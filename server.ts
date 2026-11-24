import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { buildFfmpegArgs } from './src/engine/ffmpegArgs.ts';

interface RenderJob {
  id: string;
  dir: string;
  fps: number;
  crf: number;
  framesPath: string;
  audioPath: string | null;
  createdAt: number;
  chunkCount: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm']);
const JOB_TTL_MS = 20 * 60 * 1000;

const jobs = new Map<string, RenderJob>();

function getJobDir(jobId: string): string {
  return path.join(os.tmpdir(), `ks-render-${jobId}`);
}

async function saveJobMeta(job: RenderJob): Promise<void> {
  const metaPath = path.join(job.dir, 'meta.json');
  await fs.promises.writeFile(metaPath, JSON.stringify(job), 'utf8');
}

async function loadJob(jobId: string): Promise<RenderJob | null> {
  if (!UUID_RE.test(jobId)) return null;
  const cached = jobs.get(jobId);
  if (cached) return cached;

  const dir = getJobDir(jobId);
  const metaPath = path.join(dir, 'meta.json');
  try {
    const raw = await fs.promises.readFile(metaPath, 'utf8');
    const parsed = JSON.parse(raw) as RenderJob;
    if (parsed && parsed.id === jobId && parsed.dir === dir) {
      jobs.set(jobId, parsed);
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

async function cleanupJob(jobId: string): Promise<void> {
  if (!UUID_RE.test(jobId)) return;
  const job = jobs.get(jobId);
  jobs.delete(jobId);
  const dir = job?.dir ?? getJobDir(jobId);
  await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      void cleanupJob(id);
    }
  }
}, 60_000).unref();

function sanitizeAudioExt(rawExt: string | undefined): string {
  if (!rawExt) return '.mp3';
  const normalized = rawExt.trim().toLowerCase();
  const withDot = normalized.startsWith('.') ? normalized : `.${normalized}`;
  return ALLOWED_AUDIO_EXTS.has(withDot) ? withDot : '.mp3';
}

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      encoder: 'ffmpeg-h264-aac',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.post('/api/ai/save-key', express.json(), async (req, res) => {
    try {
      const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
      if (!apiKey) {
        res.status(400).json({ error: 'API Key không hợp lệ.' });
        return;
      }
      process.env.GEMINI_API_KEY = apiKey;
      const envPath = path.resolve('.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = await fs.promises.readFile(envPath, 'utf8');
      }
      if (envContent.includes('GEMINI_API_KEY=')) {
        envContent = envContent.replace(/GEMINI_API_KEY=.*(?:\r?\n|$)/, `GEMINI_API_KEY=${apiKey}\n`);
      } else {
        envContent = envContent ? `${envContent.trim()}\nGEMINI_API_KEY=${apiKey}\n` : `GEMINI_API_KEY=${apiKey}\n`;
      }
      await fs.promises.writeFile(envPath, envContent, 'utf8');
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Không thể lưu vào file .env' });
    }
  });

  app.post('/api/ai/generate-scene', express.json({ limit: '2mb' }), async (req, res) => {
    try {
      const apiKey = (typeof req.body?.apiKey === 'string' && req.body.apiKey.trim()) || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(400).json({ error: 'Chưa cấu hình GEMINI_API_KEY (trong .env hoặc ô nhập trên web).' });
        return;
      }
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
      if (!prompt.trim()) {
        res.status(400).json({ error: 'Thiếu prompt đầu vào.' });
        return;
      }
      const model = typeof req.body?.model === 'string' && req.body.model.trim() ? req.body.model.trim() : 'gemini-2.5-flash';
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.35,
        },
      });
      res.json({ ok: true, jsonText: response.text || '' });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Lỗi gọi Gemini API',
      });
    }
  });

  app.post('/api/render/start', express.json({ limit: '1mb' }), async (req, res) => {
    try {
      const requestedFps = Number(req.body?.fps ?? 30);
      const fps = Number.isFinite(requestedFps)
        ? Math.max(1, Math.min(60, Math.round(requestedFps)))
        : 30;
      const requestedCrf = Number(req.body?.crf ?? 22);
      const crf = Number.isFinite(requestedCrf)
        ? Math.max(16, Math.min(32, Math.round(requestedCrf)))
        : 22;
      const jobId = crypto.randomUUID();
      const dir = getJobDir(jobId);
      await fs.promises.mkdir(dir, { recursive: true });
      const framesPath = path.join(dir, 'frames.mjpeg');

      const job: RenderJob = {
        id: jobId,
        dir,
        fps,
        crf,
        framesPath,
        audioPath: null,
        createdAt: Date.now(),
        chunkCount: 0,
      };
      jobs.set(jobId, job);
      await saveJobMeta(job);

      res.json({ jobId, fps, crf });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to create render job',
      });
    }
  });

  app.post(
    '/api/render/:jobId/audio',
    express.raw({ type: () => true, limit: '20mb' }),
    async (req, res) => {
      const job = await loadJob(req.params.jobId);
      if (!job) {
        res.status(404).json({ error: 'Render job not found' });
        return;
      }
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: 'Empty audio payload' });
        return;
      }
      const extHeader =
        typeof req.headers['x-audio-ext'] === 'string' ? req.headers['x-audio-ext'] : '';
      const safeExt = sanitizeAudioExt(extHeader);
      const audioPath = path.join(job.dir, `audio${safeExt}`);
      const isAppend = req.query.append === '1';

      if (isAppend) {
        await fs.promises.appendFile(audioPath, body);
      } else {
        await fs.promises.writeFile(audioPath, body);
      }
      if (job.audioPath !== audioPath) {
        job.audioPath = audioPath;
        await saveJobMeta(job);
      }
      res.json({ ok: true, bytes: body.length });
    },
  );

  app.post(
    '/api/render/:jobId/frames',
    express.raw({ type: () => true, limit: '20mb' }),
    async (req, res) => {
      const job = await loadJob(req.params.jobId);
      if (!job) {
        res.status(404).json({ error: 'Render job not found' });
        return;
      }
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: 'Empty frames chunk' });
        return;
      }
      await fs.promises.appendFile(job.framesPath, body);
      job.chunkCount += 1;
      res.json({ ok: true, chunkCount: job.chunkCount, bytes: body.length });
    },
  );

  app.post('/api/render/:jobId/finish', express.json({ limit: '256kb' }), async (req, res) => {
    const job = await loadJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Render job not found' });
      return;
    }

    try {
      const stat = await fs.promises.stat(job.framesPath).catch(() => null);
      if (!stat || stat.size === 0) {
        await cleanupJob(job.id);
        res.status(400).json({ error: 'No video frames uploaded' });
        return;
      }

      const outputPath = path.join(job.dir, 'output.mp4');
      const ffmpegArgs = buildFfmpegArgs({
        fps: job.fps,
        framesPath: job.framesPath,
        outputPath,
        audioPath: job.audioPath,
        crf: job.crf,
      });

      await new Promise<void>((resolve, reject) => {
        const proc = spawn('ffmpeg', ffmpegArgs, { shell: false });
        let stderr = '';
        proc.stderr.on('data', (chunk: Buffer) => {
          stderr = (stderr + chunk.toString('utf8')).slice(-8000);
        });
        proc.on('error', (err) => reject(err));
        proc.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
          }
        });
      });

      const outStat = await fs.promises.stat(outputPath);
      const rawName = typeof req.body?.fileName === 'string' ? req.body.fileName : 'kineticsub-video';
      const safeBaseName =
        rawName.replace(/[\x00-\x1f\\/:*?"<>|]/g, '_').trim().replace(/[.\s]+$/, '') || 'kineticsub-video';

      if (req.body?.saveToDisk === true) {
        // Support custom save path from client, defaulting to 'output' folder in project root
        const rawSavePath = typeof req.body?.savePath === 'string' ? req.body.savePath.trim() : '';
        const exportDir = rawSavePath
          ? path.resolve(rawSavePath)
          : path.resolve(process.env.BATCH_OUTPUT_DIR || 'output');
        await fs.promises.mkdir(exportDir, { recursive: true });
        const diskPath = path.join(exportDir, `${safeBaseName}.mp4`);
        await fs.promises.copyFile(outputPath, diskPath);
        await cleanupJob(job.id);
        res.json({ ok: true, savedPath: diskPath, bytes: outStat.size });
        return;
      }

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', String(outStat.size));
      const asciiFallback = safeBaseName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'kineticsub-video';
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(safeBaseName)}.mp4; filename="${asciiFallback}.mp4"`,
      );

      const stream = fs.createReadStream(outputPath);
      const onDone = () => {
        void cleanupJob(job.id);
      };
      res.on('close', onDone);
      stream.on('error', () => {
        void cleanupJob(job.id);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream rendered MP4' });
        }
      });
      stream.pipe(res);
    } catch (err) {
      await cleanupJob(job.id);
      if (!res.headersSent) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'MP4 encoding failed',
        });
      }
    }
  });

  app.delete('/api/render/:jobId', async (req, res) => {
    await cleanupJob(req.params.jobId);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve('dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`KineticSub Studio server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
