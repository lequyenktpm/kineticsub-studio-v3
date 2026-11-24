import { computeElementFrameState, easeInOutCubic, clamp01 } from './animationMath';
import {
  CANVAS_THEMES,
  ComparisonStripProps,
  IllustrationPropProps,
  IllustrationSceneIcon,
  KaraokeCardProps,
  LessonProject,
  SceneElement,
  SentenceCardProps,
  Shape3DProps,
  ToneMeterProps,
  TopicPillProps,
  WordStackProps,
} from './types';

export const STAGE_WIDTH = 1080;
export const STAGE_HEIGHT = 1920;

const FONT_DISPLAY = '"Outfit", "Plus Jakarta Sans", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif';
const FONT_SANS = '"Plus Jakarta Sans", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif';

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillCardWithShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  shadowAlpha = 0.08,
) {
  ctx.save();
  ctx.shadowColor = `rgba(15, 23, 42, ${shadowAlpha})`;
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = fill;
  drawRoundedRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function drawSceneIcon(ctx: CanvasRenderingContext2D, kind: IllustrationSceneIcon) {
  ctx.save();
  if (kind === 'tv') {
    fillCardWithShadow(ctx, -92, -62, 184, 124, 28, '#1E293B', 0.12);
    ctx.fillStyle = '#93C5FD';
    drawRoundedRectPath(ctx, -72, -44, 144, 78, 16);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-12, -22);
    ctx.lineTo(28, -2);
    ctx.lineTo(-12, 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-28, 72);
    ctx.lineTo(28, 72);
    ctx.stroke();
  } else if (kind === 'eye') {
    ctx.fillStyle = '#DBEAFE';
    ctx.beginPath();
    ctx.ellipse(0, 0, 78, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'watch') {
    ctx.fillStyle = '#1D4ED8';
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#BFDBFE';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'listen') {
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.ellipse(-8, 0, 36, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(18, 0, 38, -0.7, 0.7);
    ctx.stroke();
  } else if (kind === 'walk') {
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(0, -36, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 28);
    ctx.moveTo(0, 4);
    ctx.lineTo(-28, 22);
    ctx.moveTo(0, 4);
    ctx.lineTo(26, 18);
    ctx.moveTo(0, 28);
    ctx.lineTo(-18, 58);
    ctx.moveTo(0, 28);
    ctx.lineTo(22, 58);
    ctx.stroke();
  } else {
    fillCardWithShadow(ctx, -40, -70, 80, 140, 18, '#0F172A', 0.1);
    ctx.fillStyle = '#38BDF8';
    drawRoundedRectPath(ctx, -28, -54, 56, 100, 12);
    ctx.fill();
  }
  ctx.restore();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];

  const pushWrappedWord = (word: string) => {
    if (ctx.measureText(word).width <= maxWidth) {
      lines.push(word);
      return;
    }
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (ctx.measureText(next).width <= maxWidth || chunk.length === 0) {
        chunk = next;
      } else {
        lines.push(chunk);
        chunk = ch;
      }
    }
    if (chunk) lines.push(chunk);
  };

  let current = '';
  for (const word of words) {
    if (!current) {
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
      } else {
        pushWrappedWord(word);
        current = lines.pop() ?? '';
      }
      continue;
    }
    const candidate = `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
      } else {
        pushWrappedWord(word);
        current = lines.pop() ?? '';
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawComparisonStrip(
  ctx: CanvasRenderingContext2D,
  props: ComparisonStripProps,
  width: number,
  time: number,
) {
  const count = Math.max(1, props.items.length);
  const gap = 22;
  const itemW = (width - gap * (count - 1)) / count;
  const itemH = 112;
  const startX = -width / 2;
  const startY = -itemH / 2;

  // Determine active index: latest item whose activateAt <= time
  let activeIdx = -1;
  props.items.forEach((item, idx) => {
    if (item.activateAt !== undefined && time >= item.activateAt) {
      activeIdx = idx;
    }
  });

  props.items.forEach((item, idx) => {
    const x = startX + idx * (itemW + gap);
    const isActive = idx === activeIdx;
    const accent = item.accentColor || '#2563EB';

    fillCardWithShadow(
      ctx,
      x,
      startY,
      itemW,
      itemH,
      30,
      isActive ? '#FFFFFF' : 'rgba(255,255,255,0.86)',
      isActive ? 0.12 : 0.05,
    );

    if (isActive) {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      drawRoundedRectPath(ctx, x, startY, itemW, itemH, 30);
      ctx.stroke();
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fontSize = 40;
    const maxLabelW = itemW - 28;
    ctx.font = `700 ${fontSize}px ${FONT_DISPLAY}`;
    while (fontSize > 22 && ctx.measureText(item.label).width > maxLabelW) {
      fontSize -= 2;
      ctx.font = `700 ${fontSize}px ${FONT_DISPLAY}`;
    }
    ctx.fillStyle = isActive ? accent : '#475569';
    ctx.fillText(item.label, x + itemW / 2, item.sublabel ? startY + 42 : startY + itemH / 2);

    if (item.sublabel) {
      ctx.font = `600 22px ${FONT_SANS}`;
      ctx.fillStyle = isActive ? '#334155' : '#94A3B8';
      ctx.fillText(item.sublabel, x + itemW / 2, startY + 84);
    }
  });
}

function drawTopicPill(ctx: CanvasRenderingContext2D, props: TopicPillProps) {
  let fontSize = 34;
  ctx.font = `700 ${fontSize}px ${FONT_SANS}`;
  while (fontSize > 22 && ctx.measureText(props.text).width > 720) {
    fontSize -= 2;
    ctx.font = `700 ${fontSize}px ${FONT_SANS}`;
  }
  const textW = ctx.measureText(props.text).width;
  const pillW = Math.min(820, Math.max(240, textW + 76));
  const pillH = 74;

  fillCardWithShadow(ctx, -pillW / 2, -pillH / 2, pillW, pillH, 37, props.bgColor, 0.05);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = props.textColor;
  ctx.fillText(props.text, 0, 2, pillW - 44);
}

function drawIllustrationProp(
  ctx: CanvasRenderingContext2D,
  props: IllustrationPropProps,
  time: number,
) {
  const floatOffset = Math.sin(time * 2.2) * 8;
  ctx.save();
  ctx.translate(0, floatOffset);

  if (props.variant === 'cafe-water') {
    // Glass of water on the left
    ctx.save();
    ctx.translate(-225, 65);
    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.moveTo(-36, -64);
    ctx.lineTo(36, -64);
    ctx.lineTo(26, 68);
    ctx.lineTo(-26, 68);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#60A5FA';
    ctx.beginPath();
    ctx.moveTo(-31, -20);
    ctx.lineTo(31, -20);
    ctx.lineTo(24, 62);
    ctx.lineTo(-24, 62);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#93C5FD';
    ctx.lineWidth = 4;
    ctx.strokeRect(-1, -1, 2, 2); // noop clean state
    ctx.restore();

    // Minimalist cafe shop center
    fillCardWithShadow(ctx, -125, -80, 250, 220, 24, '#FFFDF9', 0.08);
    // Roof stripes
    const stripeW = 250 / 5;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#EF4444' : '#FFFFFF';
      drawRoundedRectPath(ctx, -135 + i * (270 / 5), -110, 270 / 5, 58, 12);
      ctx.fill();
    }
    // Window
    ctx.fillStyle = '#BAE6FD';
    drawRoundedRectPath(ctx, -98, -22, 108, 92, 16);
    ctx.fill();
    // Door
    ctx.fillStyle = '#92400E';
    drawRoundedRectPath(ctx, 28, -12, 72, 152, 14);
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(84, 64, 7, 0, Math.PI * 2);
    ctx.fill();

    // Friendly character on right
    ctx.save();
    ctx.translate(220, 15);
    ctx.fillStyle = '#F472B6';
    drawRoundedRectPath(ctx, -46, 36, 92, 68, 30);
    ctx.fill();
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(0, -14, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.arc(0, -24, 42, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(-14, -12, 4.5, 0, Math.PI * 2);
    ctx.arc(14, -12, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -2, 14, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  } else if (props.variant === 'coffee-cup') {
    fillCardWithShadow(ctx, -95, -50, 190, 130, 32, '#FFFFFF', 0.08);
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.ellipse(0, -34, 72, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(105, 10, 32, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  } else if (props.variant === 'friends-chat') {
    // Two friendly people chatting with speech bubbles
    const drawPerson = (px: number, shirt: string, hair: string) => {
      ctx.save();
      ctx.translate(px, 24);
      ctx.fillStyle = shirt;
      drawRoundedRectPath(ctx, -46, 36, 92, 70, 30);
      ctx.fill();
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(0, -14, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(0, -24, 42, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(-13, -12, 4.5, 0, Math.PI * 2);
      ctx.arc(13, -12, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -2, 13, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
    };
    drawPerson(-130, '#3B82F6', '#1E293B');
    drawPerson(130, '#EC4899', '#78350F');
    // Small chat bubble above
    fillCardWithShadow(ctx, -68, -118, 136, 72, 24, '#FFFFFF', 0.08);
    ctx.fillStyle = '#2563EB';
    [-26, 0, 26].forEach((dx, i) => {
      const bounce = Math.sin(time * 5 + i * 0.9) * 4;
      ctx.beginPath();
      ctx.arc(dx, -82 + bounce, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (props.variant === 'office-work') {
    // Minimalist office monitor / desk & calendar
    fillCardWithShadow(ctx, -165, -95, 330, 195, 28, '#FFFFFF', 0.08);
    ctx.fillStyle = '#E0E7FF';
    drawRoundedRectPath(ctx, -135, -65, 270, 125, 16);
    ctx.fill();
    // Tie / collar badge in center + calendar card
    ctx.fillStyle = '#4F46E5';
    drawRoundedRectPath(ctx, -108, -42, 108, 80, 12);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 28px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FRI', -54, -2);
    // Email lines on right
    ctx.fillStyle = '#6366F1';
    drawRoundedRectPath(ctx, 18, -36, 94, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#94A3B8';
    drawRoundedRectPath(ctx, 18, -8, 76, 12, 6);
    ctx.fill();
    drawRoundedRectPath(ctx, 18, 18, 86, 12, 6);
    ctx.fill();
    // Stand
    ctx.fillStyle = '#CBD5E1';
    drawRoundedRectPath(ctx, -40, 100, 80, 20, 8);
    ctx.fill();
  } else if (props.variant === 'hotel-desk') {
    // Formal hotel reception bell + keycard
    fillCardWithShadow(ctx, -160, -70, 320, 165, 28, '#FFFDF9', 0.08);
    ctx.fillStyle = '#7C3AED';
    drawRoundedRectPath(ctx, -125, 24, 250, 44, 16);
    ctx.fill();
    // Bell dome
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, 18, 68, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#FDE68A';
    drawRoundedRectPath(ctx, -12, -66, 24, 16, 8);
    ctx.fill();
    // Sparkle
    const pulse = 0.7 + 0.3 * Math.sin(time * 4);
    ctx.fillStyle = `rgba(124, 58, 237, ${pulse})`;
    ctx.beginPath();
    ctx.arc(82, -52, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (props.variant === 'lightbulb-tip') {
    const glow = 0.28 + 0.14 * Math.sin(time * 3.5);
    ctx.fillStyle = `rgba(250, 204, 21, ${glow})`;
    ctx.beginPath();
    ctx.arc(0, -18, 118, 0, Math.PI * 2);
    ctx.fill();
    // Bulb glass
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(0, -24, 72, 0, Math.PI * 2);
    ctx.fill();
    drawRoundedRectPath(ctx, -36, 26, 72, 42, 14);
    ctx.fill();
    // Screw base
    ctx.fillStyle = '#475569';
    drawRoundedRectPath(ctx, -32, 68, 64, 34, 12);
    ctx.fill();
    // Inner filament check
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-22, -20);
    ctx.lineTo(-4, 0);
    ctx.lineTo(26, -34);
    ctx.stroke();
  } else if (props.variant === 'ear-listen') {
    fillCardWithShadow(ctx, -140, -90, 280, 180, 44, '#FFFFFF', 0.08);
    // Headphones arc + sound waves
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 6, 58, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#4F46E5';
    drawRoundedRectPath(ctx, -74, -4, 28, 56, 14);
    ctx.fill();
    drawRoundedRectPath(ctx, 46, -4, 28, 56, 14);
    ctx.fill();
    // Equalizer bars in middle
    [0, 1, 2].forEach((i) => {
      const h = 22 + 28 * Math.abs(Math.sin(time * 5 + i * 0.9));
      ctx.fillStyle = '#0284C7';
      drawRoundedRectPath(ctx, -22 + i * 18, 20 - h / 2, 10, h, 5);
      ctx.fill();
    });
  } else if (props.variant === 'speech-bubble') {
    fillCardWithShadow(ctx, -180, -90, 360, 160, 44, '#FFFFFF', 0.08);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-40, 70);
    ctx.lineTo(10, 70);
    ctx.lineTo(-25, 118);
    ctx.closePath();
    ctx.fill();

    // Animated sound bars inside bubble
    const barHeights = [26, 52, 74, 44, 64, 34];
    barHeights.forEach((h, i) => {
      const pulse = Math.abs(Math.sin(time * 4 + i * 0.7));
      const bh = 22 + h * 0.65 * pulse;
      ctx.fillStyle = i % 2 === 0 ? '#4F46E5' : '#0284C7';
      drawRoundedRectPath(ctx, -105 + i * 38, -bh / 2 - 10, 18, bh, 9);
      ctx.fill();
    });
  } else if (props.variant === 'flow-diagram') {
    const nodes =
      props.data?.nodes && props.data.nodes.length >= 2
        ? props.data.nodes.slice(0, 3)
        : [
            { label: 'Present', icon: 'clock' as const, color: '#2563EB' },
            { label: 'Past', icon: 'history' as const, color: '#16A34A' },
            { label: 'Future', icon: 'rocket' as const, color: '#7C3AED' },
          ];
    const xs = nodes.length === 2 ? [-190, 190] : [-280, 0, 280];

    // Connecting arrows
    for (let i = 0; i < xs.length - 1; i++) {
      const ax1 = xs[i] + 74;
      const ax2 = xs[i + 1] - 74;
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ax1, -24);
      ctx.lineTo(ax2 - 12, -24);
      ctx.stroke();
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.moveTo(ax2, -24);
      ctx.lineTo(ax2 - 20, -36);
      ctx.lineTo(ax2 - 20, -12);
      ctx.closePath();
      ctx.fill();
    }

    nodes.forEach((node, idx) => {
      const nx = xs[idx];
      const color = node.color || '#2563EB';
      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(nx, -24, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(nx, -24, 54, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glyph
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (node.icon === 'rocket') {
        ctx.beginPath();
        ctx.moveTo(nx, -48);
        ctx.lineTo(nx + 16, -18);
        ctx.lineTo(nx - 16, -18);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(nx - 6, -18, 12, 16);
      } else if (node.icon === 'star') {
        ctx.beginPath();
        for (let s = 0; s < 5; s++) {
          const a1 = -Math.PI / 2 + (s * 2 * Math.PI) / 5;
          const a2 = a1 + Math.PI / 5;
          ctx.lineTo(nx + Math.cos(a1) * 22, -24 + Math.sin(a1) * 22);
          ctx.lineTo(nx + Math.cos(a2) * 10, -24 + Math.sin(a2) * 10);
        }
        ctx.closePath();
        ctx.fill();
      } else if (node.icon === 'check') {
        ctx.beginPath();
        ctx.moveTo(nx - 18, -24);
        ctx.lineTo(nx - 4, -10);
        ctx.lineTo(nx + 20, -38);
        ctx.stroke();
      } else if (node.icon === 'chat') {
        drawRoundedRectPath(ctx, nx - 22, -40, 44, 30, 10);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        [-10, 0, 10].forEach((dx) => {
          ctx.beginPath();
          ctx.arc(nx + dx, -25, 3.2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        // clock / history default
        ctx.beginPath();
        ctx.arc(nx, -24, 21, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(nx, -36);
        ctx.lineTo(nx, -24);
        ctx.lineTo(nx + 11, -18);
        ctx.stroke();
      }

      // Label pill below circle
      ctx.font = `800 28px ${FONT_DISPLAY}`;
      const lw = Math.min(240, Math.max(132, ctx.measureText(node.label).width + 38));
      fillCardWithShadow(ctx, nx - lw / 2, 46, lw, 46, 23, color, 0.08);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, nx, 69, lw - 24);
    });
  } else if (props.variant === 'gauge-arc') {
    const val = clamp01((props.data?.value ?? 0.65) + Math.sin(time * 2.4) * 0.015);
    const segments = ['#EF4444', '#F97316', '#FACC15', '#4ADE80', '#16A34A'];
    const cx = 0;
    const cy = 58;
    const radius = 152;
    const segSpan = Math.PI / segments.length;
    const gapRad = 0.04;

    fillCardWithShadow(ctx, -370, -138, 740, 278, 36, '#FFFFFF', 0.09);

    segments.forEach((col, i) => {
      const a0 = Math.PI + i * segSpan + gapRad / 2;
      const a1 = Math.PI + (i + 1) * segSpan - gapRad / 2;
      ctx.strokeStyle = col;
      ctx.lineWidth = 34;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, a0, a1);
      ctx.stroke();
    });

    // Indicator dot along arc
    const needleAngle = Math.PI + val * Math.PI;
    const dotX = cx + Math.cos(needleAngle) * radius;
    const dotY = cy + Math.sin(needleAngle) * radius;
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(dotX, dotY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
    ctx.restore();

    // Friendly emoji face inside arc
    ctx.fillStyle = val < 0.35 ? '#FECACA' : val > 0.65 ? '#BBF7D0' : '#FEF08A';
    ctx.beginPath();
    ctx.arc(0, 24, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(-18, 16, 5.5, 0, Math.PI * 2);
    ctx.arc(18, 16, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (val < 0.35) {
      ctx.arc(0, 48, 16, 1.15 * Math.PI, 1.85 * Math.PI);
    } else if (val > 0.6) {
      ctx.arc(0, 26, 20, 0.15 * Math.PI, 0.85 * Math.PI);
    } else {
      ctx.moveTo(-16, 36);
      ctx.lineTo(16, 36);
    }
    ctx.stroke();

    const statusText = props.data?.subtitle || 'Good & Polite';
    ctx.font = `700 28px ${FONT_SANS}`;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusText, 0, 106, 480);
  } else if (props.variant === 'timeline-track') {
    const progress = clamp01(props.data?.value ?? 0.68);
    const labels =
      props.data?.labels && props.data.labels.length >= 2
        ? props.data.labels.slice(0, 3)
        : ['Early', 'On time', 'Too late'];

    fillCardWithShadow(ctx, -430, -104, 860, 208, 34, '#FFFFFF', 0.09);

    // Track line
    const x0 = -320;
    const x1 = 320;
    const trackY = -20;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, trackY);
    ctx.lineTo(x1, trackY);
    ctx.stroke();

    // Active progress fill
    const activeX = x0 + (x1 - x0) * progress;
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, '#3B82F6');
    grad.addColorStop(1, '#10B981');
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0, trackY);
    ctx.lineTo(activeX, trackY);
    ctx.stroke();

    // Start marker & Finish Flag
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.arc(x0, trackY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x1, trackY + 6);
    ctx.lineTo(x1, trackY - 44);
    ctx.stroke();
    ctx.fillStyle = '#F59E0B';
    drawRoundedRectPath(ctx, x1, trackY - 44, 34, 22, 4);
    ctx.fill();

    // Moving runner dot
    ctx.save();
    ctx.shadowColor = 'rgba(16, 185, 129, 0.45)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(activeX, trackY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(activeX, trackY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Milestone labels
    const lxs = labels.length === 2 ? [-200, 200] : [-270, 0, 270];
    labels.forEach((lbl, i) => {
      const lx = lxs[i];
      const isCurrent = Math.abs(progress - i / Math.max(1, labels.length - 1)) < 0.35;
      ctx.fillStyle = isCurrent ? '#DCFCE7' : '#F1F5F9';
      drawRoundedRectPath(ctx, lx - 108, 28, 216, 46, 23);
      ctx.fill();
      ctx.font = `700 24px ${FONT_SANS}`;
      ctx.fillStyle = isCurrent ? '#15803D' : '#475569';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, lx, 51, 190);
    });
  } else if (props.variant === 'checklist-card') {
    const items =
      props.data?.checklist && props.data.checklist.length > 0
        ? props.data.checklist.slice(0, 4)
        : [
            { text: 'You are right.', ok: true },
            { text: 'We are on time.', ok: true },
            { text: 'They are here.', ok: true },
          ];
    const rowH = 66;
    const cardH = 74 + items.length * rowH;
    const cardW = 840;
    const topY = -cardH / 2;

    fillCardWithShadow(ctx, -cardW / 2, topY, cardW, cardH, 34, '#FFFFFF', 0.09);

    ctx.font = `700 24px ${FONT_SANS}`;
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.data?.title || 'Checklist', 0, topY + 34);

    items.forEach((item, idx) => {
      const ry = topY + 80 + idx * rowH;
      const isOk = item.ok !== false;
      ctx.fillStyle = isOk ? '#F0FDF4' : '#FEF2F2';
      drawRoundedRectPath(ctx, -cardW / 2 + 28, ry - 24, cardW - 56, 52, 18);
      ctx.fill();

      // Check or Cross circle
      const bx = -cardW / 2 + 64;
      ctx.fillStyle = isOk ? '#16A34A' : '#DC2626';
      ctx.beginPath();
      ctx.arc(bx, ry + 2, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (isOk) {
        ctx.moveTo(bx - 7, ry + 2);
        ctx.lineTo(bx - 2, ry + 8);
        ctx.lineTo(bx + 8, ry - 5);
      } else {
        ctx.moveTo(bx - 6, ry - 4);
        ctx.lineTo(bx + 6, ry + 8);
        ctx.moveTo(bx + 6, ry - 4);
        ctx.lineTo(bx - 6, ry + 8);
      }
      ctx.stroke();

      ctx.font = `700 30px ${FONT_DISPLAY}`;
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.text, bx + 32, ry + 3, cardW - 140);
    });
  } else if (props.variant === 'dialogue-upgrade') {
    const rows =
      props.data?.upgrades && props.data.upgrades.length > 0
        ? props.data.upgrades.slice(0, 3)
        : [
            { prompt: 'Very good', upgrade: 'Wonderful', badgeColor: '#2563EB' },
            { prompt: 'Very tasty', upgrade: 'Delicious', badgeColor: '#16A34A' },
            { prompt: 'Very nice', upgrade: 'Amazing', badgeColor: '#7C3AED' },
          ];
    const rowH = 82;
    const totalH = rows.length * rowH;
    const startY = -totalH / 2 + rowH / 2;

    rows.forEach((row, idx) => {
      const ry = startY + idx * rowH;
      fillCardWithShadow(ctx, -430, ry - 34, 860, 68, 24, '#FFFFFF', 0.08);

      // Mini avatar
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(-384, ry, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(-390, ry - 2, 2.5, 0, Math.PI * 2);
      ctx.arc(-378, ry - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Prompt text (auto-fit font size so it never squishes)
      let promptFontPx = 25;
      while (promptFontPx > 19) {
        ctx.font = `600 ${promptFontPx}px ${FONT_SANS}`;
        if (ctx.measureText(row.prompt).width <= 366) break;
        promptFontPx -= 1;
      }
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.prompt, -350, ry + 1, 366);

      // Arrow
      ctx.fillStyle = '#94A3B8';
      ctx.font = `700 28px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText('→', 42, ry);

      // Upgrade pill
      const bColor = row.badgeColor || '#16A34A';
      ctx.fillStyle = bColor;
      drawRoundedRectPath(ctx, 78, ry - 24, 336, 48, 24);
      ctx.fill();

      let upgFontPx = 25;
      while (upgFontPx > 18) {
        ctx.font = `700 ${upgFontPx}px ${FONT_DISPLAY}`;
        if (ctx.measureText(row.upgrade).width <= 300) break;
        upgFontPx -= 1;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(row.upgrade, 246, ry + 1, 300);
    });
  } else if (props.variant === 'clock-face') {
    const hour = props.data?.timeHour ?? 8;
    const minute = props.data?.timeMinute ?? 20;
    const formula = props.data?.formula || `${hour}:${String(minute).padStart(2, '0')}`;
    const sub = props.data?.subtitle || 'Use "past" / "to"';

    // Analog clock on left
    const cx = -165;
    const cy = 0;
    const r = 114;
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Shaded minute sector
    const startAng = -Math.PI / 2;
    const minAng = startAng + (minute / 60) * Math.PI * 2;
    if (minute > 0) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.16)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r - 12, startAng, minAng);
      ctx.closePath();
      ctx.fill();
    }

    // 12 hour dots
    for (let h = 0; h < 12; h++) {
      const a = -Math.PI / 2 + (h / 12) * Math.PI * 2;
      ctx.fillStyle = h % 3 === 0 ? '#1E293B' : '#94A3B8';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18), h % 3 === 0 ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hour & Minute hands
    const hourAng = -Math.PI / 2 + (((hour % 12) + minute / 60) / 12) * Math.PI * 2;
    ctx.strokeStyle = '#0F172A';
    ctx.lineCap = 'round';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hourAng) * 58, cy + Math.sin(hourAng) * 58);
    ctx.stroke();

    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(minAng) * 86, cy + Math.sin(minAng) * 86);
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();

    // Right readout card
    fillCardWithShadow(ctx, -10, -86, 390, 172, 32, '#FFFFFF', 0.09);
    ctx.font = `800 50px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#2563EB';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formula, 185, -18, 350);
    ctx.font = `600 28px ${FONT_SANS}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(sub, 185, 42, 350);
  } else if (props.variant === 'spatial-boxes') {
    const boxes =
      props.data?.boxes && props.data.boxes.length >= 2
        ? props.data.boxes.slice(0, 3)
        : [
            { title: 'AT', subtitle: 'point', icon: 'dot' as const, accent: '#2563EB' },
            { title: 'ON', subtitle: 'surface', icon: 'surface' as const, accent: '#16A34A' },
            { title: 'IN', subtitle: 'space', icon: 'cube' as const, accent: '#7C3AED' },
          ];
    const gap = 24;
    const bw = boxes.length === 2 ? 360 : 276;
    const totalW = boxes.length * bw + (boxes.length - 1) * gap;
    const startX = -totalW / 2;

    boxes.forEach((box, idx) => {
      const bx = startX + idx * (bw + gap) + bw / 2;
      const accent = box.accent || '#2563EB';
      fillCardWithShadow(ctx, bx - bw / 2, -108, bw, 216, 30, '#FFFFFF', 0.09);

      // Icon container
      ctx.fillStyle = '#F8FAFC';
      drawRoundedRectPath(ctx, bx - bw / 2 + 20, -90, bw - 40, 88, 20);
      ctx.fill();

      if (box.icon === 'surface') {
        ctx.fillStyle = '#CBD5E1';
        drawRoundedRectPath(ctx, bx - 44, -40, 88, 16, 8);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(bx, -52, 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (box.icon === 'cube') {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        ctx.strokeRect(bx - 26, -68, 52, 46);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(bx, -45, 11, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(bx, -46, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = `800 36px ${FONT_DISPLAY}`;
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(box.title, bx, 34, bw - 36);

      if (box.subtitle) {
        ctx.font = `600 24px ${FONT_SANS}`;
        ctx.fillStyle = '#64748B';
        ctx.fillText(box.subtitle, bx, 76, bw - 36);
      }
    });
  } else if (props.variant === 'avatar-speech') {
    const speech = props.data?.speechText || 'Could I have some water, please?';
    const reaction = props.data?.reactionText || 'Polite!';

    // Speaker avatar on left
    ctx.save();
    ctx.translate(-295, 16);
    ctx.fillStyle = '#DBEAFE';
    ctx.beginPath();
    ctx.arc(0, 0, 82, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3B82F6';
    drawRoundedRectPath(ctx, -46, 28, 92, 54, 24);
    ctx.fill();
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(0, -14, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(0, -24, 42, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-13, -12, 4.5, 0, Math.PI * 2);
    ctx.arc(13, -12, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -2, 13, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();

    // Speech bubble on right
    fillCardWithShadow(ctx, -185, -86, 585, 152, 34, '#FFFFFF', 0.09);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-185, -18);
    ctx.lineTo(-218, 4);
    ctx.lineTo(-185, 20);
    ctx.closePath();
    ctx.fill();

    ctx.font = `700 34px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lines = wrapTextLines(ctx, speech, 520).slice(0, 2);
    const lh = 44;
    const sy = -10 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, -148, sy + i * lh, 520));

    // Reaction pill
    ctx.font = `700 22px ${FONT_SANS}`;
    const rw = Math.min(240, Math.max(120, ctx.measureText(reaction).width + 38));
    fillCardWithShadow(ctx, 400 - rw - 16, 46, rw, 42, 21, '#4F46E5', 0.08);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(reaction, 400 - rw / 2 - 16, 67, rw - 24);
  } else if (props.variant === 'phrase-icon-split') {
    const nodes = (props.data?.nodes ?? []).slice(0, 3);
    const quote = props.data?.speechText || 'I see TV every';
    const chip = (props.data?.highlightWord || 'night.').replace(/["“”]/g, '');
    const wrong = props.data?.subtitle;
    const iconKind = props.data?.sceneIcon || 'tv';

    fillCardWithShadow(ctx, -430, -236, 860, 128, 40, '#FFFFFF', 0.08);
    const slotW = nodes.length > 0 ? 760 / Math.max(nodes.length, 1) : 240;
    nodes.forEach((node, i) => {
      const nx = -380 + i * slotW + slotW / 2;
      ctx.font = `800 28px ${FONT_DISPLAY}`;
      ctx.fillStyle = node.color || '#475569';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, nx, -198, slotW - 24);
      if (node.sublabel) {
        ctx.font = `600 18px ${FONT_SANS}`;
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(node.sublabel, nx, -168, slotW - 24);
      }
      if (i < nodes.length - 1) {
        ctx.fillStyle = '#CBD5E1';
        ctx.font = `700 22px ${FONT_SANS}`;
        ctx.fillText('→', nx + slotW / 2, -184);
      }
    });

    if (wrong) {
      fillCardWithShadow(ctx, -340, -88, 680, 50, 25, '#FFFFFF', 0.06);
      ctx.font = `700 26px ${FONT_SANS}`;
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(wrong, 0, -63, 640);
    }

    ctx.font = `800 58px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`"${quote}`, 0, 16, 860);

    ctx.save();
    ctx.translate(0, 118);
    drawSceneIcon(ctx, iconKind);
    ctx.restore();

    ctx.font = `700 36px ${FONT_DISPLAY}`;
    const chipW = Math.min(360, Math.max(150, ctx.measureText(chip).width + 48));
    fillCardWithShadow(ctx, -chipW / 2, 188, chipW, 58, 29, '#F8FAFC', 0.08);
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chip, 0, 217, chipW - 24);
  } else {
    // pronunciation-wave
    const bars = 9;
    for (let i = 0; i < bars; i++) {
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(time * 4.5 + i * 0.6));
      const bh = 120 * pulse;
      ctx.fillStyle = i % 3 === 0 ? '#EA580C' : i % 3 === 1 ? '#2563EB' : '#DB2777';
      drawRoundedRectPath(ctx, -160 + i * 38, -bh / 2, 22, bh, 11);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawSentenceCard(
  ctx: CanvasRenderingContext2D,
  props: SentenceCardProps,
  width: number,
) {
  ctx.font = `700 50px ${FONT_DISPLAY}`;
  const innerMaxW = width - 110;
  const lines = wrapTextLines(ctx, props.text, innerMaxW);
  const lineH = 66;
  const subH = props.subtext ? 46 : 0;
  const cardH = Math.max(148, lines.length * lineH + subH + 74);
  const x = -width / 2;
  const y = -cardH / 2;

  const cardBg = props.bgColor || '#FFFFFF';
  const isDarkBg =
    cardBg !== '#FFFFFF' &&
    (cardBg.startsWith('#0') ||
      cardBg.startsWith('#1') ||
      cardBg.startsWith('#2') ||
      cardBg.includes('rgba') ||
      cardBg.includes('15, 23, 42'));
  const defaultTextColor = props.textColor || (isDarkBg ? '#F8FAFC' : '#0F172A');

  fillCardWithShadow(ctx, x, y, width, cardH, 38, cardBg, isDarkBg ? 0.3 : 0.1);

  // Render lines with optional emphasis word coloring
  ctx.textBaseline = 'middle';
  const totalContentH = (lines.length - 1) * lineH + subH;
  const startTextY = y + cardH / 2 - totalContentH / 2;
  const emphasisLower = props.emphasisWord?.trim().toLowerCase();

  lines.forEach((line, lineIdx) => {
    const lineY = startTextY + lineIdx * lineH;
    if (emphasisLower && line.toLowerCase().includes(emphasisLower)) {
      const lower = line.toLowerCase();
      const idx = lower.indexOf(emphasisLower);
      const before = line.slice(0, idx);
      const match = line.slice(idx, idx + emphasisLower.length);
      const after = line.slice(idx + emphasisLower.length);

      const totalW = ctx.measureText(line).width;
      let cursorX = -totalW / 2;
      ctx.textAlign = 'left';

      if (before) {
        ctx.fillStyle = defaultTextColor;
        ctx.fillText(before, cursorX, lineY);
        cursorX += ctx.measureText(before).width;
      }
      ctx.fillStyle = props.emphasisColor || (isDarkBg ? '#FACC15' : '#2563EB');
      ctx.fillText(match, cursorX, lineY);
      cursorX += ctx.measureText(match).width;
      if (after) {
        ctx.fillStyle = defaultTextColor;
        ctx.fillText(after, cursorX, lineY);
      }
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = defaultTextColor;
      ctx.fillText(line, 0, lineY);
    }
  });

  if (props.subtext) {
    ctx.font = `600 28px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = isDarkBg ? '#94A3B8' : '#64748B';
    ctx.fillText(props.subtext, 0, startTextY + (lines.length - 1) * lineH + 50, innerMaxW);
  }

  // Top-right badge (check, cross, or question)
  if (props.badge === 'check' || props.badge === 'cross' || props.badge === 'question') {
    const bx = x + width - 18;
    const by = y + 10;
    ctx.save();
    ctx.fillStyle =
      props.badge === 'check' ? '#16A34A' : props.badge === 'cross' ? '#DC2626' : '#4F46E5';
    ctx.beginPath();
    ctx.arc(bx, by, 30, 0, Math.PI * 2);
    ctx.fill();
    if (props.badge === 'question') {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 34px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', bx, by + 1);
    } else {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (props.badge === 'check') {
        ctx.moveTo(bx - 12, by + 1);
        ctx.lineTo(bx - 3, by + 10);
        ctx.lineTo(bx + 13, by - 9);
      } else {
        ctx.moveTo(bx - 10, by - 10);
        ctx.lineTo(bx + 10, by + 10);
        ctx.moveTo(bx + 10, by - 10);
        ctx.lineTo(bx - 10, by + 10);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Optional stamp (e.g., RUDE / AVOID)
  if (props.stampText) {
    ctx.save();
    ctx.translate(x + width - 90, y + cardH - 12);
    ctx.rotate(-0.08);
    ctx.fillStyle = props.stampColor || '#DC2626';
    drawRoundedRectPath(ctx, -74, -24, 148, 48, 12);
    ctx.fill();
    ctx.font = `800 26px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.stampText, 0, 1);
    ctx.restore();
  }
}

function drawToneMeter(
  ctx: CanvasRenderingContext2D,
  props: ToneMeterProps,
  width: number,
  time: number,
) {
  const span = Math.max(0.1, props.animateEnd - props.animateStart);
  const progress = clamp01((time - props.animateStart) / span);
  const eased = easeInOutCubic(progress);
  const value = props.valueStart + (props.valueEnd - props.valueStart) * eased;

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 24px ${FONT_SANS}`;
  ctx.fillStyle = '#64748B';
  ctx.fillText(props.title, 0, -48);

  // Gradient bar
  const barW = width;
  const barH = 22;
  const grad = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0);
  grad.addColorStop(0, '#DC2626');
  grad.addColorStop(0.5, '#F59E0B');
  grad.addColorStop(1, '#16A34A');

  ctx.fillStyle = grad;
  drawRoundedRectPath(ctx, -barW / 2, -barH / 2, barW, barH, barH / 2);
  ctx.fill();

  // Thumb
  const thumbX = -barW / 2 + barW * clamp01(value);
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.2)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(thumbX, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = value < 0.38 ? '#DC2626' : value > 0.65 ? '#16A34A' : '#F59E0B';
  ctx.stroke();
  ctx.restore();

  // Labels
  ctx.font = `700 28px ${FONT_SANS}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#DC2626';
  ctx.fillText(props.leftLabel, -barW / 2, 48);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#16A34A';
  ctx.fillText(props.rightLabel, barW / 2, 48);
}

function drawWordStack(
  ctx: CanvasRenderingContext2D,
  props: WordStackProps,
  width: number,
  time: number,
) {
  const rowH = 128;
  const gap = 28;
  const totalH = props.rows.length * rowH + (props.rows.length - 1) * gap;
  const startY = -totalH / 2;

  props.rows.forEach((row, idx) => {
    if (time < row.appearAt) return;
    const elapsed = Math.min(1, (time - row.appearAt) / 0.25);
    const scale = 0.88 + 0.12 * elapsed;

    ctx.save();
    ctx.globalAlpha *= elapsed;
    ctx.translate(0, startY + idx * (rowH + gap) + rowH / 2);
    ctx.scale(scale, scale);

    fillCardWithShadow(ctx, -width / 2, -rowH / 2, width, rowH, 34, '#FFFFFF', 0.09);

    ctx.font = `800 66px ${FONT_DISPLAY}`;
    ctx.textBaseline = 'middle';
    const prefixW = ctx.measureText(row.prefix).width;
    const suffixW = ctx.measureText(row.suffix).width;
    const fullW = prefixW + suffixW;
    const leftX = row.phonetic ? -width / 2 + 64 : -fullW / 2;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.fillText(row.prefix, leftX, 0);
    ctx.fillStyle = row.suffixColor;
    ctx.fillText(row.suffix, leftX + prefixW, 0);

    if (row.phonetic) {
      ctx.font = `600 32px ${FONT_SANS}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748B';
      ctx.fillText(row.phonetic, width / 2 - 58, 2);
    }

    ctx.restore();
  });
}

function adjustHex(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const nr = factor >= 1 ? clamp(r + (255 - r) * (factor - 1)) : clamp(r * factor);
  const ng = factor >= 1 ? clamp(g + (255 - g) * (factor - 1)) : clamp(g * factor);
  const nb = factor >= 1 ? clamp(b + (255 - b) * (factor - 1)) : clamp(b * factor);
  return `rgb(${nr}, ${ng}, ${nb})`;
}

function drawShape3D(
  ctx: CanvasRenderingContext2D,
  props: Shape3DProps,
  width: number,
  height: number,
) {
  const x = -width / 2;
  const y = -height / 2;
  const depth = Math.max(0, props.depth ?? 10);
  const darkFill = adjustHex(props.fill, 0.72);
  const lightEdge = adjustHex(props.fill, 1.35);

  if (props.shapeType === 'cube_3d') {
    const s = Math.min(width, height) * 0.48;
    const topY = -s * 0.95;
    const midY = -s * 0.42;
    const botY = s * 0.58;
    const sideY = s * 0.08;

    ctx.save();
    if (props.shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 18;
    }
    // Left face (medium)
    ctx.fillStyle = props.fill;
    ctx.beginPath();
    ctx.moveTo(-s * 0.92, sideY - s * 0.48);
    ctx.lineTo(0, midY);
    ctx.lineTo(0, botY + s * 0.42);
    ctx.lineTo(-s * 0.92, sideY + s * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Right face (dark)
    ctx.fillStyle = darkFill;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(s * 0.92, sideY - s * 0.48);
    ctx.lineTo(s * 0.92, sideY + s * 0.48);
    ctx.lineTo(0, botY + s * 0.42);
    ctx.closePath();
    ctx.fill();

    // Top face (bright)
    ctx.fillStyle = adjustHex(props.fill, 1.25);
    ctx.beginPath();
    ctx.moveTo(0, topY);
    ctx.lineTo(s * 0.92, sideY - s * 0.48);
    ctx.lineTo(0, midY);
    ctx.lineTo(-s * 0.92, sideY - s * 0.48);
    ctx.closePath();
    ctx.fill();

    if (props.highlight) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  } else if (props.shapeType === 'staircase_3d') {
    const steps = 3;
    const gap = 16;
    const stepW = (width - gap * (steps - 1)) / steps;
    const labels = props.stepLabels ?? ['Step 1', 'Step 2', 'Step 3'];

    for (let i = 0; i < steps; i++) {
      const ratio = 0.45 + i * 0.27;
      const sh = height * ratio;
      const sx = x + i * (stepW + gap);
      const sy = y + height - sh;

      // Extruded depth
      if (depth > 0) {
        ctx.fillStyle = darkFill;
        drawRoundedRectPath(ctx, sx, sy + depth, stepW, sh, 18);
        ctx.fill();
      }
      fillCardWithShadow(ctx, sx, sy, stepW, sh, 18, props.fill, props.shadow ? 0.25 : 0);

      // Top highlight face
      if (props.highlight) {
        ctx.fillStyle = lightEdge;
        drawRoundedRectPath(ctx, sx + 4, sy + 2, stepW - 8, 14, 7);
        ctx.fill();
      }

      const label = labels[i];
      if (label) {
        ctx.fillStyle = props.textColor || '#FFFFFF';
        ctx.font = `800 32px ${FONT_DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, sx + stepW / 2, sy + sh / 2);
      }
    }
    return;
  } else {
    const radius =
      props.shapeType === 'pill_3d'
        ? height / 2
        : props.shapeType === 'rect_3d'
          ? 12
          : Math.min(props.cornerRadius ?? 28, height / 2);

    if (props.shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 14 + depth;
      ctx.fillStyle = darkFill;
      drawRoundedRectPath(ctx, x, y + depth, width, height, radius);
      ctx.fill();
      ctx.restore();
    }

    if (depth > 0) {
      ctx.fillStyle = darkFill;
      drawRoundedRectPath(ctx, x, y + depth, width, height, radius);
      ctx.fill();
    }

    ctx.fillStyle = props.fill;
    drawRoundedRectPath(ctx, x, y, width, height, radius);
    ctx.fill();

    if (props.highlight) {
      ctx.save();
      ctx.strokeStyle = lightEdge;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + radius, y + 3);
      ctx.lineTo(x + width - radius, y + 3);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Render attached text content
  if (props.textContent) {
    const sizeMap = {
      display: 64,
      headline: 48,
      body: 36,
      caption: 28,
      label: 24,
    };
    const weightMap = {
      regular: 400,
      medium: 500,
      bold: 700,
      black: 800,
    };
    const fSize = sizeMap[props.textSize ?? 'headline'];
    const fWeight = weightMap[props.textWeight ?? 'bold'];
    ctx.font = `${fWeight} ${fSize}px ${FONT_DISPLAY}`;
    ctx.fillStyle = props.textColor || '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapTextLines(ctx, props.textContent, width - 64);
    const lineH = fSize * 1.24;
    const startY = -((lines.length - 1) * lineH) / 2;
    lines.forEach((ln, idx) => {
      ctx.fillText(ln, 0, startY + idx * lineH);
    });
  }
}

function drawKaraokeCard(
  ctx: CanvasRenderingContext2D,
  props: KaraokeCardProps,
  width: number,
  time: number,
) {
  const words = props.words;
  if (words.length === 0) return;

  const isDarkBar = props.variant === 'dark-bar';
  ctx.font = `700 42px ${FONT_DISPLAY}`;
  const maxLineW = width - 104;
  const asciiSpaceW = Math.max(14, ctx.measureText(' ').width * 1.45);
  const isCjkOnly = (s: string) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(s) && !/[A-Za-z0-9]/.test(s);
  const gapBetween = (a: string, b: string) => (isCjkOnly(a) && isCjkOnly(b) ? 3 : asciiSpaceW);

  // Build wrapped lines of WordTiming tokens
  const allLines: { tokens: typeof words; lineWidth: number }[] = [];
  let currentLine: typeof words = [];
  let currentW = 0;

  for (const token of words) {
    const wWidth = ctx.measureText(token.word).width;
    const prevWord = currentLine.length > 0 ? currentLine[currentLine.length - 1].word : null;
    const sep = prevWord ? gapBetween(prevWord, token.word) : 0;
    const nextW = currentLine.length === 0 ? wWidth : currentW + sep + wWidth;
    if (nextW > maxLineW && currentLine.length > 0) {
      allLines.push({ tokens: currentLine, lineWidth: currentW });
      currentLine = [token];
      currentW = wWidth;
    } else {
      currentLine.push(token);
      currentW = nextW;
    }
  }
  if (currentLine.length > 0) {
    allLines.push({ tokens: currentLine, lineWidth: currentW });
  }

  // Group into pages of at most 2 lines so long narration never overflows vertically
  const pages: { tokens: typeof words; lineWidth: number }[][] = [];
  for (let i = 0; i < allLines.length; i += 2) {
    pages.push(allLines.slice(i, i + 2));
  }

  let activePageIdx = 0;
  if (pages.length > 1) {
    const foundIdx = pages.findIndex((page) => {
      const first = page[0]?.tokens[0];
      const lastLine = page[page.length - 1];
      const last = lastLine?.tokens[lastLine.tokens.length - 1];
      return first && last && time <= last.end + 0.02;
    });
    activePageIdx = foundIdx === -1 ? pages.length - 1 : foundIdx;
  }

  const lines = pages[activePageIdx] ?? allLines.slice(0, 2);
  const lineH = 62;
  const cardH = Math.max(134, lines.length * lineH + 64);
  const x = -width / 2;
  const y = -cardH / 2;

  fillCardWithShadow(
    ctx,
    x,
    y,
    width,
    cardH,
    isDarkBar ? 28 : 36,
    isDarkBar ? 'rgba(15, 23, 42, 0.78)' : '#FFFFFF',
    isDarkBar ? 0.25 : 0.11,
  );

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const startY = y + cardH / 2 - ((lines.length - 1) * lineH) / 2;

  lines.forEach((line, lineIdx) => {
    let cursorX = -line.lineWidth / 2;
    const lineY = startY + lineIdx * lineH;

    line.tokens.forEach((token, tIdx) => {
      const isActive = time >= token.start && time <= token.end;
      const isSpoken = time > token.end;
      const tokenW = ctx.measureText(token.word).width;

      if (isActive) {
        ctx.save();
        ctx.fillStyle = token.highlightColor || props.activeColor;
        ctx.translate(cursorX + tokenW / 2, lineY);
        ctx.scale(1.04, 1.04);
        ctx.textAlign = 'center';
        ctx.fillText(token.word, 0, 0);
        ctx.restore();
      } else {
        ctx.fillStyle = isSpoken ? props.spokenColor : props.inactiveColor;
        ctx.fillText(token.word, cursorX, lineY);
      }

      const nextTok = line.tokens[tIdx + 1];
      cursorX += tokenW + (nextTok ? gapBetween(token.word, nextTok.word) : 0);
    });
  });
}

export function renderProjectFrame(
  ctx: CanvasRenderingContext2D,
  project: LessonProject,
  time: number,
  selectedElementId?: string | null,
) {
  const palette = CANVAS_THEMES[project.theme] || CANVAS_THEMES['pastel-sunrise'];

  // 1. Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, STAGE_HEIGHT);
  bgGrad.addColorStop(0, palette.bgTop);
  bgGrad.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  // Soft ambient radial glows
  const glow1 = ctx.createRadialGradient(200, 320, 40, 200, 320, 560);
  glow1.addColorStop(0, palette.glowA);
  glow1.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  const glow2 = ctx.createRadialGradient(880, 1420, 40, 880, 1420, 620);
  glow2.addColorStop(0, palette.glowB);
  glow2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  // 2. Sort elements by zIndex
  const sorted = [...project.elements].sort((a, b) => a.layout.zIndex - b.layout.zIndex);

  for (const el of sorted) {
    const frame = computeElementFrameState(el, time);
    if (!frame.visible) continue;

    ctx.save();
    ctx.globalAlpha = frame.opacity;
    ctx.translate(el.layout.x, el.layout.y + frame.translateY);
    ctx.scale(frame.scale, frame.scale);

    switch (el.props.kind) {
      case 'comparison-strip':
        drawComparisonStrip(ctx, el.props, el.layout.width, time);
        break;
      case 'topic-pill':
        drawTopicPill(ctx, el.props);
        break;
      case 'illustration-prop':
        drawIllustrationProp(ctx, el.props, time);
        break;
      case 'sentence-card':
        drawSentenceCard(ctx, el.props, el.layout.width);
        break;
      case 'tone-meter':
        drawToneMeter(ctx, el.props, el.layout.width, time);
        break;
      case 'word-stack':
        drawWordStack(ctx, el.props, el.layout.width, time);
        break;
      case 'shape-3d':
        drawShape3D(ctx, el.props, el.layout.width, el.layout.height ?? 200);
        break;
      case 'karaoke-card':
        drawKaraokeCard(ctx, el.props, el.layout.width, time);
        break;
    }

    // Optional crisp selection guide on canvas when editing in studio
    if (selectedElementId && el.id === selectedElementId) {
      ctx.save();
      ctx.strokeStyle = '#4F46E5';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      const boxW = el.layout.width + 26;
      const boxH =
        el.type === 'shape-3d'
          ? (el.layout.height ?? 200) + 26
          : el.type === 'word-stack'
            ? 480
            : el.type === 'illustration-prop'
              ? 320
              : 170;
      drawRoundedRectPath(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 24);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

export function hitTestElements(
  elements: SceneElement[],
  canvasX: number,
  canvasY: number,
  time: number,
): SceneElement | null {
  const sorted = [...elements].sort((a, b) => b.layout.zIndex - a.layout.zIndex);
  for (const el of sorted) {
    const state = computeElementFrameState(el, time);
    if (!state.visible) continue;
    const halfW = (el.layout.width * state.scale) / 2;
    const halfH =
      el.type === 'shape-3d'
        ? ((el.layout.height ?? 200) * state.scale) / 2
        : el.type === 'word-stack'
          ? 230
          : el.type === 'illustration-prop'
            ? 160
            : 85;
    if (
      canvasX >= el.layout.x - halfW &&
      canvasX <= el.layout.x + halfW &&
      canvasY >= el.layout.y - halfH &&
      canvasY <= el.layout.y + halfH
    ) {
      return el;
    }
  }
  return null;
}
