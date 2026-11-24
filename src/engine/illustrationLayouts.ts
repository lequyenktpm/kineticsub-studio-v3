import { resolveProjectOverlaps } from './layoutSolver';
import {
  CanvasThemeId,
  ComparisonItem,
  IllustrationChecklistItem,
  IllustrationDialogueRow,
  IllustrationFlowNode,
  IllustrationPropData,
  IllustrationSpatialBox,
  IllustrationVariant,
  IllustrationSceneIcon,
  LayoutCompositionId,
  LessonProject,
  SceneElement,
  TranscriptCue,
} from './types';

export interface LayoutCompositionMeta {
  id: LayoutCompositionId;
  name: string;
  shortLabel: string;
  description: string;
  recommendedTheme: CanvasThemeId;
  signatureVariant: IllustrationVariant;
}

export const LAYOUT_COMPOSITIONS: LayoutCompositionMeta[] = [
  {
    id: 'story-scenes',
    name: 'Cảnh đời sống (@168 Story)',
    shortLabel: 'Cảnh đời sống',
    description: 'Tự đổi hình minh họa theo từng ngữ cảnh (quán nước, công sở, bạn bè, mẹo hay)',
    recommendedTheme: 'pastel-sunrise',
    signatureVariant: 'cafe-water',
  },
  {
    id: 'flow-steps',
    name: 'Sơ đồ 3 bước (Flow Steps)',
    shortLabel: 'Sơ đồ 3 bước',
    description: '3 nút tròn nối mũi tên theo cấp độ hoặc dòng thời gian giống @englishpracticing168',
    recommendedTheme: 'soft-lavender',
    signatureVariant: 'flow-diagram',
  },
  {
    id: 'gauge-tone',
    name: 'Đồng hồ sắc thái (Mood Gauge)',
    shortLabel: 'Đồng hồ sắc thái',
    description: 'Cung bán nguyệt chia 5 nấc màu kèm biểu cảm tự dịch chuyển theo từng câu',
    recommendedTheme: 'mint-breeze',
    signatureVariant: 'gauge-arc',
  },
  {
    id: 'checklist-cards',
    name: 'Thẻ Checklist đối chiếu',
    shortLabel: 'Thẻ Checklist',
    description: 'Bảng câu mẫu đánh dấu ✔ / ✘ rõ ràng, tô đậm từ khóa ngữ pháp',
    recommendedTheme: 'soft-lavender',
    signatureVariant: 'checklist-card',
  },
  {
    id: 'dialogue-upgrade',
    name: 'Nâng cấp hội thoại (Boring → Natural)',
    shortLabel: 'Nâng cấp câu',
    description: 'So sánh song song câu nói cơ bản bên trái → cách nói tự nhiên bên phải',
    recommendedTheme: 'warm-paper',
    signatureVariant: 'dialogue-upgrade',
  },
  {
    id: 'timeline-track',
    name: 'Đường chạy tiến trình (Timeline Track)',
    shortLabel: 'Đường chạy Timeline',
    description: 'Thanh đường chạy có mốc xuất phát – về đích theo tiến độ câu chuyện',
    recommendedTheme: 'mint-breeze',
    signatureVariant: 'timeline-track',
  },
  {
    id: 'spatial-contrast',
    name: '3 Hộp khái niệm / Phát âm',
    shortLabel: '3 Hộp khái niệm',
    description: '3 khung thẻ có icon trực quan đối chiếu quy tắc, giới từ hoặc cấp độ',
    recommendedTheme: 'warm-paper',
    signatureVariant: 'spatial-boxes',
  },
  {
    id: 'avatar-dialogue',
    name: 'Nhân vật & Bóng thoại (Real-life)',
    shortLabel: 'Nhân vật & Thoại',
    description: 'Nhân vật nói chuyện kèm bóng thoại tương tác và thẻ câu nhấn mạnh',
    recommendedTheme: 'pastel-sunrise',
    signatureVariant: 'avatar-speech',
  },
  {
    id: 'clock-spotlight',
    name: 'Đồng hồ & Thời điểm (Time Focus)',
    shortLabel: 'Đồng hồ & Giờ',
    description: 'Đồng hồ kim chỉ giờ kèm công thức đọc hoặc nhấn mạnh thời điểm trong bài',
    recommendedTheme: 'warm-paper',
    signatureVariant: 'clock-face',
  },
  {
    id: 'phrase-icon-split',
    name: 'Câu tách icon (@168 Look/See/Watch)',
    shortLabel: 'Câu tách icon',
    description:
      '3 pill đối chiếu trên cùng, sơ đồ nghĩa ngắn, câu quote lớn chèn icon giữa câu và từ cuối trong pill — giống Look / See / Watch',
    recommendedTheme: 'soft-lavender',
    signatureVariant: 'phrase-icon-split',
  },
];

export function isLayoutCompositionId(value: unknown): value is LayoutCompositionId {
  return typeof value === 'string' && LAYOUT_COMPOSITIONS.some((c) => c.id === value);
}

const LIGHT_TIKTOK_THEMES: CanvasThemeId[] = [
  'pastel-sunrise',
  'soft-lavender',
  'mint-breeze',
  'warm-paper',
];

function extractTimeHint(text: string): { hour: number; minute: number; formula: string } | null {
  const m = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) {
    const h = Math.max(1, Math.min(12, Number(m[1]) % 12 || 12));
    const min = Math.max(0, Math.min(59, Number(m[2])));
    return {
      hour: h,
      minute: min,
      formula: `${m[1]}:${m[2]}`,
    };
  }
  if (/friday|weekend|morning|afternoon|evening|clock|hour|minute|late|early/i.test(text)) {
    return {
      hour: 9,
      minute: 15,
      formula: 'Timing matters',
    };
  }
  return null;
}

/**
 * Matches the closest semantic vector illustration to a cue's text content
 * so visuals always accurately match the spoken context.
 */
export function matchIllustrationForCue(
  text: string,
  fallback: IllustrationVariant = 'speech-bubble',
): IllustrationVariant {
  const t = text.toLowerCase();
  if (/\b(\d{1,2}:\d{2}|clock|o'clock|twenty past|half past|quarter)\b/.test(t)) {
    return 'clock-face';
  }
  if (/(coffee|espresso|latte|cappuccino|コーヒー|カフェ)/.test(t) && !/(water|水)/.test(t)) {
    return 'coffee-cup';
  }
  if (/(water|drink|thirsty|salt|cafe|喉が渇|水|カフェ)/.test(t)) {
    return 'cafe-water';
  }
  if (/(office|boss|manager|friday|meeting|email|work|上司|オフィス|メール|金曜)/.test(t)) {
    return 'office-work';
  }
  if (/(hotel|reception|lobby|desk|check-in|ホテル)/.test(t)) {
    return 'hotel-desk';
  }
  if (/(friend|family|casual|classmate|colleague|友達|家族|同僚|先生)/.test(t)) {
    return 'friends-chat';
  }
  if (/(ladder|stair|step|level|stage|past|present|future|階段|段)/.test(t)) {
    return 'flow-diagram';
  }
  if (/(tone|polite|rude|warm|smile|friendly|トーン|笑顔|丁寧|礼儀)/.test(t)) {
    return 'gauge-arc';
  }
  if (/(ear|listen|quiz|check|sound|pronounc|耳|チェック|聞こえ)/.test(t)) {
    return 'ear-listen';
  }
  if (/(tip|secret|remember|trick|note|コツ|大事|迷ったら)/.test(t)) {
    return 'lightbulb-tip';
  }
  if (/(early|late|on time|in time|deadline|schedule)/.test(t)) {
    return 'timeline-track';
  }
  if (/\b(look|see|watch|hear|listen|say|tell|talk)\b/.test(t)) {
    return 'phrase-icon-split';
  }
  return fallback;
}

const CONTRAST_TRIOS: Array<{ words: [string, string, string]; hints: [string, string, string] }> = [
  { words: ['Look', 'See', 'Watch'], hints: ['on purpose', 'automatic', 'moving'] },
  { words: ['Hear', 'Listen', 'Sound'], hints: ['passive', 'active', 'result'] },
  { words: ['Say', 'Tell', 'Talk'], hints: ['words', 'someone', 'chat'] },
  { words: ['Make', 'Do', 'Get'], hints: ['create', 'action', 'obtain'] },
  { words: ['In time', 'On time', 'Late'], hints: ['before', 'exact', 'after'] },
];

export function pickSceneIcon(text: string): IllustrationSceneIcon {
  const t = text.toLowerCase();
  if (/(tv|television|screen|movie|film|video)/.test(t)) return 'tv';
  if (/\bwatch\b/.test(t) && /(moving|action|game|match)/.test(t)) return 'watch';
  if (/\b(look|see|eye|watch)\b/.test(t)) return 'eye';
  if (/(listen|hear|sound|ear)/.test(t)) return 'listen';
  if (/(walk|go|run|move)/.test(t)) return 'walk';
  if (/(phone|call|message|text)/.test(t)) return 'phone';
  return 'tv';
}

export function pickCompositionFromContext(text: string): LayoutCompositionId {
  const t = text.toLowerCase();
  const trioHit = CONTRAST_TRIOS.find((trio) =>
    trio.words.filter((w) => new RegExp(`\\b${w.replace(/\s+/g, '\\s+')}\\b`, 'i').test(t)).length >= 2,
  );
  if (trioHit) return 'phrase-icon-split';
  if (/\b(\d{1,2}:\d{2}|o'clock|clock|twenty past|half past)\b/.test(t)) return 'clock-spotlight';
  if (/(don't say|instead of|upgrade|boring|natural|rude|polite)/.test(t)) return 'dialogue-upgrade';
  if (/(step|first|then|finally|ladder|level 1|level 2)/.test(t)) return 'flow-steps';
  if (/(tone|mood|gauge|too direct|friendly)/.test(t)) return 'gauge-tone';
  if (/(checklist|✔|✘|correct|wrong example|do not)/.test(t)) return 'checklist-cards';
  if (/(early|late|on time|deadline|timeline)/.test(t)) return 'timeline-track';
  if (/(office|boss|cafe|hotel|friend|picture this)/.test(t)) return 'story-scenes';
  return 'story-scenes';
}

function splitPhraseForIcon(text: string): { prefix: string; highlight: string } {
  const cleaned = text.replace(/^["“]+|["”]+$/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { prefix: cleaned, highlight: cleaned };
  }
  return {
    prefix: words.slice(0, -1).join(' '),
    highlight: words[words.length - 1],
  };
}

function cleanShortPhrase(text: string, maxWords = 5, maxChars = 26): string {
  const quoted = text.match(/"([^"]+)"|'([^']+)'|「([^」]+)」/);
  const target = (quoted?.[1] || quoted?.[2] || quoted?.[3] || text).trim();
  const words = target.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords && target.length <= maxChars) return target;

  const picked: string[] = [];
  let charCount = 0;
  for (const w of words.slice(0, maxWords)) {
    const nextLen = charCount + (picked.length > 0 ? 1 : 0) + w.length;
    if (picked.length > 0 && nextLen > maxChars - 1) break;
    picked.push(w);
    charCount = nextLen;
  }
  const joined = (picked.length > 0 ? picked.join(' ') : words[0].slice(0, maxChars - 1)).replace(/[,;:]+$/, '');
  return picked.length < words.length || joined.length < target.length ? `${joined}…` : joined;
}

function extractTargetSentence(cue: TranscriptCue): string | null {
  const q = cue.text.match(/"([^"]+)"|'([^']+)'|「([^」]+)」/);
  if (q) return (q[1] || q[2] || q[3] || '').trim();
  // Pure Latin sentence inside a mixed JP/VN lesson
  const trimmed = cue.text.trim();
  if (/^[A-Za-z][A-Za-z0-9\s,'’?!.-]{3,}$/.test(trimmed) && !/^Follow along\.?$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function deriveStripItems(project: LessonProject): ComparisonItem[] {
  const existing = project.elements.find((e) => e.props.kind === 'comparison-strip');
  if (existing && existing.props.kind === 'comparison-strip' && existing.props.items.length >= 2) {
    return existing.props.items;
  }
  const joined = project.cues.map((c) => c.text).join(' ');
  const trio = CONTRAST_TRIOS.find(
    (item) =>
      item.words.filter((w) => new RegExp(`\\b${w.replace(/\s+/g, '\\s+')}\\b`, 'i').test(joined))
        .length >= 2,
  );
  if (trio) {
    const colors = ['#64748B', '#94A3B8', '#6366F1'];
    return trio.words.map((label, i) => ({
      label,
      sublabel: trio.hints[i],
      activateAt: project.cues[Math.min(i, Math.max(0, project.cues.length - 1))]?.start ?? 0,
      accentColor: colors[i],
    }));
  }
  const cues = project.cues;
  if (cues.length === 0) {
    return [
      { label: 'Step 1', sublabel: 'Intro', activateAt: 0, accentColor: '#2563EB' },
      { label: 'Step 2', sublabel: 'Core', activateAt: 2, accentColor: '#16A34A' },
      { label: 'Step 3', sublabel: 'Tip', activateAt: 4, accentColor: '#7C3AED' },
    ];
  }
  const colors = ['#2563EB', '#16A34A', '#7C3AED'];
  const indices =
    cues.length >= 3
      ? [0, Math.floor(cues.length / 2), cues.length - 1]
      : cues.length === 2
        ? [0, 1]
        : [0];
  return indices.map((idx, i) => {
    const cue = cues[idx];
    const target = extractTargetSentence(cue) ?? cue.text;
    const words = target.replace(/[^\p{L}\p{N}\s'-]/gu, '').split(/\s+/).filter(Boolean);
    const label = words.slice(0, 2).join(' ') || `Part ${i + 1}`;
    return {
      label: label.length > 14 ? `${label.slice(0, 12)}…` : label,
      activateAt: cue.start,
      accentColor: colors[i % colors.length],
    };
  });
}

function buildBeatSegments(project: LessonProject): Array<{
  startTime: number;
  endTime: number;
  cueText: string;
  cardText: string;
  subtext?: string;
  badge: 'check' | 'cross' | 'question' | 'none';
  stampText?: string;
  stampColor?: string;
  emphasisWord?: string;
  emphasisColor?: string;
  topicLabel: string;
  topicBg: string;
  topicColor: string;
}> {
  const existingCards = project.elements
    .filter((e) => e.props.kind === 'sentence-card')
    .sort((a, b) => a.startTime - b.startTime);

  const existingPills = project.elements
    .filter((e) => e.props.kind === 'topic-pill')
    .sort((a, b) => a.startTime - b.startTime);

  const cues = project.cues;
  const segments: ReturnType<typeof buildBeatSegments> = [];

  if (existingCards.length >= 2) {
    existingCards.forEach((card, idx) => {
      if (card.props.kind !== 'sentence-card') return;
      const mid = (card.startTime + card.endTime) / 2;
      const matchingCue =
        cues.find((c) => mid >= c.start && mid <= c.end) ??
        cues[Math.min(cues.length - 1, idx)] ??
        null;
      const matchingPill = existingPills.find((p) => mid >= p.startTime && mid <= p.endTime);
      const pillProps =
        matchingPill?.props.kind === 'topic-pill' ? matchingPill.props : undefined;

      segments.push({
        startTime: card.startTime,
        endTime: card.endTime,
        cueText: `${matchingCue?.text ?? ''} ${card.props.text}`.trim(),
        cardText: card.props.text,
        subtext: card.props.subtext,
        badge: card.props.badge ?? 'none',
        stampText: card.props.stampText,
        stampColor: card.props.stampColor,
        emphasisWord: card.props.emphasisWord,
        emphasisColor: card.props.emphasisColor,
        topicLabel: pillProps?.text ?? `Point #${idx + 1}`,
        topicBg: pillProps?.bgColor ?? '#DDD6FE',
        topicColor: pillProps?.textColor ?? '#4338CA',
      });
    });
    return segments;
  }

  // Fallback directly from cues
  const chunkSize = Math.max(1, Math.ceil(cues.length / 5));
  for (let i = 0; i < cues.length; i += chunkSize) {
    const slice = cues.slice(i, i + chunkSize);
    const first = slice[0];
    const last = slice[slice.length - 1];
    const combined = slice.map((c) => c.text).join(' ');
    const targetCue = slice.find((c) => extractTargetSentence(c)) ?? first;
    const cardText = extractTargetSentence(targetCue) ?? cleanShortPhrase(first.text, 7);
    const isNeg = /(rude|wrong|avoid|never|ぶっきらぼう|NG)/i.test(combined);
    const isPos = /(polite|better|natural|could|may|丁寧|自然)/i.test(combined);
    segments.push({
      startTime: first.start,
      endTime: last.end,
      cueText: combined,
      cardText,
      badge: isNeg ? 'cross' : isPos ? 'check' : 'none',
      stampText: isNeg ? 'AVOID' : undefined,
      stampColor: isNeg ? '#DC2626' : undefined,
      emphasisColor: isNeg ? '#DC2626' : '#2563EB',
      topicLabel: i === 0 ? 'Picture this' : isPos ? 'Natural choice' : `Part ${segments.length + 1}`,
      topicBg: isNeg ? '#FEE2E2' : isPos ? '#DCFCE7' : '#DDD6FE',
      topicColor: isNeg ? '#B91C1C' : isPos ? '#15803D' : '#4338CA',
    });
  }

  return segments;
}

function buildIllustrationDataForComposition(
  compositionId: LayoutCompositionId,
  stripItems: ComparisonItem[],
  segments: ReturnType<typeof buildBeatSegments>,
  segIdx: number,
  segCount: number,
  project: LessonProject,
): { variant: IllustrationVariant; data?: IllustrationPropData } {
  const seg = segments[segIdx];
  const progress = segCount <= 1 ? 0.65 : (segIdx + 0.5) / segCount;

  switch (compositionId) {
    case 'story-scenes': {
      const variant = matchIllustrationForCue(seg.cueText, 'speech-bubble');
      return {
        variant,
        data:
          variant === 'clock-face'
            ? {
                timeHour: extractTimeHint(seg.cueText)?.hour ?? 8,
                timeMinute: extractTimeHint(seg.cueText)?.minute ?? 20,
                formula: extractTimeHint(seg.cueText)?.formula ?? cleanShortPhrase(seg.cardText, 4),
              }
            : undefined,
      };
    }

    case 'flow-steps': {
      const colors = ['#2563EB', '#16A34A', '#7C3AED'];
      const icons: IllustrationFlowNode['icon'][] = ['chat', 'check', 'star'];
      const nodes: IllustrationFlowNode[] = stripItems.slice(0, 3).map((it, idx) => ({
        label: it.label,
        sublabel: it.sublabel,
        icon: icons[idx % icons.length],
        color: it.accentColor || colors[idx % colors.length],
      }));
      return {
        variant: 'flow-diagram',
        data: {
          title: seg.topicLabel,
          nodes,
          value: progress,
        },
      };
    }

    case 'gauge-tone': {
      const sentimentVal =
        seg.badge === 'cross'
          ? 0.16
          : seg.badge === 'check'
            ? Math.min(0.92, 0.52 + progress * 0.42)
            : 0.52;
      return {
        variant: 'gauge-arc',
        data: {
          title: seg.topicLabel,
          subtitle:
            seg.badge === 'cross'
              ? 'Too direct'
              : sentimentVal > 0.75
                ? 'Polite & Natural'
                : 'Friendly',
          labels: ['Rough', 'Okay', 'Good', 'Polite', 'Great'],
          value: sentimentVal,
        },
      };
    }

    case 'checklist-cards': {
      const items: IllustrationChecklistItem[] = segments
        .slice(Math.max(0, segIdx - 1), Math.max(3, segIdx + 2))
        .slice(0, 3)
        .map((s) => ({
          text: s.cardText,
          highlight: s.emphasisWord,
          ok: s.badge !== 'cross',
        }));
      if (items.length < 2 && project.cues.length >= 2) {
        items.push({
          text: cleanShortPhrase(project.cues[1].text, 6),
          ok: true,
        });
      }
      return {
        variant: 'checklist-card',
        data: {
          title: 'Key Examples',
          checklist: items,
        },
      };
    }

    case 'dialogue-upgrade': {
      const negativeSeg = segments.find((s) => s.badge === 'cross');
      const positiveSegs = segments.filter((s) => s.badge !== 'cross');
      const rows: IllustrationDialogueRow[] = [];
      const basePrompt = negativeSeg ? cleanShortPhrase(negativeSeg.cardText, 4, 21) : 'Basic phrase';

      // Pick up to 3 distinct positive levels (e.g. one from Can, Could, May) when available
      const distinctUpgrades: typeof positiveSegs = [];
      const seenLabels = new Set<string>();
      for (const p of positiveSegs) {
        if (!seenLabels.has(p.topicLabel) && !distinctUpgrades.some((d) => d.cardText === p.cardText)) {
          distinctUpgrades.push(p);
          seenLabels.add(p.topicLabel);
        }
        if (distinctUpgrades.length >= 3) break;
      }
      if (distinctUpgrades.length < 3) {
        for (const p of positiveSegs) {
          if (!distinctUpgrades.some((d) => d.cardText === p.cardText)) {
            distinctUpgrades.push(p);
          }
          if (distinctUpgrades.length >= 3) break;
        }
      }

      if (distinctUpgrades.length > 0) {
        distinctUpgrades.forEach((u, i) => {
          const prevText = i === 0 ? basePrompt : cleanShortPhrase(distinctUpgrades[i - 1].cardText, 4, 21);
          const promptText =
            i > 0 && prevText === rows[i - 1]?.prompt
              ? `${distinctUpgrades[i - 1].topicLabel || `Step ${i}`}`
              : prevText;
          rows.push({
            prompt: promptText,
            upgrade: cleanShortPhrase(u.cardText, 4, 21),
            badgeColor: i === 0 ? '#2563EB' : i === 1 ? '#16A34A' : '#7C3AED',
          });
        });
      } else {
        rows.push({
          prompt: cleanShortPhrase(seg.cardText, 4, 21),
          upgrade: 'Sounds natural',
          badgeColor: '#16A34A',
        });
      }
      return {
        variant: 'dialogue-upgrade',
        data: {
          title: 'Upgrade Phrase',
          upgrades: rows,
        },
      };
    }

    case 'timeline-track': {
      const labels = stripItems.slice(0, 3).map((s) => s.label);
      return {
        variant: 'timeline-track',
        data: {
          title: seg.topicLabel,
          labels: labels.length >= 2 ? labels : ['Start', 'Focus', 'Mastered'],
          value: progress,
        },
      };
    }

    case 'spatial-contrast': {
      const icons: IllustrationSpatialBox['icon'][] = ['dot', 'surface', 'cube'];
      const accents = ['#2563EB', '#16A34A', '#7C3AED'];
      const boxes: IllustrationSpatialBox[] = stripItems.slice(0, 3).map((it, idx) => ({
        title: it.label,
        subtitle: it.sublabel || `Level ${idx + 1}`,
        icon: icons[idx % icons.length],
        accent: it.accentColor || accents[idx % accents.length],
      }));
      return {
        variant: 'spatial-boxes',
        data: { boxes },
      };
    }

    case 'avatar-dialogue': {
      return {
        variant: 'avatar-speech',
        data: {
          speechText: seg.cardText,
          reactionText:
            seg.badge === 'cross'
              ? 'Too blunt!'
              : seg.badge === 'check'
                ? 'Natural!'
                : seg.topicLabel,
        },
      };
    }

    case 'clock-spotlight': {
      const hint = extractTimeHint(seg.cueText);
      const stepHour = hint?.hour ?? (((8 + segIdx) % 12) || 12);
      const stepMin = hint?.minute ?? (segIdx * 15) % 60;
      return {
        variant: 'clock-face',
        data: {
          timeHour: stepHour,
          timeMinute: stepMin,
          formula: hint?.formula ?? cleanShortPhrase(seg.cardText, 4),
          subtitle: seg.topicLabel,
        },
      };
    }

    case 'phrase-icon-split': {
      const split = splitPhraseForIcon(seg.cardText);
      const nodes: IllustrationFlowNode[] = stripItems.slice(0, 3).map((it, idx) => ({
        label: it.label.toUpperCase(),
        sublabel: it.sublabel,
        color: it.accentColor || ['#94A3B8', '#64748B', '#6366F1'][idx],
      }));
      return {
        variant: 'phrase-icon-split',
        data: {
          title: stripItems.map((s) => s.label).join(' / '),
          nodes,
          speechText: split.prefix,
          highlightWord: split.highlight,
          subtitle: seg.badge === 'cross' ? `${seg.cardText} = wrong` : undefined,
          sceneIcon: pickSceneIcon(`${seg.cueText} ${seg.cardText}`),
        },
      };
    }
  }
}

export function recomposeProjectWithStyle(
  project: LessonProject,
  compositionId: LayoutCompositionId,
  options?: { theme?: CanvasThemeId },
): LessonProject {
  const meta =
    LAYOUT_COMPOSITIONS.find((c) => c.id === compositionId) ?? LAYOUT_COMPOSITIONS[0];
  const nextTheme = options?.theme ?? meta.recommendedTheme;
  const stripItems = deriveStripItems(project);
  const segments = buildBeatSegments(project);
  const karaokeEls = project.elements.filter((e) => e.type === 'karaoke-card');

  const newVisuals: SceneElement[] = [];

  // 1. Top Comparison Strip spanning the lesson
  if (stripItems.length >= 2) {
    newVisuals.push({
      id: `comp-strip-${compositionId}`,
      type: 'comparison-strip',
      label: 'Thanh đối chiếu chủ đề',
      startTime: 0,
      endTime: project.duration,
      enterAnimation: 'drop-in',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 185, width: 900, scale: 1, zIndex: 10 },
      props: {
        kind: 'comparison-strip',
        items: stripItems,
      },
    });
  }

  // 2. Per-segment synchronized Topic Pill + Rich Illustration/Diagram + Sentence Card
  // Merge consecutive segments whose topic pill / illustration matches so animations feel natural
  let lastPillEnd = -1;
  let lastIllEnd = -1;
  let lastCardEnd = -1;

  segments.forEach((seg, idx) => {
    const safeStart = Math.max(0, seg.startTime);
    const safeEnd = Math.max(safeStart + 0.45, seg.endTime);
    const nextSegStart =
      idx < segments.length - 1 ? Math.max(safeEnd, segments[idx + 1].startTime - 0.03) : project.duration;

    const skipChrome = compositionId === 'phrase-icon-split';
    const pillStart = Math.max(safeStart, lastPillEnd + 0.03);
    const pillEnd = Math.max(safeEnd, nextSegStart);
    if (!skipChrome && pillEnd - pillStart >= 0.35) {
      newVisuals.push({
        id: `comp-pill-${idx + 1}`,
        type: 'topic-pill',
        label: `Nhãn: ${seg.topicLabel}`,
        startTime: Number(pillStart.toFixed(2)),
        endTime: Number(pillEnd.toFixed(2)),
        enterAnimation: 'pop-up',
        exitAnimation: 'fade-out',
        layout: { x: 540, y: 335, width: 380, scale: 1, zIndex: 12 },
        props: {
          kind: 'topic-pill',
          text: seg.topicLabel,
          bgColor: seg.topicBg,
          textColor: seg.topicColor,
        },
      });
      lastPillEnd = pillEnd;
    }

    const builtIllustration = buildIllustrationDataForComposition(
      compositionId,
      stripItems,
      segments,
      idx,
      segments.length,
      project,
    );

    const illStart = idx === 0 ? 0 : Math.max(safeStart, lastIllEnd + 0.03);
    const illEnd = idx === segments.length - 1 ? project.duration : Math.max(safeEnd, nextSegStart);
    if (illEnd - illStart >= 0.35) {
      newVisuals.push({
        id: `comp-ill-${idx + 1}`,
        type: 'illustration-prop',
        label: `Minh họa: ${builtIllustration.variant}`,
        startTime: Number(illStart.toFixed(2)),
        endTime: Number(illEnd.toFixed(2)),
        enterAnimation: 'fade-scale',
        exitAnimation: 'fade-out',
        layout: {
          x: 540,
          y: compositionId === 'phrase-icon-split' ? 780 : 635,
          width: 880,
          scale: 1,
          zIndex: 8,
        },
        props: {
          kind: 'illustration-prop',
          variant: builtIllustration.variant,
          data: builtIllustration.data,
        },
      });
      lastIllEnd = illEnd;
    }

    const cardStart = Math.max(safeStart, lastCardEnd + 0.03);
    if (!skipChrome && safeEnd - cardStart >= 0.35) {
      newVisuals.push({
        id: `comp-card-${idx + 1}`,
        type: 'sentence-card',
        label: `Thẻ câu: ${seg.cardText.slice(0, 24)}`,
        startTime: Number(cardStart.toFixed(2)),
        endTime: Number(safeEnd.toFixed(2)),
        enterAnimation: 'pop-up',
        exitAnimation: idx === segments.length - 1 ? 'fade-out' : 'shrink',
        layout: { x: 540, y: 985, width: 830, scale: 1, zIndex: 20 },
        props: {
          kind: 'sentence-card',
          text: seg.cardText,
          subtext: seg.subtext,
          badge: seg.badge,
          stampText: seg.stampText,
          stampColor: seg.stampColor,
          emphasisWord: seg.emphasisWord,
          emphasisColor: seg.emphasisColor,
        },
      });
      lastCardEnd = safeEnd;
    }
  });

  // 3. Tone meter for compositions that benefit from a continuous bottom sentiment bar
  if (
    compositionId === 'story-scenes' ||
    compositionId === 'flow-steps' ||
    compositionId === 'timeline-track'
  ) {
    newVisuals.push({
      id: `comp-meter-${compositionId}`,
      type: 'tone-meter',
      label: 'Thanh sắc thái: Rude ↔ Polite',
      startTime: segments[0]?.startTime ?? 0,
      endTime: project.duration,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1255, width: 700, scale: 1, zIndex: 18 },
      props: {
        kind: 'tone-meter',
        title: 'TONE',
        leftLabel: 'casual',
        rightLabel: 'polite',
        valueStart: 0.2,
        valueEnd: 0.88,
        animateStart: project.duration * 0.2,
        animateEnd: Math.max(1.2, project.duration * 0.78),
      },
    });
  }

  // Adapt karaoke card theme colors cleanly
  const isDarkTheme = nextTheme === 'studio-slate';
  const themedKaraoke: SceneElement[] = karaokeEls.map((k) => {
    if (k.props.kind !== 'karaoke-card') return k;
    return {
      ...k,
      props: {
        ...k.props,
        variant: isDarkTheme ? 'dark-bar' : 'white-card',
        activeColor: isDarkTheme ? '#FACC15' : '#2563EB',
        inactiveColor: isDarkTheme ? '#CBD5E1' : '#9CA3AF',
        spokenColor: isDarkTheme ? '#FFFFFF' : '#111827',
      },
    };
  });

  const resolved = resolveProjectOverlaps([...newVisuals, ...themedKaraoke]);

  return {
    ...project,
    theme: nextTheme,
    compositionId,
    subtitle: `${project.cues.length} câu thoại · Phối kiểu ${meta.shortLabel}`,
    elements: resolved,
  };
}

export function pickRandomComposition(
  currentCompositionId?: LayoutCompositionId,
  currentTheme?: CanvasThemeId,
  rng: () => number = Math.random,
): { compositionId: LayoutCompositionId; theme: CanvasThemeId } {
  const candidates = LAYOUT_COMPOSITIONS.filter((c) => c.id !== currentCompositionId);
  const chosen =
    candidates[Math.floor(rng() * candidates.length) % candidates.length] ??
    LAYOUT_COMPOSITIONS[0];

  const themePool = LIGHT_TIKTOK_THEMES.filter((t) => t !== currentTheme);
  const chosenTheme =
    rng() > 0.35
      ? chosen.recommendedTheme
      : themePool[Math.floor(rng() * themePool.length) % themePool.length] ??
        chosen.recommendedTheme;

  return {
    compositionId: chosen.id,
    theme: chosenTheme,
  };
}

export function applyCompositionToProject(
  project: LessonProject,
  selected: LayoutCompositionId | 'ai-decide',
): LessonProject {
  if (selected !== 'ai-decide') {
    return recomposeProjectWithStyle(project, selected);
  }
  if (isLayoutCompositionId(project.compositionId)) {
    return recomposeProjectWithStyle(project, project.compositionId);
  }
  const transcript = project.cues.map((c) => c.text).join(' ');
  return recomposeProjectWithStyle(project, pickCompositionFromContext(transcript));
}
