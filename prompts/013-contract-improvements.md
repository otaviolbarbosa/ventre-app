# Objetivo
Vamos alterar a forma que geramos contratos no sistema.

## Contexto
Atualmente geramos um único contrato base, tanto para gestores (contrato da empresa), quanto para profissionais (contrato para autônomo). Isso limita que tenhamos apenas um formato de contrato.

## Solução
Possibilitar a criação de diversos contratos base para abranger diferentes cenários de prestação de serviços.

## Requisitos

- Para empresas, usuários membros da staff podem gerar diversos contratos base
- Cada contrato base deve ter um nome - adicionar campo name na tabela contracts (nullable)
- Um seletor dropdown no topo da página /settings/contract e profile/settings/contract contendo a lista de contratos base salvos permite que o usuário consiga carregar nos campos de edição os dados do contrato base selecionado
- Nenhum contrato deve ser carregado automaticamente em /settings/contract e /profile/settings/contract - o usuário que deve escolher qual contrato deseja abrir.
- O formulário vazio deve permitir que o usuário preencha os campos para inserir um novo contrato base
- Adicione um botão para limpar formulário caso algum contrato esteja selecionado
- Em @apps/web/src/components/shared/patient-contract.tsx o usuário deve inicialmente ver somente um seletor dropdown com a lista de contratos base e um botão para um novo contrato.
  - O seletor dropdown deve ser agrupado por: contratos base da empresa e contratos base da profissional
  - Caso selecione um dos contratos base, deve exibir o formulário de contrato com os campos já preenchidos, permitindo alteração de qualquer valor contido no contrato base.
  - Caso selecione o botão de novo contrato, o formulário deve ser exibido em branco (em caso de formulário já preenchido, resetar os campos)
  - Também adicione um botão para que o usuário possa salvar este contrato em edição como um contrato base. Para isso, um modal deve ser exibido para que o usuário adicione um nome para esse novo contrato base. Deve ser associado com o usuário da profissional, nunca com a empresa.

# Considerações finais
Em @apps/web/src/components/shared/patient-contract.tsx Não devemos mais exibir as mensagens de contrato base não configurado, uma vez que o usuário pode criar um novo contrato base nesta mesma página.

A alteração no banco de dados deve gerar uma migration, e essa migration ser executada com o comando `pnpm db:push` e depois `pnpm db:types` para fazer o sync de tipos

