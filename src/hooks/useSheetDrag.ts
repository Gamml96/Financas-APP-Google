import { useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

/** Altura (px) a partir do topo do painel onde o arrasto pode começar. */
const DRAG_ZONE = 56;

/** Quanto (px) o usuário precisa arrastar para fechar. */
const CLOSE_THRESHOLD = 110;

/**
 * Permite arrastar os modais para baixo para fechar, no celular.
 *
 * Funciona por delegação: qualquer elemento com a classe `.modal-panel` ganha
 * o gesto, sem precisar alterar cada modal. O arrasto só começa na faixa
 * superior do painel (a "alça"), para não atrapalhar a rolagem do conteúdo.
 */
export function useSheetDrag() {
  useEffect(() => {
    let panel: HTMLElement | null = null;
    let startY = 0;
    let delta = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (!window.matchMedia(MOBILE_QUERY).matches) return;
      if (event.pointerType === 'mouse') return;

      const target = event.target as HTMLElement | null;
      const candidate = target?.closest?.('.modal-panel') as HTMLElement | null;
      if (!candidate) return;
      if (candidate.scrollTop > 0) return;

      const rect = candidate.getBoundingClientRect();
      if (event.clientY - rect.top > DRAG_ZONE) return;

      panel = candidate;
      startY = event.clientY;
      delta = 0;
      panel.style.transition = 'none';
      panel.style.touchAction = 'none';
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!panel) return;
      delta = Math.max(0, event.clientY - startY);
      panel.style.transform = `translateY(${delta}px)`;
      panel.style.opacity = String(Math.max(0.45, 1 - delta / 420));
    };

    const finish = () => {
      if (!panel) return;
      const el = panel;
      panel = null;

      el.style.transform = '';
      el.style.opacity = '';
      el.style.touchAction = '';

      if (delta > CLOSE_THRESHOLD) {
        // O backdrop é o irmão anterior do painel e já tem o onClick de fechar.
        const backdrop = el.previousElementSibling as HTMLElement | null;
        el.style.transition = '';
        backdrop?.click();
      } else {
        el.style.transition = 'transform 200ms ease, opacity 200ms ease';
        window.setTimeout(() => {
          el.style.transition = '';
        }, 220);
      }
    };

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);
    };
  }, []);
}
