# Obejtivo:

criar uma rota onde as profissionais do parto ou membros da staff podem confeccionar o seu contrato com as suas gestantes.

## O que implementar?

- O contrato define as cláusulas que devem ser respeitadas entre ambas as partes, descrevendo direitos e deveres.
- Todo contrato possui um cabeçalho, que possui as informações das partes envolvidas, chamadas de CONTRATANTE (a gestante) e CONTRATADA.
- Para o cabeçalho existem duas possibilidades:
  1. A profissional não estar vinculada a nenhuma empresa, nesse caso os dados da CONTRATADA serão da própria profissional.
  2. A profissional estar vinculada a uma empresa/organização, nesse caso a profissional pode escolher entre usar seus próprios dados como CONTRATADA ou usar os dados da empresa;
- Caso a CONTRATADA seja uma empresa, o cabeçalho deve conter as informações da equipe de cuidado da gestante (titulares e backups)
- O cabeçalho não pode ser editado pela profissional ou gestor/secretaria, pois deve seguir o formato descrito na sessão Modelo de Cabeçalho abaixo
- As demais cláusulas devem ser fornecidas pela profissional ou empresa
  - Criar um formulário com um campo de texto para as cláusulas
  - O campo deve conter ferramentas de formatação para enriquecer o output do texto.
- A rota para configurar o "contrato base" deve ser /settings/contract
  - As cláusulas fornecidas pela profissional ou gestor/secretaria devem ser populadas em uma nova tabela, criada através de uma migration, chamada contracts, com uma flag chamada "is_base_contract" indicando que aquele é o contrato base
  - A nova tabela contracts, deve conter o user_id e organization_id, dependendo se é um contrato criado ou associado a uma profissional ou uma empresa.
  - A nova tabela também deve ser associada a uma gestante/paciente - menos o contrato base
- Cada gestação deve ser associado a um contrato, que deve ser baseado no contrato base.
- A profissional ou gestor/secretaria, ao criar um novo contrato de uma gestação, tem a opção de: 
  1. utilizar o texto do contrato base na integra ou 
  2. alterar o texto do contrato a partir do contrato base
- Ao final, deve ser possível exportar uma versão final em PDF, disponibilizando a versão pronta na sessão de documentos da gestante e salvando o documento exportado no supabase storage.
  - O arquivo PDF gerado deve ser noemado da seguinte forma: CONTRATO_<NOME_DA_PACIENTE>_<DATA_DE_HOJE_FORMATO_YYYY-MM-DD>

## Requisitos não funcionais

- Para o campo de texto rico, devemos utilizar o  quill editor (quilljs.com), utilizando o pnpm install para adicionar ao pacote package/ui
- Buscar documentação atualizada utilizando o mcp do context7
- Criar um componente em @packages/ui/src/shared chamado RichEditor para embedar o editor.
- O campo de texto rico deve conter apenas as ferramentas para alterar: o tamanho da fonte, font-family, Bold, Italic, Underscore, numbered list, bullet list e text-align

## Modelo de cabeçalho

Siga o formato abaixo, que deve se basear nos dados da gestante/gestação, empresa e profissional da equipe de cuidado:
```
CONTRATANTE: Larisse de Sousa Soares, Brasileira, casada, auxiliar
administrativa/biomédica, CPF: 019.130.411-58, RG:2835977,qd 301, CNJ 2, LOTE 9,
bloco D, apto 1705 Samambaia - BSB dra.larissesoares@gmail.com, telefone:
619376-2811 e data provável de parto: 27/07/2026, doravante denominada
simplesmente GESTANTE.

CONTRATADA: Instituto Do Ventre à Vida LTDA, pessoa jurídica de direito privado,
inscrita no CNPJ sob no 62.857.483/0001-00, com sede à QR 414 CJ 9A Lote 01 Apto
102, Samambaia Norte/DF, CEP 72.320-211, doravante denominada simplesmente
EQUIPE CONTRATADA.

EQUIPE CONTRATADA:
ENFERMEIRAS OBSTETRAS
Jéssica Oliveira Moraes, Brasileira, Divorciada, Enfermeira Obstetra, 036.183.791-10, QI
25 lote 12/14 apt 441 - Guará/DF, enfermeirajessicaoliveira@gmail.com, 61992258978,
COREN no 403505 ENF/DF
Marina Costa Tolentino Ferreira, Brasileira, Solteira, Enfermeira Obstetra,
022.037.191-17, SMPW quadra 3 conjunto 7 lote 6 casa F - Park Way DF,
marina.costa.tolentino@gmail.com , 61 9938-3996, COREN no 764.955 ENF/DF.

DOULA
Bruna Gois de Mello, CPF: 086.826.554-38, Endereço: Rua Caminho dos Buritis,
Casa 15, Núcleo Rural Córrego do Urubu, Cidade: Lago Norte/ Brasília, Telefone: (61)
99994-6737, E-mail: eubrunademello@gmail.com.
```

