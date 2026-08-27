# Objetivo
Quando iniciarmos o modo parto, exibir um formulário para registro dos eventos que desencadearam esse estado.

# Contexto
Ativar o modo parto depende de alguns fatores que acontecem durante o acompanhamento da gestante/gestação pela equipe de cuidado. Estes eventos também precisam ser registrados para fins de documentação, geração de relatórios, auditorias e futuras ações que necessitam de informações comprobatórias.

# Requisitos
- Iniciar o modo parto exibindo um formulário contendo: 1. Tipo de trabalho de parto, com os valores "espontâneo" e "Induzido". 2. Se for induzido, exibir tipos de indução: "Balão", "Misoprostol", "Ocitocina". 3. Campo aberto para "Descrição"
- O partograma só deve ser exibido ao atingir certas condições:
  - Contração a cada 3 minutos
  - 5+ cm de dilatação
- Caso as condições acima não sejam atendidas, os dados registrados não entram no partograma.
- Caso as condições acima não sejam atendidas, a aba do partograma deve estar desabilitada ou escondida.
