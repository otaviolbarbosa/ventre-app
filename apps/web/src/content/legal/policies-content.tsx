import type { LegalSection } from "@/components/shared/legal-document";

export const policiesMeta = {
  title: "Política de Privacidade",
  subtitle: "Como o APP Ventre trata dados pessoais e dados de saúde.",
  version: "1.0",
  effectiveDate: "27 de agosto de 2026",
};

export const policiesSections: LegalSection[] = [
  {
    id: "identificacao-escopo",
    title: "Identificação e escopo",
    content: (
      <>
        <p>
          Esta Política explica como a Timani Tecnologia Desenvolvimento de Software Ltda., nome
          fantasia Timani Tecnologia, CNPJ 68.107.944/0001-04 (&quot;Timani&quot;), trata dados
          pessoais no APP Ventre (&quot;Ventre&quot; ou &quot;Plataforma&quot;).
        </p>
        <p>
          Ela se aplica a profissionais, clínicas e equipes, gestantes e puérperas, pacientes,
          recém-nascidos vinculados ao cuidado, pessoas que entram em contato com o suporte e
          visitantes dos canais digitais do Ventre. Dados de saúde e outros dados previstos na LGPD
          podem ser sensíveis e recebem proteção reforçada.
        </p>
        <p>
          Endereço da Timani: Rua 1, QR 414, Conjunto 9A, Lote 1, apartamento 102, Setor
          Habitacional Vicente Pires, Brasília/DF, CEP 72.005-100. Canal de privacidade:
          falecom@ventre.app.
        </p>
      </>
    ),
  },
  {
    id: "quem-decide",
    title: "Quem decide sobre o tratamento",
    content: (
      <>
        <p className="font-medium text-foreground">2.1. Timani como controladora</p>
        <p>
          A Timani atua como controladora quando define por que e como tratar dados necessários à
          administração do Ventre, incluindo criação e segurança de contas, autenticação,
          assinatura, contratação, cobrança, suporte, comunicações técnicas, prevenção de fraude,
          cumprimento legal, gestão de fornecedores e melhoria operacional.
        </p>
        <p className="font-medium text-foreground">
          2.2. Profissional ou clínica/equipe como controladores dos Dados Clínicos
        </p>
        <p>
          Em regra, o profissional, a clínica ou a equipe que presta o cuidado decide as finalidades
          clínicas, o que registrar, quem pode acessar e por quanto tempo conservar os prontuários.
          Nessa atividade, eles atuam como controladores e a Timani geralmente atua como operadora,
          processando os Dados Clínicos conforme instruções, contratos e lei.
        </p>
        <p>
          Pedidos sobre conteúdo clínico, correção de prontuário, compartilhamento assistencial ou
          decisão profissional podem precisar ser atendidos pelo profissional ou pela clínica
          responsável. A Timani ajuda a identificar ou encaminhar o controlador adequado quando
          possível.
        </p>
        <p className="font-medium text-foreground">2.3. Conta direta da gestante</p>
        <p>
          Quando a gestante cria ou recebe uma conta, a Timani controla os dados técnicos do acesso,
          autenticação, preferências, segurança e comunicações da Plataforma. O conteúdo clínico
          associado ao acompanhamento continua sob a responsabilidade do profissional ou da
          organização que decide a finalidade assistencial, conforme o caso.
        </p>
        <p className="font-medium text-foreground">2.4. Dados do recém-nascido</p>
        <p>
          O recém-nascido é titular autônomo de seus dados pessoais desde o nascimento, ainda que
          não possua capacidade de exercer diretamente seus direitos. Enquanto não houver
          representação diversa, a mãe/gestante cadastrada exerce em nome do bebê os direitos
          previstos na LGPD (acesso, correção, informação sobre compartilhamentos), em conjunto com
          o profissional ou a clínica que atua como controlador dos Dados Clínicos do
          acompanhamento.
        </p>
      </>
    ),
  },
  {
    id: "dados-tratados",
    title: "Dados que podemos tratar",
    content: (
      <>
        <p className="font-medium text-foreground">3.1. Dados de profissionais e equipes</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            nome, CPF ou documento quando necessário, data de nascimento, foto, e-mail, telefone e
            endereço;
          </li>
          <li>
            profissão, especialidade, registro em conselho quando houver, qualificações, clínica,
            equipe, função e permissões;
          </li>
          <li>
            credenciais e dados de autenticação, inclusive identificador Google quando escolhido
            esse login;
          </li>
          <li>
            plano, status da assinatura, faturas, cobranças, identificadores de transação e
            histórico de atendimento; e
          </li>
          <li>
            ações na Plataforma, logs de acesso, assinatura, exportação, alterações e eventos de
            segurança.
          </li>
        </ul>
        <p className="font-medium text-foreground">
          3.2. Dados de gestantes, puérperas e pacientes
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            identificação, data de nascimento, documento quando necessário, contatos, endereço e
            dados sociodemográficos;
          </li>
          <li>
            informações de gestação, antecedentes, consultas, sinais, avaliações, exames, imagens,
            documentos e cartão pré-natal;
          </li>
          <li>
            registros de trabalho de parto, nascimento, puerpério, amamentação e recém-nascido;
          </li>
          <li>
            agenda, profissional/equipe responsável, observações, relatórios e histórico de
            acompanhamento;
          </li>
          <li>arquivos enviados pela gestante e metadados associados; e</li>
          <li>
            preferência por lembretes de WhatsApp, número utilizado, status de envio/entrega e
            interações necessárias ao serviço.
          </li>
        </ul>
        <p className="font-medium text-foreground">3.3. Dados técnicos e de uso</p>
        <p>
          Podemos tratar endereço IP, data e hora, identificador de sessão, sistema operacional,
          versão do aplicativo, modelo do dispositivo, registros de erro, desempenho, eventos de
          segurança, páginas/telas acessadas e ações realizadas. Esses dados ajudam a autenticar,
          auditar, diagnosticar falhas, prevenir fraude e proteger contas.
        </p>
        <p className="font-medium text-foreground">3.4. Dados de pagamento</p>
        <p>
          A Stripe processa os pagamentos. Dados completos do cartão ou da conta de pagamento são
          coletados diretamente no ambiente ou componente da Stripe, conforme a integração. A Timani
          pode receber somente os dados necessários à gestão comercial, como cliente, plano, valor,
          moeda, status, datas, fatura, forma de pagamento resumida e identificadores de transação.
        </p>
      </>
    ),
  },
  {
    id: "origem-dados",
    title: "De onde vêm os dados",
    content: (
      <>
        <p>
          Os dados podem ser fornecidos diretamente pelo titular; inseridos por profissional,
          clínica ou equipe durante o cuidado; enviados por uma gestante; gerados automaticamente
          pelo uso do Ventre; recebidos do Google quando a pessoa escolhe esse login; recebidos da
          Stripe sobre pagamentos; ou produzidos pela Meta/WhatsApp em razão dos lembretes.
        </p>
        <p>
          Quem cadastrar dados de terceiros deve estar autorizado e cumprir deveres de informação,
          sigilo, segurança e base jurídica. A Timani não recebe dados além do necessário para as
          finalidades da Plataforma.
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "Para que utilizamos os dados",
    content: (
      <ul className="list-disc space-y-1 pl-5">
        <li>criar, autenticar, recuperar, proteger e administrar contas;</li>
        <li>
          permitir cadastro, prontuário, acompanhamento pré-natal, agenda, anexos, parto, puerpério,
          amamentação, recém-nascido e cartão digital;
        </li>
        <li>
          aplicar papéis e permissões e viabilizar colaboração entre profissionais autorizados;
        </li>
        <li>gerar relatórios, PDFs, registros de autoria, exportações e trilhas de auditoria;</li>
        <li>enviar lembretes assistenciais e operacionais pelo WhatsApp quando habilitados;</li>
        <li>processar teste, assinatura, cobrança, cancelamento e suporte;</li>
        <li>
          prevenir fraude, investigar incidentes, controlar acesso, manter disponibilidade e
          corrigir falhas;
        </li>
        <li>cumprir obrigações legais, regulatórias, éticas e ordens de autoridades;</li>
        <li>exercer e defender direitos em processos; e</li>
        <li>
          avaliar uso e melhorar a Plataforma de forma compatível com as expectativas e, sempre que
          possível, com dados agregados ou anonimizados.
        </li>
      </ul>
    ),
  },
  {
    id: "bases-legais",
    title: "Bases legais",
    content: (
      <>
        <p>
          A base legal depende do dado, da finalidade e do papel exercido. Entre as hipóteses
          aplicáveis estão:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              <tr className="border-border border-b">
                <th className="w-1/3 py-2 pr-4 align-top font-medium text-foreground">
                  Execução de contrato e procedimentos preliminares
                </th>
                <td className="py-2 text-muted-foreground">
                  Conta profissional, teste, plano, cobrança, recursos contratados e suporte.
                </td>
              </tr>
              <tr className="border-border border-b">
                <th className="py-2 pr-4 align-top font-medium text-foreground">
                  Cumprimento de obrigação legal ou regulatória
                </th>
                <td className="py-2 text-muted-foreground">
                  Guarda de registros, documentos fiscais, atendimento de direitos e obrigações
                  profissionais.
                </td>
              </tr>
              <tr className="border-border border-b">
                <th className="py-2 pr-4 align-top font-medium text-foreground">Tutela da saúde</th>
                <td className="py-2 text-muted-foreground">
                  Tratamento indispensável por profissionais ou serviços de saúde, conforme a LGPD e
                  a atividade concreta.
                </td>
              </tr>
              <tr className="border-border border-b">
                <th className="py-2 pr-4 align-top font-medium text-foreground">
                  Exercício regular de direitos
                </th>
                <td className="py-2 text-muted-foreground">
                  Provas, auditoria, defesa em processos, prevenção de responsabilidade e
                  preservação de registros.
                </td>
              </tr>
              <tr className="border-border border-b">
                <th className="py-2 pr-4 align-top font-medium text-foreground">
                  Proteção da vida ou da incolumidade física
                </th>
                <td className="py-2 text-muted-foreground">
                  Situações excepcionais em que o tratamento seja indispensável à proteção de uma
                  pessoa.
                </td>
              </tr>
              <tr className="border-border border-b">
                <th className="py-2 pr-4 align-top font-medium text-foreground">
                  Legítimo interesse
                </th>
                <td className="py-2 text-muted-foreground">
                  Segurança, prevenção de fraude e melhorias operacionais proporcionais, com
                  avaliação de necessidade e direitos.
                </td>
              </tr>
              <tr>
                <th className="py-2 pr-4 align-top font-medium text-foreground">Consentimento</th>
                <td className="py-2 text-muted-foreground">
                  Preferências ou atividades opcionais quando essa for a base adequada; pode ser
                  revogado sem afetar tratamentos anteriores lícitos.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          O profissional ou a clínica responsável deve identificar e documentar a base legal dos
          Dados Clínicos. O consentimento não é usado para legitimar atividade quando outra base for
          mais apropriada nem é imposto como condição para tratamento necessário ao cuidado.
        </p>
      </>
    ),
  },
  {
    id: "menores",
    title: "Dados de gestantes menores de 18 anos",
    content: (
      <>
        <p>
          O tratamento de dados de crianças e adolescentes observa seu melhor interesse, proteção
          prioritária, privacidade por padrão, segurança reforçada, transparência adequada à idade e
          participação compatível com a autonomia progressiva.
        </p>
        <p>
          A menor de 18 anos não realiza o autocadastro geral. O profissional ou a equipe faz o
          cadastro e pode disponibilizar a ela credencial individual para acesso ao cartão pré-natal
          e à área da gestante. Não há acesso automático para familiares ou acompanhantes.
        </p>
        <p>
          Solicitações de responsável legal são analisadas considerando a LGPD, o Estatuto da
          Criança e do Adolescente, o Estatuto Digital da Criança e do Adolescente, o sigilo
          assistencial, a situação clínica e os direitos da menor. Para gestantes que sejam
          crianças, aplicam-se as exigências específicas do art. 14 da LGPD, incluindo consentimento
          específico e destacado do responsável quando essa for a hipótese jurídica exigida, ou
          outra hipótese válida devidamente documentada. Esse fluxo recebe acompanhamento jurídico e
          assistencial dedicado.
        </p>
      </>
    ),
  },
  {
    id: "compartilhamento",
    title: "Com quem compartilhamos dados",
    content: (
      <>
        <p>
          Não vendemos dados pessoais nem compartilhamos prontuários para publicidade. O
          compartilhamento ocorre somente quando necessário e com controles compatíveis com a
          finalidade.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="py-2 pr-4 font-medium text-foreground">Destinatário</th>
                <th className="py-2 pr-4 font-medium text-foreground">Finalidade</th>
                <th className="py-2 font-medium text-foreground">Dados envolvidos</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-border border-b align-top">
                <td className="py-2 pr-4 text-muted-foreground">
                  Profissionais, clínicas e equipes autorizados
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  Prestação do cuidado, colaboração e continuidade assistencial.
                </td>
                <td className="py-2 text-muted-foreground">
                  Dados de identificação e Dados Clínicos conforme permissões.
                </td>
              </tr>
              <tr className="border-border border-b align-top">
                <td className="py-2 pr-4 text-muted-foreground">
                  <a
                    href="https://supabase.com/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Supabase
                  </a>{" "}
                  (AWS, região us-east-1, EUA)
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  Infraestrutura de banco de dados, armazenamento, autenticação e backend.
                </td>
                <td className="py-2 text-muted-foreground">
                  Dados de conta, clínicos, arquivos, logs e metadados necessários.
                </td>
              </tr>
              <tr className="border-border border-b align-top">
                <td className="py-2 pr-4 text-muted-foreground">
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Google
                  </a>
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  Login opcional por conta Google.
                </td>
                <td className="py-2 text-muted-foreground">
                  Identificador, nome, e-mail e foto/perfil nos escopos autorizados.
                </td>
              </tr>
              <tr className="border-border border-b align-top">
                <td className="py-2 pr-4 text-muted-foreground">
                  <a
                    href="https://www.facebook.com/legal/terms/dataprocessing"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Meta/WhatsApp Business
                  </a>
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  Envio de lembretes assistenciais e operacionais habilitados.
                </td>
                <td className="py-2 text-muted-foreground">
                  Telefone, conteúdo mínimo da mensagem e metadados de entrega.
                </td>
              </tr>
              <tr className="border-border border-b align-top">
                <td className="py-2 pr-4 text-muted-foreground">
                  <a
                    href="https://stripe.com/br/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Stripe
                  </a>
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  Cobrança e gestão de assinaturas.
                </td>
                <td className="py-2 text-muted-foreground">
                  Dados de pagamento, cobrança, transação, cliente e prevenção de fraude.
                </td>
              </tr>
              <tr className="align-top">
                <td className="py-2 pr-4 text-muted-foreground">
                  Autoridades e terceiros legitimados
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  Cumprimento legal, ordem válida, proteção de direitos ou resposta a incidente.
                </td>
                <td className="py-2 text-muted-foreground">
                  Somente os dados necessários ao pedido ou dever.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          A lista pode mudar se houver substituição ou contratação de fornecedores. Alterações
          relevantes serão refletidas nesta Política. Contratos, instruções, confidencialidade e
          medidas de segurança são avaliados conforme o risco e o papel de cada destinatário.
        </p>
      </>
    ),
  },
  {
    id: "transferencia-internacional",
    title: "Transferências internacionais",
    content: (
      <>
        <p>
          O uso de Supabase, Google, Meta/WhatsApp Business e Stripe envolve tratamento ou acesso a
          dados fora do Brasil. O projeto Supabase do Ventre é hospedado na Amazon Web Services
          (AWS), região us-east-1 (Norte da Virgínia, Estados Unidos).
        </p>
        <p>
          Nessas transferências internacionais, a Timani adota um mecanismo permitido pelos arts. 33
          a 36 da LGPD e pela Resolução CD/ANPD nº 19/2024, como cláusulas contratuais-padrão,
          normas corporativas globais ou outra garantia equivalente exigida dos fornecedores. Caso a
          localização de algum fornecedor mude, esta Política será atualizada.
        </p>
      </>
    ),
  },
  {
    id: "login",
    title: "Login por e-mail/senha ou Google",
    content: (
      <>
        <p>
          O usuário pode autenticar-se por e-mail e senha ou com sua conta Google. No login Google,
          o Ventre solicita apenas os escopos necessários à identificação e autenticação, como
          openid, e-mail e perfil. A senha da conta Google não é recebida pela Timani.
        </p>
        <p>
          O usuário pode gerenciar a conexão na conta Google, sem prejuízo de eventual necessidade
          de criar outro método de acesso ao Ventre. Sessões, tokens e credenciais são tratados para
          autenticação e segurança; acessos suspeitos podem ser revogados.
        </p>
      </>
    ),
  },
  {
    id: "lembretes-whatsapp",
    title: "Lembretes por WhatsApp",
    content: (
      <>
        <p>
          O Ventre usa a Meta/WhatsApp Business para lembretes assistenciais e operacionais. A
          usuária pode desabilitar os lembretes nas configurações. Não utilizamos esse canal para
          publicidade no lançamento.
        </p>
        <p>
          O número de telefone, o conteúdo mínimo necessário e metadados de envio/entrega podem ser
          processados pela Meta e por empresas de seu grupo conforme seus termos. Para minimizar
          exposição, lembretes não incluem detalhes clínicos desnecessários. Desabilitar mensagens
          não elimina registros anteriores nem comunicações que sejam exigidas por lei ou
          indispensáveis à segurança da conta por outro canal.
        </p>
        <p>
          Se mensagens publicitárias forem introduzidas no futuro, a Timani atualizará esta Política
          antes do início, separará preferências e solicitará autorização quando exigida.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies e tecnologias de análise",
    content: (
      <>
        <p>
          No lançamento, o Ventre não utiliza Google Analytics, Meta Pixel ou cookies de
          publicidade. São usados apenas recursos estritamente necessários a login, segurança,
          preferências e funcionamento técnico.
        </p>
        <p>
          A Timani pode considerar utilizar Google Analytics futuramente, mas não o ativará antes de
          atualizar esta Política, mapear dados e transferências, configurar retenção e anonimização
          quando disponíveis e implementar aviso ou consentimento conforme a legislação e a
          plataforma aplicável.
        </p>
      </>
    ),
  },
  {
    id: "seguranca",
    title: "Segurança",
    content: (
      <>
        <p>
          Os dados são criptografados durante a transmissão e no armazenamento. A Plataforma também
          utiliza controle de acesso por perfil, credenciais individuais, trilhas de auditoria,
          gestão de permissões, atualização de software, monitoramento, registro de eventos e
          medidas de resposta a incidentes.
        </p>
        <p>
          O Supabase disponibiliza recursos como SSL/TLS, segurança em nível de linha (Row Level
          Security) e controles de plataforma; a configuração correta desses recursos é
          responsabilidade compartilhada da Timani. Segurança depende também de profissionais e
          clínicas: credenciais não devem ser compartilhadas, permissões devem ser revistas,
          dispositivos protegidos e exportações armazenadas com sigilo.
        </p>
        <p>
          Nenhum sistema é totalmente imune. Se o usuário identificar acesso indevido, perda de
          dispositivo, mensagem suspeita ou vulnerabilidade, deve comunicar imediatamente a{" "}
          <a href="mailto:falecom@ventre.app" className="text-primary underline underline-offset-2">
            falecom@ventre.app
          </a>{" "}
          e evitar divulgar publicamente informações que ampliem o risco.
        </p>
      </>
    ),
  },
  {
    id: "backups",
    title: "Backups e continuidade",
    content: (
      <>
        <p>
          O Ventre é hospedado no plano Pro do Supabase (AWS, região us-east-1), que realiza backups
          diários automáticos com retenção de 7 dias, com acesso restrito. O recurso adicional de
          recuperação a um ponto específico no tempo (PITR) não está contratado no momento; caso
          passe a ser, esta Política será atualizada com os novos parâmetros de frequência e
          retenção.
        </p>
        <p>
          A restauração de um backup é realizada pela equipe técnica da Timani a partir do painel do
          Supabase e pode gerar indisponibilidade temporária da Plataforma durante o processo,
          variável conforme o volume de dados.
        </p>
      </>
    ),
  },
  {
    id: "retencao",
    title: "Por quanto tempo conservamos os dados",
    content: (
      <>
        <p>
          Os dados são mantidos pelo tempo necessário à finalidade, à prestação do serviço, ao
          cumprimento de obrigações e ao exercício de direitos. Os prazos podem variar:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            dados de conta e assinatura: durante a relação e depois pelo prazo necessário a
            obrigações fiscais, contratuais, antifraude e probatórias;
          </li>
          <li>
            logs de aplicação e segurança: pelos prazos legais e de segurança aplicáveis, incluindo
            o Marco Civil da Internet quando incidente;
          </li>
          <li>
            prontuários e documentos clínicos: pelos prazos legais, regulatórios e éticos, podendo
            ser aplicável o mínimo de 20 anos a partir do último registro (Lei nº 13.787/2018);
          </li>
          <li>
            solicitações de titulares e incidentes: pelo prazo necessário a comprovar o atendimento
            e cumprir normas da ANPD; e
          </li>
          <li>
            backups: pelo prazo de retenção descrito na seção anterior, com acesso restrito e
            eliminação ou sobrescrita segundo o ciclo técnico.
          </li>
        </ul>
        <p>
          O cancelamento comercial não apaga automaticamente Dados Clínicos. Depois do período
          contratado, o profissional tem 30 dias de acesso somente para consulta e exportação; a
          guarda legal pode continuar após a suspensão. A gestante pode exercer seus direitos
          perante o controlador responsável.
        </p>
      </>
    ),
  },
  {
    id: "direitos-titulares",
    title: "Direitos dos titulares",
    content: (
      <>
        <p>Nos limites e condições da LGPD, o titular pode solicitar:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>confirmação da existência de tratamento e acesso;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>informação sobre compartilhamentos e transferências internacionais;</li>
          <li>
            anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados
            irregularmente;
          </li>
          <li>portabilidade, observada a regulamentação, sigilo e viabilidade técnica;</li>
          <li>
            eliminação de dados tratados com consentimento, ressalvadas hipóteses de conservação
            legal;
          </li>
          <li>revogação do consentimento e informação sobre suas consequências;</li>
          <li>
            oposição a tratamento baseado em hipótese diferente do consentimento quando houver
            descumprimento da LGPD; e
          </li>
          <li>
            revisão e informação sobre decisões unicamente automatizadas que afetem seus interesses,
            se essa atividade vier a existir.
          </li>
        </ul>
        <p>
          O pedido pode ser enviado a{" "}
          <a href="mailto:falecom@ventre.app" className="text-primary underline underline-offset-2">
            falecom@ventre.app
          </a>
          . Para proteger o titular, podemos verificar identidade e representação. Se a Timani atuar
          apenas como operadora ou se o pedido tratar de conteúdo clínico, ele pode ser encaminhado
          ao profissional ou à clínica controladora. O atendimento é gratuito e ocorre nos prazos
          legais; uma negativa será justificada quando aplicável.
        </p>
      </>
    ),
  },
  {
    id: "exclusao-correcao",
    title: "Exclusão, correção e exportação de prontuários",
    content: (
      <>
        <p>
          Direitos de correção e eliminação não significam apagar fatos clínicos ou trilhas de
          auditoria de forma retroativa. Correções de prontuário podem exigir adendo, retificação
          identificada ou preservação da versão anterior para manter autenticidade, integridade e
          responsabilidade profissional.
        </p>
        <p>
          Antes do encerramento, profissionais podem exportar os registros nos formatos
          disponibilizados. A Timani desenvolve mecanismos razoáveis de exportação, mas a
          organização do acervo, a continuidade do cuidado e a guarda de cópias exportadas são
          responsabilidades do controlador clínico.
        </p>
      </>
    ),
  },
  {
    id: "incidentes",
    title: "Incidentes de segurança",
    content: (
      <>
        <p>
          A Timani mantém processo de detecção, contenção, investigação, documentação e recuperação.
          Se um incidente com dados pessoais puder causar risco ou dano relevante, o controlador
          competente comunicará a ANPD e os titulares nos prazos e termos legais. Quando atuar como
          operadora, a Timani informará e auxiliará o profissional ou a clínica controladora
          conforme contratos e lei.
        </p>
        <p>
          A comunicação explicará natureza, categorias de dados, titulares afetados, medidas de
          segurança, riscos e providências. Investigações são conduzidas preservando evidências,
          confidencialidade e cooperação com autoridades.
        </p>
      </>
    ),
  },
  {
    id: "ia-decisoes-automatizadas",
    title: "Inteligência artificial e decisões automatizadas",
    content: (
      <p>
        O Ventre não tem funcionalidade de inteligência artificial no lançamento e não realiza
        decisões clínicas unicamente automatizadas. Se esse recurso for desenvolvido, a Timani fará
        avaliação de impacto, transparência, segurança, supervisão humana, governança de
        fornecedores e atualização prévia desta Política e dos Termos de Uso.
      </p>
    ),
  },
  {
    id: "alteracoes-politica",
    title: "Alterações desta Política",
    content: (
      <p>
        Esta Política pode ser atualizada para refletir mudanças legais, técnicas, de fornecedores
        ou de funcionalidades. Alterações relevantes serão comunicadas de forma adequada. A data e a
        versão vigentes ficam disponíveis no aplicativo e no site oficial.
      </p>
    ),
  },
  {
    id: "contato",
    title: "Contato e encarregado(a) pelo tratamento de dados",
    content: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Encarregado(a) (DPO): Otávio Bruno Leite Barbosa, sócio da Timani.</li>
        <li>Canal de suporte e privacidade: falecom@ventre.app</li>
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
