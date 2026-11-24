import { computeElementFrameState } from './animationMath';
import {
  LessonProject,
  SceneElement,
  SceneElementType,
} from './types';

export const STAGE_SAFE_TOP = 108;
export const STAGE_SAFE_BOTTOM = 1415;
export const KARAOKE_SAFE_Y = 1585;
export const DEFAULT_MIN_VERTICAL_GAP = 24;
export const TIGHT_MIN_VERTICAL_GAP = 14;

export interface ElementBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  halfW: number;
  halfH: number;
}

function hasCjk(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
}

export function estimateWrappedLineCount(
  text: string,
  maxWidthPx: number,
  fontPx: number,
): number {
  const clean = text.trim();
  if (!clean) return 1;
  const avgCharW = hasCjk(clean) ? fontPx * 0.96 : fontPx * 0.56;
  const charsPerLine = Math.max(6, Math.floor(maxWidthPx / avgCharW));
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lines = 1;
  let lineChars = 0;
  for (const w of words) {
    if (w.length > charsPerLine) {
      if (lineChars > 0) {
        lines += 1;
        lineChars = 0;
      }
      const extraLines = Math.ceil(w.length / charsPerLine) - 1;
      lines += extraLines;
      lineChars = w.length % charsPerLine || charsPerLine;
      continue;
    }
    const nextLen = lineChars === 0 ? w.length : lineChars + 1 + w.length;
    if (nextLen > charsPerLine) {
      lines += 1;
      lineChars = w.length;
    } else {
      lineChars = nextLen;
    }
  }
  return Math.max(1, lines);
}

export function estimateElementHalfExtents(el: SceneElement): {
  halfW: number;
  halfH: number;
} {
  const scale = el.layout.scale > 0 ? el.layout.scale : 1;
  const baseHalfW = (el.layout.width || 600) / 2;
  let baseHalfH = 90;

  switch (el.props.kind) {
    case 'comparison-strip':
      baseHalfH = 60;
      break;
    case 'topic-pill':
      baseHalfH = 42;
      break;
    case 'illustration-prop': {
      const variant = el.props.variant;
      const data = el.props.data;
      if (variant === 'flow-diagram') {
        baseHalfH = 118;
      } else if (variant === 'gauge-arc') {
        baseHalfH = 148;
      } else if (variant === 'timeline-track') {
        baseHalfH = 112;
      } else if (variant === 'checklist-card') {
        const rows = Math.max(2, Math.min(4, data?.checklist?.length ?? 3));
        baseHalfH = Math.round((86 + rows * 68) / 2);
      } else if (variant === 'dialogue-upgrade') {
        const rows = Math.max(2, Math.min(3, data?.upgrades?.length ?? 3));
        baseHalfH = Math.round((68 + rows * 84) / 2);
      } else if (variant === 'clock-face') {
        baseHalfH = 145;
      } else if (variant === 'spatial-boxes') {
        baseHalfH = 122;
      } else if (variant === 'avatar-speech') {
        baseHalfH = 116;
      } else if (variant === 'phrase-icon-split') {
        baseHalfH = 250;
      } else if (variant === 'cafe-water' || variant === 'friends-chat') {
        baseHalfH = 146;
      } else {
        baseHalfH = 130;
      }
      break;
    }
    case 'sentence-card': {
      const innerW = Math.max(240, (el.layout.width || 820) - 110);
      const lines = estimateWrappedLineCount(el.props.text, innerW, 50);
      const subH = el.props.subtext ? 46 : 0;
      const cardH = Math.max(148, lines * 66 + subH + 74);
      const badgeExtra = el.props.badge && el.props.badge !== 'none' ? 16 : 0;
      const stampExtra = el.props.stampText ? 20 : 0;
      baseHalfH = Math.ceil((cardH + badgeExtra + stampExtra) / 2);
      break;
    }
    case 'word-stack': {
      const rowCount = Math.max(1, el.props.rows.length);
      const totalH = rowCount * 128 + (rowCount - 1) * 28;
      baseHalfH = Math.ceil(totalH / 2) + 8;
      break;
    }
    case 'shape-3d': {
      const depth = el.props.depth ?? 10;
      baseHalfH = Math.ceil(((el.layout.height ?? 200) + depth) / 2) + 8;
      break;
    }
    case 'tone-meter':
      baseHalfH = 74;
      break;
    case 'karaoke-card':
      baseHalfH = 104;
      break;
  }

  return {
    halfW: Math.round(baseHalfW * scale),
    halfH: Math.round(baseHalfH * scale),
  };
}

export function estimateElementBounds(el: SceneElement): ElementBounds {
  const { halfW, halfH } = estimateElementHalfExtents(el);
  return {
    left: el.layout.x - halfW,
    right: el.layout.x + halfW,
    top: el.layout.y - halfH,
    bottom: el.layout.y + halfH,
    width: halfW * 2,
    height: halfH * 2,
    halfW,
    halfH,
  };
}

function getZoneTier(type: SceneElementType): number {
  switch (type) {
    case 'comparison-strip':
      return 0;
    case 'topic-pill':
      return 1;
    case 'illustration-prop':
    case 'word-stack':
    case 'shape-3d':
      return 2;
    case 'sentence-card':
      return 3;
    case 'tone-meter':
      return 4;
    case 'karaoke-card':
      return 5;
  }
}

function intervalsOverlap(a: SceneElement, b: SceneElement, minOverlap = 0.06): boolean {
  return Math.min(a.endTime, b.endTime) - Math.max(a.startTime, b.startTime) > minOverlap;
}

function horizontalOverlap(a: ElementBounds, b: ElementBounds): boolean {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 12;
}

/**
 * Resolves vertical collisions across all simultaneously active visual elements
 * so cards, illustrations, diagrams, and tone meters never overlap each other
 * or encroach into the bottom karaoke subtitle safe zone.
 */
export function resolveProjectOverlaps(elements: SceneElement[]): SceneElement[] {
  const karaokeEls: SceneElement[] = [];
  const visualEls: SceneElement[] = [];

  for (const el of elements) {
    if (el.type === 'karaoke-card') {
      const cloned: SceneElement = {
        ...el,
        layout: {
          ...el.layout,
          y: Math.max(KARAOKE_SAFE_Y - 75, Math.min(1680, el.layout.y || KARAOKE_SAFE_Y)),
        },
      };
      karaokeEls.push(cloned);
    } else {
      visualEls.push({
        ...el,
        layout: { ...el.layout, scale: el.layout.scale > 0 ? el.layout.scale : 1 },
      });
    }
  }

  // Sort strictly by zone tier -> original Y -> startTime for deterministic topological packing
  visualEls.sort((a, b) => {
    const tierDiff = getZoneTier(a.type) - getZoneTier(b.type);
    if (tierDiff !== 0) return tierDiff;
    const yDiff = a.layout.y - b.layout.y;
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.startTime - b.startTime;
  });

  // Pass 1: Place top-down respecting min gap against all overlapping predecessors
  const placed: SceneElement[] = [];
  for (const current of visualEls) {
    const curBounds = estimateElementBounds(current);
    let minCenterY = STAGE_SAFE_TOP + curBounds.halfH;

    for (const prev of placed) {
      if (!intervalsOverlap(current, prev)) continue;
      const prevBounds = estimateElementBounds(prev);
      if (!horizontalOverlap(curBounds, prevBounds)) continue;
      minCenterY = Math.max(
        minCenterY,
        prevBounds.bottom + DEFAULT_MIN_VERTICAL_GAP + curBounds.halfH,
      );
    }

    const desiredY = Math.max(current.layout.y, minCenterY);
    placed.push({
      ...current,
      layout: {
        ...current.layout,
        y: Math.round(desiredY),
      },
    });
  }

  // Pass 2: Check for any elements pushed below STAGE_SAFE_BOTTOM and compact/scale crowded slices
  const sampleTimes = Array.from(
    new Set(
      placed.flatMap((el) => [
        Number((el.startTime + 0.05).toFixed(3)),
        Number(((el.startTime + el.endTime) / 2).toFixed(3)),
      ]),
    ),
  ).sort((a, b) => a - b);

  for (const t of sampleTimes) {
    const activeIndices = placed
      .map((el, idx) => ({ el, idx }))
      .filter(({ el }) => t >= el.startTime && t <= el.endTime)
      .map(({ idx }) => idx);

    if (activeIndices.length === 0) continue;

    const maxBottom = Math.max(
      ...activeIndices.map((idx) => estimateElementBounds(placed[idx]).bottom),
    );
    if (maxBottom <= STAGE_SAFE_BOTTOM) continue;

    // Repack this active slice tightly from STAGE_SAFE_TOP to STAGE_SAFE_BOTTOM
    const totalGap = TIGHT_MIN_VERTICAL_GAP * Math.max(0, activeIndices.length - 1);
    const availableH = STAGE_SAFE_BOTTOM - STAGE_SAFE_TOP - totalGap;
    const rawHeights = activeIndices.map((idx) => {
      const b = estimateElementBounds(placed[idx]);
      return b.height;
    });
    const sumH = rawHeights.reduce((acc, h) => acc + h, 0);

    if (sumH > availableH && availableH > 200) {
      const shrinkRatio = Math.max(0.7, Math.min(1, availableH / sumH));
      for (const idx of activeIndices) {
        const el = placed[idx];
        // Never shrink comparison-strip more than 0.92 so top tabs remain crisp
        const factor = el.type === 'comparison-strip' ? Math.max(0.92, shrinkRatio) : shrinkRatio;
        const newScale = Number(((el.layout.scale || 1) * factor).toFixed(3));
        placed[idx] = {
          ...el,
          layout: {
            ...el.layout,
            scale: Math.max(0.68, newScale),
          },
        };
      }
    }

    // Re-stack cleanly top-down inside STAGE_SAFE_TOP..STAGE_SAFE_BOTTOM
    let cursorY = STAGE_SAFE_TOP;
    for (let i = 0; i < activeIndices.length; i++) {
      const idx = activeIndices[i];
      const el = placed[idx];
      const { halfH } = estimateElementHalfExtents(el);
      const nextY = Math.round(cursorY + halfH);
      // Only shift upward if it was pushing down, or shift smoothly to eliminate overlap
      placed[idx] = {
        ...el,
        layout: {
          ...el.layout,
          y: Math.min(STAGE_SAFE_BOTTOM - halfH, nextY),
        },
      };
      cursorY = placed[idx].layout.y + halfH + TIGHT_MIN_VERTICAL_GAP;
    }
  }

  // Pass 3: Final safety assertion pass across all time overlaps in case Pass 2 pulled an element
  // into conflict with another companion outside that single sample time
  for (let i = 0; i < placed.length; i++) {
    const current = placed[i];
    const curBounds = estimateElementBounds(current);
    for (let j = 0; j < i; j++) {
      const prev = placed[j];
      if (!intervalsOverlap(current, prev)) continue;
      const prevBounds = estimateElementBounds(prev);
      if (!horizontalOverlap(curBounds, prevBounds)) continue;
      if (curBounds.top < prevBounds.bottom + TIGHT_MIN_VERTICAL_GAP) {
        const shiftedY = Math.round(prevBounds.bottom + TIGHT_MIN_VERTICAL_GAP + curBounds.halfH);
        if (shiftedY + curBounds.halfH <= STAGE_SAFE_BOTTOM) {
          placed[i] = {
            ...current,
            layout: { ...current.layout, y: shiftedY },
          };
        } else {
          // Shrink both slightly so they coexist above STAGE_SAFE_BOTTOM
          const nextScale = Number(Math.max(0.68, (current.layout.scale || 1) * 0.88).toFixed(3));
          const updated: SceneElement = {
            ...current,
            layout: { ...current.layout, scale: nextScale },
          };
          const updatedHalfH = estimateElementHalfExtents(updated).halfH;
          placed[i] = {
            ...updated,
            layout: {
              ...updated.layout,
              y: Math.min(
                STAGE_SAFE_BOTTOM - updatedHalfH,
                Math.round(prevBounds.bottom + TIGHT_MIN_VERTICAL_GAP + updatedHalfH),
              ),
            },
          };
        }
      }
    }
  }

  return [...placed, ...karaokeEls];
}

export interface VisualOverlapViolation {
  firstId: string;
  secondId: string;
  time: number;
  overlapPx: number;
}

export function findVisualOverlaps(
  elements: SceneElement[],
  stepSec = 0.25,
): VisualOverlapViolation[] {
  const violations: VisualOverlapViolation[] = [];
  if (elements.length === 0) return violations;

  const maxTime = Math.max(...elements.map((e) => e.endTime));
  const seenPairs = new Set<string>();

  for (let t = 0; t <= maxTime; t = Number((t + stepSec).toFixed(2))) {
    const active = elements.filter((el) => computeElementFrameState(el, t).visible);
    for (let i = 0; i < active.length; i++) {
      const a = active[i];
      const ba = estimateElementBounds(a);

      // Check visual element vs karaoke boundary
      if (a.type !== 'karaoke-card' && ba.bottom > STAGE_SAFE_BOTTOM + 20) {
        const key = `${a.id}::karaoke-zone`;
        if (!seenPairs.has(key)) {
          seenPairs.add(key);
          violations.push({
            firstId: a.id,
            secondId: 'karaoke-zone',
            time: t,
            overlapPx: Math.round(ba.bottom - STAGE_SAFE_BOTTOM),
          });
        }
      }

      for (let j = i + 1; j < active.length; j++) {
        const b = active[j];
        const bb = estimateElementBounds(b);
        if (!horizontalOverlap(ba, bb)) continue;
        const overlapY = Math.min(ba.bottom, bb.bottom) - Math.max(ba.top, bb.top);
        if (overlapY > 2) {
          const pairKey = [a.id, b.id].sort().join('::');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            violations.push({
              firstId: a.id,
              secondId: b.id,
              time: t,
              overlapPx: Math.round(overlapY),
            });
          }
        }
      }
    }
  }

  return violations;
}

export function resolveProjectElements(project: LessonProject): LessonProject {
  return {
    ...project,
    elements: resolveProjectOverlaps(project.elements),
  };
}
