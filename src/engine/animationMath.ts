import { SceneElement } from './types';

export interface ElementFrameState {
  visible: boolean;
  opacity: number;
  scale: number;
  translateY: number;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeOutBack(t: number): number {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function computeElementFrameState(
  element: SceneElement,
  time: number,
  enterDur = 0.28,
  exitDur = 0.22,
): ElementFrameState {
  if (time < element.startTime || time > element.endTime) {
    return { visible: false, opacity: 0, scale: 0.9, translateY: 0 };
  }

  const elapsed = time - element.startTime;
  const remaining = element.endTime - time;
  const lifespan = Math.max(0.1, element.endTime - element.startTime);

  const safeEnter = Math.min(enterDur, lifespan * 0.45);
  const safeExit = Math.min(exitDur, lifespan * 0.35);

  let opacity = 1;
  let scale = element.layout.scale || 1;
  let translateY = 0;

  if (elapsed < safeEnter && safeEnter > 0) {
    const p = elapsed / safeEnter;
    const easedCubic = easeOutCubic(p);
    const easedBack = easeOutBack(p);
    opacity = easedCubic;

    switch (element.enterAnimation) {
      case 'pop-up':
        scale *= 0.82 + 0.18 * easedBack;
        translateY += (1 - easedCubic) * 28;
        break;
      case 'slide-up':
        translateY += (1 - easedCubic) * 44;
        break;
      case 'drop-in':
        translateY -= (1 - easedCubic) * 38;
        break;
      case 'fade-scale':
        scale *= 0.92 + 0.08 * easedCubic;
        break;
    }
  } else if (remaining < safeExit && safeExit > 0) {
    const p = remaining / safeExit; // 1 -> 0
    const eased = easeOutCubic(p);
    opacity = eased;

    switch (element.exitAnimation) {
      case 'shrink':
        scale *= 0.86 + 0.14 * eased;
        break;
      case 'slide-down':
        translateY += (1 - eased) * 32;
        break;
      case 'fade-out':
        break;
    }
  }

  return {
    visible: opacity > 0.01,
    opacity: clamp01(opacity),
    scale,
    translateY,
  };
}
