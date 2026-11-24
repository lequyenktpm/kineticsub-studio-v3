import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2, FolderTree, X } from 'lucide-react';
import {
  generatePythonProjectFiles,
  VideoMakerFileName,
} from '../engine/pythonGenerator';
import { LessonProject } from '../engine/types';
import { buildZipArchive } from '../utils/zipBuilder';

interface PythonExportModalProps {
  isOpen: boolean;
  project: LessonProject;
  onClose: () => void;
}

const ORDERED_FILES: VideoMakerFileName[] = [
  'main.py',
  'loader.py',
  'renderer_shapes.py',
  'renderer_text.py',
  'renderer_subtitles.py',
  'timeline.py',
  'video_builder.py',
  'sample_words.json',
  'sample_scene.json',
  'requirements.txt',
  'README.md',
];

export const PythonExportModal: React.FC<PythonExportModalProps> = ({
  isOpen,
  project,
  onClose,
}) => {
  const [activeFile, setActiveFile] = useState<VideoMakerFileName>('main.py');
  const [copied, setCopied] = useState(false);

  const files = useMemo(() => generatePythonProjectFiles(project), [project]);

  if (!isOpen) return null;

  const currentContent = files[activeFile];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadZip = () => {
    const zipEntries: Record<string, string> = {};
    for (const [name, content] of Object.entries(files)) {
      zipEntries[`video_maker/${name}`] = content;
    }
    const zipBytes = buildZipArchive(zipEntries);
    const copy = new Uint8Array(zipBytes.length);
    copy.set(zipBytes);
    const blob = new Blob([copy.buffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_maker_${project.id}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="python-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-5xl h-[86vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FolderTree className="w-4 h-4" />
            </div>
            <div>
              <h2 id="python-export-title" className="text-base font-semibold text-slate-900">
                Mã nguồn Python modular: <code className="font-mono text-indigo-600">video_maker/</code>
              </h2>
              <p className="text-xs text-slate-500">
                Pillow + MoviePy + FFmpeg · Đầy đủ 7 module Python + sample_words.json + sample_scene.json
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép file</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải trọn bộ video_maker (.zip)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ xuất Python"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2-Pane File Tree + Code Viewer */}
        <div className="flex-1 flex min-h-0">
          <nav
            aria-label="Danh sách file Python"
            className="w-56 shrink-0 bg-slate-50 border-r border-slate-200 p-3 overflow-y-auto space-y-1"
          >
            <div className="px-2 pb-1.5 text-[11px] font-semibold text-slate-500">
              video_maker/ ({ORDERED_FILES.length} files)
            </div>
            {ORDERED_FILES.map((fileName) => {
              const isActive = activeFile === fileName;
              return (
                <button
                  key={fileName}
                  type="button"
                  onClick={() => setActiveFile(fileName)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs font-mono rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span className="truncate">{fileName}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 overflow-auto bg-[#0F172A] text-slate-100 p-5">
            <pre className="text-xs font-mono leading-relaxed whitespace-pre">
              <code>{currentContent}</code>
            </pre>
          </div>
        </div>

        {/* Footer Command Hint */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            Lệnh chạy trên máy:
            <code className="ml-2 px-2 py-0.5 bg-slate-200/70 text-slate-900 rounded font-mono">
              python main.py --audio {project.audioFileName || 'input.mp3'} --transcript sample_words.json --scene-plan sample_scene.json --output output.mp4
            </code>
          </span>
          <span className="tabular-nums text-slate-500">
            {project.elements.length} lớp · {project.fps} FPS
          </span>
        </div>
      </div>
    </div>
  );
};
