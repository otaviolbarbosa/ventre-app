

# Melhorias em cobranças

## Objetivos

- Adicionar impostos, taxas, tributos, descontos em conbranças
- Exportar dados de cobranças

## Impostos, Taxas, Tributos e Descontos

Devemos adicionar configurações para cobranças, onde os gesatores das empresas podem criar ou selecionar valores a serem descontos para os profissionais de sua empresa. Esses itens podem ser fixos ou customizados. Por exemplo, adicionar impostos/tributos obrigatórios por lei, taxas da plataforma de pagamento, descontos referentes a utilização da marca ou franquia, etc.

### Requisitos

- Crie uma página em /settings para que o gestor possa gerenciar os impostos, taxas, tributos e descontos
- Seja o mais abrangente possível para cobrir diversos cenários referentes a tais impostos, taxas e descontos.
- Busque na legislação brasileira quais são os possíveis impostos e valores que podem ser adicionados aos serviços prestados pela plataforma.
- Os valores podem ser absolutos em percentuais
- Adicione logs para o gerenciamento de Impostos, taxas, tributos e descontos

### Exemplos

- O gestor da Empresa X adicionou um custo de 6.5% para cada cobrança realizada na plataforma, referente a emissão da nota fiscal. Ou seja, o profissional que usa a plataforma para cobrar R$1000,00 de uma paciente/gestante, deve ter um desconto de R$65,00 referentes aos 6.5% da nota fiscal.
- O gestor da Empresa Y adicionou uma taxa de utilização de R$20,00 como taxa de manutenção da plataforma.
- O gestor da Empresa Z adicionou uma taxa de 3.5% referente ao uso da plataforma de pagamento

## Exportar dados

Adicionar um botão para exportar os dados de cobrança de toda a empresa ou de um profissional específico. Esta ação deve gerar um documentos PDF em formato de relatório, contendo as informações de cobrança, com valores, descrições do serviço, profissionais envolvidos, taxas, impostos, descontos, etc.

### Requisitos

- Adicionar um botão em /billing para gerar o documento do relatório
- Poder filtrar o mês para o qual deseja gerar o relatório
- Poder filtrar o profissional para o qual deseja gerar o relatório (se usuário é gestor)
- Profissionais podem gerar apenas seus próprios relatórios
- Criar um cabeçalho contendo a logo do VentreApp, e dados 
- Adicionar os dados referentes a valores, período (ex: 01/06/2026 a 30/06/2026), descrições, profissionais envolvidos, datas, formas de pagamentos, taxas/impostos/tributos/descontos, valores finais após descontos de cada cobrança
- Adicione logs para a geração de relatórios