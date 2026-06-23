# Objetivo
Precisamos melhorar a página de /billings tanto para os profissionais quanto para os membros da staff.

## Melhorias
- Em @apps/web/src/components/billing/dashboard-metrics.tsx devemos exibir o resumo financeiro do mês atual. Ou seja, mostrar pagamentos a receber, pagamentos realizados e pagamentos em atraso somente do mês corrente.
- Também temos que permitir que os usuários naveguem entre os meses facilmente, para verificar os mesmos dados em meses anteriores e posteriores.
- Todas as alterações devem refletir nos dados visualizados em @apps/web/src/screens/billing-dashboard-screen.tsx e @apps/web/src/screens/billing-dashboard-enterprise-screen.tsx

## Fluxo
- O usuário visualiza por padrão o resumo financeiro do mês atual.
- O usuário pode selecionar o mês que deseja visualizar.
- O usuário pode navegar entre os meses facilmente, para verificar os mesmos dados em meses anteriores e posteriores.
- O usuário pode visualizar o resumo financeiro de um range customizado de meses.
- O usuário pode visualizar o resumo financeiro de todos os meses.

## Considerações
- Utilize a skill frontend-design para melhorar a visualização do componente @apps/web/src/components/billing/dashboard-metrics.tsx
- Não altere a UI das demais páginas de billing, somente a dashboard-metrics.tsx