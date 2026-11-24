import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileAudio,
  FileJson,
  Loader2,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from 'lucide-react';
import { buildSceneGenerationPrompt } from '../engine/aiPromptBuilder';
import type { PromptVideoStyle } from '../engine/aiPromptBuilder';
import { LAYOUT_COMPOSITIONS } from '../engine/illustrationLayouts';
import {
  FPS_OPTIONS,
  Mp4ExportSettings,
  QUALITY_OPTIONS,
  RESOLUTION_OPTIONS,
  resolveMp4EncodingParams,
} from '../engine/mp4Config';
import { ExportVideoResult } from '../engine/mp4Exporter';
import {
  SAMPLE_JP_EN_SCENE_JSON,
  SAMPLE_JP_EN_TRANSCRIPT,
  SAMPLE_SCENE_PLAN,
  SAMPLE_WORDS_JSON,
  SAMPLE_XUN52000_SCENE_JSON,
  SAMPLE_XUN52000_TRANSCRIPT,
} from '../engine/demoPresets';
import {
  parseScenePlanJson,
  parseWordLevelJson,
  summarizeScenePlan,
} from '../engine/scenePlanAdapter';
import {
  cuesToBlockTranscript,
  formatTimeToken,
  parseTranscriptAuto,
} from '../engine/transcriptParser';
import {
  LayoutCompositionId,
  LessonProject,
  ScenePlanDocument,
  TranscriptCue,
  WordTiming,
} from '../engine/types';

export type PresetId = 'jp-en' | 'water' | 'ed' | '3d' | 'xun';

interface AutomationPipelinePanelProps {
  project: LessonProject;
  audioFileName?: string;
  currentTime: number;
  isExportingVideo: boolean;
  exportProgress: number;
  exportStageLabel: string;
  exportError: string | null;
  mp4Settings: Mp4ExportSettings;
  onChangeMp4Settings: (next: Mp4ExportSettings) => void;
  onChangeComposition: (compositionId: LayoutCompositionId) => void;
  onRandomizeComposition: () => void;
  onSelectPreset: (presetId: PresetId) => void;
  onUploadAudio: (file: File) => void;
  onClearAudio: () => void;
  onApplyTranscript: (cues: TranscriptCue[], title: string) => void;
  onApplyScenePlan: (
    words: WordTiming[],
    plan: ScenePlanDocument,
    title: string,
    cuesOverride?: TranscriptCue[],
  ) => LessonProject;
  onApplyAndRenderVideo: (
    words: WordTiming[],
    plan: ScenePlanDocument,
    title: string,
    cuesOverride?: TranscriptCue[],
  ) => Promise<ExportVideoResult | null>;
  onSeek: (time: number) => void;
  onOpenAdvancedEditor: () => void;
}

export const AutomationPipelinePanel: React.FC<AutomationPipelinePanelProps> = ({
  project,
  audioFileName,
  currentTime,
  isExportingVideo,
  exportProgress,
  exportStageLabel,
  exportError,
  mp4Settings,
  onChangeMp4Settings,
  onChangeComposition,
  onRandomizeComposition,
  onSelectPreset,
  onUploadAudio,
  onClearAudio,
  onApplyTranscript,
  onApplyScenePlan,
  onApplyAndRenderVideo,
  onSeek,
  onOpenAdvancedEditor,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(2);
  const [rawTranscript, setRawTranscript] = useState<string>(() =>
    cuesToBlockTranscript(project.cues),
  );
  const [customTitle, setCustomTitle] = useState<string>(project.title);
  const [promptStyle, setPromptStyle] = useState<PromptVideoStyle>('tiktok-cards');
  const [compositionMode, setCompositionMode] = useState<'manual' | 'ai-decide' | 'random'>('ai-decide');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  const [rawSceneJson, setRawSceneJson] = useState<string>(() =>
    JSON.stringify(SAMPLE_JP_EN_SCENE_JSON, null, 2),
  );
  const [useSeparateWordsJson, setUseSeparateWordsJson] = useState<boolean>(false);
  const [rawWordsJson, setRawWordsJson] = useState<string>(() =>
    JSON.stringify(SAMPLE_WORDS_JSON, null, 2),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [renderNotice, setRenderNotice] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);

  const liveTranscriptCues = useMemo(() => parseTranscriptAuto(rawTranscript), [rawTranscript]);
  const activeCues = project.cues.length > 0 ? project.cues : liveTranscriptCues;

  // Resolve effective compositionId for the prompt
  const effectiveCompositionId = useMemo((): LayoutCompositionId | 'ai-decide' => {
    if (compositionMode === 'ai-decide') return 'ai-decide';
    if (compositionMode === 'random') {
      const ids = LAYOUT_COMPOSITIONS.map((c) => c.id) as LayoutCompositionId[];
      return ids[Math.floor(Math.random() * ids.length)];
    }
    return project.compositionId ?? 'story-scenes';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositionMode, project.compositionId]);

  const generatedPrompt = useMemo(
    () =>
      buildSceneGenerationPrompt(activeCues, {
        title: customTitle || project.title,
        style: promptStyle,
        compositionId: promptStyle === 'tiktok-cards' ? effectiveCompositionId : undefined,
      }),
    [activeCues, customTitle, project.title, effectiveCompositionId, promptStyle],
  );

  const jsonPreviewSummary = useMemo(() => {
    const parsed = parseScenePlanJson(rawSceneJson);
    if (!parsed) return null;
    return summarizeScenePlan(parsed, activeCues);
  }, [rawSceneJson, activeCues]);

  const encoding = useMemo(() => resolveMp4EncodingParams(mp4Settings), [mp4Settings]);

  const visualTimelineItems = useMemo(
    () =>
      project.elements
        .filter((e) => e.type !== 'karaoke-card')
        .sort((a, b) => a.startTime - b.startTime),
    [project.elements],
  );

  const handleLoadPreset = (presetId: PresetId) => {
    setErrorMsg(null);
    setRenderNotice(null);
    onSelectPreset(presetId);
    if (presetId === 'jp-en') {
      setRawTranscript(SAMPLE_JP_EN_TRANSCRIPT);
      setCustomTitle('Can / Could / May (Transcript Nhật-Anh 1:42)');
      setRawSceneJson(JSON.stringify(SAMPLE_JP_EN_SCENE_JSON, null, 2));
      setPromptStyle('tiktok-cards');
      setUseSeparateWordsJson(false);
    } else if (presetId === '3d') {
      setRawWordsJson(JSON.stringify(SAMPLE_WORDS_JSON, null, 2));
      setRawSceneJson(JSON.stringify(SAMPLE_SCENE_PLAN, null, 2));
      setCustomTitle('3D Shapes & Karaoke: Three Polite Levels');
      setPromptStyle('3d-shapes');
      setUseSeparateWordsJson(true);
    } else if (presetId === 'xun') {
      setRawTranscript(SAMPLE_XUN52000_TRANSCRIPT);
      setCustomTitle('Stop Saying Very (@xun52000 Word Reveal)');
      setRawSceneJson(JSON.stringify(SAMPLE_XUN52000_SCENE_JSON, null, 2));
      setPromptStyle('word-reveal-dark');
      setUseSeparateWordsJson(false);
    }
  };

  const handleTranscriptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawTranscript(text);
    setErrorMsg(null);
    const parsed = parseTranscriptAuto(text);
    if (parsed.length > 0) {
      onApplyTranscript(parsed, customTitle);
    }
  };

  const handleCommitTranscriptAndGoPrompt = () => {
    const parsed = parseTranscriptAuto(rawTranscript);
    if (parsed.length === 0) {
      setErrorMsg(
        'Chưa nhận diện được mốc thời gian. Hãy dán định dạng HH:MM:SS.mmm + Nội dung, SRT, VTT hoặc JSON.',
      );
      return;
    }
    setErrorMsg(null);
    onApplyTranscript(parsed, customTitle);
    setStep(2);
  };

  const handleCopyPrompt = async () => {
    if (liveTranscriptCues.length > 0 && project.cues.length !== liveTranscriptCues.length) {
      onApplyTranscript(liveTranscriptCues, customTitle);
    }
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      setCopiedPrompt(false);
    }
  };

  const parseInputsForRender = (): {
    words: WordTiming[];
    plan: ScenePlanDocument;
    title: string;
    cuesOverride?: TranscriptCue[];
    summary: ReturnType<typeof summarizeScenePlan>;
  } | null => {
    const plan = parseScenePlanJson(rawSceneJson);
    if (!plan || plan.scenes.length === 0) {
      setErrorMsg(
        'Không đọc được JSON từ AI. Hãy đảm bảo đoạn dán chứa object JSON có "scenes" hoặc "elements".',
      );
      return null;
    }

    if (useSeparateWordsJson) {
      const words = parseWordLevelJson(rawWordsJson);
      if (words.length === 0) {
        setErrorMsg('words.json không hợp lệ hoặc thiếu danh sách "words".');
        return null;
      }
      setErrorMsg(null);
      return {
        words,
        plan,
        title: customTitle,
        summary: summarizeScenePlan(plan, project.cues),
      };
    }

    const cues = liveTranscriptCues.length > 0 ? liveTranscriptCues : project.cues;
    if (cues.length === 0) {
      setErrorMsg('Hãy nhập Transcript ở Bước 1 trước khi Render.');
      setStep(1);
      return null;
    }
    const nextTitle = (plan as { title?: string }).title?.trim() || customTitle;
    if ((plan as { title?: string }).title?.trim()) {
      setCustomTitle(nextTitle);
    }
    const words = cues.flatMap((c) => c.words);
    setErrorMsg(null);
    return {
      words,
      plan,
      title: nextTitle,
      cuesOverride: cues,
      summary: summarizeScenePlan(plan, cues),
    };
  };

  const handleApplyPreviewOnly = () => {
    const prepared = parseInputsForRender();
    if (!prepared) return;
    onApplyScenePlan(prepared.words, prepared.plan, prepared.title, prepared.cuesOverride);
    setRenderNotice(
      `Đã cập nhật xem trước 9:16 với ${prepared.summary.elementCount} lớp chữ/minh họa + ${prepared.summary.cueCount} phụ đề karaoke.`,
    );
  };

  const handleRenderAndDownloadVideo = async () => {
    if (isExportingVideo) return;
    const prepared = parseInputsForRender();
    if (!prepared) return;
    setRenderNotice(null);
    const result = await onApplyAndRenderVideo(
      prepared.words,
      prepared.plan,
      prepared.title,
      prepared.cuesOverride,
    );
    if (result) {
      const mb = (result.byteLength / (1024 * 1024)).toFixed(2);
      setRenderNotice(
        `Đã render & tải xong file ${result.fileName} (${mb} MB, ${result.width}×${result.height} @ ${result.fps}fps · ${result.qualityLabel}${audioFileName ? ' · có tiếng' : ''}).`,
      );
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Main 3-Step Automated Pipeline Card */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
        {/* Top Header + Quick Demo Presets */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Quy trình tự động bằng AI Prompt
            </h2>
            <p className="text-xs text-slate-500">
              Nhập Audio &amp; Transcript → Tạo Prompt gửi ChatGPT/Gemini → Dán JSON để Render
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleLoadPreset('jp-en')}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap ${
                project.id === 'preset-jp-en-polite'
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Mẫu Nhật-Anh 1:42
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset('water')}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap ${
                project.id === 'preset-water-polite'
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Can / Could
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset('3d')}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap ${
                project.id === 'preset-3d-shapes'
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              3D Shapes
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset('xun')}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap ${
                project.id === 'preset-xun52000-dark'
                  ? 'bg-slate-800 border-slate-700 text-yellow-300'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              ⚡ @xun52000 Dark
            </button>
          </div>
        </div>

        {/* 3-Step Selector Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setStep(1);
            }}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
              step === 1
                ? 'bg-white border-indigo-300 shadow-xs text-slate-900'
                : 'bg-transparent border-transparent text-slate-600 hover:bg-white/70'
            }`}
          >
            <div>
              <div className="text-[11px] font-semibold text-indigo-600">Bước 1</div>
              <div className="text-xs font-semibold truncate">Audio &amp; Transcript</div>
            </div>
            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
              {activeCues.length} câu
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setStep(2);
            }}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
              step === 2
                ? 'bg-white border-indigo-300 shadow-xs text-slate-900'
                : 'bg-transparent border-transparent text-slate-600 hover:bg-white/70'
            }`}
          >
            <div>
              <div className="text-[11px] font-semibold text-indigo-600">Bước 2 · Xương sống</div>
              <div className="text-xs font-semibold truncate">Tạo Prompt AI</div>
            </div>
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setStep(3);
            }}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
              step === 3
                ? 'bg-white border-indigo-300 shadow-xs text-slate-900'
                : 'bg-transparent border-transparent text-slate-600 hover:bg-white/70'
            }`}
          >
            <div>
              <div className="text-[11px] font-semibold text-indigo-600">Bước 3</div>
              <div className="text-xs font-semibold truncate">Dán JSON &amp; Render</div>
            </div>
            <FileJson className="w-4 h-4 text-indigo-500 shrink-0" />
          </button>
        </div>

        {/* Step Content */}
        <div className="p-5 space-y-4">
          {step === 1 && (
            <>
              {/* Audio Input */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <FileAudio className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {audioFileName ? `Audio đã nạp: ${audioFileName}` : '1. File Audio giọng đọc'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Hỗ trợ .mp3, .wav, .m4a · Phát đồng bộ và ghép tiếng khi render MP4
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadAudio(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{audioFileName ? 'Đổi Audio' : 'Chọn file Audio'}</span>
                  </button>
                  {audioFileName && (
                    <button
                      type="button"
                      onClick={onClearAudio}
                      className="px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-red-600 border border-slate-200 rounded-lg bg-white"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>

              {/* Title + Transcript Input */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label
                    htmlFor="pipeline-title-input"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Tên bài giảng
                  </label>
                  <input
                    id="pipeline-title-input"
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="VD: Can / Could / May — Giao tiếp lịch sự"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRawTranscript(SAMPLE_JP_EN_TRANSCRIPT);
                      setCustomTitle('Can / Could / May (Transcript Nhật-Anh 1:42)');
                      setErrorMsg(null);
                    }}
                    className="flex-1 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap"
                  >
                    Nạp mẫu Nhật-Anh
                  </button>
                  <button
                    type="button"
                    onClick={() => transcriptInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>File</span>
                  </button>
                  <input
                    ref={transcriptInputRef}
                    type="file"
                    accept=".txt,.srt,.vtt,.json"
                    className="hidden"
                    onChange={handleTranscriptFile}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="pipeline-transcript-input"
                    className="text-xs font-medium text-slate-700"
                  >
                    2. Dán Transcript có timestamp (dạng <code>00:00:00.000</code> xuống dòng hoặc SRT/VTT/JSON)
                  </label>
                  <span className="text-[11px] font-medium text-emerald-700 tabular-nums">
                    Nhận diện: {liveTranscriptCues.length} câu thoại
                  </span>
                </div>
                <textarea
                  id="pipeline-transcript-input"
                  rows={8}
                  value={rawTranscript}
                  onChange={(e) => {
                    setRawTranscript(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder={'00:00:00.000\nこのシーンを想像してみて...\n\n00:00:11.960\nまずは can から...'}
                  className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  {errorMsg}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseTranscriptAuto(rawTranscript);
                    if (parsed.length > 0) onApplyTranscript(parsed, customTitle);
                  }}
                  className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Dựng nhanh không cần AI
                </button>
                <button
                  type="button"
                  onClick={handleCommitTranscriptAndGoPrompt}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tạo Prompt cho ChatGPT / Gemini</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    Prompt đã đóng gói sẵn {activeCues.length} câu thoại &amp; quy tắc dàn cảnh tự động
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sao chép Prompt này dán vào ChatGPT hoặc Gemini → lấy đoạn JSON trả về dán sang Bước 3.
                  </p>
                </div>

                {/* Template selector */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPromptStyle('tiktok-cards')}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
                      promptStyle === 'tiktok-cards'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    📱 TikTok Cards (@168)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptStyle('3d-shapes')}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
                      promptStyle === '3d-shapes'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🎲 Khối 3D + Karaoke
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptStyle('word-reveal-dark')}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
                      promptStyle === 'word-reveal-dark'
                        ? 'bg-slate-800 border-slate-700 text-yellow-300'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ⚡ Word Reveal Dark (@xun52000)
                  </button>
                </div>
              </div>

              {/* Composition picker — only for tiktok-cards */}
              {promptStyle === 'tiktok-cards' && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                    <label
                      htmlFor="step2-composition-select"
                      className="text-[11px] font-semibold text-slate-700 whitespace-nowrap"
                    >
                      Cách phối minh họa:
                    </label>
                    {/* Mode tabs */}
                    <div className="flex gap-1">
                      {(['ai-decide', 'manual', 'random'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCompositionMode(m)}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded border transition-colors ${
                            compositionMode === m
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {m === 'ai-decide' ? '✨ AI chọn' : m === 'random' ? '🔀 Ngẫu nhiên' : 'Thủ công'}
                        </button>
                      ))}
                    </div>
                    {/* Manual dropdown */}
                    {compositionMode === 'manual' && (
                      <select
                        id="step2-composition-select"
                        value={project.compositionId ?? 'story-scenes'}
                        onChange={(e) => onChangeComposition(e.target.value as LayoutCompositionId)}
                        className="flex-1 min-w-0 px-2 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {LAYOUT_COMPOSITIONS.map((comp) => (
                          <option key={comp.id} value={comp.id}>
                            {comp.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {compositionMode === 'manual' && (
                    <button
                      type="button"
                      onClick={onRandomizeComposition}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors whitespace-nowrap"
                    >
                      <Shuffle className="w-3 h-3" />
                      <span>Phối ngẫu nhiên</span>
                    </button>
                  )}
                  {compositionMode === 'ai-decide' && (
                    <span className="text-[10px] text-violet-700">
                      ✨ AI phân tích context và tự chọn kiểu phối tối ưu + ghi lý do vào JSON
                    </span>
                  )}
                  {compositionMode === 'random' && (
                    <span className="text-[10px] text-orange-600">
                      🔀 Mỗi lần tạo prompt sẽ chọn ngẫu nhiên một kiểu phối
                    </span>
                  )}
                </div>
              )}

              <textarea
                aria-label="Prompt sinh Scene JSON cho AI"
                readOnly
                rows={9}
                value={generatedPrompt}
                className="w-full p-3 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none leading-relaxed text-slate-800"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  ← Sửa Transcript
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    {copiedPrompt ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedPrompt ? 'Đã sao chép Prompt!' : 'Sao chép Prompt cho AI'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <span>Dán JSON từ AI</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label htmlFor="pipeline-scene-json" className="text-xs font-semibold text-slate-900">
                    Dán nguyên kết quả JSON từ ChatGPT / Gemini
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Tự động lọc bỏ dấu <code>```json</code> và tự đồng bộ với Audio + {activeCues.length} câu thoại.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUseSeparateWordsJson(false);
                      setRawSceneJson(JSON.stringify(SAMPLE_JP_EN_SCENE_JSON, null, 2));
                      setErrorMsg(null);
                    }}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Mẫu JSON Nhật-Anh
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseSeparateWordsJson(false);
                      setRawSceneJson(JSON.stringify(SAMPLE_XUN52000_SCENE_JSON, null, 2));
                      setErrorMsg(null);
                    }}
                    className="text-[11px] font-medium text-amber-600 hover:text-amber-700"
                  >
                    Mẫu @xun52000 JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseSeparateWordsJson(true);
                      setRawWordsJson(JSON.stringify(SAMPLE_WORDS_JSON, null, 2));
                      setRawSceneJson(JSON.stringify(SAMPLE_SCENE_PLAN, null, 2));
                      setErrorMsg(null);
                    }}
                    className="text-[11px] font-medium text-slate-600 hover:text-slate-900"
                  >
                    Mẫu 3D JSON
                  </button>
                </div>
              </div>

              <textarea
                id="pipeline-scene-json"
                rows={useSeparateWordsJson ? 5 : 7}
                value={rawSceneJson}
                onChange={(e) => {
                  setRawSceneJson(e.target.value);
                  setErrorMsg(null);
                  setRenderNotice(null);
                }}
                placeholder='Dán kết quả từ ChatGPT/Gemini vào đây (hỗ trợ cả ```json ... ```)...'
                className="w-full p-3 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />

              {jsonPreviewSummary && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      JSON hợp lệ: {jsonPreviewSummary.elementCount} lớp chữ/ảnh tự động ·{' '}
                      {jsonPreviewSummary.cueCount} câu karaoke
                    </span>
                  </span>
                  <span className="text-[11px] text-emerald-700 truncate max-w-[220px]">
                    {jsonPreviewSummary.types.slice(0, 4).join(', ')}
                  </span>
                </div>
              )}

              <div>
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSeparateWordsJson}
                    onChange={(e) => setUseSeparateWordsJson(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Tùy chọn: dùng file words.json riêng thay cho Transcript Bước 1</span>
                </label>
              </div>

              {useSeparateWordsJson && (
                <textarea
                  aria-label="words.json tùy chọn"
                  rows={4}
                  value={rawWordsJson}
                  onChange={(e) => setRawWordsJson(e.target.value)}
                  className="w-full p-2.5 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}

              {/* MP4 Resolution, Quality & FPS Controls */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">
                    Chất lượng &amp; Độ phân giải MP4
                  </span>
                  <span className="text-[11px] font-mono text-slate-600 tabular-nums">
                    {encoding.width}×{encoding.height} · {(encoding.videoBitrate / 1_000_000).toFixed(1)} Mbps · {encoding.fps}fps
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label
                      htmlFor="pipeline-export-resolution"
                      className="block text-[11px] font-medium text-slate-600 mb-1"
                    >
                      Độ phân giải
                    </label>
                    <select
                      id="pipeline-export-resolution"
                      disabled={isExportingVideo}
                      value={mp4Settings.resolution}
                      onChange={(e) =>
                        onChangeMp4Settings({
                          ...mp4Settings,
                          resolution: e.target.value as Mp4ExportSettings['resolution'],
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {RESOLUTION_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="pipeline-export-quality"
                      className="block text-[11px] font-medium text-slate-600 mb-1"
                    >
                      Chất lượng
                    </label>
                    <select
                      id="pipeline-export-quality"
                      disabled={isExportingVideo}
                      value={mp4Settings.quality}
                      onChange={(e) =>
                        onChangeMp4Settings({
                          ...mp4Settings,
                          quality: e.target.value as Mp4ExportSettings['quality'],
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {QUALITY_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="pipeline-export-fps"
                      className="block text-[11px] font-medium text-slate-600 mb-1"
                    >
                      Khung hình (FPS)
                    </label>
                    <select
                      id="pipeline-export-fps"
                      disabled={isExportingVideo}
                      value={mp4Settings.fps}
                      onChange={(e) =>
                        onChangeMp4Settings({
                          ...mp4Settings,
                          fps: Number(e.target.value) as Mp4ExportSettings['fps'],
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {FPS_OPTIONS.map((fpsVal) => (
                        <option key={fpsVal} value={fpsVal}>
                          {fpsVal} fps{fpsVal === 30 ? ' (Chuẩn)' : fpsVal === 60 ? ' (Mượt)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {(errorMsg || exportError) && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  {errorMsg || exportError}
                </p>
              )}

              {isExportingVideo && (
                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-indigo-800">
                    <span>{exportStageLabel || 'Đang render Video MP4...'}</span>
                    <span className="tabular-nums">{Math.round(exportProgress * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-indigo-200/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-150"
                      style={{ width: `${Math.round(exportProgress * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {renderNotice && !isExportingVideo && (
                <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 font-medium">
                  {renderNotice}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  disabled={isExportingVideo}
                  onClick={() => setStep(2)}
                  className="px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  ← Quay lại Prompt
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isExportingVideo}
                    onClick={handleApplyPreviewOnly}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Áp dụng vào Xem trước</span>
                  </button>
                  <button
                    type="button"
                    disabled={isExportingVideo}
                    onClick={() => void handleRenderAndDownloadVideo()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {isExportingVideo ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isExportingVideo ? 'Đang render MP4...' : 'Render & Tải Video (.mp4)'}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Bottom Compact Overview: Auto-synced Cues & AI Visual Beats (No manual design required) */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-900">
              Kịch bản AI đã đồng bộ ({visualTimelineItems.length} hiệu ứng chữ/ảnh · {project.cues.length} phụ đề)
            </h3>
            <p className="text-[11px] text-slate-500">
              Bấm vào bất kỳ mốc nào để xem ngay đoạn chuyển động đó trên khung 9:16
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAdvancedEditor}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Tinh chỉnh nâng cao</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1 max-h-[220px]">
          {visualTimelineItems.map((el) => {
            const active = currentTime >= el.startTime && currentTime <= el.endTime;
            return (
              <button
                key={el.id}
                type="button"
                onClick={() =>
                  onSeek(
                    Math.min(
                      el.endTime - 0.05,
                      el.startTime + Math.min(0.28, (el.endTime - el.startTime) * 0.25),
                    ),
                  )
                }
                className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                  active
                    ? 'bg-indigo-50/80 border-indigo-300'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                  <span className="font-mono">
                    {formatTimeToken(el.startTime).slice(3, 8)} →{' '}
                    {formatTimeToken(el.endTime).slice(3, 8)}
                  </span>
                  <span className="text-[10px] font-medium text-indigo-600">{el.type}</span>
                </div>
                <div className="text-xs font-medium text-slate-900 truncate mt-0.5">
                  {el.label}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
