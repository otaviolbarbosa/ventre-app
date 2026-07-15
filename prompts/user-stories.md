# User Stories — Ventre (Nascere)

> Documento vivo que consolida todas as user stories identificáveis a partir do código-fonte atual (`apps/web`) e dos PRDs em `prompts/`. Deve ser atualizado sempre que novas funcionalidades forem implementadas ou planejadas.

## Personas

| Persona | Descrição |
|---|---|
| **Profissional autônoma** | Profissional do parto (doula, médica obstetra, enfermeira obstétrica etc.) sem vínculo com nenhuma empresa/organização. |
| **Profissional vinculada** | Profissional associada a uma ou mais empresas (`user_enterprises`), podendo atuar como titular ou backup no time de cuidado. |
| **Staff — Secretária** | Membro da equipe administrativa de uma empresa, com acesso operacional (agenda, pacientes, cobranças). |
| **Staff — Gestora/Owner** | Responsável pela empresa; além do acesso operacional, configura equipe, cobranças, contratos e taxas. |
| **Gestante/Paciente** | Beneficiária do cuidado. Hoje é majoritariamente um registro gerenciado pela equipe (não possui portal próprio ativo, embora `user_type = 'patient'` já exista no modelo de dados para uso futuro). |
| **Sistema** | Processos automáticos (jobs agendados, webhooks, integrações externas). |

---

## 1. Autenticação e Onboarding

- Como **visitante**, quero criar uma conta com e-mail e senha, para começar a usar a plataforma.
- Como **usuária**, quero recuperar minha senha via "esqueci minha senha", para reobter acesso à minha conta.
- Como **usuária recém-cadastrada**, quero escolher se sou profissional ou membro de staff (tela de seleção de tipo), para que o sistema personalize minha experiência.
- Como **profissional recém-cadastrada**, quero definir minha especialidade/tipo profissional, para que meus dados apareçam corretamente em contratos e listagens.
- Como **gestora**, quero convidar uma nova profissional por e-mail informando nome, telefone e tipo profissional, para que ela complete o próprio cadastro.
- Como **profissional convidada**, quero acessar um link único (`/complete-registration?riid=...`) e completar meu cadastro em etapas (senha → foto e confirmação de dados → confirmação final), para ingressar na empresa que me convidou.
- Como **sistema**, quero expirar convites de registro não utilizados após um prazo, para manter a segurança dos convites.
- Como **usuária**, quero passar por um onboarding guiado no primeiro acesso, para entender rapidamente como usar o app.

## 2. Assinatura e Pagamento da Plataforma

- Como **profissional**, quero visualizar os planos disponíveis e fazer a assinatura de um plano (via Stripe Checkout), para liberar o uso completo da plataforma.
- Como **profissional**, quero ver a confirmação de pagamento após finalizar a assinatura, para ter certeza de que a transação foi concluída.
- Como **profissional**, quero visualizar os detalhes da minha assinatura atual (plano, status, próxima cobrança), para acompanhar meu contrato com a plataforma.
- Como **profissional**, quero cancelar minha assinatura quando desejar, para não ser cobrada em ciclos futuros.
- Como **sistema**, quero bloquear a profissional através de um paywall quando sua assinatura estiver inativa/vencida, para que a plataforma proteja o acesso a funcionalidades pagas.

## 3. Perfil e Configurações Pessoais

- Como **usuária**, quero editar meus dados pessoais (nome, telefone, foto de perfil), para manter meu cadastro atualizado.
- Como **usuária**, quero preencher meu endereço com busca automática por CEP, para agilizar o cadastro sem erros de digitação.
- Como **profissional**, quero acessar uma área de configurações pessoais separada das configurações da empresa, para gerenciar preferências que dizem respeito só a mim (ex: contrato pessoal, notificações).
- Como **usuária**, quero configurar minhas preferências de notificação (quais tipos de evento me notificam e por qual canal), para não ser incomodada com alertas irrelevantes.

## 4. Gestantes/Pacientes — Cadastro e Ciclo de Cuidado

- Como **profissional**, quero cadastrar uma nova gestante com seus dados pessoais e da gestação, para iniciar o acompanhamento pré-natal.
- Como **profissional**, quero editar os dados de uma gestante já cadastrada, para manter as informações corretas ao longo do acompanhamento.
- Como **profissional**, quero listar e buscar minhas gestantes com filtros, para encontrar rapidamente quem preciso atender.
- Como **profissional**, quero visualizar um histórico de gestantes já atendidas (finalizadas), separado da lista ativa, para não poluir minha visão do dia a dia.
- Como **profissional**, quero marcar o cuidado de uma gestante como finalizado (parto realizado/encerramento), para que ela saia da lista ativa e entre no histórico.
- Como **profissional**, quero excluir o registro de uma gestação quando cadastrada por engano, para manter a base de dados limpa.
- Como **staff de empresa**, quero visualizar todas as gestantes da organização, para ter visão consolidada do atendimento.
- Como **staff/gestora**, quero ver a distribuição de gestantes por profissional (gráfico), para entender a carga de trabalho de cada uma.
- Como **gestante**, quero que meus dados de contato e data provável de parto estejam sempre corretos no sistema, para que a equipe de cuidado consiga se comunicar comigo e planejar o parto.

## 5. Prontuário Pré-natal (Ficha Clínica)

- Como **profissional**, quero registrar evoluções da gestação (consultas, observações clínicas) ao longo do pré-natal, para manter um histórico clínico completo.
- Como **profissional**, quero editar ou excluir uma evolução registrada por engano, para manter o prontuário preciso.
- Como **profissional**, quero visualizar o cartão da gestante (prenatal card) com o resumo de todo o acompanhamento, para ter uma visão rápida da linha do tempo clínica.
- Como **profissional**, quero registrar e atualizar o histórico obstétrico da gestante (gestações anteriores, partos, abortos etc.), para embasar decisões clínicas.
- Como **profissional**, quero registrar fatores de risco da gestação, para sinalizar cuidados especiais necessários.
- Como **profissional**, quero registrar as vacinas administradas durante a gestação, para acompanhar a cobertura vacinal.
- Como **profissional**, quero registrar exames laboratoriais (com valores, datas, referências), para acompanhar a evolução dos indicadores da gestante.
- Como **profissional**, quero registrar outros exames não laboratoriais (ex: exames de imagem, testes específicos), para manter o prontuário completo.
- Como **profissional**, quero registrar ultrassonografias com seus achados, para acompanhar o desenvolvimento fetal.
- Como **profissional**, quero editar ou excluir exames/ultrassons cadastrados incorretamente, para manter a integridade do prontuário.
- Como **profissional**, quero visualizar o gráfico de ganho de peso gestacional da paciente comparado às curvas de referência (CONMAI/IOM), para identificar ganho de peso inadequado precocemente.
- Como **profissional**, quero visualizar o gráfico de altura uterina por semana gestacional comparado à curva INTERGROWTH-21st, para identificar desvios de crescimento fetal.
- Como **profissional**, quero anexar e consultar documentos da gestante (exames digitalizados, contratos, laudos), para centralizar toda a documentação em um só lugar.
- Como **profissional**, quero baixar um documento específico da gestante com segurança (URL assinada), para compartilhar ou revisar informações sem expor arquivos publicamente.
- Como **profissional**, quero excluir um documento anexado por engano, para manter a pasta da paciente organizada.

## 6. Equipe de Cuidado (Time por Paciente)

- Como **profissional**, quero montar o time de cuidado de uma gestante, adicionando profissionais titulares e backups, para garantir cobertura em caso de indisponibilidade.
- Como **profissional**, quero convidar diretamente outra profissional (já cadastrada) para o time de uma paciente, para agilizar a formação do time sem depender de convite por e-mail.
- Como **profissional convidada**, quero aceitar ou recusar um convite para integrar o time de cuidado de uma paciente, para decidir conscientemente minha participação.
- Como **profissional**, quero visualizar convites pendentes (enviados e recebidos), para acompanhar o status das formações de time.
- Como **profissional**, quero adicionar ou remover uma backup específica de uma titular, para cobrir ausências pontuais (plantão, férias).
- Como **profissional**, quero sair do time de cuidado de uma paciente, para me desvincular quando não farei mais parte do atendimento.
- Como **profissional**, quero buscar outras profissionais cadastradas por nome/especialidade, para convidá-las para um time.
- Como **staff de empresa**, quero visualizar o time de cuidado de qualquer gestante da organização, para monitorar a cobertura assistencial.

## 7. Empresas / Organizações (Multi-tenant)

- Como **profissional autônoma**, quero solicitar vínculo com uma empresa existente, para passar a atuar sob aquela organização.
- Como **gestora**, quero aprovar (ou recusar) solicitações de profissionais que desejam se juntar à minha empresa, para controlar quem integra minha equipe.
- Como **profissional**, quero estar vinculada a mais de uma empresa simultaneamente, mantendo cobranças, agendamentos e gestações isolados por empresa, para atuar em múltiplas organizações sem misturar dados.
- Como **profissional multi-empresa**, quero decidir a qual empresa (ou nenhuma, atuando autonomamente) associar cada nova gestante que atendo, para que a gestação seja corretamente isolada por organização.
- Como **staff**, quero que uma gestação criada por mim seja automaticamente associada à minha empresa, para não precisar de um passo manual extra.
- Como **gestora**, quero que uma gestora de uma empresa não veja cobranças/agendamentos de uma profissional referentes a outra empresa, para preservar a privacidade e a integridade financeira entre organizações.
- Como **profissional**, quero ser identificada como "externa" no time de uma gestação vinculada a uma empresa da qual não faço parte, para que fique clara minha relação com aquela organização.
- Como **gestora/staff**, quero adicionar ou remover profissionais do quadro da minha empresa, para manter a equipe atualizada.
- Como **staff (manager/secretária)**, quero uma home dedicada com cards de navegação rápida e visão consolidada da organização (em vez de replicar a home da profissional individual), para navegar mais eficientemente pelas funções gerenciais.
- Como **staff**, quero que além do menu lateral na home da empresa, também existam cards de ação, para uma navegação mais direta às funções mais usadas.
- Como **staff/gestora**, quero visualizar a coluna de agenda/timeline ao lado da home, para acompanhar os compromissos do dia sem trocar de tela.

## 8. Agendamentos / Agenda

- Como **profissional**, quero criar um agendamento (consulta, encontro) vinculado a uma gestante, para organizar minha agenda de atendimentos.
- Como **profissional**, quero editar um agendamento (data, horário, tipo, local, observações), para refletir mudanças de última hora.
- Como **profissional**, quero cancelar um agendamento específico, para liberar o horário quando necessário.
- Como **profissional**, quero cancelar todos os agendamentos de um dia de uma vez, para lidar rapidamente com imprevistos que afetam a agenda inteira (ex: emergência pessoal ou atendimento a um parto).
- Como **profissional**, quero visualizar meus agendamentos por gestante e de forma consolidada, para ter controle total da minha agenda.
- Como **profissional**, quero conectar minha Google Agenda de forma opt-in, para que agendamentos criados no Ventres sejam sincronizados automaticamente com meu calendário pessoal.
- Como **profissional conectada ao Google**, quero que a criação, edição e cancelamento de um agendamento no Ventre reflitam automaticamente no evento correspondente do Google Calendar, para não precisar duplicar o trabalho de agendar em dois lugares.
- Como **profissional**, quero desconectar minha conta do Google Agenda quando quiser, para interromper a sincronização automática.
- Como **sistema**, quero renovar automaticamente o token de acesso do Google Calendar, para manter a sincronização funcionando sem exigir reautenticação manual.

## 9. Cobranças e Financeiro

- Como **profissional**, quero criar uma cobrança para uma gestante (valor, forma de pagamento, parcelas), para registrar e acompanhar o pagamento do meu serviço.
- Como **profissional**, quero editar uma cobrança existente, para corrigir valores ou condições combinadas.
- Como **profissional**, quero visualizar o histórico de cobranças de uma gestante específica, para acompanhar o que já foi pago e o que está pendente.
- Como **profissional**, quero um dashboard com o resumo financeiro do mês atual (a receber, pago, em atraso), para entender minha situação financeira rapidamente.
- Como **profissional/staff**, quero navegar facilmente entre meses (anteriores e posteriores) no dashboard financeiro, para comparar performance ao longo do tempo.
- Como **profissional/staff**, quero visualizar o resumo financeiro de um intervalo customizado de meses ou de todos os meses, para análises de período mais flexíveis.
- Como **gestora**, quero visualizar o dashboard financeiro consolidado da empresa (todas as profissionais), para ter visão gerencial das finanças da organização.
- Como **gestora**, quero salvar um link de parcelamento associado a uma cobrança, para facilitar o pagamento parcelado pela gestante.
- Como **sistema**, quero marcar automaticamente parcelas e cobranças vencidas como "em atraso", para manter o status financeiro sempre correto sem intervenção manual.
- Como **gestante**, quero receber notificações sobre parcelas e cobranças (lembrete, vencimento, atraso), para não perder prazos de pagamento.
- Como **gestora**, quero configurar datas para cobranças automaticas para alertar as gestantes sobre cobranças ou parcelas a vencer.
- Como **sistema**, quero notificar pacientes/gestantes sobre parcelas a vencer através de notificações push, emails e contato via WhatsApp.

## 10. Taxas, Impostos e Descontos da Empresa

- Como **gestora**, quero configurar impostos, taxas, tributos e descontos aplicáveis às cobranças das profissionais da minha empresa, para refletir corretamente custos obrigatórios (nota fiscal, taxa de plataforma de pagamento, uso de marca/franquia) no repasse financeiro.
- Como **gestora**, quero definir se uma taxa/desconto é um valor fixo ou um percentual, para cobrir diferentes cenários de cobrança (ex: 6,5% de imposto sobre nota fiscal vs. R$20 fixos de manutenção).
- Como **gestora**, quero ativar ou desativar uma taxa/desconto sem precisar excluí-la, para pausar temporariamente sua aplicação.
- Como **profissional**, quero ver de forma transparente quais taxas/descontos foram aplicados sobre uma cobrança minha, para entender o valor líquido que vou receber.
- Como **sistema**, quero registrar em log toda criação, edição ou alteração de taxas/impostos/descontos, para manter rastreabilidade de mudanças financeiras sensíveis.

## 11. Relatórios de Cobrança (Exportação)

- Como **gestora**, quero gerar um relatório em PDF das cobranças de toda a empresa em um período, para prestar contas ou fazer análises financeiras offline.
- Como **gestora**, quero filtrar o relatório por profissional específica, para analisar o desempenho financeiro individual.
- Como **profissional**, quero gerar meu próprio relatório de cobranças (sem acesso aos dados de outras profissionais), para meu controle financeiro pessoal.
- Como **usuária**, quero que o relatório em PDF traga cabeçalho com a logo do Ventre, período selecionado, descrições de serviço, profissionais envolvidos, datas, formas de pagamento, taxas/impostos/descontos e valores finais líquidos, para ter um documento completo e apresentável.
- Como **sistema**, quero registrar em log cada geração de relatório de cobrança, para auditoria de quem exportou quais dados e quando.

## 12. Contratos

- Como **profissional autônoma**, quero configurar um contrato base com minhas próprias cláusulas, para reutilizá-lo em todas as gestantes que atendo.
- Como **profissional vinculada a uma empresa**, quero, ao criar um contrato, escolher se a CONTRATADA será eu mesma (dados pessoais) ou a empresa (dados da organização), para adequar o contrato ao modelo de atuação de cada atendimento.
- Como **gestora**, quero configurar o contrato base da empresa em `/settings/contract`, para padronizar as cláusulas usadas por todas as profissionais vinculadas.
- Como **profissional/staff**, quero que o cabeçalho do contrato (dados da CONTRATANTE/gestante e CONTRATADA/empresa ou profissional, e equipe de cuidado com titulares e backups) seja gerado automaticamente a partir dos dados já cadastrados, para evitar erros de digitação e garantir um formato jurídico padronizado que não pode ser editado livremente.
- Como **profissional/staff**, quero editar as cláusulas do contrato usando um editor de texto rico (fonte, negrito, itálico, sublinhado, listas, alinhamento), para formatar o conteúdo contratual de forma clara e profissional.
- Como **profissional/staff**, quero criar o contrato de uma gestação específica a partir do contrato base, podendo usá-lo integralmente ou alterá-lo, para adaptar cláusulas a particularidades daquele atendimento sem reescrever tudo do zero.
- Como **profissional/staff**, quero exportar o contrato final da gestante em PDF (nomeado como `CONTRATO_<NOME_DA_PACIENTE>_<DATA>`), para formalizar o acordo e arquivá-lo.
- Como **profissional/staff**, quero que o PDF do contrato exportado seja salvo automaticamente na seção de documentos da gestante, para manter tudo centralizado no prontuário dela.
- Como **profissional/staff**, quero desativar o contrato de uma gestante quando ele deixar de ser válido (ex: substituído por uma nova versão), para manter o histórico sem apagar registros.

## 13. Log de Atividades (Auditoria)

- Como **staff/gestora**, quero visualizar as 10 atividades mais recentes de toda a equipe na home da empresa, para acompanhar o que está acontecendo na organização em tempo real.
- Como **staff/gestora**, quero acessar uma página paginada com o histórico completo de atividades (`/last-activities`), para investigar ações passadas com mais profundidade.
- Como **staff/gestora**, quero que ações relevantes (consultas, evoluções, exames, mudanças de equipe, cobranças) sejam automaticamente registradas com nome, descrição, tipo e autor, para ter visibilidade sem depender de comunicação manual da equipe.
- Como **sistema**, quero ser a única entidade autorizada a inserir logs de atividade (via service role), para garantir a integridade e não-adulteração do histórico.

## 14. Notificações

- Como **usuária**, quero permitir o recebimento de notificações push depois de uma interação contextualizada (não assim que abro o site), para entender o valor antes de conceder a permissão.
- Como **usuária**, quero receber notificações push mesmo com o app fechado (via service worker), para ser avisada de eventos importantes (agendamentos, cobranças, convites) em tempo real.
- Como **usuária**, quero visualizar minhas notificações em uma central dedicada, para revisar alertas que recebi.
- Como **usuária**, quero ver a contagem de notificações não lidas, para saber rapidamente se há algo novo para revisar.
- Como **usuária**, quero marcar notificações como lidas, para manter minha caixa organizada.
- Como **usuária**, quero cancelar minha inscrição em notificações push quando quiser, para parar de recebê-las em um dispositivo específico.
- Como **usuária**, quero configurar quais tipos de notificação desejo receber e por qual canal, para personalizar minha experiência.
- Como **sistema**, quero processar notificações agendadas (lembretes de DPP, parcelas a vencer) automaticamente, para garantir que os alertas cheguem no momento certo sem intervenção manual.

## 15. Assistente IA

- Como **profissional**, quero acessar uma funcionalidade de IA dentro do app, para obter apoio inteligente no meu fluxo de trabalho (ex.: dúvidas clínicas, resumos, sugestões).

## 16. PWA / Multiplataforma

- Como **usuária**, quero instalar o Ventre como aplicativo (PWA) no meu celular, para ter uma experiência semelhante a um app nativo.
- Como **usuária em iOS**, quero que o app funcione com notificações push mesmo nas restrições do Safari/iOS 16.4+, contanto que eu tenha adicionado o PWA à tela de início, para não perder funcionalidades por causa da plataforma.

---

## Backlog / Melhorias identificadas mas não descritas como stories completas

- **Qualidade de código (002)**: remoção de endpoints de debug, logs sensíveis e correção de open redirect — não são user stories, mas prontidão de produção que impacta a confiabilidade percebida por todas as personas.
- **Dados AU (008)** e **Ganho de peso gestacional (009)**: cobertos na seção 5 (Prontuário Pré-natal) como visualização de curvas — a origem dos dados (INTERGROWTH-21st, CONMAI) é referência clínica, não uma story adicional.

---

## Como manter este documento

- Ao implementar um novo PRD em `prompts/`, adicione as stories correspondentes na seção temática adequada (ou crie uma nova seção).
- Ao remover ou substituir uma funcionalidade, remova ou reescreva a story correspondente — este documento reflete o estado atual + planejado, não o histórico.
