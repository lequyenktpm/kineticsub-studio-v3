import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { renderProjectFrame, STAGE_HEIGHT, STAGE_WIDTH } from './canvasRenderer';
import {
  DEFAULT_MP4_EXPORT_SETTINGS,
  Mp4ExportSettings,
  resolveMp4EncodingParams,
  ResolvedMp4Encoding,
} from './mp4Config';
import { LessonProject } from './types';

export interface ExportVideoProgress {
  progress: number;
  stageLabel: string;
}

export interface ExportVideoResult {
  format: 'mp4' | 'webm';
  fileName: string;
  byteLength: number;
  width: number;
  height: number;
  fps: number;
  qualityLabel: string;
}

function sanitizeFileBase(raw: string): string {
  return (
    raw
      .replace(/[\x00-\x1f\\/:*?"<>|]/g, '_')
      .trim()
      .replace(/[.\s]+$/, '')
      .slice(0, 120) || 'kineticsub-video'
  );
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function renderScaledProjectFrame(
  ctx: CanvasRenderingContext2D,
  project: LessonProject,
  time: number,
  targetWidth: number,
  targetHeight: number,
): void {
  ctx.save();
  ctx.scale(targetWidth / STAGE_WIDTH, targetHeight / STAGE_HEIGHT);
  renderProjectFrame(ctx, project, time, null);
  ctx.restore();
}

interface SupportedVideoEncoderSpec {
  webCodec: string;
  muxerCodec: 'avc' | 'vp9';
}

async function pickSupportedVideoCodec(
  width: number,
  height: number,
  fps: number,
  bitrate: number,
): Promise<SupportedVideoEncoderSpec | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }

  const candidates: SupportedVideoEncoderSpec[] =
    width >= 1440
      ? [
          { webCodec: 'avc1.640033', muxerCodec: 'avc' },
          { webCodec: 'avc1.4d0033', muxerCodec: 'avc' },
          { webCodec: 'avc1.420033', muxerCodec: 'avc' },
          { webCodec: 'vp09.00.50.08', muxerCodec: 'vp9' },
          { webCodec: 'vp09.00.10.08', muxerCodec: 'vp9' },
        ]
      : [
          { webCodec: 'avc1.64002a', muxerCodec: 'avc' },
          { webCodec: 'avc1.4d002a', muxerCodec: 'avc' },
          { webCodec: 'avc1.42002a', muxerCodec: 'avc' },
          { webCodec: 'avc1.42001f', muxerCodec: 'avc' },
          { webCodec: 'vp09.00.10.08', muxerCodec: 'vp9' },
        ];

  for (const item of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: item.webCodec,
        width,
        height,
        bitrate,
        framerate: fps,
      });
      if (support.supported) {
        return item;
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

interface SupportedAudioEncoderSpec {
  webCodec: string;
  muxerCodec: 'aac' | 'opus';
  sampleRate: number;
  channels: number;
  bitrate: number;
}

async function pickSupportedAudioCodec(
  preferredSampleRate: number,
  channels: number,
  bitrate: number,
): Promise<SupportedAudioEncoderSpec | null> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') {
    return null;
  }

  const aacSampleRate =
    preferredSampleRate === 44100 || preferredSampleRate === 48000 ? preferredSampleRate : 48000;

  const candidates: SupportedAudioEncoderSpec[] = [
    {
      webCodec: 'mp4a.40.2',
      muxerCodec: 'aac',
      sampleRate: aacSampleRate,
      channels,
      bitrate,
    },
    {
      webCodec: 'opus',
      muxerCodec: 'opus',
      sampleRate: 48000,
      channels,
      bitrate,
    },
  ];

  for (const item of candidates) {
    try {
      const support = await AudioEncoder.isConfigSupported({
        codec: item.webCodec,
        sampleRate: item.sampleRate,
        numberOfChannels: item.channels,
        bitrate: item.bitrate,
      });
      if (support.supported) {
        return item;
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

async function decodeAndResampleAudio(
  audioFile: File,
  maxDurationSec: number,
  audioBitrate: number,
): Promise<{ buffer: AudioBuffer; spec: SupportedAudioEncoderSpec } | null> {
  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(await audioFile.arrayBuffer());
    const channels = Math.max(1, Math.min(2, decoded.numberOfChannels));
    const spec = await pickSupportedAudioCodec(decoded.sampleRate, channels, audioBitrate);
    if (!spec) {
      return null;
    }

    const targetDuration = Math.min(decoded.duration, maxDurationSec);
    if (decoded.sampleRate === spec.sampleRate && decoded.numberOfChannels === channels) {
      return { buffer: decoded, spec };
    }

    const targetLength = Math.max(1, Math.ceil(targetDuration * spec.sampleRate));
    const offline = new OfflineAudioContext(channels, targetLength, spec.sampleRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const resampled = await offline.startRendering();
    return { buffer: resampled, spec };
  } finally {
    await audioCtx.close().catch(() => undefined);
  }
}

async function exportWithWebCodecsMp4(
  project: LessonProject,
  audioFile: File | null,
  encoding: ResolvedMp4Encoding,
  onProgress: (info: ExportVideoProgress) => void,
): Promise<ExportVideoResult | null> {
  const videoSpec = await pickSupportedVideoCodec(
    encoding.width,
    encoding.height,
    encoding.fps,
    encoding.videoBitrate,
  );
  if (!videoSpec) {
    return null;
  }

  let preparedAudio: { buffer: AudioBuffer; spec: SupportedAudioEncoderSpec } | null = null;
  if (audioFile) {
    onProgress({ progress: 0.03, stageLabel: 'Đang giải mã & đồng bộ Audio...' });
    try {
      preparedAudio = await decodeAndResampleAudio(
        audioFile,
        project.duration,
        encoding.audioBitrate,
      );
      if (!preparedAudio) {
        // Browser lacks AAC/Opus AudioEncoder; fall back cleanly to FFmpeg/WebM so audio isn't lost
        return null;
      }
    } catch {
      return null;
    }
  }

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = encoding.width;
  offscreenCanvas.height = encoding.height;
  const ctx = offscreenCanvas.getContext('2d', { alpha: false });
  if (!ctx) {
    return null;
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: videoSpec.muxerCodec,
      width: encoding.width,
      height: encoding.height,
      frameRate: encoding.fps,
    },
    audio: preparedAudio
      ? {
          codec: preparedAudio.spec.muxerCodec,
          numberOfChannels: preparedAudio.spec.channels,
          sampleRate: preparedAudio.spec.sampleRate,
        }
      : undefined,
    fastStart: 'in-memory',
  });

  let encoderError: unknown = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encoderError = err;
    },
  });

  videoEncoder.configure({
    codec: videoSpec.webCodec,
    width: encoding.width,
    height: encoding.height,
    bitrate: encoding.videoBitrate,
    framerate: encoding.fps,
  });

  let audioEncoder: AudioEncoder | null = null;
  if (preparedAudio) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (err) => {
        encoderError = err;
      },
    });
    audioEncoder.configure({
      codec: preparedAudio.spec.webCodec,
      sampleRate: preparedAudio.spec.sampleRate,
      numberOfChannels: preparedAudio.spec.channels,
      bitrate: preparedAudio.spec.bitrate,
    });
  }

  try {
    const totalFrames = Math.max(1, Math.ceil(project.duration * encoding.fps));
    const frameDurationUs = Math.round(1_000_000 / encoding.fps);
    const keyInterval = encoding.fps * 2;

    for (let i = 0; i < totalFrames; i++) {
      if (encoderError) throw encoderError;

      const t = Math.min(project.duration, i / encoding.fps);
      renderScaledProjectFrame(ctx, project, t, encoding.width, encoding.height);

      const frame = new VideoFrame(offscreenCanvas, {
        timestamp: Math.round((i * 1_000_000) / encoding.fps),
        duration: frameDurationUs,
      });

      while (videoEncoder.encodeQueueSize > 8) {
        if (encoderError) {
          frame.close();
          throw encoderError;
        }
        await new Promise((r) => setTimeout(r, 4));
      }

      videoEncoder.encode(frame, { keyFrame: i % keyInterval === 0 });
      frame.close();

      if (i % 4 === 0 || i === totalFrames - 1) {
        onProgress({
          progress: 0.05 + ((i + 1) / totalFrames) * (preparedAudio ? 0.78 : 0.88),
          stageLabel: `Đang dựng & nén MP4 ${encoding.width}×${encoding.height} (${i + 1}/${totalFrames})...`,
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    if (audioEncoder && preparedAudio) {
      onProgress({ progress: 0.86, stageLabel: 'Đang ghép track Audio vào MP4...' });
      const { buffer, spec } = preparedAudio;
      const chunkFrames = 4096;
      const totalAudioFrames = Math.min(
        buffer.length,
        Math.ceil(project.duration * spec.sampleRate),
      );

      for (let offset = 0; offset < totalAudioFrames; offset += chunkFrames) {
        if (encoderError) throw encoderError;
        const count = Math.min(chunkFrames, totalAudioFrames - offset);
        const planar = new Float32Array(count * spec.channels);
        for (let ch = 0; ch < spec.channels; ch++) {
          const channelData = buffer.getChannelData(ch);
          planar.set(channelData.subarray(offset, offset + count), ch * count);
        }
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: spec.sampleRate,
          numberOfFrames: count,
          numberOfChannels: spec.channels,
          timestamp: Math.round((offset * 1_000_000) / spec.sampleRate),
          data: planar,
        });
        while (audioEncoder.encodeQueueSize > 16) {
          await new Promise((r) => setTimeout(r, 2));
        }
        audioEncoder.encode(audioData);
        audioData.close();
      }
    }

    onProgress({ progress: 0.94, stageLabel: 'Đang đóng gói file .mp4...' });
    await videoEncoder.flush();
    if (audioEncoder) {
      await audioEncoder.flush();
    }
    if (encoderError) throw encoderError;

    muxer.finalize();
    const mp4Blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    const fileName = `${sanitizeFileBase(project.id)}_${encoding.height}p.mp4`;
    triggerBlobDownload(mp4Blob, fileName);

    onProgress({ progress: 1, stageLabel: 'Đã tải xong file MP4!' });
    return {
      format: 'mp4',
      fileName,
      byteLength: mp4Blob.size,
      width: encoding.width,
      height: encoding.height,
      fps: encoding.fps,
      qualityLabel: encoding.qualityLabel,
    };
  } finally {
    try {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
    } catch {
      // ignore
    }
    try {
      if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
    } catch {
      // ignore
    }
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Không thể mã hóa khung hình JPEG từ canvas.'));
      },
      'image/jpeg',
      quality,
    );
  });
}

const MAX_UPLOAD_CHUNK_BYTES = 550 * 1024;
const MAX_FRAMES_PER_BATCH = 10;

async function postBinaryWithRetry(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  label: string,
): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });
      if (res.ok) return;

      const text = await res.text().catch(() => '');
      let detail = text;
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error) detail = parsed.error;
      } catch {
        // plain text response
      }
      lastError = new Error(
        `${label} (HTTP ${res.status}${detail ? `: ${detail.slice(0, 140)}` : ''})`,
      );

      if (res.status !== 429 && res.status < 500) {
        throw lastError;
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith(label)) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
  }
  throw lastError ?? new Error(label);
}

async function exportWithServerFfmpeg(
  project: LessonProject,
  audioFile: File | null,
  encoding: ResolvedMp4Encoding,
  onProgress: (info: ExportVideoProgress) => void,
): Promise<ExportVideoResult> {
  onProgress({ progress: 0.01, stageLabel: 'Đang khởi tạo bộ dựng MP4 (FFmpeg)...' });

  const startRes = await fetch('/api/render/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fps: encoding.fps, crf: encoding.crf }),
  });

  if (!startRes.ok) {
    throw new Error(`Server FFmpeg không khả dụng (HTTP ${startRes.status}).`);
  }

  const { jobId } = (await startRes.json()) as { jobId: string };

  try {
    if (audioFile) {
      onProgress({ progress: 0.04, stageLabel: 'Đang nạp file Audio vào hàng đợi FFmpeg...' });
      const dotIdx = audioFile.name.lastIndexOf('.');
      const ext = dotIdx >= 0 ? audioFile.name.slice(dotIdx) : '.mp3';

      for (let offset = 0; offset < audioFile.size; offset += MAX_UPLOAD_CHUNK_BYTES) {
        const slice = audioFile.slice(offset, offset + MAX_UPLOAD_CHUNK_BYTES);
        const appendQuery = offset > 0 ? '?append=1' : '';
        await postBinaryWithRetry(
          `/api/render/${jobId}/audio${appendQuery}`,
          slice,
          {
            'Content-Type': 'application/octet-stream',
            'x-audio-ext': ext,
          },
          'Không thể tải file Audio lên máy chủ render',
        );
      }
    }

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = encoding.width;
    offscreenCanvas.height = encoding.height;
    const ctx = offscreenCanvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Không khởi tạo được Canvas 2D để dựng khung hình.');
    }

    const totalFrames = Math.max(1, Math.ceil(project.duration * encoding.fps));
    let batch: Blob[] = [];
    let batchBytes = 0;
    let pendingUpload: Promise<void> = Promise.resolve();

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const chunkBlob = new Blob(batch, { type: 'application/octet-stream' });
      batch = [];
      batchBytes = 0;
      await pendingUpload;
      pendingUpload = postBinaryWithRetry(
        `/api/render/${jobId}/frames`,
        chunkBlob,
        { 'Content-Type': 'application/octet-stream' },
        'Lỗi truyền dữ liệu khung hình lên FFmpeg',
      );
    };

    for (let i = 0; i < totalFrames; i++) {
      const t = Math.min(project.duration, i / encoding.fps);
      renderScaledProjectFrame(ctx, project, t, encoding.width, encoding.height);
      const jpeg = await canvasToJpegBlob(offscreenCanvas, 0.85);

      if (
        batch.length > 0 &&
        (batch.length >= MAX_FRAMES_PER_BATCH || batchBytes + jpeg.size > MAX_UPLOAD_CHUNK_BYTES)
      ) {
        await flushBatch();
        await new Promise((r) => setTimeout(r, 0));
      }

      batch.push(jpeg);
      batchBytes += jpeg.size;

      if (i % 6 === 0 || i === totalFrames - 1) {
        onProgress({
          progress: 0.05 + ((i + 1) / totalFrames) * 0.8,
          stageLabel: `Đang dựng khung hình ${encoding.width}×${encoding.height} (${i + 1}/${totalFrames})...`,
        });
      }

      if (i === totalFrames - 1) {
        await flushBatch();
      }
    }

    await pendingUpload;

    onProgress({
      progress: 0.9,
      stageLabel: 'Đang ghép MP4 (FFmpeg H.264 / AAC)...',
    });

    const baseName = sanitizeFileBase(project.id);
    const finishRes = await fetch(`/api/render/${jobId}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: `${baseName}_${encoding.height}p` }),
    });

    if (!finishRes.ok) {
      const errBody = await finishRes.json().catch(() => ({}));
      throw new Error((errBody as { error?: string }).error || 'FFmpeg không thể xuất MP4.');
    }

    const mp4Blob = await finishRes.blob();
    const fileName = `${baseName}_${encoding.height}p.mp4`;
    triggerBlobDownload(mp4Blob, fileName);

    onProgress({ progress: 1, stageLabel: 'Đã tải xong file MP4!' });
    return {
      format: 'mp4',
      fileName,
      byteLength: mp4Blob.size,
      width: encoding.width,
      height: encoding.height,
      fps: encoding.fps,
      qualityLabel: encoding.qualityLabel,
    };
  } catch (err) {
    void fetch(`/api/render/${jobId}`, { method: 'DELETE' }).catch(() => undefined);
    throw err;
  }
}

async function exportProjectToWebmFallback(
  project: LessonProject,
  audioFile: File | null,
  encoding: ResolvedMp4Encoding,
  onProgress: (info: ExportVideoProgress) => void,
): Promise<ExportVideoResult> {
  const canvas = document.createElement('canvas');
  canvas.width = encoding.width;
  canvas.height = encoding.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không khởi tạo được Canvas 2D.');

  let audioCtx: AudioContext | null = null;
  let audioSource: AudioBufferSourceNode | null = null;

  try {
    const videoStream = canvas.captureStream(encoding.fps);
    const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

    if (audioFile) {
      try {
        audioCtx = new AudioContext();
        const buffer = await audioCtx.decodeAudioData(await audioFile.arrayBuffer());
        const dest = audioCtx.createMediaStreamDestination();
        audioSource = audioCtx.createBufferSource();
        audioSource.buffer = buffer;
        audioSource.connect(dest);
        tracks.push(...dest.stream.getAudioTracks());
      } catch {
        // Ignore audio decode fallback
      }
    }

    const combinedStream = new MediaStream(tracks);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: encoding.videoBitrate,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data);
    };

    const donePromise = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(100);
    if (audioSource) audioSource.start(0);

    const stepMs = 1000 / encoding.fps;
    const totalFrames = Math.max(1, Math.ceil(project.duration * encoding.fps));

    for (let i = 0; i <= totalFrames; i++) {
      const t = Math.min(project.duration, i / encoding.fps);
      renderScaledProjectFrame(ctx, project, t, encoding.width, encoding.height);
      onProgress({
        progress: i / totalFrames,
        stageLabel: `Đang ghi Video WebM ${encoding.width}×${encoding.height} (${Math.round((i / totalFrames) * 100)}%)...`,
      });
      await new Promise((r) => setTimeout(r, stepMs));
    }

    if (audioSource) {
      try {
        audioSource.stop();
      } catch {
        // already stopped
      }
    }
    recorder.stop();
    await donePromise;

    const blob = new Blob(chunks, { type: 'video/webm' });
    const fileName = `${sanitizeFileBase(project.id)}_${encoding.height}p.webm`;
    triggerBlobDownload(blob, fileName);
    return {
      format: 'webm',
      fileName,
      byteLength: blob.size,
      width: encoding.width,
      height: encoding.height,
      fps: encoding.fps,
      qualityLabel: encoding.qualityLabel,
    };
  } finally {
    if (audioCtx) {
      await audioCtx.close().catch(() => undefined);
    }
  }
}

export async function exportProjectToVideo(
  project: LessonProject,
  audioFile: File | null,
  onProgress: (info: ExportVideoProgress) => void,
  settings: Mp4ExportSettings = DEFAULT_MP4_EXPORT_SETTINGS,
): Promise<ExportVideoResult> {
  const encoding = resolveMp4EncodingParams(settings);
  onProgress({
    progress: 0.01,
    stageLabel: `Đang khởi tạo bộ dựng MP4 (${encoding.width}×${encoding.height} @ ${encoding.fps}fps)...`,
  });

  // 1. Primary path: 100% browser-native WebCodecs + mp4-muxer (zero server state, immune to multi-instance 404)
  try {
    const webCodecsResult = await exportWithWebCodecsMp4(project, audioFile, encoding, onProgress);
    if (webCodecsResult) {
      return webCodecsResult;
    }
  } catch (err) {
    console.warn('WebCodecs MP4 export failed, falling back to server/WebM:', err);
  }

  // 2. Fallback path: Server FFmpeg or WebM MediaRecorder
  try {
    return await exportWithServerFfmpeg(project, audioFile, encoding, onProgress);
  } catch {
    return exportProjectToWebmFallback(project, audioFile, encoding, onProgress);
  }
}


export async function exportProjectToServerDisk(
  project: LessonProject,
  audioFile: File | null,
  onProgress: (info: ExportVideoProgress) => void,
  settings: Mp4ExportSettings = DEFAULT_MP4_EXPORT_SETTINGS,
  customBaseName?: string,
  customSavePath?: string,
): Promise<{ savedPath: string; fileName: string; byteLength: number }> {
  const encoding = resolveMp4EncodingParams(settings);
  onProgress({ progress: 0.01, stageLabel: 'Đang khởi tạo job render trên server...' });

  const startRes = await fetch('/api/render/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fps: encoding.fps, crf: encoding.crf }),
  });

  if (!startRes.ok) {
    throw new Error(`Server FFmpeg không khả dụng (HTTP ${startRes.status}).`);
  }

  const { jobId } = (await startRes.json()) as { jobId: string };

  try {
    if (audioFile) {
      onProgress({ progress: 0.04, stageLabel: 'Đang nạp Audio lên server...' });
      const dotIdx = audioFile.name.lastIndexOf('.');
      const ext = dotIdx >= 0 ? audioFile.name.slice(dotIdx) : '.mp3';

      for (let offset = 0; offset < audioFile.size; offset += MAX_UPLOAD_CHUNK_BYTES) {
        const slice = audioFile.slice(offset, offset + MAX_UPLOAD_CHUNK_BYTES);
        const appendQuery = offset > 0 ? '?append=1' : '';
        await postBinaryWithRetry(
          `/api/render/${jobId}/audio${appendQuery}`,
          slice,
          {
            'Content-Type': 'application/octet-stream',
            'x-audio-ext': ext,
          },
          'Không thể tải file Audio lên máy chủ render',
        );
      }
    }

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = encoding.width;
    offscreenCanvas.height = encoding.height;
    const ctx = offscreenCanvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Không khởi tạo được Canvas 2D.');
    }

    const totalFrames = Math.max(1, Math.ceil(project.duration * encoding.fps));
    let batch: Blob[] = [];
    let batchBytes = 0;
    let pendingUpload: Promise<void> = Promise.resolve();

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const chunkBlob = new Blob(batch, { type: 'application/octet-stream' });
      batch = [];
      batchBytes = 0;
      await pendingUpload;
      pendingUpload = postBinaryWithRetry(
        `/api/render/${jobId}/frames`,
        chunkBlob,
        { 'Content-Type': 'application/octet-stream' },
        'Lỗi truyền khung hình lên server',
      );
    };

    for (let i = 0; i < totalFrames; i++) {
      const t = Math.min(project.duration, i / encoding.fps);
      renderScaledProjectFrame(ctx, project, t, encoding.width, encoding.height);
      const jpeg = await canvasToJpegBlob(offscreenCanvas, 0.85);

      if (
        batch.length > 0 &&
        (batch.length >= MAX_FRAMES_PER_BATCH || batchBytes + jpeg.size > MAX_UPLOAD_CHUNK_BYTES)
      ) {
        await flushBatch();
        await new Promise((r) => setTimeout(r, 0));
      }

      batch.push(jpeg);
      batchBytes += jpeg.size;

      if (i % 6 === 0 || i === totalFrames - 1) {
        onProgress({
          progress: 0.05 + ((i + 1) / totalFrames) * 0.8,
          stageLabel: `Đang vẽ frame ${i + 1}/${totalFrames}...`,
        });
      }

      if (i === totalFrames - 1) {
        await flushBatch();
      }
    }

    await pendingUpload;
    onProgress({ progress: 0.9, stageLabel: 'FFmpeg đang xuất MP4 ra ổ cứng...' });

    const baseName = sanitizeFileBase(customBaseName || project.title || project.id);
    const finishRes = await fetch(`/api/render/${jobId}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: baseName, saveToDisk: true, savePath: customSavePath || undefined }),
    });

    if (!finishRes.ok) {
      const errBody = await finishRes.json().catch(() => ({}));
      throw new Error((errBody as { error?: string }).error || 'FFmpeg không thể lưu MP4.');
    }

    const data = (await finishRes.json()) as { savedPath: string; bytes: number };
    onProgress({ progress: 1, stageLabel: 'Hoàn tất!' });
    return {
      savedPath: data.savedPath,
      fileName: `${baseName}.mp4`,
      byteLength: data.bytes,
    };
  } catch (err) {
    void fetch(`/api/render/${jobId}`, { method: 'DELETE' }).catch(() => undefined);
    throw err;
  }
}
