# Ventre — páginas de erro (modelo 1b)

Modelo **1b**: anel gestacional emoldurando o código do erro (arco incompleto, terracota),
sem card, fundo creme com textura de digital a 5%, wordmark no topo.

## Conteúdo

    assets/                       ventre.png, bg-fingerprint2.png  → copiar para apps/web/public/
    src/components/error-state.tsx   componente compartilhado (client)
    app/not-found.tsx                404
    app/error.tsx                    500
    app/offline/page.tsx             offline (PWA) com auto-retry
    preview/*.html                   mockups estáticos, abrem no navegador (sem build)

## Instalação

1. Copie `assets/ventre.png` e `assets/bg-fingerprint2.png` para `apps/web/public/`.
2. Copie `src/components/error-state.tsx` para `apps/web/src/components/shared/error-state.tsx`.
3. Copie os três arquivos de `app/` para `apps/web/app/`.
4. Ajuste o import do Button se o caminho no seu app não for `@ventre/ui`.
5. Troque o número do WhatsApp em `SUPPORT_WHATSAPP` (error-state.tsx).

Tudo usa tokens existentes do `globals.css` (`--primary`, `--background`, `--foreground`,
`--muted-foreground`, `--border`) e a animação `landingFadeUp`. As únicas adições de CSS são os
keyframes `ventreArcDraw` — já embutidos via `<style jsx global>`-free inline `<style>` no componente.
