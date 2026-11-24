import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { buildSceneGenerationPrompt, PromptVideoStyle } from '../src/engine/aiPromptBuilder.ts';
import { choreographFromTranscript } from '../src/engine/autoChoreographer.ts';
import { parseScenePlanJson, scenePlanToProject } from '../src/engine/scenePlanAdapter.ts';
import { parseTranscriptAuto } from '../src/engine/transcriptParser.ts';
import { LessonProject } from '../src/engine/types.ts';

dotenv.config();

const INPUT_DIR = path.resolve(process.env.BATCH_INPUT_DIR || 'batch_input');
const OUTPUT_DIR = path.resolve(process.env.BATCH_OUTPUT_DIR || 'batch_output');
const WHISPER_CMD = process.env.WHISPER_CMD || 'faster-whisper';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'medium';
const WHISPER_LANG = process.env.WHISPER_LANG || 'ja';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AUTO_RENDER_BROWSER = process.env.AUTO_RENDER_BROWSER !== '0';

// Template style: 'tiktok-cards' | '3d-shapes' | 'word-reveal-dark'
const VIDEO_STYLE = (process.env.VIDEO_STYLE || 'tiktok-cards') as PromptVideoStyle;
// Composition: 'ai-decide' | 'random' | specific LayoutCompositionId
const COMPOSITION_MODE = process.env.COMPOSITION_MODE || 'ai-decide';

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm']);

function runCommand(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-4000);
    });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function runWhisperStt(audioPath: string, outDir: string): Promise<string> {
  const baseName = path.basename(audioPath, path.extname(audioPath));
  const expectedSrt = path.join(outDir, `${baseName}.srt`);
  if (fs.existsSync(expectedSrt) && fs.statSync(expectedSrt).size > 0) {
    return expectedSrt;
  }

  console.log(`  [STT] Đang nhận diện giọng nói lần 2 bằng ${WHISPER_CMD} (${WHISPER_LANG})...`);
  // Hỗ trợ cả faster-whisper CLI và openai-whisper CLI
  const args = [
    audioPath,
    '--model',
    WHISPER_MODEL,
    '--language',
    WHISPER_LANG,
    '--output_format',
    'srt',
    '--output_dir',
    outDir,
  ];
  await runCommand(WHISPER_CMD, args);

  if (!fs.existsSync(expectedSrt)) {
    throw new Error(`Không tìm thấy file SRT đầu ra tại ${expectedSrt}`);
  }
  return expectedSrt;
}

async function generateSceneJsonWithGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Thiếu GEMINI_API_KEY trong file .env');
  }
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.35,
    },
  });
  return response.text || '';
}

async function processSingleAudio(audioPath: string): Promise<void> {
  const baseName = path.basename(audioPath, path.extname(audioPath));
  const jobWorkDir = path.join(OUTPUT_DIR, baseName);
  await fs.promises.mkdir(jobWorkDir, { recursive: true });

  const finalMp4Path = path.join(jobWorkDir, `${baseName}.mp4`);
  if (fs.existsSync(finalMp4Path) && fs.statSync(finalMp4Path).size > 0) {
    console.log(`[SKIP] ${baseName} đã có sẵn ${baseName}.mp4`);
    return;
  }

  console.log(`\n=== Đang xử lý: ${baseName} ===`);

  // 1. Kiểm tra nếu người dùng đã bỏ sẵn .srt cạnh file audio thì dùng luôn, không thì chạy STT lần 2
  const preExistingSrt = path.join(path.dirname(audioPath), `${baseName}.srt`);
  const workSrtPath = path.join(jobWorkDir, `${baseName}.srt`);
  if (fs.existsSync(preExistingSrt)) {
    await fs.promises.copyFile(preExistingSrt, workSrtPath);
    console.log(`  [STT] Dùng sẵn file ${baseName}.srt`);
  } else {
    await runWhisperStt(audioPath, jobWorkDir);
  }

  const srtText = await fs.promises.readFile(workSrtPath, 'utf8');
  const cues = parseTranscriptAuto(srtText);
  if (cues.length === 0) {
    throw new Error(`Không đọc được cue nào từ file ${workSrtPath}`);
  }
  console.log(`  [SRT] Đã đọc ${cues.length} câu thoại.`);

  // 2. Sinh hoặc đọc Scene JSON
  const preExistingJson = path.join(path.dirname(audioPath), `${baseName}.json`);
  const workJsonPath = path.join(jobWorkDir, `${baseName}.scene.json`);
  let rawSceneJson = '';

  if (fs.existsSync(preExistingJson)) {
    rawSceneJson = await fs.promises.readFile(preExistingJson, 'utf8');
    await fs.promises.writeFile(workJsonPath, rawSceneJson, 'utf8');
    console.log(`  [AI] Dùng sẵn file ${baseName}.json`);
  } else if (fs.existsSync(workJsonPath)) {
    rawSceneJson = await fs.promises.readFile(workJsonPath, 'utf8');
    console.log(`  [AI] Dùng lại cache ${baseName}.scene.json`);
  } else if (GEMINI_API_KEY) {
    console.log(`  [AI] Đang gọi ${GEMINI_MODEL} để sinh kịch bản Motion Graphics...`);
    const prompt = buildSceneGenerationPrompt(cues, {
      title: baseName,
      style: VIDEO_STYLE,
      compositionId: (COMPOSITION_MODE === 'ai-decide' ? 'ai-decide' : COMPOSITION_MODE) as 'ai-decide',
    });
    rawSceneJson = await generateSceneJsonWithGemini(prompt);
    await fs.promises.writeFile(workJsonPath, rawSceneJson, 'utf8');
  } else {
    console.log(`  [AI] Không có GEMINI_API_KEY -> dùng bộ dàn cảnh tự động cục bộ.`);
  }

  // 3. Build LessonProject hoàn chỉnh và lưu ra file .project.json để web batch queue nạp trực tiếp
  let project: LessonProject;
  const parsedPlan = rawSceneJson ? parseScenePlanJson(rawSceneJson) : null;
  if (parsedPlan) {
    const words = cues.flatMap((c) => c.words);
    project = scenePlanToProject(words, parsedPlan, {
      id: baseName,
      title: parsedPlan.title || baseName,
      audioFileName: path.basename(audioPath),
      cuesOverride: cues,
    });
  } else {
    project = choreographFromTranscript(cues, {
      id: baseName,
      title: baseName,
      audioFileName: path.basename(audioPath),
    });
  }

  const projectJsonPath = path.join(jobWorkDir, `${baseName}.project.json`);
  await fs.promises.writeFile(projectJsonPath, JSON.stringify(project, null, 2), 'utf8');
  await fs.promises.copyFile(audioPath, path.join(jobWorkDir, path.basename(audioPath)));
  console.log(`  [READY] Đã xuất gói dự án chuẩn tại: ${jobWorkDir}`);
}

async function main(): Promise<void> {
  await fs.promises.mkdir(INPUT_DIR, { recursive: true });
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

  const entries = await fs.promises.readdir(INPUT_DIR, { withFileTypes: true });
  const audioFiles = entries
    .filter((e) => e.isFile() && AUDIO_EXTS.has(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(INPUT_DIR, e.name))
    .sort();

  if (audioFiles.length === 0) {
    console.log(`Chưa có file audio nào trong thư mục: ${INPUT_DIR}`);
    console.log(`Hãy chép các file .mp3 / .wav từ win-pyvideotrans (ElevenLabs) vào ${INPUT_DIR} rồi chạy lại: npm run batch`);
    return;
  }

  console.log(`Tìm thấy ${audioFiles.length} file audio trong ${INPUT_DIR}. Bắt đầu chạy batch...`);
  let okCount = 0;
  let failCount = 0;

  for (const audioPath of audioFiles) {
    try {
      await processSingleAudio(audioPath);
      okCount += 1;
    } catch (err) {
      failCount += 1;
      console.error(`[LỖI] ${path.basename(audioPath)}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nHoàn tất chuẩn bị Batch: ${okCount} thành công, ${failCount} lỗi.`);
  console.log(`Bước cuối: Mở ${SERVER_URL} -> Tab "Batch Hàng Loạt" -> chọn các cặp file trong ${OUTPUT_DIR} để render MP4 tự động.`);
  void AUTO_RENDER_BROWSER;
}

void main();
