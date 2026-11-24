export type ExportResolutionId = '540p' | '720p' | '1080p' | '1440p';
export type ExportQualityId = 'standard' | 'high' | 'ultra';
export type ExportFpsOption = 24 | 30 | 60;

export interface Mp4ExportSettings {
  resolution: ExportResolutionId;
  quality: ExportQualityId;
  fps: ExportFpsOption;
}

export interface ResolvedMp4Encoding {
  width: number;
  height: number;
  fps: ExportFpsOption;
  videoBitrate: number;
  audioBitrate: number;
  crf: number;
  resolutionLabel: string;
  qualityLabel: string;
}

export const DEFAULT_MP4_EXPORT_SETTINGS: Mp4ExportSettings = {
  resolution: '540p',
  quality: 'standard',
  fps: 24,
};

export const RESOLUTION_OPTIONS: Array<{
  id: ExportResolutionId;
  width: number;
  height: number;
  label: string;
}> = [
  { id: '540p', width: 540, height: 960, label: '540p (540×960) · Nhanh & Nhẹ' },
  { id: '720p', width: 720, height: 1280, label: '720p (720×1280) · HD' },
  { id: '1080p', width: 1080, height: 1920, label: '1080p (1080×1920) · Full HD' },
  { id: '1440p', width: 1440, height: 2560, label: '1440p (1440×2560) · 2K Nét' },
];

export const QUALITY_OPTIONS: Array<{
  id: ExportQualityId;
  label: string;
  baseBitrate1080p30: number;
  audioBitrate: number;
  crf: number;
}> = [
  {
    id: 'standard',
    label: 'Thấp / Tiêu chuẩn (Nhẹ nhất)',
    baseBitrate1080p30: 2_600_000,
    audioBitrate: 128_000,
    crf: 27,
  },
  {
    id: 'high',
    label: 'Cao (TikTok chuẩn)',
    baseBitrate1080p30: 6_000_000,
    audioBitrate: 192_000,
    crf: 22,
  },
  {
    id: 'ultra',
    label: 'Siêu nét (Tối đa)',
    baseBitrate1080p30: 11_000_000,
    audioBitrate: 256_000,
    crf: 18,
  },
];

export const FPS_OPTIONS: ExportFpsOption[] = [24, 30, 60];

export function resolveMp4EncodingParams(settings: Mp4ExportSettings): ResolvedMp4Encoding {
  const res =
    RESOLUTION_OPTIONS.find((r) => r.id === settings.resolution) ?? RESOLUTION_OPTIONS[0];
  const qual =
    QUALITY_OPTIONS.find((q) => q.id === settings.quality) ?? QUALITY_OPTIONS[0];
  const fps: ExportFpsOption = FPS_OPTIONS.includes(settings.fps) ? settings.fps : 24;

  const pixelRatio = (res.width * res.height) / (1080 * 1920);
  const fpsRatio = fps === 60 ? 1.45 : fps === 24 ? 0.85 : 1;
  const videoBitrate = Math.max(
    650_000,
    Math.round((qual.baseBitrate1080p30 * pixelRatio * fpsRatio) / 50_000) * 50_000,
  );

  return {
    width: res.width,
    height: res.height,
    fps,
    videoBitrate,
    audioBitrate: qual.audioBitrate,
    crf: qual.crf,
    resolutionLabel: res.label,
    qualityLabel: qual.label,
  };
}
