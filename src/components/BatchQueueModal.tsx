import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  FolderOpen,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trash2,
  X,
  AlertCircle,
  FileText,
  Download,
  FolderSearch,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  Clipboard,
  ExternalLink,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { buildSceneGenerationPrompt, PromptVideoStyle } from '../engine/aiPromptBuilder';
import { choreographFromTranscript } from '../engine/autoChoreographer';
import { applyCompositionToProject, LAYOUT_COMPOSITIONS } from '../engine/illustrationLayouts';
import {
  DEFAULT_MP4_EXPORT_SETTINGS,
  FPS_OPTIONS,
  Mp4ExportSettings,
  QUALITY_OPTIONS,
  RESOLUTION_OPTIONS,
  resolveMp4EncodingParams,
} from '../engine/mp4Config';
import { exportProjectToServerDisk, exportProjectToVideo } from '../engine/mp4Exporter';
import { parseScenePlanJson, scenePlanToProject } from '../engine/scenePlanAdapter';
import { parseTranscriptAuto } from '../engine/transcriptParser';
import { LayoutCompositionId, LessonProject } from '../engine/types';
import { buildZipArchive } from '../utils/zipBuilder';

export type BatchItemStatus =
  | 'pending'
  | 'generating-json'
  | 'rendering'
  | 'done'
  | 'prompt-ready'
  | 'error';

export interface BatchJobItem {
  id: string;
  baseName: string;
  audioFile: File | null;
  srtFile: File | null;
  jsonFile: File | null;
  pastedJsonText?: string;
  status: BatchItemStatus;
  progress: number;
  detail: string;
  outputInfo?: string;
  promptText?: string;
}

interface BatchQueueModalProps {
  isOpen: boolean;
  mp4Settings: Mp4ExportSettings;
  onChangeMp4Settings?: (next: Mp4ExportSettings) => void;
  onClose: () => void;
  onPreviewProject?: (project: LessonProject) => void;
}

const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i;
const SUB_EXT_RE = /\.(srt|vtt|txt)$/i;
const JSON_EXT_RE = /\.json$/i;

function getBaseName(fileName: string): string {
  return fileName
    .replace(/\.project\.json$/i, '')
    .replace(/\.scene\.json$/i, '')
    .replace(/\.[^.]+$/, '')
    .trim();
}

/** Trigger browser download of a Uint8Array */
function downloadBlob(data: Uint8Array, fileName: string, mimeType = 'application/octet-stream') {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Download a single text file */
function downloadText(text: string, fileName: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const BatchQueueModal: React.FC<BatchQueueModalProps> = ({
  isOpen,
  mp4Settings,
  onChangeMp4Settings,
  onClose,
}) => {
  const [items, setItems] = useState<BatchJobItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // ── Mode ──────────────────────────────────────────────────────────────────
  // 'render'  : Chạy render MP4
  // 'prompt-zip' : Xuất file prompt .txt cho từng video → nén ZIP
  const [batchMode, setBatchMode] = useState<'render' | 'prompt-zip'>('render');

  // ── Video style / template ────────────────────────────────────────────────
  const [videoStyle, setVideoStyle] = useState<PromptVideoStyle>('tiktok-cards');

  // ── Composition picker (chỉ áp dụng cho tiktok-cards) ────────────────────
  const [compositionId, setCompositionId] = useState<LayoutCompositionId | 'ai-decide' | 'random'>(
    'ai-decide',
  );

  // ── Gemini API Key & Persistence ──────────────────────────────────────────
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('kineticsub_gemini_api_key') || '';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaveNotice, setApiKeySaveNotice] = useState<string | null>(null);
  const [serverHasKey, setServerHasKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);

  // ── Render mode options ───────────────────────────────────────────────────
  const [useAiJson, setUseAiJson] = useState(true);
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [saveMode, setSaveMode] = useState<'disk' | 'download'>('disk');
  const [customSavePath, setCustomSavePath] = useState('output');
  const [outputDirHandle, setOutputDirHandle] = useState<any>(null);
  const [outputDirName, setOutputDirName] = useState<string>('');

  // ── Modals / Dialogs ──────────────────────────────────────────────────────
  // 1. Direct Paste JSON for a single item
  const [pasteJsonItem, setPasteJsonItem] = useState<BatchJobItem | null>(null);
  const [pasteJsonContent, setPasteJsonContent] = useState<string>('');
  const [pasteJsonError, setPasteJsonError] = useState<string | null>(null);

  // 2. Missing JSON warning dialog before Batch Render
  const [missingJsonWarning, setMissingJsonWarning] = useState<{
    open: boolean;
    count: number;
    names: string[];
  } | null>(null);

  const [localExportSettings, setLocalExportSettings] = useState<Mp4ExportSettings>(
    mp4Settings ?? DEFAULT_MP4_EXPORT_SETTINGS,
  );
  const stopFlagRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonOnlyInputRef = useRef<HTMLInputElement>(null);
  const apiKeyInputRef = useRef<HTMLInputElement>(null);

  // Check server health on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data?.hasGeminiKey) {
          setServerHasKey(true);
        }
      })
      .catch(() => undefined);
  }, []);

  if (!isOpen) return null;

  const activeSettings = onChangeMp4Settings ? mp4Settings : localExportSettings;
  const updateSettings = (next: Mp4ExportSettings) => {
    setLocalExportSettings(next);
    onChangeMp4Settings?.(next);
  };
  const encoding = resolveMp4EncodingParams(activeSettings);

  // ── Save API Key (both localStorage & server .env) ─────────────────────────
  const handleSaveApiKey = async (keyToSave?: string) => {
    const key = (keyToSave !== undefined ? keyToSave : geminiApiKey).trim();
    setIsSavingKey(true);
    localStorage.setItem('kineticsub_gemini_api_key', key);
    setGeminiApiKey(key);

    try {
      const res = await fetch('/api/ai/save-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      if (res.ok) {
        setServerHasKey(Boolean(key));
        setApiKeySaveNotice('✓ Đã lưu API Key vào trình duyệt và file .env thành công!');
      } else {
        setApiKeySaveNotice('✓ Đã lưu API Key vào trình duyệt!');
      }
    } catch {
      setApiKeySaveNotice('✓ Đã lưu API Key vào trình duyệt!');
    } finally {
      setIsSavingKey(false);
      setTimeout(() => setApiKeySaveNotice(null), 3500);
    }
  };

  // ── Random composition helper ─────────────────────────────────────────────
  const pickRandomComposition = (): LayoutCompositionId => {
    const ids = LAYOUT_COMPOSITIONS.map((c) => c.id);
    return ids[Math.floor(Math.random() * ids.length)] as LayoutCompositionId;
  };

  // ── Resolve effective compositionId for a given item ─────────────────────
  const resolveComposition = (): LayoutCompositionId | 'ai-decide' => {
    if (compositionId === 'random') return pickRandomComposition();
    return compositionId;
  };

  // ── Output Directory Picker (Native File System Access API) ─────────────
  const handlePickDirectory = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        setOutputDirHandle(handle);
        setOutputDirName(handle.name);
      } else {
        const manual = prompt(
          'Nhập đường dẫn thư mục lưu trên máy (hoặc đường dẫn máy chủ):',
          customSavePath || 'batch_output',
        );
        if (manual) {
          setCustomSavePath(manual);
          setOutputDirName(manual);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Directory picker cancelled or error:', err);
      }
    }
  };

  const saveTextOutput = async (text: string, fileName: string) => {
    if (outputDirHandle) {
      try {
        const fileHandle = await outputDirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(text);
        await writable.close();
        return;
      } catch (e) {
        console.warn('Failed writing to directory handle, falling back to browser download', e);
      }
    }
    downloadText(text, fileName);
  };

  const saveBlobOutput = async (data: Uint8Array, fileName: string, mimeType?: string) => {
    if (outputDirHandle) {
      try {
        const fileHandle = await outputDirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
        return;
      } catch (e) {
        console.warn('Failed writing to directory handle, falling back to browser download', e);
      }
    }
    downloadBlob(data, fileName, mimeType);
  };

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    setItems((prev) => {
      const map = new Map<string, BatchJobItem>();
      for (const existing of prev) {
        map.set(existing.baseName.toLowerCase(), { ...existing });
      }

      for (const file of files) {
        const base = getBaseName(file.name);
        if (!base) continue;
        const key = base.toLowerCase();
        const current: BatchJobItem = map.get(key) ?? {
          id: `batch-${key}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          baseName: base,
          audioFile: null,
          srtFile: null,
          jsonFile: null,
          status: 'pending',
          progress: 0,
          detail: 'Chờ xử lý',
        };

        if (AUDIO_EXT_RE.test(file.name)) {
          current.audioFile = file;
        } else if (SUB_EXT_RE.test(file.name)) {
          current.srtFile = file;
        } else if (JSON_EXT_RE.test(file.name)) {
          current.jsonFile = file;
        }

        if (current.status === 'error') {
          current.status = 'pending';
          current.detail = 'Chờ xử lý lại';
        }
        map.set(key, current);
      }

      return Array.from(map.values()).sort((a, b) => a.baseName.localeCompare(b.baseName));
    });
  };

  // ── Handle JSON-only files upload ──────────────────────────────────────────
  const handleJsonFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    setItems((prev) => {
      return prev.map((item) => {
        const matchingFile = files.find(
          (f) => getBaseName(f.name).toLowerCase() === item.baseName.toLowerCase(),
        );
        if (matchingFile) {
          return {
            ...item,
            jsonFile: matchingFile,
            detail: `Đã nạp file ${matchingFile.name}`,
          };
        }
        return item;
      });
    });
  };

  const updateItem = (id: string, patch: Partial<BatchJobItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  // ── Build a prompt string for one item (prompt-zip mode) ──────────────────
  const buildPromptForItem = async (item: BatchJobItem): Promise<string> => {
    if (!item.srtFile) {
      throw new Error(`Thiếu file phụ đề (.srt / .txt) cho "${item.baseName}"`);
    }
    const srtText = await item.srtFile.text();
    const cues = parseTranscriptAuto(srtText);
    if (cues.length === 0) {
      throw new Error(`Không đọc được mốc thời gian trong ${item.srtFile.name}`);
    }

    const effectiveComposition = resolveComposition();
    return buildSceneGenerationPrompt(cues, {
      title: item.baseName,
      style: videoStyle,
      compositionId: effectiveComposition === 'ai-decide' ? 'ai-decide' : effectiveComposition,
    });
  };

  const exportBaseName = (item: BatchJobItem): string =>
    item.audioFile ? getBaseName(item.audioFile.name) : item.baseName;

  // ── Build a LessonProject for render mode ─────────────────────────────────
  const buildProjectForItem = async (
    item: BatchJobItem,
    effectiveComposition: LayoutCompositionId | 'ai-decide',
  ): Promise<LessonProject> => {
    if (item.jsonFile && item.jsonFile.name.endsWith('.project.json')) {
      const raw = await item.jsonFile.text();
      const parsed = JSON.parse(raw) as LessonProject;
      if (parsed && Array.isArray(parsed.elements) && Array.isArray(parsed.cues)) {
        return {
          ...parsed,
          id: item.baseName,
          audioFileName: item.audioFile?.name ?? parsed.audioFileName,
        };
      }
    }

    if (!item.srtFile) {
      throw new Error(`Thiếu file phụ đề (.srt / .txt) cho "${item.baseName}"`);
    }

    const srtText = await item.srtFile.text();
    const cues = parseTranscriptAuto(srtText);
    if (cues.length === 0) {
      throw new Error(`Không đọc được mốc thời gian trong file ${item.srtFile.name}`);
    }

    let rawSceneJson = '';

    // 1. Direct pasted JSON
    if (item.pastedJsonText) {
      rawSceneJson = item.pastedJsonText;
    }
    // 2. Uploaded JSON file
    else if (item.jsonFile) {
      rawSceneJson = await item.jsonFile.text();
    }
    // 3. Automated Gemini API generation
    else if (useAiJson && (geminiApiKey.trim() || serverHasKey)) {
      updateItem(item.id, {
        status: 'generating-json',
        progress: 0.1,
        detail: 'Đang gọi Gemini sinh kịch bản JSON...',
      });
      const prompt = buildSceneGenerationPrompt(cues, {
        title: item.baseName,
        style: videoStyle,
        compositionId: effectiveComposition === 'ai-decide' ? 'ai-decide' : effectiveComposition,
      });
      const aiRes = await fetch('/api/ai/generate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          apiKey: geminiApiKey.trim() || undefined,
          model: geminiModel,
        }),
      });
      const aiBody = await aiRes.json().catch(() => ({}));
      if (!aiRes.ok || !aiBody.jsonText) {
        throw new Error(aiBody.error || 'Không thể sinh JSON từ Gemini API.');
      }
      rawSceneJson = aiBody.jsonText;
    }

    if (rawSceneJson) {
      const plan = parseScenePlanJson(rawSceneJson);
      if (plan && plan.scenes.length > 0) {
        const words = cues.flatMap((c) => c.words);
        return scenePlanToProject(words, plan, {
          id: item.baseName,
          title: plan.title || item.baseName,
          audioFileName: item.audioFile?.name,
          cuesOverride: cues,
        });
      }
    }

    return choreographFromTranscript(cues, {
      id: item.baseName,
      title: item.baseName,
      audioFileName: item.audioFile?.name,
    });
  };

  // ── PROMPT-ZIP batch ───────────────────────────────────────────────────────
  const handleGeneratePromptZip = async () => {
    if (isRunning) return;
    stopFlagRef.current = false;
    setIsRunning(true);

    const queueSnapshot = [...items];
    const promptFiles: Record<string, string> = {};
    let okCount = 0;

    for (let idx = 0; idx < queueSnapshot.length; idx++) {
      const item = queueSnapshot[idx];
      if (stopFlagRef.current) break;
      if (item.status === 'done' || item.status === 'prompt-ready') continue;

      try {
        updateItem(item.id, {
          status: 'generating-json',
          progress: 0.3,
          detail: 'Đang tạo prompt...',
        });

        const promptText = await buildPromptForItem(item);
        promptFiles[`${item.baseName}.prompt.txt`] = promptText;

        // Save individually as it completes
        await saveTextOutput(promptText, `${item.baseName}.prompt.txt`);

        updateItem(item.id, {
          status: 'prompt-ready',
          progress: 1,
          detail: `Prompt đã tạo & lưu ${outputDirName ? `vào [${outputDirName}]` : 'máy'} (${promptText.length.toLocaleString()} ký tự)`,
          promptText,
        });
        okCount++;
      } catch (err) {
        updateItem(item.id, {
          status: 'error',
          progress: 0,
          detail: err instanceof Error ? err.message : 'Lỗi không xác định',
        });
      }

      if (idx < queueSnapshot.length - 1 && !stopFlagRef.current) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // Also produce combined ZIP of all generated prompts
    if (Object.keys(promptFiles).length >= 1) {
      const zipData = buildZipArchive(promptFiles);
      const zipName = `prompts_batch_${Date.now()}.zip`;
      await saveBlobOutput(zipData, zipName, 'application/zip');
    }

    setIsRunning(false);
  };

  // ── Pre-flight check before starting Render Batch ─────────────────────────
  const handleStartBatchClick = () => {
    if (isRunning) return;

    // Check if any items are missing JSON
    const missingJsonItems = items.filter(
      (it) => !it.jsonFile && !it.pastedJsonText && it.status !== 'done',
    );

    const canAutoGenerate = useAiJson && (geminiApiKey.trim() || serverHasKey);

    if (missingJsonItems.length > 0 && !canAutoGenerate) {
      setMissingJsonWarning({
        open: true,
        count: missingJsonItems.length,
        names: missingJsonItems.map((i) => i.baseName),
      });
      return;
    }

    void handleStartBatch();
  };

  // ── RENDER batch ──────────────────────────────────────────────────────────
  const handleStartBatch = async () => {
    if (isRunning) return;
    stopFlagRef.current = false;
    setIsRunning(true);

    const queueSnapshot = [...items];
    for (let idx = 0; idx < queueSnapshot.length; idx++) {
      const item = queueSnapshot[idx];
      if (stopFlagRef.current) break;
      if (item.status === 'done') continue;

      try {
        updateItem(item.id, {
          status: 'generating-json',
          progress: 0.05,
          detail: 'Đang chuẩn bị dữ liệu...',
        });

        const effectiveComposition = resolveComposition();
        let builtProject = await buildProjectForItem(item, effectiveComposition);
        if (videoStyle === 'tiktok-cards') {
          builtProject = applyCompositionToProject(builtProject, effectiveComposition);
        }
        const fileBase = exportBaseName(item);

        updateItem(item.id, {
          status: 'rendering',
          progress: 0.15,
          detail: `Đang dựng ${encoding.width}×${encoding.height} @ ${encoding.fps}fps...`,
        });

        if (saveMode === 'disk') {
          const effectivePath = customSavePath.trim() || 'output';
          const saved = await exportProjectToServerDisk(
            builtProject,
            item.audioFile,
            ({ progress, stageLabel }) => {
              updateItem(item.id, {
                status: 'rendering',
                progress: 0.15 + progress * 0.85,
                detail: stageLabel,
              });
            },
            activeSettings,
            fileBase,
            effectivePath,
          );
          const mb = (saved.byteLength / (1024 * 1024)).toFixed(2);
          updateItem(item.id, {
            status: 'done',
            progress: 1,
            detail: `Đã lưu (${mb} MB · ${encoding.width}×${encoding.height} @ ${encoding.fps}fps)`,
            outputInfo: saved.savedPath,
          });
        } else {
          const exported = await exportProjectToVideo(
            { ...builtProject, id: fileBase },
            item.audioFile,
            ({ progress, stageLabel }) => {
              updateItem(item.id, {
                status: 'rendering',
                progress: 0.15 + progress * 0.85,
                detail: stageLabel,
              });
            },
            activeSettings,
          );
          const mb = (exported.byteLength / (1024 * 1024)).toFixed(2);
          updateItem(item.id, {
            status: 'done',
            progress: 1,
            detail: `Đã tải ${exported.fileName} (${mb} MB)`,
          });
        }
      } catch (err) {
        updateItem(item.id, {
          status: 'error',
          progress: 0,
          detail: err instanceof Error ? err.message : 'Lỗi không xác định',
        });
      }

      // Short pause between items to free RAM/GC
      if (idx < queueSnapshot.length - 1 && !stopFlagRef.current) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    setIsRunning(false);
  };

  // ── Handle Save Pasted JSON for a specific item ───────────────────────────
  const handleSavePastedJson = () => {
    if (!pasteJsonItem) return;
    const content = pasteJsonContent.trim();
    if (!content) {
      setPasteJsonError('Vui lòng dán nội dung JSON từ ChatGPT / Gemini.');
      return;
    }
    const parsed = parseScenePlanJson(content);
    if (!parsed || parsed.scenes.length === 0) {
      setPasteJsonError(
        'Đoạn JSON không hợp lệ hoặc thiếu cấu trúc "scenes" / "elements". Hãy copy toàn bộ từ AI.',
      );
      return;
    }

    updateItem(pasteJsonItem.id, {
      pastedJsonText: content,
      detail: `✓ Đã nạp JSON (${parsed.scenes.length} cảnh)`,
    });
    setPasteJsonItem(null);
    setPasteJsonContent('');
    setPasteJsonError(null);
  };

  const pendingCount = items.filter((i) => i.status === 'pending' || i.status === 'error').length;
  const doneCount = items.filter(
    (i) => i.status === 'done' || i.status === 'prompt-ready',
  ).length;
  const promptReadyCount = items.filter((i) => i.status === 'prompt-ready').length;
  const hasJsonCount = items.filter((i) => i.jsonFile || i.pastedJsonText).length;

  const compositionOptions: Array<{ value: LayoutCompositionId | 'ai-decide' | 'random'; label: string }> = [
    { value: 'ai-decide', label: '✨ AI tự chọn tối ưu theo context' },
    { value: 'random', label: '🔀 Phối ngẫu nhiên' },
    ...LAYOUT_COMPOSITIONS.map((c) => ({ value: c.id as LayoutCompositionId, label: c.name })),
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="batch-modal-title" className="text-base font-bold text-slate-900">
                Hàng đợi Batch — Tự động hoá Video TikTok
              </h2>
              <p className="text-xs text-slate-500">
                Tạo hàng loạt video từ nhiều cặp file (VD: <code>bai1.mp3</code> + <code>bai1.srt</code> + tùy chọn <code>bai1.json</code>)
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isRunning}
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Config Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 overflow-y-auto max-h-[46vh]">

          {/* ── Mode selector ── */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setBatchMode('render')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                batchMode === 'render'
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              } disabled:opacity-50`}
            >
              <div className={`p-1.5 rounded-lg ${batchMode === 'render' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Play className="w-4 h-4 fill-current" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold">1. Render MP4 tự động</div>
                <div className="text-[11px] text-slate-500 truncate">Dựng video + lưu ngay từng file</div>
              </div>
            </button>

            <button
              type="button"
              disabled={isRunning}
              onClick={() => setBatchMode('prompt-zip')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                batchMode === 'prompt-zip'
                  ? 'bg-violet-50 border-violet-400 text-violet-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              } disabled:opacity-50`}
            >
              <div className={`p-1.5 rounded-lg ${batchMode === 'prompt-zip' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold">2. Xuất Prompt ZIP (Cho AI Web)</div>
                <div className="text-[11px] text-slate-500 truncate">Tạo prompt riêng/video → cho vào ChatGPT/Gemini web</div>
              </div>
            </button>
          </div>

          {/* ── Template Video Picker ── */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Template video xu hướng
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'tiktok-cards', label: '📱 TikTok Cards (@englishpracticing168)', desc: 'Thẻ pastel, infographic, sơ đồ, icon check' },
                  { id: '3d-shapes', label: '🎲 Khối 3D + Karaoke', desc: 'Nền tối, khối 3D nổi, chữ vàng' },
                  { id: 'word-reveal-dark', label: '⚡ Word Reveal Dark (@xun52000)', desc: 'Nền đen sâu, chữ Kinetic Typography cỡ lớn' },
                ] as Array<{ id: PromptVideoStyle; label: string; desc: string }>
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setVideoStyle(s.id)}
                  title={s.desc}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                    videoStyle === s.id
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Composition Picker (tiktok-cards only) ── */}
          {videoStyle === 'tiktok-cards' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Cách phối minh họa:
              </label>
              <div className="flex items-center gap-2">
                <select
                  disabled={isRunning}
                  value={compositionId}
                  onChange={(e) => setCompositionId(e.target.value as typeof compositionId)}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {compositionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setCompositionId('random')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 whitespace-nowrap"
                >
                  <Shuffle className="w-3 h-3" />
                  Ngẫu nhiên
                </button>
              </div>
              {compositionId === 'ai-decide' && (
                <p className="text-[10px] text-violet-700 mt-1">
                  ✨ Không random: AI đọc transcript, chọn 1 kiểu trong catalog (Look/See/Watch, đồng hồ, nâng cấp câu...) rồi app dựng lại layout sạch. JSON có sẵn vẫn bị áp lại theo lựa chọn này.
                </p>
              )}
              {compositionId === 'random' && (
                <p className="text-[10px] text-orange-600 mt-1">
                  🔀 Mỗi video trong batch sẽ tự động phối với một style ngẫu nhiên khác nhau
                </p>
              )}
              {compositionId !== 'ai-decide' && compositionId !== 'random' && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Dù bài đã có file JSON, app vẫn dựng lại minh họa theo kiểu phối đang chọn.
                </p>
              )}
            </div>
          )}

          {/* ── Prompt-ZIP Destination Folder Picker ── */}
          {batchMode === 'prompt-zip' && (
            <div className="p-3 bg-violet-50/70 border border-violet-200 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-violet-900 block">
                    📁 Nơi lưu các file Prompt (.txt) &amp; file nén ZIP
                  </span>
                  <span className="text-[11px] text-violet-700">
                    Mỗi video = 1 file prompt riêng để dán vào ChatGPT / Claude / Gemini web
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={handlePickDirectory}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-white border border-violet-300 rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{outputDirName ? 'Đổi thư mục lưu' : 'Chọn thư mục lưu trên máy'}</span>
                </button>
              </div>
              {outputDirName ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Thư mục đã chọn: <strong>{outputDirName}</strong> — Từng file prompt sẽ được lưu ngay vào đây và nén ZIP khi xong!
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  ⚡ Mẹo: Bấm <strong>"Chọn thư mục lưu trên máy"</strong> để app tự ghi thẳng từng file vào folder bạn muốn, hoặc để mặc định tải về qua trình duyệt.
                </p>
              )}
            </div>
          )}

          {/* ── Render MP4: GEMINI API KEY & PERSISTENCE CARD ── */}
          {batchMode === 'render' && (
            <div className="p-3.5 rounded-xl bg-white border border-indigo-200 shadow-xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      Cấu hình Gemini API (Tự động sinh JSON)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Dùng khi chưa có sẵn file .json cho các bài
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px]">
                  {serverHasKey ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Có sẵn trong .env máy chủ</span>
                    </span>
                  ) : geminiApiKey ? (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Đã lưu trên trình duyệt</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Chưa có API Key</span>
                    </span>
                  )}
                </div>
              </div>

              {/* API Key Input + Save Button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={apiKeyInputRef}
                    type={showApiKey ? 'text' : 'password'}
                    disabled={isRunning}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Dán mã GEMINI_API_KEY vào đây (VD: AIzaSy...)"
                    className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showApiKey ? 'Ẩn key' : 'Hiện key'}
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isRunning || isSavingKey}
                  onClick={() => void handleSaveApiKey()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap shadow-xs"
                >
                  {isSavingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Lưu Key</span>
                </button>
              </div>

              {apiKeySaveNotice && (
                <p className="text-[11px] text-emerald-700 font-medium animate-fadeIn">
                  {apiKeySaveNotice}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isRunning}
                    checked={useAiJson}
                    onChange={(e) => setUseAiJson(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Tự gọi Gemini sinh JSON nếu bài chưa có file .json</span>
                </label>

                <div className="flex items-center gap-3">
                  <select
                    disabled={isRunning || !useAiJson}
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="px-2 py-0.5 text-[11px] bg-slate-50 border border-slate-200 rounded-md focus:outline-none"
                  >
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Nhanh & chuẩn)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (Chi tiết cao)</option>
                  </select>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <span>Lấy key miễn phí</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── Render MP4: Save Location & Encoding Settings ── */}
          {batchMode === 'render' && (
            <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-6">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nơi lưu file MP4 đầu ra (Lưu ngay từng video khi xong)
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      disabled={isRunning}
                      value={saveMode}
                      onChange={(e) => setSaveMode(e.target.value as 'disk' | 'download')}
                      className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      <option value="download">Tải ngay từng video qua trình duyệt</option>
                      <option value="disk">Lưu vào thư mục output/ của project (tên = file audio)</option>
                    </select>
                    {saveMode === 'disk' && (
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={handlePickDirectory}
                        className="px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 whitespace-nowrap"
                        title="Chọn thư mục trên máy"
                      >
                        Chọn thư mục
                      </button>
                    )}
                  </div>
                </div>

                <div className="md:col-span-6">
                  {saveMode === 'disk' && (
                    <div className="flex items-center gap-2">
                      <FolderSearch className="w-4 h-4 text-slate-500 shrink-0" />
                      <input
                        type="text"
                        disabled={isRunning}
                        value={customSavePath}
                        onChange={(e) => setCustomSavePath(e.target.value)}
                        placeholder="Bỏ trống = thư mục output/ của project, tên file = tên audio"
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 font-mono"
                      />
                    </div>
                  )}
                  {outputDirName && (
                    <span className="text-[11px] text-emerald-700 font-medium block mt-1">
                      ✓ Đã chọn thư mục: {outputDirName}
                    </span>
                  )}
                </div>
              </div>

              {/* Quality & Resolution */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Độ phân giải
                  </label>
                  <select
                    disabled={isRunning}
                    value={activeSettings.resolution}
                    onChange={(e) =>
                      updateSettings({
                        ...activeSettings,
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

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Chất lượng
                  </label>
                  <select
                    disabled={isRunning}
                    value={activeSettings.quality}
                    onChange={(e) =>
                      updateSettings({
                        ...activeSettings,
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

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Khung hình (FPS)
                  </label>
                  <select
                    disabled={isRunning}
                    value={activeSettings.fps}
                    onChange={(e) =>
                      updateSettings({
                        ...activeSettings,
                        fps: Number(e.target.value) as Mp4ExportSettings['fps'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {FPS_OPTIONS.map((fpsVal) => (
                      <option key={fpsVal} value={fpsVal}>
                        {fpsVal} fps{fpsVal === 24 ? ' (Nhẹ)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => updateSettings(DEFAULT_MP4_EXPORT_SETTINGS)}
                    className="w-full px-2.5 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                  >
                    Mặc định nhẹ
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Bar for Adding Files */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.srt,.vtt,.txt,.json"
                className="hidden"
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={isRunning}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors shadow-xs"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Thêm Audio + Sub (.mp3, .srt)</span>
              </button>

              <input
                ref={jsonOnlyInputRef}
                type="file"
                multiple
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  handleJsonFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={isRunning}
                onClick={() => jsonOnlyInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors shadow-xs"
                title="Nạp các file kịch bản .json đã tải từ AI Web"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Nạp file .json</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-500">
              Đã nạp: <strong>{items.length}</strong> bài ({hasJsonCount} có JSON)
            </span>
          </div>
        </div>

        {/* ── Guidance Banner When Prompts Are Ready ── */}
        {promptReadyCount > 0 && batchMode === 'prompt-zip' && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs text-emerald-900">
                <strong>Đã xuất xong prompt ({promptReadyCount} bài)!</strong> Lấy JSON từ AI Web dán vào từng bài rồi bấm nút bên cạnh:
              </div>
            </div>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => {
                setBatchMode('render');
                handleStartBatchClick();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Tiến hành Render Video ({items.length} bài)</span>
            </button>
          </div>
        )}

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[220px]">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Layers className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-800">Chưa có bài nào trong hàng đợi</p>
              <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                Bấm <strong>"Thêm Audio + Sub"</strong> và chọn cùng lúc hàng loạt file{' '}
                <code>.mp3</code> và <code>.srt</code> (cùng tên gốc, ví dụ{' '}
                <code>lesson01.mp3</code> + <code>lesson01.srt</code>).
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 hover:border-slate-300 transition-colors shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {item.baseName}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                        item.audioFile
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {item.audioFile ? `🎵 ${item.audioFile.name}` : 'Không có Audio'}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                        item.srtFile || item.jsonFile?.name.endsWith('.project.json')
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {item.srtFile ? `📄 ${item.srtFile.name}` : 'Thiếu .srt'}
                    </span>

                    {/* JSON Status Tag */}
                    {item.pastedJsonText ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        <span>Đã dán JSON</span>
                      </span>
                    ) : item.jsonFile ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {item.jsonFile.name}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        Chưa có .json
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    {item.status === 'done' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.detail}</span>
                      </span>
                    )}
                    {item.status === 'prompt-ready' && (
                      <span className="inline-flex items-center gap-1 text-violet-700 font-medium">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.detail}</span>
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.detail}</span>
                      </span>
                    )}
                    {(item.status === 'generating-json' || item.status === 'rendering') && (
                      <span className="inline-flex items-center gap-1.5 text-indigo-700 font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>
                          {item.detail} ({Math.round(item.progress * 100)}%)
                        </span>
                      </span>
                    )}
                    {item.status === 'pending' && (
                      <span className="text-slate-500">{item.detail}</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {(item.status === 'rendering' || item.status === 'generating-json') && (
                    <div className="mt-1.5 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-200 rounded-full"
                        style={{ width: `${Math.round(item.progress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Button to Paste JSON directly */}
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setPasteJsonItem(item);
                      setPasteJsonContent(item.pastedJsonText || '');
                      setPasteJsonError(null);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      item.pastedJsonText || item.jsonFile
                        ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                    }`}
                    title="Dán kịch bản JSON từ ChatGPT/Gemini"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>{item.pastedJsonText || item.jsonFile ? 'Sửa JSON' : 'Dán JSON'}</span>
                  </button>

                  {/* Re-download prompt button if prompt is ready */}
                  {item.status === 'prompt-ready' && item.promptText && (
                    <button
                      type="button"
                      onClick={() => downloadText(item.promptText!, `${item.baseName}.prompt.txt`)}
                      title="Tải lại file prompt .txt"
                      className="p-1.5 text-violet-600 hover:text-violet-800 rounded-lg hover:bg-violet-50"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}

                  {item.status === 'error' && !isRunning && (
                    <button
                      type="button"
                      onClick={() =>
                        updateItem(item.id, { status: 'pending', detail: 'Chờ chạy lại' })
                      }
                      title="Đặt lại để chạy lại"
                      className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                    title="Xóa khỏi hàng đợi"
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600 tabular-nums">
            Tổng: <strong>{items.length}</strong> bài · Đã nạp JSON:{' '}
            <strong className="text-emerald-700">{hasJsonCount}</strong> · Hoàn thành:{' '}
            <strong className="text-indigo-700">{doneCount}</strong>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && !isRunning && (
              <button
                type="button"
                onClick={() => setItems([])}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
              >
                Xóa tất cả
              </button>
            )}

            {isRunning ? (
              <button
                type="button"
                onClick={() => {
                  stopFlagRef.current = true;
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Dừng sau bài hiện tại
              </button>
            ) : batchMode === 'prompt-zip' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pendingCount === 0}
                  onClick={() => void handleGeneratePromptZip()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Xuất Prompt ({pendingCount} bài) + Nén ZIP</span>
                </button>
                <button
                  type="button"
                  disabled={items.length === 0}
                  onClick={() => {
                    setBatchMode('render');
                    handleStartBatchClick();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Bắt đầu Render Video</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={pendingCount === 0}
                onClick={handleStartBatchClick}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Chạy Batch ({pendingCount} bài)</span>
              </button>
            )}
          </div>
        </div>

        {/* ── DIALOG 1: DIRECT PASTE JSON MODAL ── */}
        {pasteJsonItem && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-scaleIn">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Clipboard className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Dán JSON kịch bản cho: <code>{pasteJsonItem.baseName}</code>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPasteJsonItem(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3">
                <p className="text-xs text-slate-600">
                  Sao chép đoạn phản hồi JSON từ ChatGPT / Claude / Gemini và dán vào đây (hỗ trợ cả dấu <code>```json ... ```</code>):
                </p>

                <textarea
                  rows={8}
                  value={pasteJsonContent}
                  onChange={(e) => {
                    setPasteJsonContent(e.target.value);
                    setPasteJsonError(null);
                  }}
                  placeholder='{\n  "title": "...",\n  "scenes": [\n    ...\n  ]\n}'
                  className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />

                {pasteJsonError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 font-medium">
                    {pasteJsonError}
                  </p>
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasteJsonItem(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSavePastedJson}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Xác nhận &amp; Lưu kịch bản</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DIALOG 2: MISSING JSON WARNING & GUIDANCE MODAL ── */}
        {missingJsonWarning && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-scaleIn">
              <div className="px-5 py-3.5 border-b border-amber-200 flex items-center justify-between bg-amber-50">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-900">
                    Phát hiện {missingJsonWarning.count} video chưa có file kịch bản JSON!
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMissingJsonWarning(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3.5">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Các video sau chưa có kịch bản JSON: <strong>{missingJsonWarning.names.slice(0, 4).join(', ')}{missingJsonWarning.names.length > 4 ? '...' : ''}</strong>.
                  <br />
                  Nếu thiếu JSON, video sẽ không có các thẻ minh họa và sơ đồ kinetic đẹp mắt. Hãy chọn 1 trong các cách sau:
                </p>

                <div className="space-y-2">
                  {/* Option 1: Generate Prompts */}
                  <button
                    type="button"
                    onClick={() => {
                      setMissingJsonWarning(null);
                      setBatchMode('prompt-zip');
                      void handleGeneratePromptZip();
                    }}
                    className="w-full text-left p-3 rounded-xl border border-violet-200 bg-violet-50/70 hover:bg-violet-100 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                        <span>Cách 1: Tạo Prompt cho các bài này ngay (Miễn phí qua AI Web)</span>
                      </div>
                      <div className="text-[11px] text-violet-700 mt-0.5">
                        Tạo file prompt riêng → nén ZIP → dán vào ChatGPT/Gemini Web lấy JSON
                      </div>
                    </div>
                    <span className="text-xs font-bold text-violet-700 group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </button>

                  {/* Option 2: Upload JSON Files */}
                  <button
                    type="button"
                    onClick={() => {
                      setMissingJsonWarning(null);
                      jsonOnlyInputRef.current?.click();
                    }}
                    className="w-full text-left p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cách 2: Nạp các file .json từ máy tính</span>
                      </div>
                      <div className="text-[11px] text-emerald-700 mt-0.5">
                        Chọn các file .json trùng tên với file audio/srt đã có sẵn
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </button>

                  {/* Option 3: Configure API Key */}
                  <button
                    type="button"
                    onClick={() => {
                      setMissingJsonWarning(null);
                      setUseAiJson(true);
                      setTimeout(() => apiKeyInputRef.current?.focus(), 150);
                    }}
                    className="w-full text-left p-3 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Cách 3: Nhập GEMINI_API_KEY để tự động sinh JSON 100%</span>
                      </div>
                      <div className="text-[11px] text-indigo-700 mt-0.5">
                        App tự gọi Gemini sinh kịch bản JSON mà không cần bạn làm thủ công
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-700 group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </button>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMissingJsonWarning(null);
                    void handleStartBatch();
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-700 underline"
                >
                  Vẫn tiếp tục render (Chỉ có phụ đề karaoke ở đáy)
                </button>
                <button
                  type="button"
                  onClick={() => setMissingJsonWarning(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                  Đóng &amp; Quay lại
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
