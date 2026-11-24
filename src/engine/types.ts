export type CanvasThemeId =
  | 'pastel-sunrise'
  | 'soft-lavender'
  | 'mint-breeze'
  | 'warm-paper'
  | 'studio-slate';

export interface WordTiming {
  word: string;
  start: number;
  end: number;
  highlightColor?: string;
}

export interface TranscriptCue {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
}

export type EnterAnimation = 'pop-up' | 'slide-up' | 'fade-scale' | 'drop-in';
export type ExitAnimation = 'fade-out' | 'slide-down' | 'shrink';

export type Shape3DType =
  | 'card_3d'
  | 'pill_3d'
  | 'cube_3d'
  | 'rect_3d'
  | 'staircase_3d';

export type TextSizeRole = 'display' | 'headline' | 'body' | 'caption' | 'label';
export type TextWeightRole = 'regular' | 'medium' | 'bold' | 'black';

export type SceneElementType =
  | 'comparison-strip'
  | 'topic-pill'
  | 'illustration-prop'
  | 'sentence-card'
  | 'tone-meter'
  | 'word-stack'
  | 'shape-3d'
  | 'karaoke-card';

export interface ElementLayout {
  x: number; // Center X on 1080x1920 canvas
  y: number; // Center Y on 1080x1920 canvas
  width: number;
  height?: number;
  scale: number;
  zIndex: number;
}

export interface ComparisonItem {
  label: string;
  sublabel?: string;
  activateAt?: number;
  accentColor?: string;
}

export interface WordStackRow {
  prefix: string;
  suffix: string;
  suffixColor: string;
  appearAt: number;
  phonetic?: string;
}

export interface ComparisonStripProps {
  kind: 'comparison-strip';
  items: ComparisonItem[];
}

export interface TopicPillProps {
  kind: 'topic-pill';
  text: string;
  bgColor: string;
  textColor: string;
}

export type IllustrationSceneIcon = 'tv' | 'eye' | 'watch' | 'listen' | 'walk' | 'phone';

export type IllustrationVariant =
  | 'cafe-water'
  | 'coffee-cup'
  | 'pronunciation-wave'
  | 'speech-bubble'
  | 'friends-chat'
  | 'office-work'
  | 'hotel-desk'
  | 'lightbulb-tip'
  | 'ear-listen'
  | 'flow-diagram'
  | 'gauge-arc'
  | 'timeline-track'
  | 'checklist-card'
  | 'dialogue-upgrade'
  | 'clock-face'
  | 'spatial-boxes'
  | 'avatar-speech'
  | 'phrase-icon-split';

export interface IllustrationFlowNode {
  label: string;
  sublabel?: string;
  icon?: 'clock' | 'history' | 'rocket' | 'chat' | 'star' | 'check' | 'water' | 'office';
  color?: string;
}

export interface IllustrationChecklistItem {
  text: string;
  highlight?: string;
  ok?: boolean;
}

export interface IllustrationDialogueRow {
  prompt: string;
  upgrade: string;
  badgeColor?: string;
}

export interface IllustrationSpatialBox {
  title: string;
  subtitle?: string;
  icon: 'dot' | 'surface' | 'cube' | 'check' | 'cross' | 'letter';
  accent?: string;
}

export interface IllustrationPropData {
  title?: string;
  subtitle?: string;
  nodes?: IllustrationFlowNode[];
  labels?: string[];
  value?: number; // 0..1 for gauge / timeline-track
  timeHour?: number;
  timeMinute?: number;
  formula?: string;
  checklist?: IllustrationChecklistItem[];
  upgrades?: IllustrationDialogueRow[];
  boxes?: IllustrationSpatialBox[];
  speechText?: string;
  reactionText?: string;
  sceneIcon?: IllustrationSceneIcon;
  highlightWord?: string;
}

export interface IllustrationPropProps {
  kind: 'illustration-prop';
  variant: IllustrationVariant;
  data?: IllustrationPropData;
}

export type LayoutCompositionId =
  | 'story-scenes'
  | 'flow-steps'
  | 'gauge-tone'
  | 'checklist-cards'
  | 'dialogue-upgrade'
  | 'timeline-track'
  | 'spatial-contrast'
  | 'avatar-dialogue'
  | 'clock-spotlight'
  | 'phrase-icon-split';

export interface SentenceCardProps {
  kind: 'sentence-card';
  text: string;
  subtext?: string;
  badge?: 'check' | 'cross' | 'question' | 'none';
  stampText?: string;
  stampColor?: string;
  emphasisWord?: string;
  emphasisColor?: string;
  strikethrough?: boolean;
  bgColor?: string;
  textColor?: string;
}

export interface ToneMeterProps {
  kind: 'tone-meter';
  title: string;
  leftLabel: string;
  rightLabel: string;
  valueStart: number; // 0..1
  valueEnd: number; // 0..1
  animateStart: number;
  animateEnd: number;
}

export interface WordStackProps {
  kind: 'word-stack';
  rows: WordStackRow[];
}

export interface Shape3DProps {
  kind: 'shape-3d';
  shapeType: Shape3DType;
  fill: string;
  shadow: boolean;
  highlight: boolean;
  depth: number;
  cornerRadius: number;
  textContent?: string;
  textColor?: string;
  textSize?: TextSizeRole;
  textWeight?: TextWeightRole;
  stepLabels?: string[];
}

export interface KaraokeCardProps {
  kind: 'karaoke-card';
  cueId: string;
  words: WordTiming[];
  activeColor: string;
  inactiveColor: string;
  spokenColor: string;
  variant?: 'white-card' | 'dark-bar';
}

export type SceneElementProps =
  | ComparisonStripProps
  | TopicPillProps
  | IllustrationPropProps
  | SentenceCardProps
  | ToneMeterProps
  | WordStackProps
  | Shape3DProps
  | KaraokeCardProps;

export interface SceneElement {
  id: string;
  type: SceneElementType;
  label: string;
  startTime: number;
  endTime: number;
  enterAnimation: EnterAnimation;
  exitAnimation: ExitAnimation;
  layout: ElementLayout;
  props: SceneElementProps;
  atWordIndex?: number;
}

export interface LessonProject {
  id: string;
  title: string;
  subtitle: string;
  theme: CanvasThemeId;
  compositionId?: LayoutCompositionId;
  duration: number;
  fps: 30 | 60;
  cues: TranscriptCue[];
  elements: SceneElement[];
  audioFileName?: string;
}

export interface ScenePlanShape {
  type: Shape3DType;
  position: { x: number; y: number; w: number; h: number };
  fill: string;
  shadow?: boolean;
  highlight?: boolean;
  depth?: number;
  corner_radius?: number;
  at: number;
  until?: number;
  step_labels?: string[];
}

export interface ScenePlanText {
  content: string;
  shape_index?: number;
  position?: { x: number; y: number; w?: number };
  style?: {
    size?: TextSizeRole;
    color?: string;
    weight?: TextWeightRole;
    align?: 'left' | 'center' | 'right';
  };
  at: number;
  until?: number;
}

export interface ScenePlanEntry {
  id: string;
  shapes?: ScenePlanShape[];
  texts?: ScenePlanText[];
}

export interface ScenePlanDocument {
  scenes: ScenePlanEntry[];
}

export interface ThemePalette {
  id: CanvasThemeId;
  name: string;
  bgTop: string;
  bgBottom: string;
  glowA: string;
  glowB: string;
  cardBg: string;
  textPrimary: string;
  textMuted: string;
  accentBlue: string;
}

export const CANVAS_THEMES: Record<CanvasThemeId, ThemePalette> = {
  'pastel-sunrise': {
    id: 'pastel-sunrise',
    name: 'Pastel Nắng Sớm',
    bgTop: '#F5F3FF',
    bgBottom: '#FFF5EB',
    glowA: '#E9E2FF',
    glowB: '#FFE4D6',
    cardBg: '#FFFFFF',
    textPrimary: '#111827',
    textMuted: '#9CA3AF',
    accentBlue: '#2563EB',
  },
  'soft-lavender': {
    id: 'soft-lavender',
    name: 'Oải Hương Mềm',
    bgTop: '#EEF2FF',
    bgBottom: '#FAF5FF',
    glowA: '#DDD6FE',
    glowB: '#E0E7FF',
    cardBg: '#FFFFFF',
    textPrimary: '#0F172A',
    textMuted: '#94A3B8',
    accentBlue: '#4F46E5',
  },
  'mint-breeze': {
    id: 'mint-breeze',
    name: 'Bạc Hà Dịu Mát',
    bgTop: '#ECFDF5',
    bgBottom: '#F0F9FF',
    glowA: '#D1FAE5',
    glowB: '#E0F2FE',
    cardBg: '#FFFFFF',
    textPrimary: '#0F172A',
    textMuted: '#94A3B8',
    accentBlue: '#0284C7',
  },
  'warm-paper': {
    id: 'warm-paper',
    name: 'Giấy Kem Editorial',
    bgTop: '#FAF8F5',
    bgBottom: '#F3EFEA',
    glowA: '#FDE68A',
    glowB: '#FED7AA',
    cardBg: '#FFFFFF',
    textPrimary: '#1C1917',
    textMuted: '#A8A29E',
    accentBlue: '#D97706',
  },
  'studio-slate': {
    id: 'studio-slate',
    name: 'Tối Hiện Đại (3D)',
    bgTop: '#0F172A',
    bgBottom: '#1E293B',
    glowA: '#134E4A',
    glowB: '#1E1B4B',
    cardBg: '#1E293B',
    textPrimary: '#F8FAFC',
    textMuted: '#94A3B8',
    accentBlue: '#14B8A6',
  },
};
