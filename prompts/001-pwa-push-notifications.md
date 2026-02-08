# Notificações PWA

## Passos para Implementação

1. Service Worker (Registro e Escuta):
    - Crie um sw.js e registre-o no seu arquivo JS principal.
    - O service worker deve escutar o evento push para receber dados do servidor e usar self.registration.showNotification() para exibi-los.
2. Solicitar Permissão:
    - Peça permissão ao usuário (Notification.requestPermission()) após uma interação, preferencialmente contextualizada, e não imediatamente ao abrir o site.
3. Inscrição no Serviço Push (Subscription):
    - Utilize o PushManager do service worker para criar uma assinatura (subscribe), enviando a chave pública VAPID (gerada via biblioteca web-push, por exemplo ou Firebase).
    - Salve o objeto de inscrição (que contém o endpoint único do navegador) no seu servidor.
4. Enviar a Notificação (Servidor):
    - No backend, use uma biblioteca web-push para enviar a carga útil (payload) criptografada para o endpoint armazenado. 

## Exemplo Básico de Código

### No Service Worker (sw.js):

```js
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.png'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/')); // Abre o app ao clicar
});
```

No JavaScript principal:

```js
navigator.serviceWorker.ready.then(registration => {
  registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: 'SUA_CHAVE_PUBLICA_VAPID'
  }).then(subscription => {
    // Envie o 'subscription' para seu servidor backend
  });
});
```

## Considerações Importantes

- iOS/Safari: Requer iOS 16.4 ou superior e que o PWA tenha sido adicionado à tela de início.
- Melhores Práticas: Evite pedir permissão imediatamente. Explique ao usuário o benefício de receber as notificações.
- Serviços: Pode-se utilizar o Firebase Cloud Messaging (FCM) para facilitar a entrega. 