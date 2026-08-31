# Objetivo
Impementar uma nova forma de registrar a dinâmica uterina.

# Contextualização
A atual forma de registrar a dinâmica uterina (duração da contração + data/hora) trouxe algumas complicações nas primeiras utilizações da ferramenta:
- Muitos registros precisam ser realizados durante o processo, o que exige uma sincronicidade que é incompatível com o ambiente de trabalho de parto.
- Gráfico atual não está no formato de visualização do processo de dinâmica uterina nos moldes como o meio obstétrico está acostumado

# Requisitos
- A notação da dinâmica uterina (anteriormente chamado de Contrações) vai mudar. Não mediremos mais o tempo de contração isoladamente.
- A implementação atual desta ferramenta não deve ser descartada, nem a tabela do banco de dados destruído.
- Uma feature flag chamada `show_uterine_activity` deve alterar a exibição do modal associado ao botão Dinâmica uterina, alternando entre @apps/web/src/modals/add-birth-contraction-modal.tsx e uma nova modal para a dinâmica uterina chamada add-birth-uterine-activity-modal.tsx (a ser criada nesta implementação), de acordo com o valor da feature flag.
- Uma nova tabela deve ser criada para atender o novo formato de registro da dinâmica uterina: `birth_uterine_activity`
- O registro da dinâmica uterina deve ter 3 campos:
  - Quantidade de contrações: Entre 0 e 6 a cada 10 minutos - ou seja, caso 10 min: max 6; caso 20 min: max 12; caso 30 min: max 18
  - Intervalo de tempo: 10 min fixo, mas pode ser 10, 20, 30 minutos
  - Duração: Depende do número de contrações. Caso 3 contrações, deverá ser registrado 3 durações (em segundos). No banco de dados pode ser um campo de array numérico
- A notação deve ser exibida abaixo dos campos de input no modal, com destaque (fonte grande e peso mais alto): `DU 3/10'/50"` -> máscara: DU _/__'__", onde o primeiro dígito é o número de contrações (máx 6 a cada 10 minutos), depois o intervalo de tempo, e por último a média da duração (em segundos) das contrações. Essa notação deve ser registrada na nova tabela do banco de dados, juntamente com os dados coletados pelos input descritos acima.
  - Caso seja de 20 ou 30 minutos, exibir notações agrupadas a cada 10 minutos. Ex: 5 contrações em 20 minutos com duração de 23,25,33,40,42 deve exibir as seguintes notações: `DU 3/10'/27"` e `DU 2/10'/41"`
- Um novo chart deve ser exibido no lugar do atual, de acordo com o exemplo abaixo. Ele também deve ser reativo à feature flag `show_uterine_activity`, mostrando o novo chart caso ativado, ou chart atual caso desativado
- O chart deve ser preenchido da seguinte maneira:
  - Cada coluna representa 10 minutos do registro da tabela `birth_uterine_activity`
  - As colunas devem ser preenchidas de baixo para cima, observando a duração de cada contração
    - Contrações leves ou não efetivas (<20s) não devem ser registradas
    - Contrações intermediárias (>20s e <40s) deve ser registradas com um triangulo que ocupa metade do espaço reservado: ◢
    - Contrações efetivas (>40s) devem ser registradas com um quadrado completo que ocupa todo o espaço reservado: ■
  - Caso o registro seja de 20 ou 30 minutos, deve ser desmembrado em intervalos de tempo de 10 minutos. Ou seja: 6 contrações, medidas em 20 minutos, com durações de [28,31,35,43,55,54] deve ser dividido em 2 colunas do chart de: 3 contrações, medidas em 10 minutos, com durações de [28,31,35] e 3 contrações, medidas em 10 minutos, com durações de [43,55,54]
  - Ex: 
┌─┬─┬─┬─┬─┬─┬─┐
│ │ │ │ │ │ │ │
├─┼─┼─┼─┼─┼─┼─┤
│ │ │ │ │ │ │ │
├─┼─┼─┼─┼─┼─┼─┤ // 4 registros de 10 minutos (40 minutos ao total):
│ │ │ │■│ │ │ │ // - 1ª coluna: 3 contrações de durações 18, 26.        -> DU 2/10'/22" (primeira contração desprezada)
├─┼─┼─┼─┼─┼─┼─┤ // - 2ª coluna: 3 contrações de durações 31, 34, 43     -> DU 3/10'/36"
│ │■│■│■│ │ │ │ // - 3ª coluna: 3 contrações de durações 45, 46, 51     -> DU 3/10'/47"
├─┼─┼─┼─┼─┼─┼─┤ // - 4ª coluna: 4 contrações de durações 52, 55, 56, 55 -> DU 4/10'/54"
│ │◢│■│■│ │ │ │
├─┼─┼─┼─┼─┼─┼─┤
│◢│◢│■│■│ │ │ │
└─┴─┴─┴─┴─┴─┴─┘

# Não entra nesta implementação
Não devemos mexer em como exibir os dados no PDF do partograma por enquanto. Esta alteração ficará para uma próxima interação.