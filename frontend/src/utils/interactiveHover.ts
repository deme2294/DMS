/**
 * Professional Interactive 3D Parallax & Movable Hover Physics Engine
 * 
 * Provides buttery-smooth, hardware-accelerated 3D tilt, subtle translation,
 * and specular lighting reflection across all main sections, cards, and modal views.
 * 
 * Uses requestAnimationFrame throttling, event delegation, and supports
 * prefers-reduced-motion and fine-pointer detection.
 */

// Selectors for sections and cards that participate in movable hover physics
const MOVABLE_SELECTORS = [
  '[data-movable="true"]',
  '.movable-card',
  '.card',
  '[class*="viewCard"]',
  '[class*="categoryHero"]',
  '[class*="viewSlaHighlight"]',
  '[class*="viewSlaCard"]',
  '[class*="defaultSlaBox"]',
  '[class*="requestsPanel"]',
  '[class*="statCard"]',
  '[class*="statBox"]',
  '[class*="metricCard"]',
  '[class*="slaDangerCard"]',
  '[class*="slaWarningCard"]',
  '[class*="slaInfoCard"]',
  '[class*="slaDetailCard"]',
  '[class*="detailSection"]',
].join(', ');

interface ActiveItem {
  element: HTMLElement;
  rafId: number | null;
  targetTiltX: number;
  targetTiltY: number;
  targetMoveX: number;
  targetMoveY: number;
  currentTiltX: number;
  currentTiltY: number;
  currentMoveX: number;
  currentMoveY: number;
  glareX: number;
  glareY: number;
  isHovered: boolean;
}

let activeItems = new WeakMap<HTMLElement, ActiveItem>();
let isInitialized = false;

function supportsHover(): boolean {
  if (typeof window === 'undefined') return false;
  // Disable on devices that do not have a fine pointer (like touch phones)
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return hasFinePointer && !prefersReducedMotion;
}

function getItem(element: HTMLElement): ActiveItem {
  let item = activeItems.get(element);
  if (!item) {
    item = {
      element,
      rafId: null,
      targetTiltX: 0,
      targetTiltY: 0,
      targetMoveX: 0,
      targetMoveY: 0,
      currentTiltX: 0,
      currentTiltY: 0,
      currentMoveX: 0,
      currentMoveY: 0,
      glareX: 50,
      glareY: 50,
      isHovered: false,
    };
    activeItems.set(element, item);
  }
  return item;
}

function animateItem(item: ActiveItem) {
  // Smooth lerp physics towards target
  const factor = item.isHovered ? 0.18 : 0.22;
  item.currentTiltX += (item.targetTiltX - item.currentTiltX) * factor;
  item.currentTiltY += (item.targetTiltY - item.currentTiltY) * factor;
  item.currentMoveX += (item.targetMoveX - item.currentMoveX) * factor;
  item.currentMoveY += (item.targetMoveY - item.currentMoveY) * factor;

  const dx = Math.abs(item.targetTiltX - item.currentTiltX);
  const dy = Math.abs(item.targetTiltY - item.currentTiltY);
  const dm = Math.abs(item.targetMoveX - item.currentMoveX) + Math.abs(item.targetMoveY - item.currentMoveY);

  if (!item.isHovered && dx < 0.05 && dy < 0.05 && dm < 0.05) {
    // Rest state reached: reset styles cleanly
    item.element.style.transform = '';
    item.element.style.setProperty('--glare-opacity', '0');
    item.rafId = null;
    return;
  }

  const scale = item.isHovered ? 1.018 : 1.0;
  const zLift = item.isHovered ? 8 : 0;

  item.element.style.transform = `perspective(1000px) rotateX(${item.currentTiltX.toFixed(2)}deg) rotateY(${item.currentTiltY.toFixed(2)}deg) translate3d(${item.currentMoveX.toFixed(1)}px, ${item.currentMoveY.toFixed(1)}px, ${zLift}px) scale3d(${scale}, ${scale}, ${scale})`;
  item.element.style.setProperty('--mouse-x', `${item.glareX.toFixed(1)}%`);
  item.element.style.setProperty('--mouse-y', `${item.glareY.toFixed(1)}%`);
  item.element.style.setProperty('--glare-opacity', item.isHovered ? '1' : '0');

  item.rafId = requestAnimationFrame(() => animateItem(item));
}

function setupElement(element: HTMLElement) {
  if (element.dataset.movableSetup === 'true') return;
  element.dataset.movableSetup = 'true';
  element.classList.add('movable-interactive');
}

/**
 * Initializes global pointer event delegation for all movable cards and main sections.
 */
export function initInteractiveMovable(): () => void {
  if (isInitialized || !supportsHover()) return () => {};
  isInitialized = true;

  let currentTarget: HTMLElement | null = null;

  const handlePointerMove = (e: PointerEvent) => {
    const target = (e.target as HTMLElement)?.closest<HTMLElement>(MOVABLE_SELECTORS);
    if (!target) {
      if (currentTarget) {
        resetTarget(currentTarget);
        currentTarget = null;
      }
      return;
    }

    // Do not tilt interactive inputs or dropdown menus directly inside cards
    const isInteractiveChild = (e.target as HTMLElement)?.closest('input, textarea, select, a, button');
    
    setupElement(target);
    currentTarget = target;

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Relative mouse position from -0.5 to 0.5
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;

    const item = getItem(target);
    item.isHovered = true;

    // Tilt limits: maximum 5.5 degrees, maximum 4.5px move
    const maxTilt = target.dataset.tiltMax ? parseFloat(target.dataset.tiltMax) : 5.5;
    const maxMove = target.dataset.moveMax ? parseFloat(target.dataset.moveMax) : 4.5;

    // When hovering over interactive buttons inside, reduce tilt intensity for easier clicking
    const multiplier = isInteractiveChild ? 0.35 : 1.0;

    item.targetTiltX = -relY * maxTilt * multiplier;
    item.targetTiltY = relX * maxTilt * multiplier;
    item.targetMoveX = relX * maxMove * multiplier;
    item.targetMoveY = relY * maxMove * multiplier;

    item.glareX = ((e.clientX - rect.left) / rect.width) * 100;
    item.glareY = ((e.clientY - rect.top) / rect.height) * 100;

    if (!item.rafId) {
      item.rafId = requestAnimationFrame(() => animateItem(item));
    }
  };

  const resetTarget = (element: HTMLElement) => {
    const item = activeItems.get(element);
    if (!item) return;
    item.isHovered = false;
    item.targetTiltX = 0;
    item.targetTiltY = 0;
    item.targetMoveX = 0;
    item.targetMoveY = 0;

    if (!item.rafId) {
      item.rafId = requestAnimationFrame(() => animateItem(item));
    }
  };

  const handlePointerOut = (e: PointerEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (currentTarget && (!related || !currentTarget.contains(related))) {
      resetTarget(currentTarget);
      currentTarget = null;
    }
  };

  document.addEventListener('pointermove', handlePointerMove, { passive: true });
  document.addEventListener('pointerout', handlePointerOut, { passive: true });

  return () => {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerout', handlePointerOut);
    isInitialized = false;
  };
}
