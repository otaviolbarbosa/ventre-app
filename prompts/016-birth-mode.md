# Objetivo
Implementar uma nova funcionalidade que chamaremos inicialmente de "MODO PARTO".

# Contexto
Quando uma gestante entrar em trabalho de parto ativo, as profissionais da equipe de cuidado dessa gestante precisam ativar no aplicativo uma funcionalidade que possibilita que altera o comportamento do Ventre. Ao ativar o MODO PARTO, todas as profissionais da equipe de cuidado devem receber uma comunicação no WhatsApp do tipo: "A gestante MARIA DE FÁTIMA BEZERRA entrou em trabalho de parto. Clique no link abaixo para acompanhar e preencher a evolução" (você pode sugerir melhoras para esse texto), com isso o Ventre das profissionais da equipe de cuidado só devem abrir em uma única página: /modo-parto. Podemos pensar em utilizar um websocket que reage quando o Modo Parto é ativado para que as demais profissionais da equipe de cuidado sejam avisadas e possam contribuir para os registros durante a fase de parto ativa.

# Cenário de Exemplo de Inicialização do Modo Parto
A gestante X está chegou no hospital sentido contrações, e 1h depois entra em trabalho de parto ativo. A doula Y ativa o Modo Parto. A partir desse momento, a enfermeira W e a médica obstetra Z recebem uma mensagem no whatsapp informando que a X está em trabalho de parto. W estava com o Ventre aberto no momento, e apareceu uma notificação dentro do app informando sobre o início da fase de parto ativa, além de um contador regressivo de 10 segundos para antes de redirecionar o usuário para /modo-parto.

# Funcionalidades do Modo Parto.
No Modo Parto, teremos diversas ferramentas disponíveis para a equipe de cuidado da gestante poder registrar todas as informações possíveis que possam contar a história do parto a partir de dados. Segue a lista de funcionalidades para o Modo Parto:
- Registro de entrada em fase ativa: data e hora, id_profissional
- Contador de contração - usado para medir o tempo da contração, e o intervalo entre uma contração e outra. Cada medição do tempo de contração deve registrar data e hora, além do profissional que aferiu a medição. Cada medição de contração deve ser registrada como
  - Efetiva: mais de 40 segundos
  - Intermediária: entre 20 e 40 segundos
  - Não efetiva: menos que 20 segundos
- Aferição da ditalação cervical (cm): aferido a cada 30 minutos, data e hora, id_profissional
- Registro da altura do bebê (plano de Lee): -4 até +4, data e hora, id_profissional
- Frequencia cardíaca fetal (FCF em bpm): valor, data e hora, id_profissional
- Bolsa rota: data e hora, id_profissional
- Registro de fluido amniótico: registro de tipo (intacto, com sangue, claro, com mecônio), data e hora, id_profissional
- Admininstração de medicamentos: tipo de medicamento (fluídos intravenosos, ocitocina, analgesia, outros), data e hora, id_profissional

# Finalização do Modo Parto
Registrar informações referentes a finalização do parto da gestante. Obs: note que já temos um formulário em @apps/web/src/components/shared/finish-care-modal.tsx - devemos extender esse formulário com as funcionalidades abaixo para finalizar o acompanhamento dessa gestação
- Via de parto: Parto vaginal [normal|assistido], cesárea
- Data e hora do parto
- Sexo do bebê (M/F)
- Peso (kg)
- Escala de APGAR