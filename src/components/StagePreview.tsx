import React, { useEffect, useRef } from 'react';
import { Download, Pause, Play, RotateCcw, Shuffle } from 'lucide-react';
import {
  hitTestElements,
  renderProjectFrame,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from '../engine/canvasRenderer';
import { LAYOUT_COMPOSITIONS } from '../engine/illustrationLayouts';
import {
  FPS_OPTIONS,
  Mp4ExportSettings,
  QUALITY_OPTIONS,
  RESOLUTION_OPTIONS,
  resolveMp4EncodingParams,
} from '../engine/mp4Config';
import {
  CANVAS_THEMES,
  CanvasThemeId,
  LayoutCompositionId,
  LessonProject,
} from '../engine/types';

interface StagePreviewProps {
  project: LessonProject;
  currentTime: number;
  isPlaying: boolean;
  isExportingVideo: boolean;
  exportProgress: number;
  exportStageLabel?: string;
  selectedElementId: string | null;
  mp4Settings: Mp4ExportSettings;
  onChangeMp4Settings: (next: Mp4ExportSettings) => void;
  onChangeComposition: (compositionId: LayoutCompositionId) => void;
  onRandomizeComposition: () => void;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeek: (time: number) => void;
  onChangeTheme: (theme: CanvasThemeId) => void;
  onSelectElement: (id: string | null) => void;
  onMoveElement: (id: string, x: number, y: number) => void;
  onExportVideo: () => void;
}

export const StagePreview: React.FC<StagePreviewProps> = ({
  project,
  currentTime,
  isPlaying,
  isExportingVideo,
  exportProgress,
  exportStageLabel,
  selectedElementId,
  mp4Settings,
  onChangeMp4Settings,
  onChangeComposition,
  onRandomizeComposition,
  onTogglePlay,
  onRestart,
  onSeek,
  onChangeTheme,
  onSelectElement,
  onMoveElement,
  onExportVideo,
}) => {
  const resolved = resolveMp4EncodingParams(mp4Settings);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStateRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderProjectFrame(
      ctx,
      project,
      currentTime,
      isPlaying || isExportingVideo ? null : selectedElementId,
    );
  }, [project, currentTime, selectedElementId, isPlaying, isExportingVideo]);

  const toCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * STAGE_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * STAGE_HEIGHT,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPlaying || isExportingVideo) return;
    const { x, y } = toCanvasCoords(e);
    const hit = hitTestElements(project.elements, x, y, currentTime);
    if (hit) {
      onSelectElement(hit.id);
      dragStateRef.current = {
        id: hit.id,
        offsetX: hit.layout.x - x,
        offsetY: hit.layout.y - y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      onSelectElement(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const { x, y } = toCanvasCoords(e);
    const clampedX = Math.max(120, Math.min(STAGE_WIDTH - 120, Math.round(x + drag.offsetX)));
    const clampedY = Math.max(120, Math.min(STAGE_HEIGHT - 120, Math.round(y + drag.offsetY)));
    onMoveElement(drag.id, clampedX, clampedY);
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
  };

  const fmtTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(2).padStart(5, '0');
    return `${String(mins).padStart(2, '0')}:${secs}`;
  };

  return (
    <section className="flex flex-col items-center bg-white border border-slate-200 rounded-xl p-4 h-fit sticky top-4">
      <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
          <span className="font-medium text-slate-800">Xem trước Video 9:16</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{resolved.width}×{resolved.height}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {Object.values(CANVAS_THEMES).map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChangeTheme(theme.id)}
              title={theme.name}
              aria-label={`Chọn nền ${theme.name}`}
              className={`w-6 h-6 rounded-md border transition-transform ${
                project.theme === theme.id
                  ? 'border-indigo-600 ring-2 ring-indigo-200 scale-105'
                  : 'border-slate-300 hover:scale-105'
              }`}
              style={{
                background: `linear-gradient(180deg, ${theme.bgTop} 0%, ${theme.bgBottom} 100%)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* @englishpracticing168 Illustration Composition & Randomize Bar */}
      <div className="w-full pt-2.5 flex items-center gap-2">
        <select
          aria-label="Kiểu phối minh họa @englishpracticing168"
          disabled={isExportingVideo}
          value={project.compositionId ?? 'story-scenes'}
          onChange={(e) => onChangeComposition(e.target.value as LayoutCompositionId)}
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {LAYOUT_COMPOSITIONS.map((comp) => (
            <option key={comp.id} value={comp.id}>
              {comp.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={isExportingVideo}
          onClick={onRandomizeComposition}
          aria-label="Phối ngẫu nhiên kiểu @englishpracticing168"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Shuffle className="w-3.5 h-3.5" />
          <span>Phối ngẫu nhiên</span>
        </button>
      </div>

      {/* 9:16 Preview Canvas */}
      <div className="my-3 flex items-center justify-center w-full">
        <div className="relative h-[515px] aspect-[9/16] rounded-[28px] overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
          <canvas
            ref={canvasRef}
            data-testid="kinetic-stage-canvas"
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
          />
          {isExportingVideo && (
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-5 text-center">
              <p className="text-sm font-semibold mb-2">
                {exportStageLabel || 'Đang render Video MP4 (FFmpeg)...'}
              </p>
              <div className="w-48 h-2 bg-white/25 rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full bg-indigo-400 transition-all duration-150"
                  style={{ width: `${Math.round(exportProgress * 100)}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-white/85">
                {Math.round(exportProgress * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Transport & Scrubber */}
      <div className="w-full pt-3 border-t border-slate-100 space-y-2.5">
        <div className="flex items-center gap-3">
          <input
            type="range"
            aria-label="Thanh tua thời gian"
            min={0}
            max={project.duration}
            step={0.02}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
          <span className="text-xs font-mono text-slate-600 tabular-nums shrink-0">
            {fmtTime(currentTime)} / {fmtTime(project.duration)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <select
            aria-label="Độ phân giải xuất MP4"
            disabled={isExportingVideo}
            value={mp4Settings.resolution}
            onChange={(e) =>
              onChangeMp4Settings({
                ...mp4Settings,
                resolution: e.target.value as Mp4ExportSettings['resolution'],
              })
            }
            className="w-full px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {RESOLUTION_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.id} ({opt.width}×{opt.height})
              </option>
            ))}
          </select>

          <select
            aria-label="Chất lượng xuất MP4"
            disabled={isExportingVideo}
            value={mp4Settings.quality}
            onChange={(e) =>
              onChangeMp4Settings({
                ...mp4Settings,
                quality: e.target.value as Mp4ExportSettings['quality'],
              })
            }
            className="w-full px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {QUALITY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Tốc độ khung hình FPS xuất MP4"
            disabled={isExportingVideo}
            value={mp4Settings.fps}
            onChange={(e) =>
              onChangeMp4Settings({
                ...mp4Settings,
                fps: Number(e.target.value) as Mp4ExportSettings['fps'],
              })
            }
            className="w-full px-2 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {FPS_OPTIONS.map((fpsVal) => (
              <option key={fpsVal} value={fpsVal}>
                {fpsVal} fps
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={isExportingVideo}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Phát thử</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onRestart}
              disabled={isExportingVideo}
              aria-label="Phát lại từ đầu"
              className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            disabled={isExportingVideo}
            onClick={onExportVideo}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingVideo ? 'Đang render MP4...' : 'Render & Tải MP4'}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
