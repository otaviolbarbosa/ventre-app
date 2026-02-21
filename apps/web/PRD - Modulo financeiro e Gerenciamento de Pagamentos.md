# nascere-app - PRD Módulo Financeiro

## Objetivo
Gerenciar informações financeiras e pagamentos entre profissionais de saúde e gestantes, incluindo registro de valores, formas de pagamento, parcelamentos, vencimentos e envio de notificações de lembrete. **Importante:** O sistema não processa cobranças automaticamente, apenas gerencia e rastreia informações de pagamento.

## Escopo
Este módulo permite que profissionais de saúde:
- Cadastrem valores de consultas, exames e serviços
- Registrem diferentes formas de pagamento
- Configurem parcelamentos (até 10x)
- Definam datas de vencimento
- Vinculem links de plataformas de pagamento externas
- Registrem pagamentos manualmente
- Recebam e enviem notificações de vencimento

## Stack Tecnológica

**Frontend:**
- Framework: Next.js 14+ (App Router)
- Linguagem: TypeScript
- Estilização: Tailwind CSS
- Componentes: Shadcn/ui
- Formulários: React Hook Form + Zod
- Gerenciamento de Estado: Context API / Zustand
- Datas: dayjs
- Formatação de valores: Intl.NumberFormat

**Backend:**
- Framework: Next.js API Routes
- Database: Supabase (PostgreSQL)
- Storage: Supabase Storage
- Jobs agendados: Vercel Cron Jobs ou node-cron
- Push Notifications: Web Push API (PWA)

**Ferramentas:**
- Validação: Zod
- Linting/Formatting: Biome

## Funcionalidades

### 1. Gerenciamento de Cobranças/Faturas

**Descrição:** CRUD de cobranças vinculadas a pacientes e serviços (consultas, exames, etc.)

**Páginas:**
- `/patients/[id]/billing` - Lista de Cobranças da Paciente
- `/patients/[id]/billing/new` - Criar Nova Cobrança
- `/patients/[id]/billing/[billingId]` - Detalhes da Cobrança
- `/billing` - Dashboard Financeiro Geral (todas as cobranças)

**Fluxo Principal:**
1. Profissional acessa perfil da paciente
2. Navega para seção de cobranças
3. Cria nova cobrança informando:
   - Valor total (em centavos)
   - Descrição do serviço prestado
   - Forma de pagamento
   - Parcelamento (se aplicável)
   - Intervalo entre parcelas (1, 2, 3 ou 4 meses)
   - Data de vencimento da primeira parcela
   - Links de pagamento (opcional, um por parcela)
4. Sistema calcula parcelas automaticamente baseado no intervalo
5. Sistema agenda notificações de vencimento
6. Profissional ou gestante registra pagamento manualmente
7. Sistema atualiza status da cobrança/parcelas

**Regras de Negócio:**
- Valor total é obrigatório e deve ser maior que zero
- Valores são armazenados em centavos (inteiros) no banco de dados
- Descrição é obrigatória (ex: "Acompanhamento Gestacional", "Pré-Natal Completo")
- Data de vencimento da primeira parcela é obrigatória
- Parcelamento: mínimo 1x, máximo 10x
- Intervalo entre parcelas: 1, 2, 3 ou 4 meses
- Ao parcelar, valor total é dividido igualmente entre parcelas
- Cada parcela tem vencimento baseado no intervalo escolhido
- Links de pagamento: array opcional, um link por parcela
- Status possíveis: `pendente`, `pago`, `atrasado`, `cancelado`
- Status atrasado é atribuído automaticamente após vencimento
- Cobranças são para prestação de serviços em geral
- Apenas profissional da equipe ou criador pode editar/deletar cobrança
- Gestante pode visualizar suas cobranças mas não editar
- Cada link de pagamento é opcional e deve ser URL válida

**API Endpoints:**

```typescript
// POST /api/billing
// Body: CreateBillingDTO
// Response: Billing

// GET /api/billing
// Query params: patientId?, professionalId?, status?, page=1, limit=20, sortBy=dueDate
// Response: { data: Billing[], total: number, page: number, summary: BillingSummary }

// GET /api/billing/[id]
// Response: Billing & { installments: Installment[] }

// PUT /api/billing/[id]
// Body: UpdateBillingDTO
// Response: Billing

// DELETE /api/billing/[id]
// Response: { success: boolean }

// GET /api/billing/dashboard
// Query params: startDate?, endDate?
// Response: DashboardMetrics
```

**Exemplo de Implementação (POST /api/billing):**
```typescript
// app/api/billing/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { CreateBillingSchema } from '@/lib/validations/billing';
import { calculateInstallmentAmount, calculateInstallmentDates } from '@/lib/billing/calculations';
import { scheduleBillingNotifications } from '@/lib/billing/notifications';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar dados
    const validatedData = CreateBillingSchema.parse(body);
    
    // Obter usuário autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Criar cobrança
    const { data: billing, error: billingError } = await supabase
      .from('billings')
      .insert({
        patient_id: validatedData.patientId,
        professional_id: user.id,
        description: validatedData.description,
        total_amount: validatedData.totalAmount, // Em centavos
        paid_amount: 0,
        payment_method: validatedData.paymentMethod,
        installment_count: validatedData.installments,
        installment_interval: validatedData.installmentInterval,
        payment_links: validatedData.paymentLinks || [],
        notes: validatedData.notes,
        status: 'pendente',
      })
      .select()
      .single();

    if (billingError) throw billingError;

    // Calcular valores e datas das parcelas
    const installmentAmount = calculateInstallmentAmount(
      validatedData.totalAmount,
      validatedData.installments
    );
    
    const installmentDates = calculateInstallmentDates(
      validatedData.firstDueDate,
      validatedData.installments,
      parseInt(validatedData.installmentInterval)
    );

    // Criar parcelas
    const installmentsData = installmentDates.map((dueDate, index) => ({
      billing_id: billing.id,
      installment_number: index + 1,
      amount: installmentAmount,
      due_date: dueDate,
      payment_link: validatedData.paymentLinks?.[index] || null,
      status: 'pendente',
    }));

    const { data: installments, error: installmentsError } = await supabase
      .from('installments')
      .insert(installmentsData)
      .select();

    if (installmentsError) throw installmentsError;

    // Agendar notificações
    await scheduleBillingNotifications(billing.id);

    return NextResponse.json({
      ...billing,
      installments,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating billing:', error);
    return NextResponse.json(
      { error: 'Failed to create billing' },
      { status: 500 }
    );
  }
}
```

**Schemas de Validação:**
```typescript
const PaymentMethodEnum = z.enum([
  'credito',
  'debito',
  'pix',
  'boleto',
  'dinheiro',
  'outro'
]);

const InstallmentIntervalEnum = z.enum(['1', '2', '3', '4']); // Meses

const CreateBillingSchema = z.object({
  patientId: z.string().uuid(),
  description: z.string().min(3).max(200),
  totalAmount: z.number().int().positive(), // Valor em centavos
  paymentMethod: PaymentMethodEnum,
  installments: z.number().int().min(1).max(10).default(1),
  installmentInterval: InstallmentIntervalEnum.default('1'), // Intervalo em meses
  firstDueDate: z.string().datetime(),
  paymentLinks: z.array(z.string().url()).max(10).optional(), // Array de links
  notes: z.string().max(500).optional(),
});

const UpdateBillingSchema = CreateBillingSchema.partial().omit({ 
  patientId: true,
  installments: true, // Não permitir alterar parcelamento após criação
  installmentInterval: true, // Não permitir alterar intervalo após criação
});

const RecordPaymentSchema = z.object({
  installmentId: z.string().uuid(),
  paidAt: z.string().datetime(),
  paidAmount: z.number().int().positive(), // Valor em centavos
  paymentMethod: PaymentMethodEnum,
  notes: z.string().max(500).optional(),
});
```

**Modelos de Dados:**
```typescript
interface Billing {
  id: string;
  patientId: string;
  professionalId: string; // Quem criou a cobrança
  description: string;
  totalAmount: number; // Valor em centavos (ex: R$199,99 = 19999)
  paidAmount: number; // Valor em centavos - Soma dos valores pagos
  remainingAmount: number; // Calculado: totalAmount - paidAmount (em centavos)
  paymentMethod: PaymentMethod;
  installmentCount: number;
  installmentInterval: '1' | '2' | '3' | '4'; // Intervalo em meses entre parcelas
  paymentLinks: string[]; // Array de URLs, uma por parcela (pode ter menos que installmentCount)
  notes?: string;
  status: BillingStatus; // Calculado baseado nas parcelas
  createdAt: string;
  updatedAt: string;
}

type PaymentMethod = 
  | 'credito'
  | 'debito'
  | 'pix'
  | 'boleto'
  | 'dinheiro'
  | 'outro';

type BillingStatus = 
  | 'pendente'    // Tem parcelas não pagas dentro do prazo
  | 'pago'        // Todas parcelas pagas
  | 'atrasado'    // Tem parcelas vencidas não pagas
  | 'cancelado';  // Cancelado manualmente

interface Installment {
  id: string;
  billingId: string;
  installmentNumber: number; // 1, 2, 3...
  amount: number; // Valor em centavos
  dueDate: string;
  paidAt?: string;
  paidAmount?: number; // Valor em centavos
  paymentMethod?: PaymentMethod;
  paymentLink?: string; // Link específico desta parcela
  status: InstallmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

type InstallmentStatus = 
  | 'pendente'
  | 'pago'
  | 'atrasado'
  | 'cancelado';

interface BillingSummary {
  totalBillings: number;
  totalAmount: number; // Em centavos
  paidAmount: number; // Em centavos
  pendingAmount: number; // Em centavos
  overdueAmount: number; // Em centavos
  byPaymentMethod: Record<PaymentMethod, number>;
  byStatus: Record<BillingStatus, number>;
}

interface DashboardMetrics {
  period: { startDate: string; endDate: string };
  revenue: {
    total: number; // Em centavos
    received: number; // Em centavos
    pending: number; // Em centavos
    overdue: number; // Em centavos
  };
  billings: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    cancelled: number;
  };
  recentPayments: Payment[];
  upcomingDueDates: Installment[];
  byPaymentMethod: Array<{
    method: PaymentMethod;
    count: number;
    amount: number; // Em centavos
  }>;
}
```

### 2. Gerenciamento de Parcelas

**Descrição:** Visualização e gerenciamento de parcelas vinculadas a cobrança

**Fluxo:**
1. Parcelas são criadas automaticamente ao criar cobrança
2. Sistema calcula valor e vencimento de cada parcela
3. Profissional ou gestante registra pagamento de parcela
4. Sistema atualiza status da parcela e da cobrança pai
5. Sistema cancela notificações pendentes para parcela paga

**Regras de Negócio:**
- Parcelas são criadas automaticamente baseado em `installments`
- Valor da parcela: `totalAmount / installments`
- Vencimento da parcela: `firstDueDate + (installmentNumber - 1) meses`
- Status calculado automaticamente:
  - `pendente`: antes do vencimento e não pago
  - `pago`: possui `paidAt` preenchido
  - `atrasado`: vencido e não pago (atualizado por job diário)
  - `cancelado`: cobrança pai foi cancelada
- Não permitir deletar parcelas individualmente
- Permitir registrar pagamento parcial (valor menor que o devido)
- Ao pagar todas parcelas, status da cobrança muda para `pago`

**API Endpoints:**

```typescript
// GET /api/billing/[billingId]/installments
// Response: Installment[]

// GET /api/installments
// Query params: status?, dueDateStart?, dueDateEnd?, page=1, limit=20
// Response: { data: Installment[], total: number }

// PUT /api/installments/[id]/pay
// Body: RecordPaymentSchema
// Response: Installment

// GET /api/installments/overdue
// Response: Installment[] (parcelas vencidas não pagas)

// GET /api/installments/upcoming
// Query params: days=7 (próximos N dias)
// Response: Installment[]
```

### 3. Registro de Pagamentos

**Descrição:** Registro manual de pagamentos realizados

**Fluxo:**
1. Profissional ou gestante acessa parcela pendente na página de cobrança
2. Clica em "Registrar Pagamento"
3. Preenche formulário:
   - Data do pagamento
   - Valor pago
   - Forma de pagamento utilizada
   - Observações (opcional)
4. Sistema valida dados
5. Sistema atualiza parcela e cobrança
6. Sistema envia notificação de confirmação (opcional)

**Regras de Negócio:**
- Data de pagamento não pode ser futura
- Valor pago deve ser maior que zero
- Permitir pagamento parcial (menor que valor da parcela)
- Se valor pago < valor da parcela, status permanece `pendente`
- Se valor pago >= valor da parcela, status muda para `pago`
- Armazenar histórico de pagamentos por parcela
- Profissional e gestante podem registrar pagamentos
- Enviar notificação ao outro lado após registro

**API Endpoints:**

```typescript
// POST /api/installments/[id]/payments
// Body: RecordPaymentSchema
// Response: Payment

// GET /api/installments/[id]/payments
// Response: Payment[]

// GET /api/billing/[billingId]/payments
// Response: Payment[] (todos pagamentos da cobrança)
```

**Modelo de Dados:**
```typescript
interface Payment {
  id: string;
  installmentId: string;
  paidAt: string;
  paidAmount: number; // Valor em centavos
  paymentMethod: PaymentMethod;
  registeredBy: string; // userId (professional ou patient)
  notes?: string;
  createdAt: string;
}
```

### 4. Sistema de Notificações de Vencimento

**Descrição:** Envio automático de notificações push para lembrar sobre vencimentos

**Fluxo:**
1. Ao criar cobrança com parcelas, sistema agenda notificações
2. Para cada parcela não paga, agendar:
   - Notificação 7 dias antes do vencimento
   - Notificação 3 dias antes do vencimento
   - Notificação no dia do vencimento
3. Job diário verifica notificações pendentes
4. Envia notificação push para profissional e gestante
5. Registra envio no banco de dados
6. Ao pagar parcela, cancela notificações pendentes

**Regras de Negócio:**
- Notificações são enviadas às 09:00 (horário local)
- Notificar tanto profissional quanto gestante
- Não enviar se parcela já foi paga
- Não enviar se cobrança foi cancelada
- Permitir usuário optar por não receber notificações (opt-out)
- Incluir na notificação:
  - Valor da parcela
  - Data de vencimento
  - Nome da paciente (para profissional)
  - Nome do profissional (para paciente)
  - Link direto para página da cobrança
- Fallback para email se push notification não disponível

**API Endpoints:**

```typescript
// POST /api/notifications/schedule
// Body: { billingId: string }
// Response: { scheduledCount: number }

// POST /api/notifications/send-due-reminders
// Body: { } (chamado por cron job)
// Response: { sentCount: number }

// GET /api/notifications/preferences
// Response: NotificationPreferences

// PUT /api/notifications/preferences
// Body: UpdateNotificationPreferencesDTO
// Response: NotificationPreferences

// POST /api/notifications/test
// Body: { userId: string }
// Response: { success: boolean } (envia notificação de teste)
```

**Modelo de Dados:**
```typescript
interface ScheduledNotification {
  id: string;
  installmentId: string;
  userId: string; // Destinatário (professional ou patient)
  type: NotificationType;
  scheduledFor: string;
  sentAt?: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  createdAt: string;
  updatedAt: string;
}

type NotificationType = 
  | 'due_in_7_days'
  | 'due_in_3_days'
  | 'due_today'
  | 'overdue';

interface NotificationPreferences {
  userId: string;
  enableBillingReminders: boolean;
  enablePaymentConfirmations: boolean;
  enablePushNotifications: boolean;
  enableEmailNotifications: boolean;
  reminderDaysBefore: number[]; // Ex: [7, 3, 0]
  updatedAt: string;
}

interface NotificationPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  data: {
    type: 'billing_reminder';
    billingId: string;
    installmentId: string;
    url: string;
  };
}
```

**Schemas de Validação:**
```typescript
const UpdateNotificationPreferencesSchema = z.object({
  enableBillingReminders: z.boolean().optional(),
  enablePaymentConfirmations: z.boolean().optional(),
  enablePushNotifications: z.boolean().optional(),
  enableEmailNotifications: z.boolean().optional(),
  reminderDaysBefore: z.array(z.number().int().min(0).max(30)).optional(),
});
```

### 5. Dashboard Financeiro

**Descrição:** Visão geral das finanças do profissional

**Página:**
- `/billing/dashboard`

**Componentes:**
1. **Cards de Resumo:**
   - Total a receber
   - Total recebido (período)
   - Total em atraso
   - Próximos vencimentos (7 dias)

2. **Gráficos:**
   - Receita por mês (últimos 6 meses)
   - Distribuição por forma de pagamento
   - Taxa de inadimplência

3. **Listas:**
   - Pagamentos recentes
   - Vencimentos próximos
   - Parcelas em atraso

4. **Filtros:**
   - Período (data início/fim)
   - Paciente
   - Forma de pagamento
   - Status

**Regras de Negócio:**
- Dados são calculados em tempo real
- Período padrão: mês atual
- Permitir exportar relatório (CSV/PDF)
- Atualizar automaticamente ao registrar pagamento
- Cache de 5 minutos para métricas agregadas

### 6. Integração com Plataformas de Pagamento

**Descrição:** Armazenamento de links para plataformas externas

**Funcionalidades:**
- Profissional pode cadastrar link de pagamento por cobrança
- Link pode ser de qualquer plataforma (PagSeguro, Mercado Pago, etc.)
- Gestante visualiza link clicável na cobrança
- Sistema não processa o pagamento
- Profissional deve marcar manualmente quando receber

**Regras de Negócio:**
- Link deve ser URL válida (HTTPS)
- Link é opcional
- Exibir ícone/badge indicando presença de link
- Abrir link em nova aba
- Não validar/verificar status do pagamento na plataforma externa

**Modelo de Dados:**
```typescript
interface PaymentLink {
  url: string;
  platform?: string; // Ex: "Mercado Pago", "PagSeguro"
  createdAt: string;
}

// Já incluído no modelo Billing
```

## Fluxos de Trabalho

### Fluxo 1: Criar Cobrança Única

```
1. Profissional acessa /patients/[id]/billing
2. Clica em "Nova Cobrança"
3. Preenche formulário:
   - Descrição: "Acompanhamento Pré-Natal - Dezembro"
   - Valor: R$ 300,00 (armazenado como 30000 centavos)
   - Forma de pagamento: PIX
   - Parcelas: 1
   - Intervalo: 1 mês
   - Vencimento: 15/12/2026
   - Link pagamento (parcela 1): https://mercadopago.com/...
4. Clica em "Criar"
5. Sistema cria:
   - 1 Billing (totalAmount: 30000)
   - 1 Installment (amount: 30000, vencimento: 15/12/2026, paymentLink: "https://...")
   - 3 ScheduledNotifications (7 dias antes, 3 dias antes, no dia)
6. Profissional e gestante recebem notificação de nova cobrança via Firebase
```

### Fluxo 2: Criar Cobrança Parcelada

```
1. Profissional acessa /patients/[id]/billing
2. Clica em "Nova Cobrança"
3. Preenche formulário:
   - Descrição: "Acompanhamento Gestacional Completo"
   - Valor: R$ 2.000,00 (armazenado como 200000 centavos)
   - Forma de pagamento: Cartão de Crédito
   - Parcelas: 4
   - Intervalo: 2 meses
   - Primeira parcela: 01/02/2026
   - Links de pagamento:
     * Parcela 1: https://mercadopago.com/link1
     * Parcela 2: https://mercadopago.com/link2
     * Parcela 3: (não fornecido)
     * Parcela 4: (não fornecido)
4. Sistema calcula:
   - Parcela 1: R$ 500,00 (50000 centavos) - Venc: 01/02/2026 - Link: link1
   - Parcela 2: R$ 500,00 (50000 centavos) - Venc: 01/04/2026 - Link: link2
   - Parcela 3: R$ 500,00 (50000 centavos) - Venc: 01/06/2026 - Link: null
   - Parcela 4: R$ 500,00 (50000 centavos) - Venc: 01/08/2026 - Link: null
5. Sistema cria 12 notificações (3 por parcela)
```

### Fluxo 3: Registrar Pagamento

```
1. Gestante acessa seu perfil
2. Vê notificação Firebase de vencimento próximo
3. Realiza pagamento via link externo
4. Informa profissional
5. Profissional acessa /patients/[id]/billing/[billingId]
6. Na seção de parcelas, clica em parcela pendente
7. Clica em "Registrar Pagamento"
8. Preenche:
   - Data: 01/02/2026
   - Valor: R$ 500,00 (50000 centavos)
   - Método: PIX
   - Observações: "Pago via Mercado Pago"
9. Sistema atualiza:
   - Installment.status = 'pago'
   - Installment.paid_at = '2026-02-01'
   - Installment.paid_amount = 50000
   - Billing.paid_amount += 50000
   - Cancela notificações pendentes dessa parcela no Supabase
10. Ambos recebem confirmação de pagamento via Firebase
```

### Fluxo 4: Envio de Notificações (Job Diário)

```
1. Cron job executa diariamente às 09:00
2. Busca ScheduledNotifications com:
   - status = 'pending'
   - scheduledFor <= hoje
3. Para cada notificação:
   a. Verifica se parcela ainda está pendente
   b. Verifica preferências do usuário
   c. Busca dados da cobrança e paciente
   d. Monta payload da notificação
   e. Envia via Web Push API
   f. Atualiza status para 'sent'
4. Log de notificações enviadas
```

### Fluxo 5: Atualização de Status (Job Diário)

```
1. Cron job executa diariamente às 00:00
2. Busca Installments com:
   - status = 'pendente'
   - dueDate < hoje
3. Atualiza status para 'atrasado'
4. Recalcula status das Billings pai
5. Agenda notificação de atraso (opcional)
```

## Jobs Agendados (Cron)

### 1. Envio de Notificações
```typescript
// Execução: Diariamente às 09:00
// Arquivo: /app/api/cron/send-notifications/route.ts

import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { sendPushNotification, getNotificationMessage } from '@/lib/billing/notifications';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // Verificar auth do cron (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = dayjs().startOf('day');
  
  const { data: notifications, error } = await supabase
    .from('scheduled_notifications')
    .select(`
      *,
      installments!inner (
        *,
        billings!inner (
          *,
          patients!inner (user_id)
        )
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', today.toISOString());

  if (error) {
    console.error('Error fetching notifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let sentCount = 0;

  for (const notification of notifications || []) {
    // Verificar se parcela ainda está pendente
    if (notification.installments.status !== 'pendente') {
      await supabase
        .from('scheduled_notifications')
        .update({ status: 'cancelled' })
        .eq('id', notification.id);
      continue;
    }

    // Verificar preferências do usuário
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', notification.user_id)
      .single();

    if (preferences && !preferences.enable_billing_reminders) continue;

    // Enviar notificação
    const sent = await sendPushNotification(notification);
    
    if (sent) {
      await supabase
        .from('scheduled_notifications')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', notification.id);
      sentCount++;
    } else {
      await supabase
        .from('scheduled_notifications')
        .update({ status: 'failed' })
        .eq('id', notification.id);
    }
  }

  return Response.json({ sentCount });
}
```

### 2. Atualização de Status
```typescript
// Execução: Diariamente às 00:00
// Arquivo: /app/api/cron/update-statuses/route.ts

import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { calculateBillingStatus } from '@/lib/billing/calculations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = dayjs().startOf('day');

  // Atualizar parcelas vencidas
  const { data: overdueInstallments, error: updateError } = await supabase
    .from('installments')
    .update({ status: 'atrasado' })
    .eq('status', 'pendente')
    .lt('due_date', today.toISOString())
    .select('id');

  if (updateError) {
    console.error('Error updating overdue installments:', updateError);
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  // Recalcular status das cobranças
  const { data: billings, error: billingsError } = await supabase
    .from('billings')
    .select('id, installments(*)');

  if (billingsError) {
    console.error('Error fetching billings:', billingsError);
    return Response.json({ error: billingsError.message }, { status: 500 });
  }

  let updatedBillings = 0;

  for (const billing of billings || []) {
    const newStatus = calculateBillingStatus(billing.installments);
    
    const { error: statusError } = await supabase
      .from('billings')
      .update({ status: newStatus })
      .eq('id', billing.id)
      .neq('status', newStatus);

    if (!statusError) updatedBillings++;
  }

  return Response.json({ 
    overdueInstallments: overdueInstallments?.length || 0,
    updatedBillings,
  });
}
```

### Configuração (vercel.json)
```json
{
  "crons": [
    {
      "path": "/api/cron/send-notifications",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/update-statuses",
      "schedule": "0 0 * * *"
    }
  ]
}
```

## Schema Supabase (PostgreSQL)

```sql
-- Enum types
CREATE TYPE payment_method AS ENUM ('credito', 'debito', 'pix', 'boleto', 'dinheiro', 'outro');
CREATE TYPE billing_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE installment_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE notification_type AS ENUM ('due_in_7_days', 'due_in_3_days', 'due_today', 'overdue');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'cancelled', 'failed');

-- Tabela de Cobranças
CREATE TABLE billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES auth.users(id),
  description TEXT NOT NULL,
  total_amount BIGINT NOT NULL CHECK (total_amount > 0), -- Valor em centavos
  paid_amount BIGINT NOT NULL DEFAULT 0, -- Valor em centavos
  payment_method payment_method NOT NULL,
  installment_count INTEGER NOT NULL DEFAULT 1 CHECK (installment_count >= 1 AND installment_count <= 10),
  installment_interval VARCHAR(1) NOT NULL DEFAULT '1' CHECK (installment_interval IN ('1', '2', '3', '4')), -- Meses
  payment_links TEXT[], -- Array de URLs
  notes TEXT,
  status billing_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para billings
CREATE INDEX idx_billings_patient_id ON billings(patient_id);
CREATE INDEX idx_billings_professional_id ON billings(professional_id);
CREATE INDEX idx_billings_status ON billings(status);
CREATE INDEX idx_billings_created_at ON billings(created_at);

-- Tabela de Parcelas
CREATE TABLE installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES billings(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  amount BIGINT NOT NULL CHECK (amount > 0), -- Valor em centavos
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  paid_amount BIGINT, -- Valor em centavos
  payment_method payment_method,
  payment_link TEXT, -- Link específico desta parcela
  status installment_status NOT NULL DEFAULT 'pendente',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(billing_id, installment_number)
);

-- Índices para installments
CREATE INDEX idx_installments_billing_id ON installments(billing_id);
CREATE INDEX idx_installments_status ON installments(status);
CREATE INDEX idx_installments_due_date ON installments(due_date);

-- Tabela de Pagamentos
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  paid_at TIMESTAMPTZ NOT NULL,
  paid_amount BIGINT NOT NULL CHECK (paid_amount > 0), -- Valor em centavos
  payment_method payment_method NOT NULL,
  registered_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para payments
CREATE INDEX idx_payments_installment_id ON payments(installment_id);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);

-- Tabela de Notificações Agendadas
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type notification_type NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status notification_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para scheduled_notifications
CREATE INDEX idx_scheduled_notifications_status_scheduled ON scheduled_notifications(status, scheduled_for);
CREATE INDEX idx_scheduled_notifications_user_id ON scheduled_notifications(user_id);

-- Tabela de Preferências de Notificação
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enable_billing_reminders BOOLEAN NOT NULL DEFAULT true,
  enable_payment_confirmations BOOLEAN NOT NULL DEFAULT true,
  enable_push_notifications BOOLEAN NOT NULL DEFAULT true,
  enable_email_notifications BOOLEAN NOT NULL DEFAULT true,
  reminder_days_before INTEGER[] NOT NULL DEFAULT ARRAY[7, 3, 0],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela para armazenar tokens FCM (Firebase Cloud Messaging)
CREATE TABLE fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_type VARCHAR(20), -- 'web', 'android', 'ios'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para fcm_tokens
CREATE INDEX idx_fcm_tokens_user_id ON fcm_tokens(user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_billings_updated_at BEFORE UPDATE ON billings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_installments_updated_at BEFORE UPDATE ON installments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_notifications_updated_at BEFORE UPDATE ON scheduled_notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fcm_tokens_updated_at BEFORE UPDATE ON fcm_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular remaining_amount (computed field)
CREATE OR REPLACE FUNCTION get_remaining_amount(billing_row billings)
RETURNS BIGINT AS $$
BEGIN
  RETURN billing_row.total_amount - billing_row.paid_amount;
END;
$$ LANGUAGE plpgsql STABLE;
```

## Componentes UI

### BillingCard
```typescript
interface BillingCardProps {
  billing: Billing & { installments: Installment[] };
  variant?: 'default' | 'compact';
  onViewDetails?: () => void;
  onRecordPayment?: (installmentId: string) => void;
}
```

### InstallmentList
```typescript
interface InstallmentListProps {
  installments: Installment[];
  onPayInstallment: (installment: Installment) => void;
  showBillingInfo?: boolean;
}
```

### BillingForm
```typescript
interface BillingFormProps {
  patientId: string;
  onSuccess: (billing: Billing) => void;
  onCancel: () => void;
}
```

### PaymentForm
```typescript
interface PaymentFormProps {
  installment: Installment;
  onSuccess: (payment: Payment) => void;
  onCancel: () => void;
}
```

### FinancialDashboard
```typescript
interface FinancialDashboardProps {
  professionalId: string;
  period?: { start: string; end: string };
}
```

### PaymentMethodBadge
```typescript
interface PaymentMethodBadgeProps {
  method: PaymentMethod;
  size?: 'sm' | 'md' | 'lg';
}
```

### StatusBadge
```typescript
interface StatusBadgeProps {
  status: BillingStatus | InstallmentStatus;
  size?: 'sm' | 'md' | 'lg';
}
```

## Utilidades e Helpers

```typescript
// lib/billing/calculations.ts

export function calculateInstallmentAmount(
  totalAmount: number, // Em centavos
  installmentCount: number
): number {
  // Divide e arredonda para o centavo mais próximo
  return Math.round(totalAmount / installmentCount);
}

export function calculateInstallmentDates(
  firstDueDate: string,
  installmentCount: number,
  intervalMonths: number = 1 // 1, 2, 3 ou 4 meses
): string[] {
  const dates: string[] = [];
  const baseDate = dayjs(firstDueDate);
  
  for (let i = 0; i < installmentCount; i++) {
    dates.push(baseDate.add(i * intervalMonths, 'month').toISOString());
  }
  
  return dates;
}

export function calculateBillingStatus(
  installments: Installment[]
): BillingStatus {
  const allPaid = installments.every(i => i.status === 'pago');
  const hasOverdue = installments.some(i => i.status === 'atrasado');
  const allCancelled = installments.every(i => i.status === 'cancelado');
  
  if (allCancelled) return 'cancelado';
  if (allPaid) return 'pago';
  if (hasOverdue) return 'atrasado';
  return 'pendente';
}

export function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amountInCents / 100); // Converte centavos para reais
}

export function parseCurrencyTocents(value: string): number {
  // Remove R$, espaços e pontos de milhar, substitui vírgula por ponto
  const cleanValue = value
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return Math.round(parseFloat(cleanValue) * 100);
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    credito: 'Cartão de Crédito',
    debito: 'Cartão de Débito',
    pix: 'PIX',
    boleto: 'Boleto',
    dinheiro: 'Dinheiro',
    outro: 'Outro',
  };
  return labels[method];
}

export function getNotificationMessage(
  type: NotificationType,
  installment: Installment,
  billing: Billing
): { title: string; body: string } {
  const amount = formatCurrency(installment.amount);
  const dueDate = dayjs(installment.dueDate).format('DD/MM/YYYY');
  
  const messages = {
    due_in_7_days: {
      title: 'Vencimento em 7 dias',
      body: `Parcela de ${amount} vence em ${dueDate}. ${billing.description}`,
    },
    due_in_3_days: {
      title: 'Vencimento em 3 dias',
      body: `Parcela de ${amount} vence em ${dueDate}. ${billing.description}`,
    },
    due_today: {
      title: 'Vencimento hoje',
      body: `Parcela de ${amount} vence hoje! ${billing.description}`,
    },
    overdue: {
      title: 'Pagamento em atraso',
      body: `Parcela de ${amount} venceu em ${dueDate}. ${billing.description}`,
    },
  };
  
  return messages[type];
}
```

```typescript
// lib/billing/notifications.ts
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import dayjs from 'dayjs';

// Inicializar Firebase Admin (fazer no servidor)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function scheduleBillingNotifications(
  billingId: string
): Promise<number> {
  const { data: billing, error } = await supabase
    .from('billings')
    .select(`
      *,
      installments (*),
      patients!inner (user_id),
      professionals:auth.users!professional_id (id)
    `)
    .eq('id', billingId)
    .single();

  if (error || !billing) throw new Error('Billing not found');

  const notifications: any[] = [];
  
  // Para cada parcela, criar 3 notificações
  for (const installment of billing.installments) {
    const dueDate = dayjs(installment.due_date);
    
    // Notificação 7 dias antes - Paciente
    notifications.push({
      installment_id: installment.id,
      user_id: billing.patients.user_id,
      type: 'due_in_7_days',
      scheduled_for: dueDate.subtract(7, 'days').toISOString(),
      status: 'pending',
    });
    
    // Notificação 7 dias antes - Profissional
    notifications.push({
      installment_id: installment.id,
      user_id: billing.professional_id,
      type: 'due_in_7_days',
      scheduled_for: dueDate.subtract(7, 'days').toISOString(),
      status: 'pending',
    });
    
    // Notificação 3 dias antes - Paciente
    notifications.push({
      installment_id: installment.id,
      user_id: billing.patients.user_id,
      type: 'due_in_3_days',
      scheduled_for: dueDate.subtract(3, 'days').toISOString(),
      status: 'pending',
    });
    
    // Notificação 3 dias antes - Profissional
    notifications.push({
      installment_id: installment.id,
      user_id: billing.professional_id,
      type: 'due_in_3_days',
      scheduled_for: dueDate.subtract(3, 'days').toISOString(),
      status: 'pending',
    });
    
    // Notificação no dia - Paciente
    notifications.push({
      installment_id: installment.id,
      user_id: billing.patients.user_id,
      type: 'due_today',
      scheduled_for: dueDate.toISOString(),
      status: 'pending',
    });
    
    // Notificação no dia - Profissional
    notifications.push({
      installment_id: installment.id,
      user_id: billing.professional_id,
      type: 'due_today',
      scheduled_for: dueDate.toISOString(),
      status: 'pending',
    });
  }

  const { error: insertError } = await supabase
    .from('scheduled_notifications')
    .insert(notifications);

  if (insertError) throw insertError;

  return notifications.length;
}

export async function cancelInstallmentNotifications(
  installmentId: string
): Promise<void> {
  await supabase
    .from('scheduled_notifications')
    .update({ status: 'cancelled' })
    .eq('installment_id', installmentId)
    .eq('status', 'pending');
}

export async function sendPushNotification(
  notification: any
): Promise<boolean> {
  const { installment } = notification;
  const { billing } = installment;
  
  const message = getNotificationMessage(
    notification.type,
    installment,
    billing
  );

  try {
    // Buscar tokens FCM do usuário
    const { data: tokens } = await supabase
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', notification.user_id);

    if (!tokens || tokens.length === 0) {
      console.log('No FCM tokens found for user:', notification.user_id);
      return false;
    }

    // Preparar mensagem Firebase
    const fcmMessage = {
      notification: {
        title: message.title,
        body: message.body,
      },
      data: {
        type: 'billing_reminder',
        billingId: billing.id,
        installmentId: installment.id,
        url: `/patients/${billing.patient_id}/billing/${billing.id}`,
      },
      tokens: tokens.map(t => t.token),
    };

    // Enviar notificação via Firebase
    const response = await admin.messaging().sendMulticast(fcmMessage);

    // Remover tokens inválidos
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx].token);
        }
      });

      if (failedTokens.length > 0) {
        await supabase
          .from('fcm_tokens')
          .delete()
          .in('token', failedTokens);
      }
    }

    return response.successCount > 0;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

export async function getUserFCMTokens(userId: string): Promise<string[]> {
  const { data: tokens } = await supabase
    .from('fcm_tokens')
    .select('token')
    .eq('user_id', userId);

  return tokens?.map(t => t.token) || [];
}

export async function saveFCMToken(
  userId: string,
  token: string,
  deviceType: 'web' | 'android' | 'ios' = 'web'
): Promise<void> {
  await supabase
    .from('fcm_tokens')
    .upsert({
      user_id: userId,
      token,
      device_type: deviceType,
    }, {
      onConflict: 'token',
    });
}

export async function removeFCMToken(token: string): Promise<void> {
  await supabase
    .from('fcm_tokens')
    .delete()
    .eq('token', token);
}
```

## Firebase Cloud Messaging (Push Notifications)

### Configuração Firebase

**firebase-config.ts**
```typescript
// lib/firebase/config.ts
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicializar Firebase apenas uma vez
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export { app };

// Função para verificar suporte e obter messaging
export async function getMessagingInstance() {
  const supported = await isSupported();
  if (!supported) return null;
  
  return getMessaging(app);
}
```

### Service Worker (Firebase)

**public/firebase-messaging-sw.js**
```javascript
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Nova Notificação';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: payload.data,
    actions: [
      { action: 'view', title: 'Ver Detalhes' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    const url = event.notification.data?.url || '/billing';
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});
```

### Cliente React (Firebase)

**hooks/useFirebaseNotifications.ts**
```typescript
// hooks/useFirebaseNotifications.ts
import { useState, useEffect } from 'react';
import { getMessagingInstance } from '@/lib/firebase/config';
import { getToken, onMessage } from 'firebase/messaging';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useFirebaseNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  useEffect(() => {
    checkSupport();
  }, []);

  async function checkSupport() {
    const messaging = await getMessagingInstance();
    setIsSupported(!!messaging);
    
    if (messaging) {
      await checkSubscription();
    }
  }

  async function checkSubscription() {
    try {
      const messaging = await getMessagingInstance();
      if (!messaging) return;

      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      });

      if (token) {
        setCurrentToken(token);
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  }

  async function subscribe(userId: string) {
    if (!isSupported) {
      console.error('Firebase Messaging is not supported');
      return;
    }

    try {
      const messaging = await getMessagingInstance();
      if (!messaging) throw new Error('Messaging not available');

      // Solicitar permissão
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Obter token FCM
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      });

      if (!token) {
        throw new Error('No FCM token received');
      }

      // Salvar token no Supabase
      const { error } = await supabase
        .from('fcm_tokens')
        .upsert({
          user_id: userId,
          token,
          device_type: 'web',
        }, {
          onConflict: 'token',
        });

      if (error) throw error;

      setCurrentToken(token);
      setIsSubscribed(true);

      // Listener para mensagens em foreground
      onMessage(messaging, (payload) => {
        console.log('Message received in foreground:', payload);
        
        // Mostrar notificação customizada
        if (payload.notification) {
          new Notification(payload.notification.title || 'Nova Notificação', {
            body: payload.notification.body,
            icon: '/icon-192x192.png',
          });
        }
      });

      console.log('Successfully subscribed to notifications');
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
    }
  }

  async function unsubscribe() {
    if (!currentToken) return;

    try {
      // Remover do Supabase
      const { error } = await supabase
        .from('fcm_tokens')
        .delete()
        .eq('token', currentToken);

      if (error) throw error;

      setCurrentToken(null);
      setIsSubscribed(false);

      console.log('Successfully unsubscribed from notifications');
    } catch (error) {
      console.error('Error unsubscribing from notifications:', error);
    }
  }

  return { 
    isSupported, 
    isSubscribed, 
    currentToken,
    subscribe, 
    unsubscribe 
  };
}
```

## Permissões e Segurança

### Regras de Acesso (RLS - Row Level Security)

```sql
-- Billings: Profissional da equipe ou paciente podem ver
CREATE POLICY "Billings viewable by team or patient"
  ON billings FOR SELECT
  USING (
    professional_id = auth.uid() OR
    patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    ) OR
    patient_id IN (
      SELECT patient_id FROM team_members 
      WHERE professional_id = auth.uid()
    )
  );

-- Billings: Apenas profissional criador pode editar
CREATE POLICY "Billings editable by creator"
  ON billings FOR UPDATE
  USING (professional_id = auth.uid());

-- Payments: Profissional ou paciente podem registrar
CREATE POLICY "Payments creatable by professional or patient"
  ON payments FOR INSERT
  WITH CHECK (
    registered_by = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM installments i
        JOIN billings b ON i.billing_id = b.id
        WHERE i.id = installment_id
        AND (
          b.professional_id = auth.uid() OR
          b.patient_id IN (
            SELECT id FROM patients WHERE user_id = auth.uid()
          )
        )
      )
    )
  );

-- Notifications: Apenas destinatário pode ver
CREATE POLICY "Notifications viewable by recipient"
  ON scheduled_notifications FOR SELECT
  USING (user_id = auth.uid());
```

### Validações de Autorização

```typescript
// lib/auth/billing.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function canAccessBilling(
  userId: string,
  billingId: string
): Promise<boolean> {
  const { data: billing, error } = await supabase
    .from('billings')
    .select(`
      *,
      patients!inner (user_id)
    `)
    .eq('id', billingId)
    .single();

  if (error || !billing) return false;

  // Profissional criador
  if (billing.professional_id === userId) return true;

  // Paciente
  if (billing.patients.user_id === userId) return true;

  // Membro da equipe
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('patient_id', billing.patient_id)
    .eq('professional_id', userId)
    .single();

  return !!teamMember;
}

export async function canEditBilling(
  userId: string,
  billingId: string
): Promise<boolean> {
  const { data: billing } = await supabase
    .from('billings')
    .select('professional_id')
    .eq('id', billingId)
    .single();

  return billing?.professional_id === userId;
}

export async function canRecordPayment(
  userId: string,
  installmentId: string
): Promise<boolean> {
  const { data: installment, error } = await supabase
    .from('installments')
    .select(`
      *,
      billings!inner (
        professional_id,
        patients!inner (user_id)
      )
    `)
    .eq('id', installmentId)
    .single();

  if (error || !installment) return false;

  const billing = installment.billings;

  // Profissional ou paciente
  return (
    billing.professional_id === userId ||
    billing.patients.user_id === userId
  );
}
```

## Testes

### Testes Unitários

```typescript
// __tests__/lib/billing/calculations.test.ts

import {
  calculateInstallmentAmount,
  calculateInstallmentDates,
  calculateBillingStatus,
  formatCurrency,
  parseCurrencyToCents,
} from '@/lib/billing/calculations';

describe('Billing Calculations', () => {
  describe('calculateInstallmentAmount', () => {
    it('should divide total amount equally in cents', () => {
      expect(calculateInstallmentAmount(100000, 4)).toBe(25000); // R$1000/4 = R$250
    });

    it('should round to nearest cent', () => {
      expect(calculateInstallmentAmount(10000, 3)).toBe(3333); // R$100/3 = R$33.33
    });
  });

  describe('calculateInstallmentDates', () => {
    it('should create monthly dates with 1 month interval', () => {
      const dates = calculateInstallmentDates('2026-01-01', 3, 1);
      expect(dates).toHaveLength(3);
      expect(dates[0]).toContain('2026-01-01');
      expect(dates[1]).toContain('2026-02-01');
      expect(dates[2]).toContain('2026-03-01');
    });

    it('should create dates with 2 month interval', () => {
      const dates = calculateInstallmentDates('2026-01-01', 3, 2);
      expect(dates).toHaveLength(3);
      expect(dates[0]).toContain('2026-01-01');
      expect(dates[1]).toContain('2026-03-01');
      expect(dates[2]).toContain('2026-05-01');
    });

    it('should create dates with 4 month interval', () => {
      const dates = calculateInstallmentDates('2026-01-01', 3, 4);
      expect(dates).toHaveLength(3);
      expect(dates[0]).toContain('2026-01-01');
      expect(dates[1]).toContain('2026-05-01');
      expect(dates[2]).toContain('2026-09-01');
    });
  });

  describe('formatCurrency', () => {
    it('should format cents to BRL currency', () => {
      expect(formatCurrency(19999)).toBe('R$ 199,99');
      expect(formatCurrency(100000)).toBe('R$ 1.000,00');
    });
  });

  describe('parseCurrencyToCents', () => {
    it('should parse currency string to cents', () => {
      expect(parseCurrencyToCents('R$ 199,99')).toBe(19999);
      expect(parseCurrencyToCents('R$ 1.000,00')).toBe(100000);
      expect(parseCurrencyToCents('1000')).toBe(100000);
    });
  });

  describe('calculateBillingStatus', () => {
    it('should return PAGO when all installments paid', () => {
      const installments = [
        { status: 'pago' },
        { status: 'pago' },
      ];
      expect(calculateBillingStatus(installments)).toBe('pago');
    });

    it('should return ATRASADO when has overdue', () => {
      const installments = [
        { status: 'pago' },
        { status: 'atrasado' },
      ];
      expect(calculateBillingStatus(installments)).toBe('atrasado');
    });
  });
});
```

### Testes de Integração

```typescript
// __tests__/api/billing.test.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('POST /api/billing', () => {
  it('should create billing with installments and payment links', async () => {
    const billingData = {
      patientId: 'patient-123',
      description: 'Acompanhamento Gestacional',
      totalAmount: 200000, // R$ 2.000,00 em centavos
      paymentMethod: 'credito',
      installments: 4,
      installmentInterval: '2', // 2 meses
      firstDueDate: '2026-01-01',
      paymentLinks: [
        'https://mercadopago.com/link1',
        'https://mercadopago.com/link2',
      ],
    };

    const { data, error } = await supabase
      .from('billings')
      .insert(billingData)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.total_amount).toBe(200000);
    expect(data.payment_links).toHaveLength(2);

    // Verificar parcelas criadas
    const { data: installments } = await supabase
      .from('installments')
      .select('*')
      .eq('billing_id', data.id)
      .order('installment_number');

    expect(installments).toHaveLength(4);
    expect(installments![0].amount).toBe(50000); // R$ 500,00
    expect(installments![0].payment_link).toBe('https://mercadopago.com/link1');
    expect(installments![1].payment_link).toBe('https://mercadopago.com/link2');
    expect(installments![2].payment_link).toBeNull();
  });

  it('should schedule notifications for all installments', async () => {
    // ... test notification scheduling
  });
});
```

## Monitoramento e Logs

### Métricas a Trackear

```typescript
// lib/analytics/billing.ts

export const billingEvents = {
  BILLING_CREATED: 'billing_created',
  BILLING_UPDATED: 'billing_updated',
  BILLING_CANCELLED: 'billing_cancelled',
  PAYMENT_RECORDED: 'payment_recorded',
  NOTIFICATION_SENT: 'notification_sent',
  NOTIFICATION_CLICKED: 'notification_clicked',
  DASHBOARD_VIEWED: 'billing_dashboard_viewed',
  PAYMENT_LINK_CLICKED: 'payment_link_clicked',
} as const;

export function trackBillingEvent(
  event: keyof typeof billingEvents,
  properties?: Record<string, any>
) {
  // Google Analytics 4 ou Posthog
  if (typeof window !== 'undefined') {
    window.gtag?.('event', billingEvents[event], properties);
  }
}
```

### Logging

```typescript
// lib/logging/billing.ts

export const billingLogger = {
  info: (message: string, data?: any) => {
    console.log(`[BILLING] ${message}`, data);
  },
  
  error: (message: string, error: Error, data?: any) => {
    console.error(`[BILLING ERROR] ${message}`, { error, ...data });
    // Enviar para Sentry se configurado
  },
  
  payment: (installmentId: string, amount: number, userId: string) => {
    console.log(`[PAYMENT] Recorded`, {
      installmentId,
      amount,
      userId,
      timestamp: new Date().toISOString(),
    });
  },
  
  notification: (notificationId: string, userId: string, success: boolean) => {
    console.log(`[NOTIFICATION] ${success ? 'Sent' : 'Failed'}`, {
      notificationId,
      userId,
      timestamp: new Date().toISOString(),
    });
  },
};
```

## Roadmap Futuro

### Fase 2 (Futuro)
- Integração real com gateways de pagamento (Stripe, Mercado Pago)
- Geração automática de boletos
- Reconciliação automática de pagamentos
- Emissão de recibos/notas fiscais
- Relatórios financeiros avançados (DRE, fluxo de caixa)
- Exportação para sistemas contábeis
- Suporte a múltiplas moedas
- Programa de fidelidade/descontos
- Split de pagamentos entre equipe
- Análise preditiva de inadimplência

## Critérios de Aceite

**Gerenciamento de Cobranças:**
- [ ] Profissional consegue criar cobrança única
- [ ] Profissional consegue criar cobrança parcelada (até 10x)
- [ ] Sistema aceita intervalo de parcelas: 1, 2, 3 ou 4 meses
- [ ] Sistema calcula valor das parcelas automaticamente em centavos
- [ ] Sistema calcula datas de vencimento baseado no intervalo escolhido
- [ ] Profissional pode adicionar múltiplos links de pagamento (array)
- [ ] Links de pagamento são opcionais e associados a parcelas específicas
- [ ] Valores são armazenados em centavos no banco (ex: R$199,99 = 19999)
- [ ] Valores são exibidos formatados em R$ na interface
- [ ] Validações de formulário funcionam (Zod + React Hook Form)
- [ ] Gestante visualiza suas cobranças
- [ ] Gestante NÃO pode editar/deletar cobranças
- [ ] Cobranças não são vinculadas a consultas ou exames específicos

**Gerenciamento de Parcelas:**
- [ ] Parcelas são criadas automaticamente ao criar cobrança
- [ ] Cada parcela tem valor correto em centavos
- [ ] Vencimento calculado com base no intervalo (1-4 meses)
- [ ] Link de pagamento associado corretamente a cada parcela
- [ ] Status das parcelas atualiza corretamente
- [ ] Não é possível deletar parcelas individualmente
- [ ] Parcelas são exibidas na página de detalhes da cobrança

**Registro de Pagamentos:**
- [ ] Profissional consegue registrar pagamento de parcela
- [ ] Gestante consegue registrar pagamento de parcela
- [ ] Sistema aceita pagamento parcial
- [ ] Valores de pagamento são em centavos
- [ ] Sistema atualiza status da parcela ao pagar
- [ ] Sistema atualiza status da cobrança ao pagar todas parcelas
- [ ] Histórico de pagamentos é mantido
- [ ] Validação de dados de pagamento funciona

**Sistema de Notificações:**
- [ ] Notificações são agendadas ao criar cobrança no Supabase
- [ ] 3 notificações por parcela (7 dias, 3 dias, no dia)
- [ ] Cron job executa diariamente às 09:00
- [ ] Notificações são enviadas para profissional e gestante
- [ ] Push notifications funcionam via Firebase Cloud Messaging
- [ ] Tokens FCM são salvos no Supabase
- [ ] Notificações canceladas ao pagar parcela
- [ ] Preferências de notificação podem ser configuradas
- [ ] Usuário pode optar por não receber notificações
- [ ] Service Worker Firebase configurado corretamente
- [ ] Notificações em background funcionam
- [ ] Notificações em foreground funcionam

**Atualização de Status:**
- [ ] Cron job executa diariamente às 00:00
- [ ] Parcelas vencidas mudam para "atrasado" via Supabase
- [ ] Status da cobrança recalculado corretamente
- [ ] Status reflete situação real das parcelas

**Dashboard Financeiro:**
- [ ] Dashboard exibe métricas corretas em centavos
- [ ] Valores formatados corretamente em R$
- [ ] Gráficos renderizam corretamente
- [ ] Filtros funcionam
- [ ] Dados atualizam em tempo real
- [ ] Performance adequada (cache de 5min)

**UI/UX:**
- [ ] Formulários validam corretamente
- [ ] Input de moeda formata automaticamente (R$)
- [ ] Campo de intervalo de parcelas tem opções: 1, 2, 3, 4 meses
- [ ] Campos para múltiplos links de pagamento funcionam
- [ ] Loading states implementados
- [ ] Error states implementados
- [ ] Toasts de feedback funcionam
- [ ] Design responsivo
- [ ] Badges de status corretos
- [ ] Formatação de moeda brasileira (R$)
- [ ] Formatação de datas locale pt-BR

**Integração Supabase:**
- [ ] Conexão com Supabase funciona
- [ ] RLS (Row Level Security) configurado
- [ ] Apenas usuários autorizados acessam cobranças
- [ ] Apenas criador pode editar/deletar cobrança
- [ ] Queries otimizadas com índices
- [ ] Triggers de updated_at funcionam
- [ ] Enums PostgreSQL criados corretamente

**Integração Firebase:**
- [ ] Firebase Admin SDK configurado (server-side)
- [ ] Firebase Client SDK configurado (client-side)
- [ ] Service Worker registrado corretamente
- [ ] Tokens FCM gerados e salvos
- [ ] Notificações enviadas com sucesso
- [ ] Tokens inválidos são removidos automaticamente
- [ ] VAPID key configurada

**Segurança:**
- [ ] Validação server-side em todas rotas
- [ ] Rate limiting configurado
- [ ] Variáveis de ambiente protegidas
- [ ] Private keys não expostas no client

**Performance:**
- [ ] API routes Supabase respondem em <500ms
- [ ] Dashboard carrega em <2s
- [ ] Notificações processam em <5min
- [ ] Queries com índices apropriados

**Integrações:**
- [ ] Links de pagamento abrem corretamente
- [ ] Cron jobs configurados no Vercel
- [ ] Firebase Cloud Messaging integrado
- [ ] Supabase Realtime funciona (opcional)

## Variáveis de Ambiente Adicionais

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Firebase (Push Notifications)
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_VAPID_KEY="..."

# Firebase Admin SDK (Server-side)
FIREBASE_PROJECT_ID="..."
FIREBASE_CLIENT_EMAIL="..."
FIREBASE_PRIVATE_KEY="..." # Atenção: deve incluir \n para quebras de linha

# Cron Secret (Vercel)
CRON_SECRET="..."

# Email (opcional, para fallback)
SMTP_HOST="..."
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASSWORD="..."
SMTP_FROM="noreply@nascere.app"
```

## Estrutura de Diretórios Atualizada

```
/
├── app/
│   ├── (dashboard)/
│   │   ├── patients/[id]/billing/
│   │   │   ├── page.tsx (lista de cobranças)
│   │   │   ├── new/page.tsx (criar cobrança)
│   │   │   └── [billingId]/
│   │   │       └── page.tsx (detalhes da cobrança + parcelas)
│   │   └── billing/
│   │       └── page.tsx (dashboard financeiro geral)
│   ├── api/
│   │   ├── billing/
│   │   │   ├── route.ts (GET, POST)
│   │   │   ├── [id]/route.ts (GET, PUT, DELETE)
│   │   │   └── dashboard/route.ts (GET métricas)
│   │   ├── installments/
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts (GET)
│   │   │   │   ├── pay/route.ts (POST registrar pagamento)
│   │   │   │   └── payments/route.ts (GET histórico)
│   │   │   ├── overdue/route.ts (GET parcelas atrasadas)
│   │   │   └── upcoming/route.ts (GET próximos vencimentos)
│   │   ├── notifications/
│   │   │   ├── subscribe/route.ts (POST salvar token FCM)
│   │   │   ├── unsubscribe/route.ts (POST remover token FCM)
│   │   │   ├── preferences/route.ts (GET, PUT)
│   │   │   ├── schedule/route.ts (POST agendar notificações)
│   │   │   └── test/route.ts (POST enviar teste)
│   │   └── cron/
│   │       ├── send-notifications/route.ts
│   │       └── update-statuses/route.ts
├── components/
│   ├── billing/
│   │   ├── BillingCard.tsx
│   │   ├── BillingForm.tsx (com campo para links array)
│   │   ├── BillingList.tsx
│   │   ├── InstallmentList.tsx (usado na página de detalhes)
│   │   ├── PaymentForm.tsx
│   │   ├── PaymentMethodBadge.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── CurrencyInput.tsx (input formatado R$)
│   │   └── FinancialDashboard.tsx
├── lib/
│   ├── billing/
│   │   ├── calculations.ts
│   │   ├── notifications.ts
│   │   └── validations.ts
│   ├── firebase/
│   │   └── config.ts
│   ├── supabase/
│   │   └── client.ts
│   ├── auth/
│   │   └── billing.ts
│   ├── analytics/
│   │   └── billing.ts
│   └── logging/
│       └── billing.ts
├── hooks/
│   ├── useBilling.ts
│   ├── useInstallments.ts
│   ├── useFirebaseNotifications.ts
│   └── useSupabase.ts
├── public/
│   ├── firebase-messaging-sw.js
│   ├── manifest.json
│   └── icons/
├── types/
│   └── billing.ts
└── vercel.json (configuração de cron jobs)
```

---

**Versão:** 1.0  
**Data:** Fevereiro 2026  
**Autor:** Equipe nascere-app
