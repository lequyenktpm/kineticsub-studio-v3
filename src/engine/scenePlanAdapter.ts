import { matchIllustrationForCue } from './illustrationLayouts';
import { resolveProjectOverlaps } from './layoutSolver';
import { parseTimeToken } from './transcriptParser';
import {
  CanvasThemeId,
  ComparisonItem,
  IllustrationPropData,
  IllustrationVariant,
  LessonProject,
  SceneElement,
  ScenePlanDocument,
  ScenePlanShape,
  ScenePlanText,
  TranscriptCue,
  WordTiming,
} from './types';

const STAGE_W = 1080;
const STAGE_H = 1920;

export function parseWordLevelJson(input: string): WordTiming[] {
  try {
    const parsed = JSON.parse(input);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.words)
        ? parsed.words
        : [];

    const words: WordTiming[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const w = String(item.word ?? item.text ?? '').trim();
      const start = Number(item.start ?? 0);
      const end = Number(item.end ?? start + 0.4);
      if (!w || Number.isNaN(start) || Number.isNaN(end)) continue;
      words.push({
        word: w,
        start: Number(start.toFixed(3)),
        end: Number(Math.max(end, start + 0.1).toFixed(3)),
      });
    }
    return words;
  } catch {
    return [];
  }
}

export function groupWordsIntoCues(words: WordTiming[], maxWordsPerCue = 6): TranscriptCue[] {
  if (words.length === 0) return [];
  const cues: TranscriptCue[] = [];
  let bucket: WordTiming[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    bucket.push(w);
    const endsSentence = /[.!?。！？]$/.test(w.word);
    const nextGap = words[i + 1] ? words[i + 1].start - w.end : 0;

    if (bucket.length >= maxWordsPerCue || endsSentence || nextGap > 0.65 || i === words.length - 1) {
      cues.push({
        id: `cue-${cues.length + 1}`,
        start: bucket[0].start,
        end: bucket[bucket.length - 1].end,
        text: bucket.map((b) => b.word).join(' '),
        words: bucket,
      });
      bucket = [];
    }
  }
  return cues;
}

export interface FlexibleAiWordStackRow {
  prefix: string;
  suffix?: string;
  suffixColor?: string;
  appearAt?: string | number;
  phonetic?: string;
}

export interface FlexibleAiElement {
  type: string;
  start?: string | number;
  end?: string | number;
  cue?: number;
  at?: number;
  until?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // comparison_strip
  items?: (Omit<ComparisonItem, 'activateAt'> & { activateAt?: string | number })[];
  // topic_pill
  text?: string;
  bgColor?: string;
  textColor?: string;
  // illustration & @168 diagrams
  variant?: IllustrationVariant;
  data?: IllustrationPropData;
  nodes?: IllustrationPropData['nodes'];
  labels?: string[];
  value?: number;
  timeHour?: number;
  timeMinute?: number;
  formula?: string;
  subtitle?: string;
  checklist?: IllustrationPropData['checklist'];
  upgrades?: IllustrationPropData['upgrades'];
  boxes?: IllustrationPropData['boxes'];
  speechText?: string;
  reactionText?: string;
  // sentence_card
  subtext?: string;
  badge?: 'check' | 'cross' | 'question' | 'none';
  stampText?: string;
  stampColor?: string;
  emphasisWord?: string;
  emphasisColor?: string;
  // word_stack
  rows?: FlexibleAiWordStackRow[];
  // tone_meter
  title?: string;
  leftLabel?: string;
  rightLabel?: string;
  valueStart?: number;
  valueEnd?: number;
  // staircase_3d / shapes
  fill?: string;
  depth?: number;
  step_labels?: string[];
  stepLabels?: string[];
}

export interface FlexibleSceneDocument extends ScenePlanDocument {
  title?: string;
  theme?: CanvasThemeId;
  compositionId?: LayoutCompositionId;
  compositionReason?: string;
  elements?: FlexibleAiElement[];
  scenes: (ScenePlanDocument['scenes'][number] & {
    elements?: FlexibleAiElement[];
  })[];
}

function extractCleanJsonText(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  // Remove trailing commas before closing } or ]
  return text.replace(/,\s*([}\]])/g, '$1');
}

export function parseScenePlanJson(input: string): FlexibleSceneDocument | null {
  try {
    const cleaned = extractCleanJsonText(input);
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Array.isArray(parsed.scenes)) {
      return parsed as FlexibleSceneDocument;
    }
    // Also support top-level elements array without scenes wrapper
    if (Array.isArray(parsed.elements)) {
      return {
        title: parsed.title,
        theme: parsed.theme,
        compositionId: parsed.compositionId,
        compositionReason: parsed.compositionReason,
        scenes: [{ id: 'sc1', elements: parsed.elements }],
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function summarizeScenePlan(
  plan: FlexibleSceneDocument,
  cues: TranscriptCue[],
): { elementCount: number; cueCount: number; types: string[] } {
  let elementCount = 0;
  const typeSet = new Set<string>();
  for (const sc of plan.scenes) {
    for (const el of sc.elements ?? []) {
      elementCount += 1;
      if (el.type) typeSet.add(el.type);
    }
    for (const sh of sc.shapes ?? []) {
      elementCount += 1;
      if (sh.type) typeSet.add(sh.type);
    }
    for (const tx of sc.texts ?? []) {
      if (tx.shape_index === undefined) {
        elementCount += 1;
        typeSet.add('text');
      }
    }
  }
  return {
    elementCount,
    cueCount: cues.length,
    types: Array.from(typeSet),
  };
}

function resolveTimeValue(
  raw: string | number | undefined,
  words: WordTiming[],
  cues: TranscriptCue[],
  fallback: number,
): number {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if (trimmed.includes(':')) return parseTimeToken(trimmed);
  }
  void words;
  void cues;
  return fallback;
}

function convertFlexibleElements(
  rawElements: FlexibleAiElement[],
  words: WordTiming[],
  cues: TranscriptCue[],
  totalDuration: number,
): SceneElement[] {
  const result: SceneElement[] = [];

  rawElements.forEach((el, idx) => {
    const cueRef = el.cue
      ? cues[Math.min(cues.length - 1, Math.max(0, el.cue - 1))]
      : undefined;
    const wordRef = el.at
      ? words[Math.min(words.length - 1, Math.max(0, el.at - 1))]
      : undefined;

    const startTime = resolveTimeValue(
      el.start,
      words,
      cues,
      cueRef?.start ?? wordRef?.start ?? 0,
    );
    const endTime = resolveTimeValue(
      el.end,
      words,
      cues,
      cueRef?.end ?? Math.min(totalDuration, startTime + 3.5),
    );
    const safeEnd = Math.max(startTime + 0.4, endTime);

    const cx = el.x !== undefined ? (el.x <= 1 ? el.x * STAGE_W : el.x) : 540;
    const cy = el.y !== undefined ? (el.y <= 1 ? el.y * STAGE_H : el.y) : 960;
    const width = el.width !== undefined ? (el.width <= 1 ? el.width * STAGE_W : el.width) : 820;
    const height = el.height !== undefined ? (el.height <= 1 ? el.height * STAGE_H : el.height) : 240;

    const id = `ai-el-${idx + 1}`;

    switch (el.type) {
      case 'comparison_strip':
      case 'comparison-strip':
        result.push({
          id,
          type: 'comparison-strip',
          label: 'Thanh đối chiếu',
          startTime,
          endTime: safeEnd,
          enterAnimation: 'drop-in',
          exitAnimation: 'fade-out',
          layout: { x: cx, y: el.y !== undefined ? cy : 190, width: 900, scale: 1, zIndex: 10 },
          props: {
            kind: 'comparison-strip',
            items: (el.items ?? []).map((it) => ({
              ...it,
              activateAt:
                it.activateAt !== undefined
                  ? resolveTimeValue(it.activateAt, words, cues, startTime)
                  : undefined,
            })),
          },
        });
        break;

      case 'topic_pill':
      case 'topic-pill':
        result.push({
          id,
          type: 'topic-pill',
          label: `Nhãn: ${el.text || 'Topic'}`,
          startTime,
          endTime: safeEnd,
          enterAnimation: 'pop-up',
          exitAnimation: 'shrink',
          layout: { x: cx, y: el.y !== undefined ? cy : 345, width: 340, scale: 1, zIndex: 12 },
          props: {
            kind: 'topic-pill',
            text: el.text || 'Tip',
            bgColor: el.bgColor || '#DDD6FE',
            textColor: el.textColor || '#4338CA',
          },
        });
        break;

      case 'illustration':
      case 'illustration-prop':
      case 'flow_diagram':
      case 'gauge_arc':
      case 'timeline_track':
      case 'checklist_card':
      case 'dialogue_upgrade':
      case 'clock_face':
      case 'spatial_boxes':
      case 'avatar_speech':
      case 'phrase_icon_split': {
        const mappedVariant: IllustrationVariant =
          el.type === 'flow_diagram'
            ? 'flow-diagram'
            : el.type === 'gauge_arc'
              ? 'gauge-arc'
              : el.type === 'timeline_track'
                ? 'timeline-track'
                : el.type === 'checklist_card'
                  ? 'checklist-card'
                  : el.type === 'dialogue_upgrade'
                    ? 'dialogue-upgrade'
                    : el.type === 'clock_face'
                      ? 'clock-face'
                      : el.type === 'spatial_boxes'
                        ? 'spatial-boxes'
                        : el.type === 'avatar_speech'
                          ? 'avatar-speech'
                          : el.type === 'phrase_icon_split'
                            ? 'phrase-icon-split'
                          : el.variant || matchIllustrationForCue(cueRef?.text ?? el.text ?? '', 'cafe-water');

        const mergedData: IllustrationPropData | undefined =
          el.data ||
          el.nodes ||
          el.labels ||
          el.value !== undefined ||
          el.timeHour !== undefined ||
          el.formula ||
          el.checklist ||
          el.upgrades ||
          el.boxes ||
          el.speechText
            ? {
                ...(el.data ?? {}),
                title: el.data?.title ?? el.title,
                subtitle: el.data?.subtitle ?? el.subtitle,
                nodes: el.data?.nodes ?? el.nodes,
                labels: el.data?.labels ?? el.labels,
                value: el.data?.value ?? el.value,
                timeHour: el.data?.timeHour ?? el.timeHour,
                timeMinute: el.data?.timeMinute ?? el.timeMinute,
                formula: el.data?.formula ?? el.formula,
                checklist: el.data?.checklist ?? el.checklist,
                upgrades: el.data?.upgrades ?? el.upgrades,
                boxes: el.data?.boxes ?? el.boxes,
                speechText: el.data?.speechText ?? el.speechText ?? el.text,
                reactionText: el.data?.reactionText ?? el.reactionText,
                sceneIcon: el.data?.sceneIcon,
                highlightWord: el.data?.highlightWord,
              }
            : undefined;

        result.push({
          id,
          type: 'illustration-prop',
          label: `Minh họa: ${mappedVariant}`,
          startTime,
          endTime: safeEnd,
          enterAnimation: 'fade-scale',
          exitAnimation: 'fade-out',
          layout: { x: cx, y: el.y !== undefined ? cy : 635, width: 880, scale: 1, zIndex: 6 },
          props: {
            kind: 'illustration-prop',
            variant: mappedVariant,
            data: mergedData,
          },
        });
        break;
      }

      case 'sentence_card':
      case 'sentence-card':
        result.push({
          id,
          type: 'sentence-card',
          label: `Thẻ câu: ${(el.text || '').slice(0, 24)}`,
          startTime,
          endTime: safeEnd,
          enterAnimation: 'pop-up',
          exitAnimation: 'shrink',
          layout: { x: cx, y: el.y !== undefined ? cy : 980, width, scale: 1, zIndex: 22 },
          props: {
            kind: 'sentence-card',
            text: el.text || '',
            subtext: el.subtext,
            badge: el.badge || 'none',
            stampText: el.stampText,
            stampColor: el.stampColor,
            emphasisWord: el.emphasisWord,
            emphasisColor: el.emphasisColor,
            bgColor: el.bgColor,
            textColor: el.textColor,
          },
        });
        break;

      case 'word_stack':
      case 'word-stack':
        result.push({
          id,
          type: 'word-stack',
          label: `Xếp chồng ${(el.rows ?? []).length} mục`,
          startTime,
          endTime: safeEnd,
          enterAnimation: 'pop-up',
          exitAnimation: 'fade-out',
          layout: { x: cx, y: el.y !== undefined ? cy : 740, width: 740, scale: 1, zIndex: 20 },
          props: {
            kind: 'word-stack',
            rows: (el.rows ?? []).map((r, rIdx) => ({
              prefix: r.prefix || '',
              suffix: r.suffix || '',
              suffixColor: r.suffixColor || '#2563EB',
              appearAt:
                r.appearAt !== undefined
                  ? resolveTimeValue(r.appearAt, words, cues, startTime + rIdx * 0.6)
                  : startTime + rIdx * 0.6,
              phonetic: r.phonetic,
            })),
          },
        });
        break;

      case 'tone_meter':
      case 'tone-meter':
        result.push({
          id,
          type: 'tone-meter',
          label: `Thanh sắc thái: ${el.leftLabel || 'low'} ↔ ${el.rightLabel || 'high'}`,
          startTime,
          endTime: safeEnd,
          enterAnimation: 'slide-up',
          exitAnimation: 'fade-out',
          layout: { x: cx, y: el.y !== undefined ? cy : 1220, width: 700, scale: 1, zIndex: 18 },
          props: {
            kind: 'tone-meter',
            title: el.title || 'TONE',
            leftLabel: el.leftLabel || 'rude',
            rightLabel: el.rightLabel || 'polite',
            valueStart: el.valueStart ?? 0.2,
            valueEnd: el.valueEnd ?? 0.85,
            animateStart: startTime + 0.3,
            animateEnd: Math.max(startTime + 0.8, safeEnd - 0.3),
          },
        });
        break;

      case 'staircase_3d':
      case 'card_3d':
      case 'pill_3d':
      case 'cube_3d':
      case 'rect_3d':
        result.push({
          id,
          type: 'shape-3d',
          label: `${el.type}: ${el.text || el.step_labels?.join(' / ') || '3D'}`,
          startTime,
          endTime: safeEnd,
          enterAnimation: 'pop-up',
          exitAnimation: 'fade-out',
          layout: {
            x: cx,
            y: el.y !== undefined ? cy : 860,
            width,
            height: el.type === 'staircase_3d' ? 420 : height,
            scale: 1,
            zIndex: 16,
          },
          props: {
            kind: 'shape-3d',
            shapeType: el.type,
            fill: el.fill || '#14B8A6',
            shadow: true,
            highlight: true,
            depth: el.depth ?? 12,
            cornerRadius: 28,
            textContent: el.text,
            textColor: el.textColor || '#FFFFFF',
            textSize: 'headline',
            textWeight: 'bold',
            stepLabels: el.step_labels ?? el.stepLabels,
          },
        });
        break;
    }
  });

  return result;
}

export function scenePlanToProject(
  words: WordTiming[],
  plan: FlexibleSceneDocument,
  options?: {
    id?: string;
    title?: string;
    theme?: CanvasThemeId;
    compositionId?: LayoutCompositionId;
    audioFileName?: string;
    cuesOverride?: TranscriptCue[];
  },
): LessonProject {
  const cues = options?.cuesOverride ?? groupWordsIntoCues(words);
  const lastEnd =
    cues.length > 0
      ? Math.max(...cues.map((c) => c.end))
      : words.length > 0
        ? words[words.length - 1].end
        : 6.0;
  const totalDuration = Number((lastEnd + 0.5).toFixed(2));

  const elements: SceneElement[] = [];

  const sceneStarts = plan.scenes.map((sc) => {
    const allAts = [
      ...(sc.shapes ?? []).map((s) => s.at),
      ...(sc.texts ?? []).map((t) => t.at),
    ].filter((n) => typeof n === 'number' && n >= 1);
    const minAt = allAts.length > 0 ? Math.min(...allAts) : 1;
    const word = words[Math.min(words.length - 1, Math.max(0, minAt - 1))];
    return word ? word.start : 0;
  });

  plan.scenes.forEach((sc, scIdx) => {
    // Path 1: Flexible AI elements[] schema (from Prompt builder)
    if (Array.isArray(sc.elements) && sc.elements.length > 0) {
      elements.push(
        ...convertFlexibleElements(sc.elements, words, cues, totalDuration),
      );
    }

    // Path 2: Classic video_maker shapes[] + texts[] schema
    const nextSceneStart =
      scIdx < plan.scenes.length - 1 ? sceneStarts[scIdx + 1] : totalDuration;
    const sceneEnd = Math.max(sceneStarts[scIdx] + 0.6, nextSceneStart);
    const shapes = sc.shapes ?? [];
    const texts = sc.texts ?? [];

    shapes.forEach((sh, shIdx) => {
      const startWord = words[Math.min(words.length - 1, Math.max(0, (sh.at || 1) - 1))];
      const startTime = startWord ? startWord.start : 0;
      const untilWord =
        sh.until && words[Math.min(words.length - 1, Math.max(0, sh.until - 1))];
      const endTime = untilWord ? untilWord.end : sceneEnd;

      const attachedText = texts.find((t) => t.shape_index === shIdx);
      const px = (sh.position.x + sh.position.w / 2) * STAGE_W;
      const py = (sh.position.y + sh.position.h / 2) * STAGE_H;
      const pw = Math.round(sh.position.w * STAGE_W);
      const ph = Math.round(sh.position.h * STAGE_H);

      elements.push({
        id: `${sc.id}-shape-${shIdx}`,
        type: 'shape-3d',
        label: attachedText
          ? `${sh.type}: ${attachedText.content.slice(0, 22)}`
          : `Khối ${sh.type} #${shIdx + 1}`,
        startTime: Number(startTime.toFixed(2)),
        endTime: Number(Math.max(startTime + 0.4, endTime).toFixed(2)),
        enterAnimation: 'pop-up',
        exitAnimation: 'fade-out',
        atWordIndex: sh.at,
        layout: {
          x: Math.round(px),
          y: Math.round(py),
          width: pw,
          height: ph,
          scale: 1,
          zIndex: 10 + shIdx,
        },
        props: {
          kind: 'shape-3d',
          shapeType: sh.type,
          fill: sh.fill || '#14B8A6',
          shadow: sh.shadow ?? true,
          highlight: sh.highlight ?? true,
          depth: sh.depth ?? 10,
          cornerRadius: sh.corner_radius ?? 28,
          textContent: attachedText?.content,
          textColor: attachedText?.style?.color ?? '#FFFFFF',
          textSize: attachedText?.style?.size ?? 'headline',
          textWeight: attachedText?.style?.weight ?? 'bold',
          stepLabels: sh.step_labels,
        },
      });
    });

    texts
      .filter((t) => t.shape_index === undefined)
      .forEach((tx, txIdx) => {
        const startWord = words[Math.min(words.length - 1, Math.max(0, (tx.at || 1) - 1))];
        const startTime = startWord ? startWord.start : 0;
        const untilWord =
          tx.until && words[Math.min(words.length - 1, Math.max(0, tx.until - 1))];
        const endTime = untilWord ? untilWord.end : sceneEnd;
        const px = (tx.position?.x ?? 0.5) * STAGE_W;
        const py = (tx.position?.y ?? 0.42) * STAGE_H;
        const pw = (tx.position?.w ?? 0.78) * STAGE_W;

        elements.push({
          id: `${sc.id}-text-${txIdx}`,
          type: 'sentence-card',
          label: `Chữ: ${tx.content.slice(0, 22)}`,
          startTime: Number(startTime.toFixed(2)),
          endTime: Number(Math.max(startTime + 0.4, endTime).toFixed(2)),
          enterAnimation: 'slide-up',
          exitAnimation: 'fade-out',
          atWordIndex: tx.at,
          layout: {
            x: Math.round(px),
            y: Math.round(py),
            width: Math.round(pw),
            scale: 1,
            zIndex: 22 + txIdx,
          },
          props: {
            kind: 'sentence-card',
            text: tx.content,
            badge: 'none',
          },
        });
      });
  });

  const has3dOnly = elements.every((e) => e.type === 'shape-3d');
  const resolvedTheme = options?.theme ?? plan.theme ?? (has3dOnly ? 'studio-slate' : 'pastel-sunrise');
  const isDarkTheme = resolvedTheme === 'studio-slate';

  // Add bottom karaoke cues
  cues.forEach((cue, idx) => {
    elements.push({
      id: `karaoke-cue-${idx + 1}`,
      type: 'karaoke-card',
      label: `Sub động #${idx + 1}`,
      startTime: cue.start,
      endTime: cue.end,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1580, width: 920, scale: 1, zIndex: 40 },
      props: {
        kind: 'karaoke-card',
        cueId: cue.id,
        words: cue.words,
        activeColor: isDarkTheme ? '#FACC15' : '#2563EB',
        inactiveColor: isDarkTheme ? '#CBD5E1' : '#9CA3AF',
        spokenColor: isDarkTheme ? '#FFFFFF' : '#111827',
        variant: isDarkTheme ? 'dark-bar' : 'white-card',
      },
    });
  });

  const resolvedElements = resolveProjectOverlaps(elements);

  return {
    id: options?.id ?? `scene-ai-${Date.now()}`,
    title: options?.title?.trim() || plan.title || 'Dự án từ Scene JSON',
    subtitle: `${cues.length} câu thoại · ${resolvedElements.length} lớp đồ họa`,
    theme: resolvedTheme,
    compositionId: options?.compositionId ?? plan.compositionId,
    duration: totalDuration,
    fps: 30,
    cues,
    elements: resolvedElements,
    audioFileName: options?.audioFileName,
  };
}

export function projectToWordsAndScenePlan(project: LessonProject): {
  wordsJson: { words: WordTiming[] };
  scenePlan: ScenePlanDocument;
} {
  const allWords = project.cues.flatMap((c) => c.words);
  const findNearestWordIndex = (time: number): number => {
    if (allWords.length === 0) return 1;
    let bestIdx = 0;
    let bestDiff = Infinity;
    allWords.forEach((w, idx) => {
      const diff = Math.abs(w.start - time);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });
    return bestIdx + 1;
  };

  const visualElements = project.elements.filter((e) => e.type !== 'karaoke-card');
  const shapes: ScenePlanShape[] = [];
  const texts: ScenePlanText[] = [];

  visualElements.forEach((el) => {
    const at = el.atWordIndex ?? findNearestWordIndex(el.startTime);
    const until = findNearestWordIndex(el.endTime);
    const wNorm = Number((el.layout.width / STAGE_W).toFixed(3));
    const hNorm = Number(((el.layout.height ?? 200) / STAGE_H).toFixed(3));
    const xNorm = Number(Math.max(0.04, el.layout.x / STAGE_W - wNorm / 2).toFixed(3));
    const yNorm = Number(Math.max(0.04, el.layout.y / STAGE_H - hNorm / 2).toFixed(3));

    if (el.props.kind === 'shape-3d') {
      const shapeIdx = shapes.length;
      shapes.push({
        type: el.props.shapeType,
        position: { x: xNorm, y: yNorm, w: wNorm, h: hNorm },
        fill: el.props.fill,
        shadow: el.props.shadow,
        highlight: el.props.highlight,
        depth: el.props.depth,
        corner_radius: el.props.cornerRadius,
        at,
        until,
        step_labels: el.props.stepLabels,
      });
      if (el.props.textContent) {
        texts.push({
          content: el.props.textContent,
          shape_index: shapeIdx,
          style: {
            size: el.props.textSize ?? 'headline',
            color: el.props.textColor ?? '#FFFFFF',
            weight: el.props.textWeight ?? 'bold',
            align: 'center',
          },
          at,
          until,
        });
      }
    } else if (el.props.kind === 'sentence-card') {
      const shapeIdx = shapes.length;
      shapes.push({
        type: 'card_3d',
        position: { x: xNorm, y: yNorm, w: wNorm, h: 0.11 },
        fill: el.props.badge === 'cross' ? '#FEE2E2' : '#FFFFFF',
        shadow: true,
        highlight: true,
        depth: 8,
        corner_radius: 32,
        at,
        until,
      });
      texts.push({
        content: el.props.text,
        shape_index: shapeIdx,
        style: {
          size: 'headline',
          color: el.props.badge === 'cross' ? '#991B1B' : '#0F172A',
          weight: 'bold',
          align: 'center',
        },
        at,
        until,
      });
    } else if (el.props.kind === 'topic-pill') {
      const shapeIdx = shapes.length;
      shapes.push({
        type: 'pill_3d',
        position: { x: xNorm, y: yNorm, w: Math.min(0.65, wNorm), h: 0.06 },
        fill: el.props.bgColor,
        shadow: true,
        highlight: true,
        depth: 5,
        at,
        until,
      });
      texts.push({
        content: el.props.text,
        shape_index: shapeIdx,
        style: {
          size: 'body',
          color: el.props.textColor,
          weight: 'bold',
          align: 'center',
        },
        at,
        until,
      });
    }
  });

  return {
    wordsJson: { words: allWords },
    scenePlan: {
      scenes: [
        {
          id: 'sc1',
          shapes,
          texts,
        },
      ],
    },
  };
}
