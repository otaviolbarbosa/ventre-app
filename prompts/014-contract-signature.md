# Objetivo
Agora que já temos a área da gestante, vamos retomar a feature de assinatura de contrato, dessa vez possibilitando a assinatura tanto a profissional quanto a gestante.

# Contexto
A assinatura já era possível do lado da profissional, mas precisou ser desfeita para que pudéssemos implementar o cadastro da paciente.
Verifique o commit 513f6122c94d6c8efa4668bee5e51326ab2281c0 para entender o que foi desfeito com relação a assinatura do contrato da profissional

# Features e Requisitos
- Após a geração do contato, adicionar um botão em @apps/web/src/components/shared/patient-contract.tsx para que a profissional possa assinar digitalmente esse contrato.
- Caso o contrato seja gerido por uma empresa/organização, deve ser assinado pela gestora dessa empresa/organização
- Caso seja um acompanhamento com múltiplas profissionais, mas não vinculado a uma empresa, somente a profissional responsável deve assinar o contrato.
- A gestante deve receber uma notificação por push notification e whatsapp avisando que seu contrato está pronto e aguardando a sua assinatura.
- A gestante deve visualizar na sua home os seus contratos pendentes.
- A gestante pode abrir o contrato para visualização
- A gestante pode solicitar alguma alteração no contrato - campo de texto com rich editor onde ela pode digitar a sua solicitação de alteração
- A gestante pode assinar o contrato.
- A gestante visualiza o seus contratos assinados na sua home - associados a sua gestação.
- A profissional deve receber notificação por push notification e whatsapp avisando que a gestante solicitou alteração no contrato ou assinou o contrato.

# Melhorias
- Não permitir gerar o contrato caso hajam campos ausentes em relação aos documentos e e dados das partes - ou seja, caso hajam campos preenchidos com '[não informado]' no cabeçalho do documento.

# Mudanças na visualização do contrato. 
Para melhorar a experiência de visualização dos contratos, devemos gerar um arquivo PDF temporário em @apps/web/src/components/shared/contract-signature-preview.tsx , @apps/web/src/screens/contract-settings-screen.tsx e @apps/web/src/screens/personal-contract-settings-screen.tsx . Além disso, devemos utilizar a biblioteca pdf.js para renderizar a previsualização documento - econtrado em https://github.com/mozilla/pdf.js

