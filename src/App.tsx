import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Code2, Layers, X } from 'lucide-react';
import { AutomationPipelinePanel, PresetId } from './components/AutomationPipelinePanel';
import { BatchQueueModal } from './components/BatchQueueModal';
import { PythonExportModal } from './components/PythonExportModal';
import { StagePreview } from './components/StagePreview';
import { TimelineAndInspector } from './components/TimelineAndInspector';
import { choreographFromTranscript } from './engine/autoChoreographer';
import {
  pickRandomComposition,
  recomposeProjectWithStyle,
} from './engine/illustrationLayouts';
import {
  DEFAULT_MP4_EXPORT_SETTINGS,
  Mp4ExportSettings,
  resolveMp4EncodingParams,
} from './engine/mp4Config';
import {
  ExportVideoResult,
  exportProjectToVideo,
} from './engine/mp4Exporter';
import {
  PRESET_3D_SHAPES_KARAOKE,
  PRESET_ED_PRONUNCIATION,
  PRESET_JP_EN_POLITE,
  PRESET_WATER_POLITE,
  PRESET_XUN52000_DARK,
} from './engine/demoPresets';
import { FlexibleSceneDocument, scenePlanToProject } from './engine/scenePlanAdapter';
import {
  CanvasThemeId,
  LayoutCompositionId,
  LessonProject,
  SceneElement,
  ScenePlanDocument,
  TranscriptCue,
  WordTiming,
} from './engine/types';

export default function App() {
  const [project, setProject] = useState<LessonProject>(() => PRESET_JP_EN_POLITE);
  const [currentTime, setCurrentTime] = useState<number>(4.8);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | undefined>(undefined);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStageLabel, setExportStageLabel] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [mp4Settings, setMp4Settings] = useState<Mp4ExportSettings>(DEFAULT_MP4_EXPORT_SETTINGS);
  const resolvedExport = resolveMp4EncodingParams(mp4Settings);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef<number | null>(null);

  // Sync playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastFrameTsRef.current = null;
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      return;
    }

    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = currentTime;
      audioRef.current.play().catch(() => {
        // Ignore autoplay restrictions
      });
    }

    const tick = (now: number) => {
      if (audioRef.current && audioUrl && !audioRef.current.paused) {
        const nextT = audioRef.current.currentTime;
        if (nextT >= project.duration) {
          setCurrentTime(0);
          setIsPlaying(false);
          return;
        }
        setCurrentTime(nextT);
      } else {
        if (lastFrameTsRef.current === null) {
          lastFrameTsRef.current = now;
        }
        const dt = (now - lastFrameTsRef.current) / 1000;
        lastFrameTsRef.current = now;
        setCurrentTime((prev) => {
          const next = prev + dt;
          if (next >= project.duration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, project.duration, audioUrl]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleSelectPreset = useCallback((presetId: PresetId) => {
    setIsPlaying(false);
    const next =
      presetId === 'jp-en'
        ? PRESET_JP_EN_POLITE
        : presetId === 'water'
          ? PRESET_WATER_POLITE
          : presetId === 'ed'
            ? PRESET_ED_PRONUNCIATION
            : presetId === 'xun'
              ? PRESET_XUN52000_DARK
              : PRESET_3D_SHAPES_KARAOKE;
    setProject(next);
    setCurrentTime(
      presetId === 'jp-en'
        ? 4.8
        : presetId === 'water'
          ? 3.1
          : presetId === 'ed'
            ? 3.8
            : presetId === 'xun'
              ? 2.8
              : 1.65,
    );
    setSelectedElementId(null);
  }, []);

  const handleUploadAudio = useCallback((file: File) => {
    setIsPlaying(false);
    const nextUrl = URL.createObjectURL(file);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    setAudioFile(file);
    setAudioFileName(file.name);
    setAudioDurationSec(null);
    setProject((prev) => ({ ...prev, audioFileName: file.name }));
  }, []);

  const handleClearAudio = useCallback(() => {
    setIsPlaying(false);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAudioFile(null);
    setAudioFileName(undefined);
    setAudioDurationSec(null);
    setProject((prev) => ({ ...prev, audioFileName: undefined }));
  }, []);

  const handleApplyTranscript = useCallback(
    (cues: TranscriptCue[], title: string) => {
      setIsPlaying(false);
      const built = choreographFromTranscript(cues, {
        title,
        theme: project.theme === 'studio-slate' ? 'pastel-sunrise' : project.theme,
        audioFileName,
      });
      const next: LessonProject = audioDurationSec
        ? { ...built, duration: Number(Math.max(built.duration, audioDurationSec).toFixed(2)) }
        : built;
      setProject(next);
      const firstCue = cues[0];
      const previewTime = firstCue
        ? Number((firstCue.start + Math.min(0.5, (firstCue.end - firstCue.start) * 0.45)).toFixed(2))
        : 0.4;
      setCurrentTime(Math.min(next.duration, previewTime));
      setSelectedElementId(null);
    },
    [project.theme, audioFileName, audioDurationSec],
  );

  const handleApplyScenePlan = useCallback(
    (
      words: WordTiming[],
      plan: ScenePlanDocument,
      title: string,
      cuesOverride?: TranscriptCue[],
    ): LessonProject => {
      setIsPlaying(false);
      const flexPlan = plan as FlexibleSceneDocument;
      const built = scenePlanToProject(words, flexPlan, {
        title,
        theme: flexPlan.theme,
        audioFileName,
        cuesOverride,
      });
      const next: LessonProject = audioDurationSec
        ? { ...built, duration: Number(Math.max(built.duration, audioDurationSec).toFixed(2)) }
        : built;
      setProject(next);
      const firstVisual = next.elements.find((e) => e.type !== 'karaoke-card');
      const firstWord = words[0];
      setCurrentTime(
        Math.min(
          next.duration,
          Number(((firstVisual?.startTime ?? firstWord?.start ?? 0) + 0.6).toFixed(2)),
        ),
      );
      setSelectedElementId(null);
      return next;
    },
    [audioFileName, audioDurationSec],
  );

  const handleSeek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(project.duration, time));
      setCurrentTime(clamped);
      if (audioRef.current && audioUrl) {
        audioRef.current.currentTime = clamped;
      }
    },
    [project.duration, audioUrl],
  );

  const handleChangeComposition = useCallback((compositionId: LayoutCompositionId) => {
    setIsPlaying(false);
    setSelectedElementId(null);
    setProject((prev) => recomposeProjectWithStyle(prev, compositionId));
  }, []);

  const handleRandomizeComposition = useCallback(() => {
    setIsPlaying(false);
    setSelectedElementId(null);
    setProject((prev) => {
      const pick = pickRandomComposition(prev.compositionId, prev.theme);
      return recomposeProjectWithStyle(prev, pick.compositionId, { theme: pick.theme });
    });
  }, []);

  const handleUpdateElement = useCallback((id: string, patch: Partial<SceneElement>) => {
    setProject((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    }));
  }, []);

  const handleMoveElement = useCallback((id: string, x: number, y: number) => {
    setProject((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, layout: { ...el.layout, x, y } } : el,
      ),
    }));
  }, []);

  const handleDeleteElement = useCallback(
    (id: string) => {
      setProject((prev) => ({
        ...prev,
        elements: prev.elements.filter((el) => el.id !== id),
      }));
      if (selectedElementId === id) {
        setSelectedElementId(null);
      }
    },
    [selectedElementId],
  );

  const handleAddElement = useCallback(
    (type: 'sentence-card' | 'topic-pill' | 'shape-3d') => {
      const start = Number(Math.max(0, currentTime).toFixed(2));
      const end = Number(Math.min(project.duration, start + 3.0).toFixed(2));
      const id = `custom-${type}-${Date.now()}`;

      let newEl: SceneElement;
      if (type === 'shape-3d') {
        newEl = {
          id,
          type: 'shape-3d',
          label: 'Khối 3D mới',
          startTime: start,
          endTime: Math.max(start + 0.8, end),
          enterAnimation: 'pop-up',
          exitAnimation: 'shrink',
          layout: { x: 540, y: 760, width: 760, height: 220, scale: 1, zIndex: 24 },
          props: {
            kind: 'shape-3d',
            shapeType: 'card_3d',
            fill: '#14B8A6',
            shadow: true,
            highlight: true,
            depth: 12,
            cornerRadius: 28,
            textContent: 'Key Point',
            textColor: '#FFFFFF',
            textSize: 'headline',
            textWeight: 'bold',
          },
        };
      } else if (type === 'sentence-card') {
        newEl = {
          id,
          type: 'sentence-card',
          label: 'Thẻ câu mới',
          startTime: start,
          endTime: Math.max(start + 0.8, end),
          enterAnimation: 'pop-up',
          exitAnimation: 'shrink',
          layout: { x: 540, y: 1005, width: 780, scale: 1, zIndex: 22 },
          props: {
            kind: 'sentence-card',
            text: 'Could I have some water?',
            badge: 'check',
            emphasisWord: 'Could I',
            emphasisColor: '#16A34A',
          },
        };
      } else {
        newEl = {
          id,
          type: 'topic-pill',
          label: 'Nhãn mới',
          startTime: start,
          endTime: Math.max(start + 0.8, end),
          enterAnimation: 'pop-up',
          exitAnimation: 'fade-out',
          layout: { x: 540, y: 345, width: 340, scale: 1, zIndex: 14 },
          props: {
            kind: 'topic-pill',
            text: 'Tip #1',
            bgColor: '#DCFCE7',
            textColor: '#15803D',
          },
        };
      }

      setProject((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
      setSelectedElementId(id);
    },
    [currentTime, project.duration],
  );

  const handleExportVideo = useCallback(
    async (projectOverride?: LessonProject): Promise<ExportVideoResult | null> => {
      if (isExportingVideo) return null;
      const targetProject = projectOverride ?? project;
      setIsPlaying(false);
      setIsExportingVideo(true);
      setExportProgress(0);
      setExportStageLabel('Đang chuẩn bị render MP4...');
      setExportError(null);

      try {
        const result = await exportProjectToVideo(
          targetProject,
          audioFile,
          ({ progress, stageLabel }) => {
            setExportProgress(progress);
            setExportStageLabel(stageLabel);
          },
          mp4Settings,
        );
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể render file video.';
        setExportError(msg);
        return null;
      } finally {
        setIsExportingVideo(false);
        setExportProgress(0);
        setExportStageLabel('');
      }
    },
    [isExportingVideo, project, audioFile, mp4Settings],
  );

  const handleApplyAndRenderVideo = useCallback(
    async (
      words: WordTiming[],
      plan: ScenePlanDocument,
      title: string,
      cuesOverride?: TranscriptCue[],
    ): Promise<ExportVideoResult | null> => {
      const nextProject = handleApplyScenePlan(words, plan, title, cuesOverride);
      return handleExportVideo(nextProject);
    },
    [handleApplyScenePlan, handleExportVideo],
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] text-slate-900">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (Number.isFinite(dur) && dur > 0.5) {
              setAudioDurationSec(dur);
              setProject((prev) => ({
                ...prev,
                duration: Number(Math.max(prev.duration, dur).toFixed(2)),
              }));
            }
          }}
        />
      )}

      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8">
        <a
          href="#studio"
          className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
        >
          KineticSub Studio
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#studio"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Quy trình AI Prompt
          </a>
          <button
            type="button"
            onClick={() => handleSelectPreset('jp-en')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Mẫu Nhật-Anh 1:42
          </button>
          <button
            type="button"
            onClick={() => handleSelectPreset('3d')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Mẫu 3D Shapes
          </button>
          <a
            href="#python-guide"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Kiến trúc 3 Input
          </a>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Chạy Batch Hàng Loạt</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPythonModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Xuất Code Python</span>
          </button>
        </div>
      </header>

      {/* Main Automated AI-First Workspace */}
      <main id="studio" className="flex-1 max-w-[1400px] w-full mx-auto p-4 lg:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight text-balance">
              {project.title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{project.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
            <span>{project.elements.length} lớp tự động</span>
            <span aria-hidden="true">·</span>
            <span>{project.duration.toFixed(1)}s</span>
            <span aria-hidden="true">·</span>
            <span>
              {resolvedExport.width}×{resolvedExport.height} @ {resolvedExport.fps}fps
            </span>
          </div>
        </div>

        {/* Clean 2-Column AI Pipeline + Live 9:16 Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-7 min-h-0">
            <AutomationPipelinePanel
              project={project}
              audioFileName={audioFileName}
              currentTime={currentTime}
              mp4Settings={mp4Settings}
              isExportingVideo={isExportingVideo}
              exportProgress={exportProgress}
              exportStageLabel={exportStageLabel}
              exportError={exportError}
              onChangeMp4Settings={setMp4Settings}
              onChangeComposition={handleChangeComposition}
              onRandomizeComposition={handleRandomizeComposition}
              onSelectPreset={handleSelectPreset}
              onUploadAudio={handleUploadAudio}
              onClearAudio={handleClearAudio}
              onApplyTranscript={handleApplyTranscript}
              onApplyScenePlan={handleApplyScenePlan}
              onApplyAndRenderVideo={handleApplyAndRenderVideo}
              onSeek={handleSeek}
              onOpenAdvancedEditor={() => setIsAdvancedOpen(true)}
            />
          </div>

          <div className="lg:col-span-5 min-h-0">
            <StagePreview
              project={project}
              currentTime={currentTime}
              isPlaying={isPlaying}
              mp4Settings={mp4Settings}
              isExportingVideo={isExportingVideo}
              exportProgress={exportProgress}
              exportStageLabel={exportStageLabel}
              selectedElementId={isAdvancedOpen ? selectedElementId : null}
              onChangeMp4Settings={setMp4Settings}
              onChangeComposition={handleChangeComposition}
              onRandomizeComposition={handleRandomizeComposition}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onRestart={() => {
                handleSeek(0);
                setIsPlaying(true);
              }}
              onSeek={handleSeek}
              onChangeTheme={(theme: CanvasThemeId) =>
                setProject((prev) => ({ ...prev, theme }))
              }
              onSelectElement={setSelectedElementId}
              onMoveElement={handleMoveElement}
              onExportVideo={() => void handleExportVideo()}
            />
          </div>
        </div>

        {/* Concise 3-Input Architecture Guide */}
        <section
          id="python-guide"
          className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div>
            <p className="text-xs font-semibold text-indigo-600 mb-1">01. Không cần thiết kế tay</p>
            <h3 className="text-sm font-semibold text-slate-900 mb-1.5">
              Chỉ nhập Audio &amp; Transcript
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hỗ trợ file ghi âm cùng transcript mốc thời gian (<code>00:00:00.000</code>, SRT,
              VTT, JSON). Karaoke từng từ/cụm chữ Nhật–Anh được đồng bộ tự động.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-600 mb-1">02. Prompt là xương sống</p>
            <h3 className="text-sm font-semibold text-slate-900 mb-1.5">
              Gửi ChatGPT / Gemini sinh JSON
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bấm “Sao chép Prompt cho AI” để AI tự chọn hình minh họa, tách câu ví dụ lên thẻ,
              tạo bậc thang 3D và gắn mốc hiện/ẩn không chồng đè.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-600 mb-1">03. Render tự động 9:16</p>
            <h3 className="text-sm font-semibold text-slate-900 mb-1.5">
              Render &amp; tải MP4 trực tiếp hoặc Python
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Chọn độ phân giải (540p–2K), chất lượng &amp; FPS ở Bước 3 để render file{' '}
              <code>.mp4</code> có tiếng ngay trên trình duyệt, hoặc tải gói Python (
              <code>video_maker/</code>) chạy offline.
            </p>
          </div>
        </section>
      </main>

      {/* Optional Advanced Editor Modal (Hidden by default so user doesn't have to design) */}
      {isAdvancedOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="advanced-editor-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl h-[82vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 id="advanced-editor-title" className="text-sm font-semibold text-slate-900">
                  Tinh chỉnh nâng cao (Tùy chọn)
                </h2>
                <p className="text-xs text-slate-500">
                  Chỉ dùng khi bạn muốn sửa tay thời gian hoặc vị trí của thẻ do AI tạo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvancedOpen(false)}
                aria-label="Đóng chỉnh sửa nâng cao"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-4 bg-slate-50">
              <TimelineAndInspector
                project={project}
                currentTime={currentTime}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onAddElement={handleAddElement}
                onSeek={handleSeek}
              />
            </div>
          </div>
        </div>
      )}

      <BatchQueueModal
        isOpen={isBatchModalOpen}
        mp4Settings={mp4Settings}
        onChangeMp4Settings={setMp4Settings}
        onClose={() => setIsBatchModalOpen(false)}
      />

      <PythonExportModal
        isOpen={isPythonModalOpen}
        project={project}
        onClose={() => setIsPythonModalOpen(false)}
      />
    </div>
  );
}
