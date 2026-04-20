/**
 * Shared scroll-reveal logic for enterprise page sections.
 *
 * Observes a root element and reveals child elements with staggered
 * animation delays based on their `data-delay` attributes.
 *
 * @example
 * ```ts
 * import { initScrollReveal } from '../enterprise-shared/scroll-reveal';
 *
 * function init() {
 *   initScrollReveal('.ep-section', [
 *     { selector: '.ep-pain-card', baseDelay: 0 },
 *     { selector: '.ep-incident-card', baseDelay: 400 },
 *     { selector: '.ep-authority', baseDelay: 700 },
 *   ]);
 * }
 *
 * init();
 * document.addEventListener('astro:after-swap', init);
 * ```
 */

export interface RevealGroup {
  /** CSS selector for elements to reveal within the section. */
  selector: string;
  /** Base delay in ms added before the per-element stagger. */
  baseDelay: number;
}

/**
 * Sets up IntersectionObserver-based scroll reveal for a section.
 *
 * - Adds `data-animations` to `<html>` when IO is available.
 * - On intersection, adds the `revealed` class to each matched element
 *   with a staggered `animationDelay`.
 * - Respects `prefers-reduced-motion` by revealing immediately.
 */
export function initScrollReveal(
  sectionSelector: string,
  groups: RevealGroup[],
): void {
  const section = document.querySelector<HTMLElement>(sectionSelector);
  if (!section) {
    return;
  }

  // Enable animation hiding via CSS
  if ('IntersectionObserver' in window) {
    document.documentElement.dataset.animations = '';
  }

  const prefersReduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  const allElements = groups.flatMap((g) => {
    const els = Array.from(section.querySelectorAll<HTMLElement>(g.selector));
    return els.map((el) => ({ el, baseDelay: g.baseDelay }));
  });

  if (prefersReduced || !('IntersectionObserver' in window)) {
    for (const { el } of allElements) {
      el.classList.add('revealed');
    }
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        for (const { el, baseDelay } of allElements) {
          const itemDelay = parseInt(el.dataset.delay ?? '0', 10);
          el.style.animationDelay = `${baseDelay + itemDelay}ms`;
          el.classList.add('revealed');
        }

        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.1 },
  );

  observer.observe(section);
}
