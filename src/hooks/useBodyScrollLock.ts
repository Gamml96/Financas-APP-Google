import { useEffect } from 'react';

/**
 * Trava o scroll da página enquanto `active` for true.
 *
 * O app rola dentro de `#root` (o `body` é `position: fixed`), então travar só
 * o `body` não impede nada. Sem isso, no celular o dedo arrasta o fundo do
 * modal e a tela de trás rola junto.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    // Mede a barra de rolagem antes de escondê-la, para o layout não pular.
    const scrollbarWidth = root ? root.offsetWidth - root.clientWidth : 0;

    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      rootOverflowY: root ? root.style.overflowY : '',
      rootPaddingRight: root ? root.style.paddingRight : '',
    };

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (root) {
      root.style.overflowY = 'hidden';
      if (scrollbarWidth > 0) {
        root.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      if (root) {
        root.style.overflowY = previous.rootOverflowY;
        root.style.paddingRight = previous.rootPaddingRight;
      }
    };
  }, [active]);
}
