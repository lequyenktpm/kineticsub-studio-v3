import { LessonProject } from './types';
import { interpolateWordTimings, parseTranscriptAuto } from './transcriptParser';
import { FlexibleSceneDocument, scenePlanToProject } from './scenePlanAdapter';

export const PRESET_WATER_POLITE: LessonProject = {
  id: 'preset-water-polite',
  title: 'Ask for Water Politely: Can / Could / May',
  subtitle: 'Phong cách @englishpracticing168 · 9:16 Kinetic Cards',
  theme: 'pastel-sunrise',
  duration: 14.5,
  fps: 30,
  cues: [
    {
      id: 'cue-1',
      start: 0.2,
      end: 2.3,
      text: 'Picture this: you say "Give me water."',
      words: interpolateWordTimings('Picture this: you say "Give me water."', 0.2, 2.3),
    },
    {
      id: 'cue-2',
      start: 2.4,
      end: 5.2,
      text: 'It is grammatically fine, but it sounds a little rude!',
      words: interpolateWordTimings(
        'It is grammatically fine, but it sounds a little rude!',
        2.4,
        5.2,
      ),
    },
    {
      id: 'cue-3',
      start: 5.4,
      end: 8.3,
      text: 'Try "Can I have some water?" for casual friends.',
      words: interpolateWordTimings(
        'Try "Can I have some water?" for casual friends.',
        5.4,
        8.3,
      ),
    },
    {
      id: 'cue-4',
      start: 8.5,
      end: 11.4,
      text: 'Use "Could I have some water?" to sound polite.',
      words: interpolateWordTimings(
        'Use "Could I have some water?" to sound polite.',
        8.5,
        11.4,
      ),
    },
    {
      id: 'cue-5',
      start: 11.6,
      end: 14.3,
      text: 'Or "May I have some water?" in formal places.',
      words: interpolateWordTimings(
        'Or "May I have some water?" in formal places.',
        11.6,
        14.3,
      ),
    },
  ],
  elements: [
    {
      id: 'el-strip-1',
      type: 'comparison-strip',
      label: 'Thanh so sánh: can / could / may',
      startTime: 0.0,
      endTime: 14.5,
      enterAnimation: 'drop-in',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 190, width: 900, scale: 1, zIndex: 10 },
      props: {
        kind: 'comparison-strip',
        items: [
          { label: 'can', sublabel: 'Casual', activateAt: 5.4, accentColor: '#2563EB' },
          { label: 'could', sublabel: 'Polite', activateAt: 8.5, accentColor: '#16A34A' },
          { label: 'may', sublabel: 'Formal', activateAt: 11.6, accentColor: '#7C3AED' },
        ],
      },
    },
    {
      id: 'el-pill-1',
      type: 'topic-pill',
      label: 'Thẻ ngữ cảnh: Picture this',
      startTime: 0.2,
      endTime: 5.3,
      enterAnimation: 'pop-up',
      exitAnimation: 'shrink',
      layout: { x: 540, y: 345, width: 320, scale: 1, zIndex: 12 },
      props: {
        kind: 'topic-pill',
        text: 'Picture this',
        bgColor: '#DDD6FE',
        textColor: '#4338CA',
      },
    },
    {
      id: 'el-pill-2',
      type: 'topic-pill',
      label: 'Thẻ ngữ cảnh: Say this instead',
      startTime: 5.35,
      endTime: 14.5,
      enterAnimation: 'pop-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 345, width: 380, scale: 1, zIndex: 12 },
      props: {
        kind: 'topic-pill',
        text: 'Say this instead',
        bgColor: '#DCFCE7',
        textColor: '#15803D',
      },
    },
    {
      id: 'el-prop-1',
      type: 'illustration-prop',
      label: 'Minh họa quán nước',
      startTime: 0.2,
      endTime: 14.5,
      enterAnimation: 'fade-scale',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 650, width: 520, scale: 1, zIndex: 5 },
      props: {
        kind: 'illustration-prop',
        variant: 'cafe-water',
      },
    },
    {
      id: 'el-card-rude',
      type: 'sentence-card',
      label: 'Thẻ câu: "Give me water." (Rude)',
      startTime: 0.7,
      endTime: 5.3,
      enterAnimation: 'pop-up',
      exitAnimation: 'shrink',
      layout: { x: 540, y: 1005, width: 760, scale: 1, zIndex: 20 },
      props: {
        kind: 'sentence-card',
        text: 'Give me water.',
        badge: 'cross',
        stampText: 'RUDE',
        stampColor: '#DC2626',
        emphasisWord: 'Give me',
        emphasisColor: '#DC2626',
      },
    },
    {
      id: 'el-card-can',
      type: 'sentence-card',
      label: 'Thẻ câu: "Can I have some water?"',
      startTime: 5.4,
      endTime: 8.4,
      enterAnimation: 'pop-up',
      exitAnimation: 'slide-down',
      layout: { x: 540, y: 1005, width: 820, scale: 1, zIndex: 20 },
      props: {
        kind: 'sentence-card',
        text: 'Can I have some water?',
        badge: 'check',
        emphasisWord: 'Can I',
        emphasisColor: '#2563EB',
      },
    },
    {
      id: 'el-card-could',
      type: 'sentence-card',
      label: 'Thẻ câu: "Could I have some water?"',
      startTime: 8.5,
      endTime: 11.5,
      enterAnimation: 'pop-up',
      exitAnimation: 'slide-down',
      layout: { x: 540, y: 1005, width: 850, scale: 1, zIndex: 20 },
      props: {
        kind: 'sentence-card',
        text: 'Could I have some water?',
        badge: 'check',
        emphasisWord: 'Could I',
        emphasisColor: '#16A34A',
      },
    },
    {
      id: 'el-card-may',
      type: 'sentence-card',
      label: 'Thẻ câu: "May I have some water?"',
      startTime: 11.6,
      endTime: 14.5,
      enterAnimation: 'pop-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1005, width: 830, scale: 1, zIndex: 20 },
      props: {
        kind: 'sentence-card',
        text: 'May I have some water?',
        badge: 'check',
        emphasisWord: 'May I',
        emphasisColor: '#7C3AED',
      },
    },
    {
      id: 'el-meter-1',
      type: 'tone-meter',
      label: 'Thanh sắc thái: Rude ↔ Polite',
      startTime: 2.3,
      endTime: 14.5,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1240, width: 700, scale: 1, zIndex: 18 },
      props: {
        kind: 'tone-meter',
        title: 'TONE',
        leftLabel: 'rude',
        rightLabel: 'polite',
        valueStart: 0.14,
        valueEnd: 0.92,
        animateStart: 5.2,
        animateEnd: 11.8,
      },
    },
    {
      id: 'el-karaoke-1',
      type: 'karaoke-card',
      label: 'Sub động: Cue 1',
      startTime: 0.2,
      endTime: 2.35,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1510, width: 840, scale: 1, zIndex: 30 },
      props: {
        kind: 'karaoke-card',
        cueId: 'cue-1',
        words: interpolateWordTimings('Picture this: you say "Give me water."', 0.2, 2.3),
        activeColor: '#2563EB',
        inactiveColor: '#9CA3AF',
        spokenColor: '#111827',
      },
    },
    {
      id: 'el-karaoke-2',
      type: 'karaoke-card',
      label: 'Sub động: Cue 2',
      startTime: 2.4,
      endTime: 5.25,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1510, width: 860, scale: 1, zIndex: 30 },
      props: {
        kind: 'karaoke-card',
        cueId: 'cue-2',
        words: interpolateWordTimings(
          'It is grammatically fine, but it sounds a little rude!',
          2.4,
          5.2,
        ),
        activeColor: '#DC2626',
        inactiveColor: '#9CA3AF',
        spokenColor: '#111827',
      },
    },
    {
      id: 'el-karaoke-3',
      type: 'karaoke-card',
      label: 'Sub động: Cue 3',
      startTime: 5.4,
      endTime: 8.35,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1510, width: 860, scale: 1, zIndex: 30 },
      props: {
        kind: 'karaoke-card',
        cueId: 'cue-3',
        words: interpolateWordTimings(
          'Try "Can I have some water?" for casual friends.',
          5.4,
          8.3,
        ),
        activeColor: '#2563EB',
        inactiveColor: '#9CA3AF',
        spokenColor: '#111827',
      },
    },
    {
      id: 'el-karaoke-4',
      type: 'karaoke-card',
      label: 'Sub động: Cue 4',
      startTime: 8.5,
      endTime: 11.45,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1510, width: 860, scale: 1, zIndex: 30 },
      props: {
        kind: 'karaoke-card',
        cueId: 'cue-4',
        words: interpolateWordTimings(
          'Use "Could I have some water?" to sound polite.',
          8.5,
          11.4,
        ),
        activeColor: '#16A34A',
        inactiveColor: '#9CA3AF',
        spokenColor: '#111827',
      },
    },
    {
      id: 'el-karaoke-5',
      type: 'karaoke-card',
      label: 'Sub động: Cue 5',
      startTime: 11.6,
      endTime: 14.35,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1510, width: 860, scale: 1, zIndex: 30 },
      props: {
        kind: 'karaoke-card',
        cueId: 'cue-5',
        words: interpolateWordTimings(
          'Or "May I have some water?" in formal places.',
          11.6,
          14.3,
        ),
        activeColor: '#7C3AED',
        inactiveColor: '#9CA3AF',
        spokenColor: '#111827',
      },
    },
  ],
};

export const PRESET_ED_PRONUNCIATION: LessonProject = {
  id: 'preset-ed-sound',
  title: 'Past Tense -ed: Worked / Played / Wanted',
  subtitle: 'Sắp xếp nhóm âm T / D / ID & xếp chồng từ vựng',
  theme: 'soft-lavender',
  duration: 11.0,
  fps: 30,
  cues: [
    {
      id: 'cue-ed-1',
      start: 0.2,
      end: 3.2,
      text: 'Why do worked, played, and wanted sound different?',
      words: interpolateWordTimings(
        'Why do worked, played, and wanted sound different?',
        0.2,
        3.2,
      ),
    },
    {
      id: 'cue-ed-2',
      start: 3.4,
      end: 6.0,
      text: 'Worked ends with a crisp T sound: work-t.',
      words: interpolateWordTimings('Worked ends with a crisp T sound: work-t.', 3.4, 6.0),
    },
    {
      id: 'cue-ed-3',
      start: 6.1,
      end: 8.5,
      text: 'Played ends with a smooth D sound: play-d.',
      words: interpolateWordTimings('Played ends with a smooth D sound: play-d.', 6.1, 8.5),
    },
    {
      id: 'cue-ed-4',
      start: 8.6,
      end: 10.8,
      text: 'Wanted adds an extra syllable: want-id.',
      words: interpolateWordTimings('Wanted adds an extra syllable: want-id.', 8.6, 10.8),
    },
  ],
  elements: [
    {
      id: 'ed-strip',
      type: 'comparison-strip',
      label: '3 nhóm âm: T / D / ID',
      startTime: 0.0,
      endTime: 11.0,
      enterAnimation: 'drop-in',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 210, width: 920, scale: 1, zIndex: 10 },
      props: {
        kind: 'comparison-strip',
        items: [
          { label: 'T sound', sublabel: 'work·t', activateAt: 3.4, accentColor: '#EA580C' },
          { label: 'D sound', sublabel: 'play·d', activateAt: 6.1, accentColor: '#2563EB' },
          { label: 'ID sound', sublabel: 'want·id', activateAt: 8.6, accentColor: '#DB2777' },
        ],
      },
    },
    {
      id: 'ed-pill',
      type: 'topic-pill',
      label: 'Nhãn chủ đề: 3 cách đọc đuôi -ed',
      startTime: 0.2,
      endTime: 11.0,
      enterAnimation: 'pop-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 370, width: 420, scale: 1, zIndex: 12 },
      props: {
        kind: 'topic-pill',
        text: '-ED Pronunciation',
        bgColor: '#E0E7FF',
        textColor: '#3730A3',
      },
    },
    {
      id: 'ed-stack',
      type: 'word-stack',
      label: 'Thẻ xếp chồng: worked / played / wanted',
      startTime: 0.5,
      endTime: 11.0,
      enterAnimation: 'pop-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 800, width: 700, scale: 1, zIndex: 20 },
      props: {
        kind: 'word-stack',
        rows: [
          {
            prefix: 'work',
            suffix: 'ed',
            suffixColor: '#EA580C',
            appearAt: 0.6,
            phonetic: '/wɜːrkt/',
          },
          {
            prefix: 'play',
            suffix: 'ed',
            suffixColor: '#2563EB',
            appearAt: 1.2,
            phonetic: '/pleɪd/',
          },
          {
            prefix: 'want',
            suffix: 'ed',
            suffixColor: '#DB2777',
            appearAt: 1.8,
            phonetic: '/ˈwɒntɪd/',
          },
        ],
      },
    },
    {
      id: 'ed-k1',
      type: 'karaoke-card',
      label: 'Sub động: Cue 1',
      startTime: 0.2,
      endTime: 3.25,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1480, width: 860, scale: 1, zIndex: 30 },
      props: {
        kind: 'karaoke-card',
        cueId: 'cue-ed-1',
        words: interpolateWordTimings(
          'Why do worked, played, and wanted sound different?',
          0.2,
          3.2,
        ),
        activeColor: '#4F46E5',
        inactiveColor: '#9CA3AF',
        spokenColor: '#111827',
      },
    },
    {
      id: 'ed-k2',
      type: 'karaoke-card',
      label: 'Sub động: Cue 2',
      startTime: 3.4,
      endTime: 6.05,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1480, width: 860, scale: 1, zIndex: 30 },
      props: {
        kind: 'karaoke-card',
        cueId: 'cue-ed-2',
        words: interpolateWordTimings('Worked ends with a crisp T sound: work-t.', 3.4, 6.0),
        activeColor: '#EA580C',
        inactiveColor: '#9CA3AF',
        spokenColor: '#111827',
      },
    },
    {
      id: 'ed-k3',
      type: 'karaoke-card',
      label: 'Sub động: Cue 3',
      startTime: 6.1,
      endTime: 8.55,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1480, width: 860, scale: 1, zIndex: 30 },
      props: {
        kind: 'karaoke-card',
        cueId: 'cue-ed-3',
        words: interpolateWordTimings('Played ends with a smooth D sound: play-d.', 6.1, 8.5),
        activeColor: '#2563EB',
        inactiveColor: '#9CA3AF',
        spokenColor: '#111827',
      },
    },
    {
      id: 'ed-k4',
      type: 'karaoke-card',
      label: 'Sub động: Cue 4',
      startTime: 8.6,
      endTime: 10.85,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 1480, width: 860, scale: 1, zIndex: 30 },
      props: {
        kind: 'karaoke-card',
        cueId: 'cue-ed-4',
        words: interpolateWordTimings('Wanted adds an extra syllable: want-id.', 8.6, 10.8),
        activeColor: '#DB2777',
        inactiveColor: '#9CA3AF',
        spokenColor: '#111827',
      },
    },
  ],
};

export const SAMPLE_WORDS_JSON = {
  words: [
    { word: 'Hello', start: 0.0, end: 0.45 },
    { word: 'everyone!', start: 0.45, end: 1.05 },
    { word: 'Today', start: 1.15, end: 1.55 },
    { word: 'we', start: 1.55, end: 1.8 },
    { word: 'learn', start: 1.8, end: 2.3 },
    { word: 'three', start: 2.45, end: 2.85 },
    { word: 'polite', start: 2.85, end: 3.35 },
    { word: 'levels', start: 3.35, end: 3.9 },
    { word: 'from', start: 4.0, end: 4.35 },
    { word: 'casual', start: 4.35, end: 4.95 },
    { word: 'to', start: 4.95, end: 5.2 },
    { word: 'formal', start: 5.2, end: 5.85 },
    { word: 'English.', start: 5.85, end: 6.5 },
  ],
};

export const SAMPLE_SCENE_PLAN = {
  scenes: [
    {
      id: 'sc1',
      shapes: [
        {
          type: 'card_3d' as const,
          position: { x: 0.1, y: 0.14, w: 0.8, h: 0.14 },
          fill: '#14B8A6',
          shadow: true,
          highlight: true,
          depth: 12,
          corner_radius: 30,
          at: 1,
          until: 5,
        },
        {
          type: 'pill_3d' as const,
          position: { x: 0.18, y: 0.34, w: 0.64, h: 0.085 },
          fill: '#F0FDFA',
          shadow: true,
          highlight: true,
          depth: 8,
          at: 3,
          until: 13,
        },
        {
          type: 'cube_3d' as const,
          position: { x: 0.32, y: 0.48, w: 0.36, h: 0.18 },
          fill: '#6366F1',
          shadow: true,
          highlight: true,
          depth: 14,
          at: 3,
          until: 6,
        },
      ],
      texts: [
        {
          content: 'Hello everyone!',
          shape_index: 0,
          style: { size: 'display' as const, color: '#FFFFFF', weight: 'black' as const, align: 'center' as const },
          at: 1,
          until: 5,
        },
        {
          content: 'Today we learn',
          shape_index: 1,
          style: { size: 'headline' as const, color: '#0F766E', weight: 'bold' as const, align: 'center' as const },
          at: 3,
          until: 13,
        },
      ],
    },
    {
      id: 'sc2',
      shapes: [
        {
          type: 'staircase_3d' as const,
          position: { x: 0.12, y: 0.48, w: 0.76, h: 0.24 },
          fill: '#F59E0B',
          shadow: true,
          highlight: true,
          depth: 14,
          at: 6,
          until: 13,
          step_labels: ['Can I...', 'Could I...', 'May I...'],
        },
      ],
      texts: [],
    },
  ],
};

export const PRESET_3D_SHAPES_KARAOKE: LessonProject = (() => {
  const words = SAMPLE_WORDS_JSON.words;
  return {
    id: 'preset-3d-shapes',
    title: '3D Shapes & Karaoke: Three Polite Levels',
    subtitle: 'Schema video_maker (words.json + scene.json) · Thẻ 3D & Karaoke #FACC15',
    theme: 'studio-slate',
    duration: 7.0,
    fps: 30,
    cues: [
      {
        id: 'cue-3d-1',
        start: 0.0,
        end: 2.35,
        text: 'Hello everyone! Today we learn',
        words: words.slice(0, 5),
      },
      {
        id: 'cue-3d-2',
        start: 2.45,
        end: 3.95,
        text: 'three polite levels',
        words: words.slice(5, 8),
      },
      {
        id: 'cue-3d-3',
        start: 4.0,
        end: 6.5,
        text: 'from casual to formal English.',
        words: words.slice(8, 13),
      },
    ],
    elements: [
      {
        id: 'sc1-shape-0',
        type: 'shape-3d',
        label: 'card_3d: Hello everyone!',
        startTime: 0.0,
        endTime: 2.4,
        enterAnimation: 'pop-up',
        exitAnimation: 'shrink',
        atWordIndex: 1,
        layout: { x: 540, y: 403, width: 864, height: 268, scale: 1, zIndex: 10 },
        props: {
          kind: 'shape-3d',
          shapeType: 'card_3d',
          fill: '#14B8A6',
          shadow: true,
          highlight: true,
          depth: 12,
          cornerRadius: 30,
          textContent: 'Hello everyone!',
          textColor: '#FFFFFF',
          textSize: 'display',
          textWeight: 'black',
        },
      },
      {
        id: 'sc1-shape-1',
        type: 'shape-3d',
        label: 'pill_3d: Today we learn',
        startTime: 1.15,
        endTime: 6.8,
        enterAnimation: 'slide-up',
        exitAnimation: 'fade-out',
        atWordIndex: 3,
        layout: { x: 540, y: 734, width: 690, height: 160, scale: 1, zIndex: 12 },
        props: {
          kind: 'shape-3d',
          shapeType: 'pill_3d',
          fill: '#F0FDFA',
          shadow: true,
          highlight: true,
          depth: 8,
          cornerRadius: 80,
          textContent: 'Today we learn',
          textColor: '#0F766E',
          textSize: 'headline',
          textWeight: 'bold',
        },
      },
      {
        id: 'sc1-shape-2',
        type: 'shape-3d',
        label: 'cube_3d: Khối 3D mở đầu',
        startTime: 1.15,
        endTime: 2.5,
        enterAnimation: 'fade-scale',
        exitAnimation: 'shrink',
        atWordIndex: 3,
        layout: { x: 540, y: 1120, width: 340, height: 340, scale: 1, zIndex: 14 },
        props: {
          kind: 'shape-3d',
          shapeType: 'cube_3d',
          fill: '#6366F1',
          shadow: true,
          highlight: true,
          depth: 14,
          cornerRadius: 16,
        },
      },
      {
        id: 'sc2-shape-0',
        type: 'shape-3d',
        label: 'staircase_3d: Can / Could / May',
        startTime: 2.45,
        endTime: 6.8,
        enterAnimation: 'pop-up',
        exitAnimation: 'fade-out',
        atWordIndex: 6,
        layout: { x: 540, y: 1140, width: 820, height: 460, scale: 1, zIndex: 15 },
        props: {
          kind: 'shape-3d',
          shapeType: 'staircase_3d',
          fill: '#F59E0B',
          shadow: true,
          highlight: true,
          depth: 14,
          cornerRadius: 20,
          stepLabels: ['Can I...', 'Could I...', 'May I...'],
        },
      },
      {
        id: 'karaoke-3d-1',
        type: 'karaoke-card',
        label: 'Karaoke #1',
        startTime: 0.0,
        endTime: 2.4,
        enterAnimation: 'slide-up',
        exitAnimation: 'fade-out',
        layout: { x: 540, y: 1680, width: 920, scale: 1, zIndex: 40 },
        props: {
          kind: 'karaoke-card',
          cueId: 'cue-3d-1',
          words: words.slice(0, 5),
          activeColor: '#FACC15',
          inactiveColor: '#CBD5E1',
          spokenColor: '#FFFFFF',
          variant: 'dark-bar',
        },
      },
      {
        id: 'karaoke-3d-2',
        type: 'karaoke-card',
        label: 'Karaoke #2',
        startTime: 2.45,
        endTime: 3.98,
        enterAnimation: 'slide-up',
        exitAnimation: 'fade-out',
        layout: { x: 540, y: 1680, width: 920, scale: 1, zIndex: 40 },
        props: {
          kind: 'karaoke-card',
          cueId: 'cue-3d-2',
          words: words.slice(5, 8),
          activeColor: '#FACC15',
          inactiveColor: '#CBD5E1',
          spokenColor: '#FFFFFF',
          variant: 'dark-bar',
        },
      },
      {
        id: 'karaoke-3d-3',
        type: 'karaoke-card',
        label: 'Karaoke #3',
        startTime: 4.0,
        endTime: 6.8,
        enterAnimation: 'slide-up',
        exitAnimation: 'fade-out',
        layout: { x: 540, y: 1680, width: 920, scale: 1, zIndex: 40 },
        props: {
          kind: 'karaoke-card',
          cueId: 'cue-3d-3',
          words: words.slice(8, 13),
          activeColor: '#FACC15',
          inactiveColor: '#CBD5E1',
          spokenColor: '#FFFFFF',
          variant: 'dark-bar',
        },
      },
    ],
  };
})();

export const SAMPLE_JP_EN_TRANSCRIPT = `00:00:00.000
このシーンを想像してみて。カフェにいて、すごく喉が渇いて「水、くれる？」って言うんだ。言葉は正しいけど、ちょっとぶっきらぼうに聞こえる。なぜかって？英語には丁寧に聞くための特別な表現があって、相手によって使い分けるんだ。

00:00:11.960
まずは can から。カジュアルでフレンドリー。友達や家族、よく知っている相手に使う。

00:00:17.040
Can you pass the salt?

00:00:24.500
Can I borrow your pen?

00:00:27.580
次は could にステップアップ。ちょっと柔らかくて丁寧。

00:00:30.780
同僚や先生、店員さん、あまり親しくない人に使える。

00:00:33.020
Could I have some water, please?

00:00:38.400
Could you help me with this?

00:00:41.720
そして最上位が may。フォーマルな場面で使う。

00:00:44.400
ホテルやオフィス、メールでよく聞く。

00:00:46.100
May I come in?

00:00:49.260
May I ask a question?

00:00:52.460
だからこれを階段みたいに考えてみて。

00:00:53.820
Can は下の段、普通。

00:00:57.040
Could は中間の段、丁寧。

00:00:59.560
May は上の段、すごくフォーマル。

00:01:04.400
小さなコツだよ。

00:01:07.340
迷ったら could を選べばほぼどこでも通用するし、いつも礼儀正しく聞こえる。

00:01:12.440
もうひとつ大事なこと。

00:01:15.240
トーンも言葉と同じくらい重要。please と笑顔を添えれば、たとえ can でも温かくフレンドリーに聞こえる。

00:01:21.420
さあ、耳をチェックしよう。

00:01:24.800
上司が通りかかって金曜に休みが欲しいとき。

00:01:27.340
「Can I have Friday off?」とか言うか、

00:01:30.040
「Could I take Friday off, please?」とか言うか。

00:01:35.660
二番目を選べば、ネイティブらしい自然な表現になる。

00:01:38.140
もっとこんなフレーズが知りたい？

00:01:39.800
Follow along.`;

export const SAMPLE_JP_EN_SCENE_JSON: FlexibleSceneDocument = {
  title: 'Can / Could / May — Bài giảng Nhật-Anh',
  theme: 'pastel-sunrise',
  scenes: [
    {
      id: 'jp-en-full',
      elements: [
        {
          type: 'comparison_strip',
          start: '00:00:00.000',
          end: '00:01:42.500',
          y: 185,
          items: [
            { label: 'can', sublabel: 'Casual', activateAt: '00:00:11.960', accentColor: '#2563EB' },
            { label: 'could', sublabel: 'Polite', activateAt: '00:00:27.580', accentColor: '#16A34A' },
            { label: 'may', sublabel: 'Formal', activateAt: '00:00:41.720', accentColor: '#7C3AED' },
          ],
        },
        {
          type: 'topic_pill',
          start: '00:00:00.000',
          end: '00:00:11.900',
          y: 335,
          text: 'Picture this',
          bgColor: '#DDD6FE',
          textColor: '#4338CA',
        },
        {
          type: 'illustration',
          variant: 'cafe-water',
          start: '00:00:00.000',
          end: '00:00:52.400',
          y: 620,
        },
        {
          type: 'sentence_card',
          start: '00:00:02.000',
          end: '00:00:11.900',
          y: 970,
          text: 'Give me water.',
          badge: 'cross',
          stampText: 'RUDE',
          stampColor: '#DC2626',
          emphasisWord: 'Give me',
          emphasisColor: '#DC2626',
        },
        {
          type: 'tone_meter',
          start: '00:00:03.500',
          end: '00:00:11.900',
          y: 1215,
          title: 'TONE',
          leftLabel: 'rude',
          rightLabel: 'polite',
          valueStart: 0.5,
          valueEnd: 0.14,
        },
        {
          type: 'topic_pill',
          start: '00:00:11.960',
          end: '00:00:27.500',
          y: 335,
          text: '1. Casual (Can)',
          bgColor: '#DBEAFE',
          textColor: '#1D4ED8',
        },
        {
          type: 'sentence_card',
          start: '00:00:17.040',
          end: '00:00:24.400',
          y: 970,
          text: 'Can you pass the salt?',
          badge: 'check',
          emphasisWord: 'Can',
          emphasisColor: '#2563EB',
        },
        {
          type: 'sentence_card',
          start: '00:00:24.500',
          end: '00:00:27.500',
          y: 970,
          text: 'Can I borrow your pen?',
          badge: 'check',
          emphasisWord: 'Can I',
          emphasisColor: '#2563EB',
        },
        {
          type: 'topic_pill',
          start: '00:00:27.580',
          end: '00:00:41.650',
          y: 335,
          text: '2. Polite (Could)',
          bgColor: '#DCFCE7',
          textColor: '#15803D',
        },
        {
          type: 'sentence_card',
          start: '00:00:33.020',
          end: '00:00:38.300',
          y: 970,
          text: 'Could I have some water, please?',
          badge: 'check',
          emphasisWord: 'Could I',
          emphasisColor: '#16A34A',
        },
        {
          type: 'sentence_card',
          start: '00:00:38.400',
          end: '00:00:41.650',
          y: 970,
          text: 'Could you help me with this?',
          badge: 'check',
          emphasisWord: 'Could you',
          emphasisColor: '#16A34A',
        },
        {
          type: 'topic_pill',
          start: '00:00:41.720',
          end: '00:00:52.400',
          y: 335,
          text: '3. Formal (May)',
          bgColor: '#F3E8FF',
          textColor: '#6D28D9',
        },
        {
          type: 'sentence_card',
          start: '00:00:46.100',
          end: '00:00:49.200',
          y: 970,
          text: 'May I come in?',
          badge: 'check',
          emphasisWord: 'May I',
          emphasisColor: '#7C3AED',
        },
        {
          type: 'sentence_card',
          start: '00:00:49.260',
          end: '00:00:52.400',
          y: 970,
          text: 'May I ask a question?',
          badge: 'check',
          emphasisWord: 'May I',
          emphasisColor: '#7C3AED',
        },
        {
          type: 'topic_pill',
          start: '00:00:52.460',
          end: '00:01:04.350',
          y: 335,
          text: 'Politeness Ladder',
          bgColor: '#FEF3C7',
          textColor: '#B45309',
        },
        {
          type: 'staircase_3d',
          start: '00:00:52.460',
          end: '00:01:04.350',
          y: 800,
          width: 820,
          fill: '#F59E0B',
          step_labels: ['Can', 'Could', 'May'],
        },
        {
          type: 'topic_pill',
          start: '00:01:04.400',
          end: '00:01:21.350',
          y: 335,
          text: 'Pro Tip',
          bgColor: '#DCFCE7',
          textColor: '#15803D',
        },
        {
          type: 'sentence_card',
          start: '00:01:07.340',
          end: '00:01:21.350',
          y: 780,
          text: 'Could + please + smile',
          badge: 'check',
          emphasisWord: 'Could',
          emphasisColor: '#16A34A',
        },
        {
          type: 'tone_meter',
          start: '00:01:12.440',
          end: '00:01:21.350',
          y: 1120,
          title: 'WARMTH',
          leftLabel: 'cold',
          rightLabel: 'friendly',
          valueStart: 0.3,
          valueEnd: 0.94,
        },
        {
          type: 'topic_pill',
          start: '00:01:21.420',
          end: '00:01:42.500',
          y: 335,
          text: 'Ear Check Quiz',
          bgColor: '#E0E7FF',
          textColor: '#3730A3',
        },
        {
          type: 'sentence_card',
          start: '00:01:27.340',
          end: '00:01:30.000',
          y: 780,
          text: 'Can I have Friday off?',
          badge: 'cross',
          emphasisWord: 'Can I',
          emphasisColor: '#DC2626',
        },
        {
          type: 'sentence_card',
          start: '00:01:30.040',
          end: '00:01:39.750',
          y: 780,
          text: 'Could I take Friday off, please?',
          badge: 'check',
          emphasisWord: 'Could I',
          emphasisColor: '#16A34A',
        },
        {
          type: 'sentence_card',
          start: '00:01:39.800',
          end: '00:01:42.500',
          y: 970,
          text: 'Follow along!',
          badge: 'check',
          emphasisWord: 'Follow',
          emphasisColor: '#4F46E5',
        },
      ],
    },
  ],
};

export const PRESET_JP_EN_POLITE: LessonProject = (() => {
  const cues = parseTranscriptAuto(SAMPLE_JP_EN_TRANSCRIPT);
  const words = cues.flatMap((c) => c.words);
  return scenePlanToProject(words, SAMPLE_JP_EN_SCENE_JSON, {
    id: 'preset-jp-en-polite',
    title: 'Can / Could / May (Transcript Nhật-Anh 1:42)',
    theme: 'pastel-sunrise',
    cuesOverride: cues,
  });
})();

export const SAMPLE_XUN52000_TRANSCRIPT = `00:00:00.000
Stop saying "Very tired".

00:00:02.500
Say "I am exhausted!"

00:00:05.200
Stop saying "Very cold".

00:00:07.400
Say "It's freezing outside!"

00:00:10.100
Stop saying "Very happy".

00:00:12.300
Say "I'm absolutely thrilled!"

00:00:15.000
Save this for your next English practice.`;

export const SAMPLE_XUN52000_SCENE_JSON: FlexibleSceneDocument = {
  title: 'Stop Saying Very (@xun52000 Word Reveal)',
  theme: 'studio-slate',
  scenes: [
    {
      id: 'sc-xun',
      elements: [
        {
          type: 'sentence_card',
          start: '00:00:00.000',
          end: '00:00:02.400',
          y: 820,
          text: 'Stop saying "Very tired"',
          badge: 'cross',
          emphasisWord: 'Very tired',
          emphasisColor: '#EF4444',
          bgColor: 'rgba(15, 23, 42, 0.85)',
          textColor: '#F8FAFC',
        },
        {
          type: 'sentence_card',
          start: '00:00:02.500',
          end: '00:00:05.100',
          y: 820,
          text: 'Say "I am exhausted!"',
          subtext: 'Tự nhiên & cuốn hút hơn',
          badge: 'check',
          emphasisWord: 'exhausted',
          emphasisColor: '#FACC15',
          bgColor: 'rgba(15, 23, 42, 0.85)',
          textColor: '#F8FAFC',
        },
        {
          type: 'sentence_card',
          start: '00:00:05.200',
          end: '00:00:07.300',
          y: 820,
          text: 'Stop saying "Very cold"',
          badge: 'cross',
          emphasisWord: 'Very cold',
          emphasisColor: '#EF4444',
          bgColor: 'rgba(15, 23, 42, 0.85)',
          textColor: '#F8FAFC',
        },
        {
          type: 'sentence_card',
          start: '00:00:07.400',
          end: '00:00:10.000',
          y: 820,
          text: "Say \"It's freezing!\"",
          badge: 'check',
          emphasisWord: 'freezing',
          emphasisColor: '#38BDF8',
          bgColor: 'rgba(15, 23, 42, 0.85)',
          textColor: '#F8FAFC',
        },
        {
          type: 'sentence_card',
          start: '00:00:10.100',
          end: '00:00:12.200',
          y: 820,
          text: 'Stop saying "Very happy"',
          badge: 'cross',
          emphasisWord: 'Very happy',
          emphasisColor: '#EF4444',
          bgColor: 'rgba(15, 23, 42, 0.85)',
          textColor: '#F8FAFC',
        },
        {
          type: 'sentence_card',
          start: '00:00:12.300',
          end: '00:00:14.900',
          y: 820,
          text: "Say \"I'm thrilled!\"",
          badge: 'check',
          emphasisWord: 'thrilled',
          emphasisColor: '#FACC15',
          bgColor: 'rgba(15, 23, 42, 0.85)',
          textColor: '#F8FAFC',
        },
        {
          type: 'sentence_card',
          start: '00:00:15.000',
          end: '00:00:17.500',
          y: 820,
          text: 'Follow for daily English!',
          badge: 'none',
          emphasisWord: 'Follow',
          emphasisColor: '#FACC15',
          bgColor: 'rgba(15, 23, 42, 0.85)',
          textColor: '#F8FAFC',
        },
      ],
    },
  ],
};

export const PRESET_XUN52000_DARK: LessonProject = (() => {
  const cues = parseTranscriptAuto(SAMPLE_XUN52000_TRANSCRIPT);
  const words = cues.flatMap((c) => c.words);
  return scenePlanToProject(words, SAMPLE_XUN52000_SCENE_JSON, {
    id: 'preset-xun52000-dark',
    title: 'Word Reveal Dark (@xun52000): Stop Saying Very',
    theme: 'studio-slate',
    cuesOverride: cues,
  });
})();

