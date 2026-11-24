import { matchIllustrationForCue, recomposeProjectWithStyle } from './illustrationLayouts';
import { resolveProjectOverlaps } from './layoutSolver';
import {
  CanvasThemeId,
  ComparisonItem,
  LayoutCompositionId,
  LessonProject,
  SceneElement,
  TranscriptCue,
} from './types';

function extractQuotedPhrases(text: string): string[] {
  const matches = [...text.matchAll(/"([^"]+)"|'([^']+)'/g)];
  return matches.map((m) => (m[1] || m[2] || '').trim()).filter(Boolean);
}

function detectKeywordsForStrip(cues: TranscriptCue[]): ComparisonItem[] {
  const fullText = cues.map((c) => c.text).join(' ');
  const quoted = extractQuotedPhrases(fullText);

  if (quoted.length >= 2 && quoted.length <= 4) {
    const colors = ['#DC2626', '#2563EB', '#16A34A', '#7C3AED'];
    return quoted.slice(0, 3).map((q, idx) => {
      const cueWithPhrase = cues.find((c) => c.text.includes(q));
      const shortLabel = q.split(/\s+/).slice(0, 3).join(' ');
      return {
        label: shortLabel,
        activateAt: cueWithPhrase?.start ?? idx * 2,
        accentColor: colors[idx % colors.length],
      };
    });
  }

  // Fallback: pick 3 key cues as chapter comparison pills
  const step = Math.max(1, Math.floor(cues.length / 3));
  const picks = [cues[0], cues[Math.min(cues.length - 1, step)], cues[Math.min(cues.length - 1, step * 2)]].filter(
    Boolean,
  );
  const uniquePicks = Array.from(new Set(picks));
  const colors = ['#2563EB', '#16A34A', '#7C3AED'];

  return uniquePicks.slice(0, 3).map((cue, idx) => {
    const cleanWords = cue.text.replace(/[^\w\s'-]/g, '').split(/\s+/).filter(Boolean);
    const label = cleanWords.slice(0, 2).join(' ') || `Part ${idx + 1}`;
    return {
      label,
      activateAt: cue.start,
      accentColor: colors[idx % colors.length],
    };
  });
}

export function choreographFromTranscript(
  cues: TranscriptCue[],
  options?: {
    id?: string;
    title?: string;
    theme?: CanvasThemeId;
    compositionId?: LayoutCompositionId;
    includeToneMeter?: boolean;
    audioFileName?: string;
  },
): LessonProject {
  const safeCues = cues.length > 0 ? cues : [];
  const totalDuration =
    safeCues.length > 0
      ? Number((Math.max(...safeCues.map((c) => c.end)) + 0.4).toFixed(2))
      : 5.0;

  const elements: SceneElement[] = [];

  if (safeCues.length > 0) {
    const stripItems = detectKeywordsForStrip(safeCues);
    if (stripItems.length >= 2) {
      elements.push({
        id: 'auto-strip',
        type: 'comparison-strip',
        label: 'Thanh đối chiếu tự động',
        startTime: 0,
        endTime: totalDuration,
        enterAnimation: 'drop-in',
        exitAnimation: 'fade-out',
        layout: { x: 540, y: 195, width: 900, scale: 1, zIndex: 10 },
        props: {
          kind: 'comparison-strip',
          items: stripItems,
        },
      });
    }

    // Topic pill alternating between opening and solution
    const midpoint = safeCues[Math.floor(safeCues.length / 2)]?.start ?? totalDuration * 0.45;
    elements.push({
      id: 'auto-pill-1',
      type: 'topic-pill',
      label: 'Nhãn phần mở đầu',
      startTime: safeCues[0].start,
      endTime: Math.max(safeCues[0].start + 0.5, midpoint),
      enterAnimation: 'pop-up',
      exitAnimation: 'shrink',
      layout: { x: 540, y: 350, width: 340, scale: 1, zIndex: 12 },
      props: {
        kind: 'topic-pill',
        text: 'Watch closely',
        bgColor: '#DDD6FE',
        textColor: '#4338CA',
      },
    });

    if (safeCues.length >= 2) {
      elements.push({
        id: 'auto-pill-2',
        type: 'topic-pill',
        label: 'Nhãn phần kết luận',
        startTime: midpoint,
        endTime: totalDuration,
        enterAnimation: 'pop-up',
        exitAnimation: 'fade-out',
        layout: { x: 540, y: 350, width: 360, scale: 1, zIndex: 12 },
        props: {
          kind: 'topic-pill',
          text: 'Key takeaway',
          bgColor: '#DCFCE7',
          textColor: '#15803D',
        },
      });
    }

    // Visual prop anchor matched directly to transcript context
    const combinedText = safeCues.map((c) => c.text).join(' ');
    const propVariant = matchIllustrationForCue(combinedText, 'speech-bubble');

    elements.push({
      id: 'auto-prop',
      type: 'illustration-prop',
      label: `Minh họa: ${propVariant}`,
      startTime: 0,
      endTime: totalDuration,
      enterAnimation: 'fade-scale',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 635, width: 880, scale: 1, zIndex: 5 },
      props: {
        kind: 'illustration-prop',
        variant: propVariant,
      },
    });

    // Floating sentence cards per cue (show/hide dynamically!)
    safeCues.forEach((cue, idx) => {
      const quoted = extractQuotedPhrases(cue.text);
      const cardText = quoted[0] ?? cue.text;
      const isNegative = /\b(rude|wrong|never|avoid|bad|don't)\b/i.test(cue.text);
      const isPositive = /\b(polite|better|instead|good|try|use|may|could)\b/i.test(cue.text);

      elements.push({
        id: `auto-card-${idx + 1}`,
        type: 'sentence-card',
        label: `Thẻ nổi #${idx + 1}: ${cardText.slice(0, 26)}`,
        startTime: cue.start,
        endTime: cue.end,
        enterAnimation: 'pop-up',
        exitAnimation: idx === safeCues.length - 1 ? 'fade-out' : 'shrink',
        layout: { x: 540, y: 985, width: 830, scale: 1, zIndex: 20 },
        props: {
          kind: 'sentence-card',
          text: cardText,
          badge: isNegative ? 'cross' : isPositive ? 'check' : 'none',
          stampText: isNegative ? 'AVOID' : undefined,
          stampColor: isNegative ? '#DC2626' : undefined,
          emphasisColor: isNegative ? '#DC2626' : '#2563EB',
        },
      });

      // Bottom karaoke word-by-word dynamic card
      elements.push({
        id: `auto-karaoke-${idx + 1}`,
        type: 'karaoke-card',
        label: `Sub động #${idx + 1}`,
        startTime: cue.start,
        endTime: cue.end,
        enterAnimation: 'slide-up',
        exitAnimation: 'fade-out',
        layout: { x: 540, y: 1495, width: 860, scale: 1, zIndex: 30 },
        props: {
          kind: 'karaoke-card',
          cueId: cue.id,
          words: cue.words,
          activeColor: isNegative ? '#DC2626' : '#2563EB',
          inactiveColor: '#9CA3AF',
          spokenColor: '#111827',
        },
      });
    });

    if (options?.includeToneMeter ?? true) {
      elements.push({
        id: 'auto-meter',
        type: 'tone-meter',
        label: 'Thanh đo sắc thái / tiến độ',
        startTime: safeCues[0].start,
        endTime: totalDuration,
        enterAnimation: 'slide-up',
        exitAnimation: 'fade-out',
        layout: { x: 540, y: 1225, width: 700, scale: 1, zIndex: 18 },
        props: {
          kind: 'tone-meter',
          title: 'CLARITY',
          leftLabel: 'basic',
          rightLabel: 'natural',
          valueStart: 0.18,
          valueEnd: 0.88,
          animateStart: safeCues[0].start + totalDuration * 0.25,
          animateEnd: Math.max(safeCues[0].start + 1.0, totalDuration * 0.8),
        },
      });
    }
  }

  const baseProject: LessonProject = {
    id: options?.id ?? `project-${Date.now()}`,
    title: options?.title?.trim() || 'Dự án Video Tiếng Anh Mới',
    subtitle: `${safeCues.length} câu thoại · Tự động dàn cảnh & ẩn hiện`,
    theme: options?.theme ?? 'pastel-sunrise',
    compositionId: options?.compositionId ?? 'story-scenes',
    duration: totalDuration,
    fps: 30,
    cues: safeCues,
    elements: resolveProjectOverlaps(elements),
    audioFileName: options?.audioFileName,
  };

  if (options?.compositionId && options.compositionId !== 'story-scenes') {
    return recomposeProjectWithStyle(baseProject, options.compositionId, {
      theme: options.theme,
    });
  }
  return baseProject;
}
