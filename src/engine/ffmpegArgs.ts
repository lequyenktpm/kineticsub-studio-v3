export function buildFfmpegArgs(options: {
  fps: number;
  framesPath: string;
  outputPath: string;
  audioPath?: string | null;
  durationSec?: number;
  crf?: number;
}): string[] {
  const safeFps = Math.max(1, Math.min(60, Math.round(options.fps || 30)));
  const safeCrf = Math.max(16, Math.min(32, Math.round(options.crf ?? 22)));
  const args: string[] = [
    '-y',
    '-framerate',
    String(safeFps),
    '-f',
    'mjpeg',
    '-i',
    options.framesPath,
  ];

  if (options.audioPath) {
    args.push('-i', options.audioPath);
  } else {
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    String(safeCrf),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
    options.outputPath,
  );

  return args;
}
