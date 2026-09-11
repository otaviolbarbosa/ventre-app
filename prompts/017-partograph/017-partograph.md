# Objetivo
Criar componente do partograma, onde serão plotados os dados coletados no modo parto.

# Contexto
Use os documentos como parâmetro para gerar o componente do partograma, que deve morar em @apps/web/src/screens/birth-mode-screen.tsx - usar abas para mostrar: 1. Partograma 2. Linha do tempo (já implementada).

# Requisitos
- Siga os documentos pdf em @prompts/017-partograph como exemplo do partograma a ser gerado.
- Ao inserir um novo registro, o partograma deve ser atualizado
- O componente do partograma deve ser dividido em sessões, onde a visualização dos dados são plotados com a ajuda da lib chart.js
- Crie um botão para realizar o download do documento do partograma, inserindo um com cabeçalho com a logomarca do ventre
- 