import type { LegalSection } from "@/components/shared/legal-document";

export const termsMeta = {
  title: "Termos de Uso",
  subtitle: "Condições de acesso e utilização da plataforma de cuidado materno-infantil Ventre.",
  version: "1.0",
  effectiveDate: "27 de agosto de 2026",
};

export const termsSections: LegalSection[] = [
  {
    id: "quem-somos",
    title: "Quem somos e objeto destes Termos",
    content: (
      <>
        <p>
          O APP Ventre (&quot;Ventre&quot; ou &quot;Plataforma&quot;) é uma solução tecnológica
          operada pela Timani Tecnologia Desenvolvimento de Software Ltda., nome fantasia Timani
          Tecnologia, inscrita no CNPJ sob nº 68.107.944/0001-04, com sede em Brasília/DF
          (&quot;Timani&quot;).
        </p>
        <p>
          Estes Termos disciplinam o cadastro, a contratação e o uso do Ventre por profissionais de
          saúde e de assistência materno-infantil, clínicas e equipes, bem como o acesso concedido a
          gestantes e puérperas. Ao criar uma conta, aceitar eletronicamente estes Termos ou
          utilizar a Plataforma, o usuário declara que leu e concorda com estas condições e com a{" "}
          <a href="/policies" className="text-primary underline underline-offset-2">
            Política de Privacidade
          </a>{" "}
          vigente.
        </p>
        <p>
          Se o usuário não concordar, não deverá concluir o cadastro nem utilizar o Ventre.
          Cláusulas específicas apresentadas no momento da contratação, no plano escolhido ou em
          contrato empresarial poderão complementar estes Termos; em caso de conflito, prevalecerá a
          condição específica válida para aquele relacionamento, sem prejuízo das normas
          obrigatórias de proteção ao consumidor e ao titular de dados.
        </p>
      </>
    ),
  },
  {
    id: "definicoes",
    title: "Definições essenciais",
    content: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-medium text-foreground">Usuário Profissional:</span> pessoa física
          habilitada a prestar serviços relacionados à gestação, parto, puerpério, amamentação ou
          cuidado materno-infantil, incluindo, entre outros, enfermeiras obstetras, obstetrizes,
          doulas, médicas(os) e consultoras(es) de amamentação.
        </li>
        <li>
          <span className="font-medium text-foreground">Conta de Clínica ou Equipe:</span> ambiente
          organizacional com mais de um profissional, permissões diferenciadas e acessos vinculados
          à atuação de cada integrante.
        </li>
        <li>
          <span className="font-medium text-foreground">Gestante:</span> pessoa cadastrada para
          acompanhamento, inclusive adolescente ou criança quando houver gestação, que poderá
          receber acesso individual à área da gestante e ao cartão de pré-natal digital.
        </li>
        <li>
          <span className="font-medium text-foreground">Recém-nascido:</span> criança vinculada ao
          acompanhamento de parto e puerpério de uma Gestante cadastrada. Seus dados são inseridos
          pelo profissional responsável e pela própria mãe/gestante, que exerce em nome do bebê os
          direitos de titular previstos na LGPD até que ele tenha representação diversa.
        </li>
        <li>
          <span className="font-medium text-foreground">Dados Clínicos:</span> registros de saúde,
          prontuários, exames, imagens, documentos, informações de consultas, parto, puerpério,
          amamentação e recém-nascido inseridos ou armazenados na Plataforma.
        </li>
        <li>
          <span className="font-medium text-foreground">Assinatura:</span> plano pago contratado por
          profissional, em periodicidade mensal, semestral ou anual, após o período de teste.
        </li>
        <li>
          <span className="font-medium text-foreground">Conteúdo do Usuário:</span> informações e
          arquivos inseridos por profissionais, clínicas, equipes ou gestantes, respeitadas as
          permissões disponíveis.
        </li>
      </ul>
    ),
  },
  {
    id: "elegibilidade",
    title: "Elegibilidade, cadastro e contas",
    content: (
      <>
        <p className="font-medium text-foreground">3.1. Contas profissionais</p>
        <p>
          Profissionais podem criar suas próprias contas. O cadastro deve conter informações
          verdadeiras, completas e atualizadas. Quando a atividade estiver sujeita a conselho
          profissional, habilitação, registro, especialidade ou outro requisito legal, o usuário é
          responsável por manter sua regularidade e por utilizar o Ventre apenas dentro dos limites
          de sua competência. Isso inclui profissionais como doulas, cuja atuação não é
          regulamentada por um conselho profissional formal no Brasil.
        </p>
        <p>
          A Timani poderá solicitar comprovação de identidade, habilitação, vínculo com uma
          clínica/equipe ou outras evidências razoáveis para prevenir fraude, proteger pacientes ou
          atender obrigações legais. O Ventre verifica os dados declarados pelo profissional, mas{" "}
          <span className="font-medium text-foreground">
            não realiza credenciamento profissional, não certifica formação ou capacitação
          </span>{" "}
          e não garante a qualidade dos serviços de qualquer usuário.
        </p>
        <p className="font-medium text-foreground">3.2. Clínicas e equipes</p>
        <p>
          Clínicas e equipes podem criar ambientes com múltiplos profissionais. Cada integrante deve
          utilizar credencial individual e possuir assinatura ou licença própria quando exigida pelo
          plano. O administrador da organização define papéis e permissões, mas não deve conceder
          acesso além do necessário para a função assistencial ou administrativa de cada pessoa.
        </p>
        <p>
          A clínica ou equipe é responsável por: autorizar e revogar integrantes; revisar permissões
          periodicamente; assegurar confidencialidade; comunicar desligamentos; e manter base
          jurídica, sigilo e governança adequados para o compartilhamento de Dados Clínicos.
        </p>
        <p className="font-medium text-foreground">3.3. Conta e acesso da gestante</p>
        <p>
          Gestantes adultas podem realizar autocadastro nos fluxos disponibilizados. Também podem
          ser cadastradas por um profissional ou equipe e receber acesso individual à área da
          gestante, ao cartão de pré-natal digital e às funcionalidades liberadas para seu perfil.
        </p>
        <p>
          Familiares e acompanhantes não recebem acesso automático. Qualquer compartilhamento fora
          da Plataforma é responsabilidade de quem o realiza e deve observar a vontade da gestante,
          o sigilo profissional e a legislação aplicável.
        </p>
        <p className="font-medium text-foreground">3.4. Gestantes menores de 18 anos</p>
        <p>
          O cadastro de gestante menor de 18 anos é realizado pelo profissional ou pela equipe
          responsável; a menor não utiliza o fluxo geral de autocadastro. Após o cadastro, ela pode
          receber credenciais próprias para acessar sua área e seu cartão de pré-natal digital, em
          linguagem e experiência adequadas à idade.
        </p>
        <p>
          O acesso de familiar ou responsável legal não é automático. Pedidos de acesso,
          representação ou exercício de direitos são avaliados pelo profissional, pela clínica e/ou
          pela Timani, conforme a função de cada agente, considerando a legislação, o melhor
          interesse da menor, sua autonomia progressiva, a confidencialidade assistencial e
          eventuais situações de risco.
        </p>
        <p>
          Quando a gestante cadastrada for criança, nos termos do Estatuto da Criança e do
          Adolescente, o Ventre observa as exigências específicas do art. 14 da LGPD, incluindo
          consentimento específico e destacado de ao menos um dos pais ou responsável legal,
          ressalvadas as hipóteses em que a lei dispensa esse consentimento para proteger o
          interesse da criança. Esse fluxo recebe tratamento e acompanhamento redobrados, em
          conjunto com o profissional responsável pelo caso.
        </p>
      </>
    ),
  },
  {
    id: "recursos-lancamento",
    title: "O que o Ventre disponibiliza no lançamento",
    content: (
      <>
        <p>
          Conforme o perfil, as permissões e o plano contratado, o lançamento do Ventre pode
          incluir:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>cadastro e prontuário da gestante;</li>
          <li>registro de consultas e acompanhamento pré-natal;</li>
          <li>
            anexação de exames, imagens e documentos por profissionais e upload de exames pela
            gestante;
          </li>
          <li>agenda de consultas e retornos;</li>
          <li>registro do trabalho de parto e do nascimento;</li>
          <li>acompanhamento de pós-parto, amamentação e recém-nascido;</li>
          <li>acesso compartilhado por profissionais da mesma equipe, com níveis de permissão;</li>
          <li>geração do cartão de pré-natal em PDF;</li>
          <li>relatórios e documentos profissionais;</li>
          <li>manifestação eletrônica de autoria por login e senha;</li>
          <li>lembretes assistenciais e operacionais via WhatsApp;</li>
          <li>exportação de registros; e</li>
          <li>registro de acessos e alterações para fins de auditoria.</li>
        </ul>
        <p>
          A disponibilidade concreta pode variar por perfil, sistema operacional, versão,
          contratação, configuração da equipe e cronograma de implantação. A tela do produto e a
          oferta comercial vigente indicam quais recursos estão efetivamente disponíveis.
        </p>
      </>
    ),
  },
  {
    id: "funcionalidades-futuras",
    title: "Funcionalidades previstas para o futuro",
    content: (
      <>
        <p>
          Integram o planejamento, mas não constituem obrigação atual nem promessa de data de
          entrega: plano de parto; anotações adicionais inseridas pela gestante; prescrições,
          atestados e encaminhamentos; recursos de inteligência artificial; e pagamentos dentro do
          Ventre.
        </p>
        <p>
          Se esses recursos forem lançados, a Timani poderá apresentar termos adicionais, avisos
          específicos, bases legais e controles próprios. Recursos de inteligência artificial, em
          especial, passarão por avaliação de risco e não poderão substituir julgamento clínico,
          supervisão profissional nem direitos do titular.
        </p>
      </>
    ),
  },
  {
    id: "natureza-plataforma",
    title: "Natureza da Plataforma e responsabilidade assistencial",
    content: (
      <>
        <p>
          O Ventre é uma ferramenta de organização, registro, comunicação e apoio ao acompanhamento.
          A Timani não presta atendimento médico, de enfermagem, obstétrico, psicológico ou de
          doulagem, não integra a relação clínica e não substitui avaliação presencial, julgamento
          profissional, protocolos assistenciais ou serviços de urgência e emergência.
        </p>
        <p>
          O Ventre,{" "}
          <span className="font-medium text-foreground">incluindo os registros do Modo Parto</span>{" "}
          (frequência cardíaca fetal, dilatação, descida, contrações, pulso e pressão arterial), é
          uma ferramenta de registro e apoio à decisão clínica.{" "}
          <span className="font-medium text-foreground">
            Não é um dispositivo médico regulamentado pela ANVISA
          </span>
          , não realiza monitorização fisiológica automática, diagnóstico ou alerta clínico
          automatizado. Os dados são inseridos manualmente pelo profissional responsável, que
          permanece integralmente responsável pela monitorização clínica direta da paciente.
        </p>
        <p>
          Diagnósticos, condutas, orientações, registros, encaminhamentos e decisões assistenciais
          são de responsabilidade do profissional e da organização que prestam o cuidado. A gestante
          deve procurar o serviço de saúde ou emergência indicado quando houver sintomas,
          intercorrência ou risco; lembretes, cartão digital e conteúdos do Ventre não devem ser
          usados como canal emergencial.
        </p>
        <p>
          O profissional é responsável por confirmar a identidade da paciente, a exatidão do
          cadastro, a pertinência dos dados registrados e o cumprimento de normas éticas e
          regulatórias aplicáveis à sua profissão. O Ventre não valida automaticamente a correção
          clínica do conteúdo inserido.
        </p>
      </>
    ),
  },
  {
    id: "prontuario",
    title: "Prontuário, registros, documentos e auditoria",
    content: (
      <>
        <p>
          Os registros devem ser objetivos, legíveis, cronológicos, completos e compatíveis com as
          atribuições do autor. O usuário não deve alterar ou excluir informações com a finalidade
          de ocultar fatos, autoria, data, versão ou responsabilidade. Quando houver correção, o
          sistema preserva histórico, autor, data e hora.
        </p>
        <p>
          O Ventre registra quem acessou, inseriu, modificou, exportou ou assinou informações. Esses
          logs destinam-se à segurança, rastreabilidade, prevenção de fraude, suporte, defesa de
          direitos e atendimento de deveres legais. O usuário não deve tentar contornar controles,
          utilizar credenciais de outra pessoa ou acessar prontuários sem necessidade e autorização.
        </p>
        <p>
          O cancelamento da assinatura ou a solicitação de exclusão da conta não implica eliminação
          imediata de prontuários. Registros clínicos são preservados pelos prazos legais,
          regulatórios, éticos e probatórios aplicáveis, que podem incluir o prazo mínimo de 20 anos
          contado do último registro, nos termos da Lei nº 13.787/2018.
        </p>
      </>
    ),
  },
  {
    id: "assinatura-eletronica",
    title: "Assinatura eletrônica por login e senha",
    content: (
      <>
        <p>
          A Plataforma vincula documentos e registros ao usuário autenticado mediante login e senha,
          com data, hora, identificador e trilha de auditoria. Esse mecanismo representa uma
          manifestação eletrônica de autoria e integridade dentro do Ventre.
        </p>
        <p>
          O recurso não utiliza certificado ICP-Brasil e não deve ser descrito como assinatura
          digital qualificada. Cabe ao profissional verificar se o tipo de documento e a norma de
          sua categoria exigem certificado, assinatura avançada, assinatura qualificada ou outro
          requisito. A Timani pode restringir o recurso ou exigir método adicional quando
          necessário.
        </p>
        <p>
          O usuário não pode compartilhar credenciais, permitir assinatura por terceiros ou deixar
          sessão ativa em dispositivo inseguro. Ações feitas por credencial válida podem ser
          atribuídas ao titular da conta, sem prejuízo da investigação de fraude comunicada
          prontamente.
        </p>
      </>
    ),
  },
  {
    id: "seguranca-conta",
    title: "Segurança da conta",
    content: (
      <>
        <p>
          O login pode ocorrer por e-mail e senha ou por autenticação com conta Google. O usuário
          deve criar senha forte, proteger seu e-mail e dispositivo, revisar acessos e comunicar
          imediatamente suspeita de comprometimento a{" "}
          <a href="mailto:falecom@ventre.app" className="text-primary underline underline-offset-2">
            falecom@ventre.app
          </a>
          .
        </p>
        <p>
          Quando utilizado o login Google, aplicam-se também os termos e controles da conta Google.
          A Timani pode encerrar sessões, redefinir credenciais, exigir verificação adicional ou
          suspender acessos quando houver risco, tentativa de fraude, incidente, ordem legal ou
          violação destes Termos.
        </p>
      </>
    ),
  },
  {
    id: "whatsapp",
    title: "Lembretes pelo WhatsApp",
    content: (
      <>
        <p>
          Os lembretes são enviados por meio da Meta/WhatsApp Business apenas para finalidades
          assistenciais e operacionais, como consultas, retornos e eventos relacionados ao
          acompanhamento. Mensagens publicitárias não fazem parte do escopo atual.
        </p>
        <p>
          A gestante pode desabilitar os lembretes nas configurações do aplicativo. A desativação
          não encerra a conta, mas pode reduzir comunicações úteis. O envio depende de número
          válido, conexão, regras e disponibilidade do WhatsApp; entrega imediata não é garantida.
        </p>
        <p>
          Para reduzir riscos, o conteúdo das mensagens é limitado ao necessário, evitando detalhes
          clínicos sensíveis sempre que possível. O WhatsApp não é canal de urgência. Se futuramente
          houver mensagens promocionais, a Timani atualizará os documentos, apresentará aviso
          apropriado e obterá a autorização exigida antes do envio.
        </p>
      </>
    ),
  },
  {
    id: "planos-cobranca",
    title: "Planos, teste gratuito e cobrança",
    content: (
      <>
        <p>
          Não há plano gratuito permanente. O novo Usuário Profissional tem período de teste de 30
          dias. Salvo cancelamento antes do fim do teste, a assinatura passa a ser cobrada a partir
          do segundo mês, conforme o plano selecionado e as informações exibidas no checkout.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              <tr className="border-border border-b">
                <th className="w-1/3 py-2 pr-4 align-top font-medium text-foreground">
                  Periodicidade
                </th>
                <td className="py-2 text-muted-foreground">Mensal, semestral ou anual.</td>
              </tr>
              <tr className="border-border border-b">
                <th className="py-2 pr-4 align-top font-medium text-foreground">Licenciamento</th>
                <td className="py-2 text-muted-foreground">
                  Por profissional. Contas de equipe exigem uma assinatura/licença por profissional
                  ativo, conforme a oferta.
                </td>
              </tr>
              <tr className="border-border border-b">
                <th className="py-2 pr-4 align-top font-medium text-foreground">Gestantes</th>
                <td className="py-2 text-muted-foreground">
                  Sem limite de gestantes por assinatura, sujeito ao uso lícito e à capacidade
                  técnica razoável da Plataforma.
                </td>
              </tr>
              <tr className="border-border border-b">
                <th className="py-2 pr-4 align-top font-medium text-foreground">Processamento</th>
                <td className="py-2 text-muted-foreground">
                  A Stripe processa os pagamentos. O Ventre pode receber status, identificadores,
                  valores, faturas e informações necessárias à gestão da assinatura.
                </td>
              </tr>
              <tr>
                <th className="py-2 pr-4 align-top font-medium text-foreground">Renovação</th>
                <td className="py-2 text-muted-foreground">
                  Automática ao fim de cada ciclo, salvo cancelamento realizado antes da próxima
                  cobrança.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Preços, tributos, benefícios e moeda são informados antes da contratação. Alterações de
          preço são comunicadas com antecedência razoável e produzem efeitos nos ciclos futuros,
          respeitada a legislação aplicável. A Timani pode oferecer campanhas ou condições
          específicas sem obrigação de estendê-las a todos os usuários.
        </p>
      </>
    ),
  },
  {
    id: "cancelamento",
    title: "Cancelamento, arrependimento, reembolso e inadimplência",
    content: (
      <>
        <p className="font-medium text-foreground">12.1. Cancelamento</p>
        <p>
          O profissional pode cancelar a qualquer momento pelos meios disponibilizados na conta ou
          pelo suporte. O cancelamento impede novas renovações e, em regra, mantém o uso até o
          término do período já pago. Depois desse término, há 30 dias de acesso somente para
          consulta e exportação dos registros já existentes, sem criação de novos registros.
        </p>
        <p>
          Ao final dos 30 dias de acesso restrito, o acesso profissional pode ser suspenso. O
          usuário deve planejar a continuidade assistencial e realizar a exportação necessária. A
          preservação legal dos prontuários e os direitos da gestante não são extintos pelo
          cancelamento comercial.
        </p>
        <p className="font-medium text-foreground">12.2. Direito de arrependimento e reembolsos</p>
        <p>
          Quando aplicável a relação de consumo e a contratação ocorrer fora do estabelecimento
          comercial, o consumidor pode exercer o direito de arrependimento no prazo legal de 7 dias,
          com restituição nos termos do art. 49 do Código de Defesa do Consumidor.
        </p>
        <p>
          Fora das hipóteses obrigatórias previstas em lei, não há reembolso de valores já pagos,
          inclusive proporcional por período não utilizado após o cancelamento. Esta regra não
          limita direitos inderrogáveis nem impede a correção de cobrança indevida.
        </p>
        <p className="font-medium text-foreground">12.3. Inadimplência</p>
        <p>
          A falta de pagamento pode causar tentativa de nova cobrança, aviso, limitação ou suspensão
          do acesso. Sempre que razoavelmente possível, será concedida oportunidade de
          regularização. A suspensão não autoriza a destruição de prontuários nem afasta os deveres
          do profissional de assegurar continuidade do cuidado e guarda adequada.
        </p>
      </>
    ),
  },
  {
    id: "conteudo-titularidade",
    title: "Conteúdo, titularidade e licenças",
    content: (
      <>
        <p>
          Profissionais, clínicas, equipes e gestantes mantêm os direitos que possuam sobre o
          Conteúdo do Usuário. Eles concedem à Timani autorização limitada, não exclusiva e pelo
          tempo necessário para hospedar, processar, reproduzir tecnicamente, transmitir, proteger,
          converter e disponibilizar esse conteúdo exclusivamente para operar o Ventre, cumprir
          instruções válidas, atender a lei e proteger direitos.
        </p>
        <p>
          A marca, o software, o design, as bases tecnológicas, os textos institucionais e os demais
          elementos do Ventre pertencem à Timani ou a seus licenciantes. A contratação concede
          licença pessoal, limitada, revogável, não transferível e não exclusiva de uso durante a
          vigência; não transfere código-fonte, marca ou propriedade intelectual.
        </p>
      </>
    ),
  },
  {
    id: "uso-permitido",
    title: "Uso permitido e condutas proibidas",
    content: (
      <>
        <p>
          O usuário deve utilizar o Ventre apenas para finalidades lícitas, profissionais e
          assistenciais compatíveis com seu perfil. É proibido:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>acessar dados sem vínculo assistencial, necessidade ou permissão;</li>
          <li>compartilhar conta ou obter credenciais de terceiros;</li>
          <li>inserir dados falsos, discriminatórios, ilícitos, ofensivos ou sem base jurídica;</li>
          <li>
            copiar, vender, explorar, fazer engenharia reversa, testar vulnerabilidades sem
            autorização ou interferir na Plataforma;
          </li>
          <li>
            distribuir malware, automatizar acessos abusivos ou contornar limites e controles;
          </li>
          <li>
            usar dados de pacientes para publicidade, perfilamento ou finalidade incompatível sem
            fundamento válido; ou
          </li>
          <li>
            usar o Ventre como único meio para urgência, emergência ou decisão clínica automática.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "privacidade-papeis",
    title: "Privacidade, proteção de dados e papéis das partes",
    content: (
      <>
        <p>
          O tratamento de dados segue a{" "}
          <a href="/policies" className="text-primary underline underline-offset-2">
            Política de Privacidade
          </a>
          . Em regra, o profissional ou a clínica/equipe decide as finalidades clínicas e atua como
          controlador dos Dados Clínicos; a Timani atua como operadora ao hospedar e processar esses
          dados conforme instruções. A Timani atua como controladora dos dados necessários à criação
          de contas, contratação, cobrança, suporte, segurança, prevenção de fraude, comunicação
          institucional e melhoria operacional do Ventre.
        </p>
        <p>
          Os papéis podem variar conforme a atividade concreta. Cada parte deve cumprir suas
          obrigações, atender direitos dos titulares, manter segurança, comunicar incidentes e
          formalizar instruções. A Timani não utiliza prontuários para publicidade nem vende dados
          pessoais.
        </p>
      </>
    ),
  },
  {
    id: "servicos-terceiros",
    title: "Serviços de terceiros",
    content: (
      <>
        <p>
          A operação depende de fornecedores como{" "}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Supabase
          </a>{" "}
          (infraestrutura, banco, armazenamento e autenticação, hospedado na Amazon Web Services,
          região us-east-1, Estados Unidos),{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Google
          </a>{" "}
          (login),{" "}
          <a
            href="https://www.facebook.com/legal/terms/dataprocessing"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Meta/WhatsApp Business
          </a>{" "}
          (lembretes) e{" "}
          <a
            href="https://stripe.com/br/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Stripe
          </a>{" "}
          (pagamentos). Esses serviços têm termos, políticas, disponibilidade e infraestrutura
          próprios.
        </p>
        <p>
          A Timani seleciona e monitora fornecedores de forma proporcional ao risco e exige
          salvaguardas contratuais quando aplicável. Entretanto, interrupções, mudanças ou falhas
          externas podem afetar recursos. Isso não exclui a responsabilidade que a lei atribuir à
          Timani, mas o Ventre não controla integralmente redes e serviços de terceiros.
        </p>
      </>
    ),
  },
  {
    id: "disponibilidade-backup",
    title: "Disponibilidade, manutenção e backups",
    content: (
      <>
        <p>
          A Timani emprega esforços razoáveis para manter a Plataforma segura e disponível, podendo
          realizar manutenção, atualização, correção, migração ou suspensão emergencial. Salvo
          compromisso específico por escrito, não há garantia de operação ininterrupta ou livre de
          falhas.
        </p>
        <p>
          Dados armazenados e transmitidos são protegidos por criptografia, além de controles de
          acesso e auditoria. Nenhuma medida elimina todo risco; usuários também devem proteger
          dispositivos, credenciais e exportações.
        </p>
        <p>
          O Ventre é hospedado no plano Pro do Supabase, que realiza backups diários automáticos com
          retenção de 7 dias. O recurso adicional de recuperação a um ponto específico no tempo
          (PITR) não está contratado no momento; caso passe a ser, esta cláusula será atualizada.
          Profissionais devem manter plano de continuidade e não depender exclusivamente de
          lembretes ou conectividade momentânea.
        </p>
      </>
    ),
  },
  {
    id: "suspensao-encerramento",
    title: "Suspensão e encerramento pela Timani",
    content: (
      <>
        <p>
          A Timani pode limitar, suspender ou encerrar acesso em caso de inadimplência, violação
          destes Termos, risco à segurança, fraude, uso indevido de dados, perda de habilitação
          relevante, ordem legal ou necessidade de proteção de titulares. Quando a urgência não
          impedir, haverá aviso e oportunidade razoável de correção.
        </p>
        <p>
          O encerramento do Ventre como produto será comunicado com antecedência razoável, sempre
          que possível, com mecanismo de exportação e plano de transição compatível com as
          obrigações de guarda e continuidade. Limitações de acesso não extinguem direitos de
          pacientes sobre seus dados.
        </p>
      </>
    ),
  },
  {
    id: "limites-responsabilidade",
    title: "Limites de responsabilidade",
    content: (
      <>
        <p>Na extensão permitida por lei, a Timani não responde por:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            indisponibilidade ou instabilidade de internet, rede, dispositivo ou serviço de
            terceiros fora de seu controle direto — caso fortuito ou força maior, nos termos do art.
            393 do Código Civil;
          </li>
          <li>
            danos decorrentes de uso indevido da Plataforma, compartilhamento de credenciais ou
            conduta de terceiros alheios à Timani — culpa exclusiva de terceiro ou da vítima, nos
            termos do art. 927, parágrafo único, do Código Civil;
          </li>
          <li>
            condutas clínicas, conteúdo inserido por usuários ou decisões tomadas sem avaliação
            profissional adequada; e
          </li>
          <li>
            serviços de terceiros fora de seu controle (Supabase, Google, Meta/WhatsApp Business e
            Stripe).
          </li>
        </ul>
        <p>
          Quando cabível e nos limites da lei, a responsabilidade civil da Timani por danos
          comprovados decorrentes de falha atribuível à Plataforma fica limitada ao total
          efetivamente pago pelo profissional ou clínica à Timani nos 12 (doze) meses anteriores ao
          evento.
        </p>
        <p>
          Nada nestes Termos exclui responsabilidade por dolo, culpa grave, violação de dever legal,
          incidente imputável à Timani ou direito que não possa ser afastado pelo Código de Defesa
          do Consumidor, pela LGPD ou por outra norma obrigatória.
        </p>
      </>
    ),
  },
  {
    id: "alteracoes-termos",
    title: "Alterações dos Termos",
    content: (
      <p>
        A Timani pode atualizar estes Termos para refletir mudanças legais, técnicas, comerciais ou
        funcionais. Alterações relevantes serão comunicadas por meio adequado antes de produzirem
        efeitos. Quando a lei ou a natureza da mudança exigir nova concordância, o usuário deverá
        aceitá-la para continuar utilizando os recursos afetados.
      </p>
    ),
  },
  {
    id: "lei-aplicavel",
    title: "Lei aplicável e solução de conflitos",
    content: (
      <p>
        Aplica-se a legislação brasileira. As partes buscarão solução amigável pelos canais de
        suporte. Nas relações de consumo, fica preservado o foro legalmente competente do
        consumidor. Nos demais casos, e quando válida a eleição, fica eleito o foro de Brasília/DF,
        com renúncia a outro, por mais privilegiado que seja.
      </p>
    ),
  },
  {
    id: "contato",
    title: "Contato",
    content: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Suporte e privacidade: falecom@ventre.app</li>
        <li>Site: https://ventre.app</li>
        <li>Telefone: (61) 99697-9671</li>
        <li>
          Endereço: Rua 1, QR 414, Conjunto 9A, Lote 1, apartamento 102, Setor Habitacional Vicente
          Pires, Brasília/DF, CEP 72.005-100.
        </li>
      </ul>
    ),
  },
];
