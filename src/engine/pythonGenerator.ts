import { projectToWordsAndScenePlan } from './scenePlanAdapter';
import { CANVAS_THEMES, LessonProject } from './types';

export type VideoMakerFileName =
  | 'main.py'
  | 'loader.py'
  | 'renderer_shapes.py'
  | 'renderer_text.py'
  | 'renderer_subtitles.py'
  | 'timeline.py'
  | 'video_builder.py'
  | 'sample_words.json'
  | 'sample_scene.json'
  | 'requirements.txt'
  | 'README.md';

export function generatePythonProjectFiles(
  project: LessonProject,
): Record<VideoMakerFileName, string> {
  const palette = CANVAS_THEMES[project.theme] || CANVAS_THEMES['studio-slate'];
  const { wordsJson, scenePlan } = projectToWordsAndScenePlan(project);

  const sampleWordsStr = JSON.stringify(wordsJson, null, 2);
  const sampleSceneStr = JSON.stringify(scenePlan, null, 2);

  const loaderPy = `"""
loader.py — Đọc và kiểm tra dữ liệu đầu vào (audio, words.json, scene.json).
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple


def _parse_time_token(raw: str) -> float:
    parts = [float(p) for p in raw.strip().replace(",", ".").split(":")]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return parts[0]


def _tokenize_for_karaoke(text: str) -> List[str]:
    raw_tokens = [t for t in text.strip().split() if t]
    result: List[str] = []
    cjk_re = re.compile(r"[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff]")
    punct_split_re = re.compile(r"(?<=[。、！？「」,.!?])")
    for tok in raw_tokens:
        if not cjk_re.search(tok) or len(tok) <= 5:
            result.append(tok)
            continue
        clauses = [c for c in punct_split_re.split(tok) if c]
        for clause in clauses:
            if len(clause) <= 5:
                result.append(clause)
            else:
                for i in range(0, len(clause), 4):
                    result.append(clause[i : i + 4])
    return result or [text.strip()]


def load_transcript(transcript_path: str) -> List[Dict[str, Any]]:
    """Đọc file transcript (.json có word timestamps HOẶC file .txt dạng 00:00:00.000\\nText)."""
    path = Path(transcript_path)
    if not path.exists():
        raise FileNotFoundError(f"Không tìm thấy file transcript: {transcript_path}")

    raw_text = path.read_text(encoding="utf-8").strip()
    if raw_text.startswith("{") or raw_text.startswith("["):
        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"File transcript không đúng định dạng JSON: {exc}") from exc

        words = data.get("words") if isinstance(data, dict) else data
        if not isinstance(words, list) or len(words) == 0:
            raise ValueError("Transcript phải chứa danh sách 'words' không rỗng.")

        prev_start = -1.0
        normalized: List[Dict[str, Any]] = []
        for idx, item in enumerate(words):
            if "word" not in item or "start" not in item or "end" not in item:
                raise ValueError(f"Từ thứ {idx + 1} thiếu trường 'word', 'start' hoặc 'end'.")
            start = float(item["start"])
            end = max(float(item["end"]), start + 0.1)
            if start < prev_start:
                raise ValueError(f"Timestamp bị giảm ở từ #{idx + 1}: {start} < {prev_start}")
            prev_start = start
            normalized.append({"word": str(item["word"]).strip(), "start": start, "end": end})
        return normalized

    # Fallback: parse multi-line block timestamps (00:00:00.000\\nText)
    ts_re = re.compile(r"^\\[?(\\d{1,2}:\\d{2}(?::\\d{2})?(?:[.,]\\d+)?)\\]?$")
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    entries: List[Tuple[float, str]] = []
    i = 0
    while i < len(lines):
        m = ts_re.match(lines[i])
        if m:
            st = _parse_time_token(m.group(1))
            buf = []
            while i + 1 < len(lines) and not ts_re.match(lines[i + 1]):
                i += 1
                buf.append(lines[i])
            if buf:
                entries.append((st, " ".join(buf)))
        i += 1

    words_out: List[Dict[str, Any]] = []
    for idx, (st, text) in enumerate(entries):
        end = entries[idx + 1][0] - 0.05 if idx + 1 < len(entries) else st + 3.0
        end = max(end, st + 0.5)
        tokens = _tokenize_for_karaoke(text)
        weights = [max(2, len(t)) for t in tokens]
        w_sum = max(1, sum(weights))
        cursor = st
        for t_i, tok in enumerate(tokens):
            span = (weights[t_i] / w_sum) * (end - st)
            w_end = end if t_i == len(tokens) - 1 else cursor + span
            words_out.append({
                "word": tok,
                "start": round(cursor, 3),
                "end": round(w_end, 3),
            })
            cursor += span
    return words_out


def load_scene_plan(scene_path: str, word_count: int) -> Dict[str, Any]:
    """Đọc file JSON mô tả đồ họa (shapes/texts hoặc elements từ AI Prompt)."""
    path = Path(scene_path)
    if not path.exists():
        raise FileNotFoundError(f"Không tìm thấy file scene plan: {scene_path}")

    try:
        plan = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Scene plan không đúng định dạng JSON: {exc}") from exc

    if isinstance(plan.get("elements"), list) and "scenes" not in plan:
        plan = {"scenes": [{"id": "sc1", "elements": plan["elements"]}]}

    scenes = plan.get("scenes")
    if not isinstance(scenes, list):
        raise ValueError("Scene plan phải chứa mảng 'scenes' hoặc 'elements'.")

    for scene in scenes:
        for group_key in ("shapes", "texts"):
            for item in scene.get(group_key, []):
                at = int(item.get("at", 1))
                if word_count > 0 and (at < 1 or at > word_count):
                    raise ValueError(
                        f"Scene '{scene.get('id', '?')}' có giá trị at={at} nằm ngoài phạm vi [1, {word_count}]."
                    )
    return plan


def validate_audio_path(audio_path: str) -> Path:
    """Xác nhận file audio đầu vào tồn tại trên đĩa."""
    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"Không tìm thấy file audio: {audio_path}")
    return path
`;

  const rendererShapesPy = `"""
renderer_shapes.py — Vẽ các khối đồ họa 3D (card_3d, pill_3d, cube_3d, rect_3d, staircase_3d) bằng Pillow.
"""

from typing import Any, Dict, List, Optional, Tuple
from PIL import Image, ImageDraw, ImageFilter


def hex_to_rgba(hex_color: str, alpha: int = 255) -> Tuple[int, int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha


def adjust_brightness(rgba: Tuple[int, int, int, int], factor: float) -> Tuple[int, int, int, int]:
    r, g, b, a = rgba
    if factor >= 1.0:
        nr = int(min(255, r + (255 - r) * (factor - 1.0)))
        ng = int(min(255, g + (255 - g) * (factor - 1.0)))
        nb = int(min(255, b + (255 - b) * (factor - 1.0)))
    else:
        nr = int(max(0, r * factor))
        ng = int(max(0, g * factor))
        nb = int(max(0, b * factor))
    return nr, ng, nb, a


def _draw_soft_shadow(
    canvas: Image.Image,
    box: Tuple[int, int, int, int],
    radius: int,
    offset: Tuple[int, int] = (6, 12),
    alpha: int = 102,
):
    x0, y0, x1, y1 = box
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    ox, oy = offset
    draw.rounded_rectangle([x0 + ox, y0 + oy, x1 + ox, y1 + oy], radius=radius, fill=(0, 0, 0, alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    canvas.alpha_composite(shadow)


def draw_shape(
    canvas: Image.Image,
    shape: Dict[str, Any],
    opacity: float = 1.0,
    scale: float = 1.0,
    offset_y: float = 0.0,
) -> Tuple[int, int, int, int]:
    """Vẽ một shape 3D lên canvas và trả về bounding box (x0, y0, x1, y1) để căn chữ."""
    cw, ch = canvas.size
    pos = shape["position"]
    cx = int((pos["x"] + pos["w"] / 2.0) * cw)
    cy = int((pos["y"] + pos["h"] / 2.0) * ch + offset_y)
    w = max(20, int(pos["w"] * cw * scale))
    h = max(20, int(pos["h"] * ch * scale))
    x0, y0, x1, y1 = cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2

    shape_type = shape.get("type", "card_3d")
    fill_rgba = hex_to_rgba(shape.get("fill", "#14B8A6"))
    dark_rgba = adjust_brightness(fill_rgba, 0.72)
    light_rgba = adjust_brightness(fill_rgba, 1.32)
    has_shadow = bool(shape.get("shadow", True))
    has_highlight = bool(shape.get("highlight", True))
    depth = int(shape.get("depth", 10))
    corner_radius = int(shape.get("corner_radius", 28))

    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    if shape_type == "cube_3d":
        side = int(min(w, h) * 0.45)
        top_pt = (cx, cy - side)
        left_top = (cx - int(side * 0.9), cy - int(side * 0.45))
        right_top = (cx + int(side * 0.9), cy - int(side * 0.45))
        center_pt = (cx, cy)
        left_bot = (cx - int(side * 0.9), cy + int(side * 0.45))
        right_bot = (cx + int(side * 0.9), cy + int(side * 0.45))
        bottom_pt = (cx, cy + side)

        if has_shadow:
            _draw_soft_shadow(layer, (cx - side, cy, cx + side, cy + side), 24, offset=(0, 14), alpha=95)
            draw = ImageDraw.Draw(layer)
        draw.polygon([left_top, center_pt, bottom_pt, left_bot], fill=fill_rgba)
        draw.polygon([center_pt, right_top, right_bot, bottom_pt], fill=dark_rgba)
        draw.polygon([top_pt, right_top, center_pt, left_top], fill=light_rgba)

    elif shape_type == "staircase_3d":
        steps = 3
        gap = 16
        step_w = (w - gap * (steps - 1)) // steps
        for i in range(steps):
            ratio = 0.45 + i * 0.27
            sh = int(h * ratio)
            sx0 = x0 + i * (step_w + gap)
            sy0 = y1 - sh
            sx1 = sx0 + step_w
            sy1 = y1
            if has_shadow:
                _draw_soft_shadow(layer, (sx0, sy0, sx1, sy1), 18, offset=(4, 10), alpha=80)
                draw = ImageDraw.Draw(layer)
            if depth > 0:
                draw.rounded_rectangle([sx0, sy0 + depth, sx1, sy1 + depth], radius=18, fill=dark_rgba)
            draw.rounded_rectangle([sx0, sy0, sx1, sy1], radius=18, fill=fill_rgba)
            if has_highlight:
                draw.rounded_rectangle([sx0 + 6, sy0 + 3, sx1 - 6, sy0 + 14], radius=6, fill=light_rgba)

    else:
        radius = h // 2 if shape_type == "pill_3d" else (12 if shape_type == "rect_3d" else min(corner_radius, h // 2))
        if has_shadow:
            _draw_soft_shadow(layer, (x0, y0 + depth, x1, y1 + depth), radius, offset=(6, 12), alpha=95)
            draw = ImageDraw.Draw(layer)
        if depth > 0:
            draw.rounded_rectangle([x0, y0 + depth, x1, y1 + depth], radius=radius, fill=dark_rgba)
        draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill_rgba)
        if has_highlight:
            draw.line([(x0 + radius, y0 + 3), (x1 - radius, y0 + 3)], fill=light_rgba, width=4)

    if opacity < 0.99:
        alpha_ch = layer.getchannel("A").point(lambda a: int(a * opacity))
        layer.putalpha(alpha_ch)

    canvas.alpha_composite(layer)
    return (x0, y0, x1, y1)
`;

  const rendererTextPy = `"""
renderer_text.py — Vẽ chữ với size_role (display, headline, body, caption, label), weight và tự động xuống dòng.
"""

import os
from typing import Any, Dict, List, Optional, Tuple
from PIL import Image, ImageDraw, ImageFont
from renderer_shapes import hex_to_rgba

SIZE_MAP = {
    "display": 64,
    "headline": 48,
    "body": 36,
    "caption": 28,
    "label": 24,
}


def load_font(size: int, weight: str = "bold") -> ImageFont.FreeTypeFont:
    is_bold = weight in ("bold", "black", "semibold")
    candidates = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if is_bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansJP-Bold.otf" if is_bold else "/usr/share/fonts/truetype/noto/NotoSansJP-Regular.otf",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if is_bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if is_bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:\\\\Windows\\\\Fonts\\\\YuGothB.ttc" if is_bold else "C:\\\\Windows\\\\Fonts\\\\YuGothR.ttc",
        "C:\\\\Windows\\\\Fonts\\\\arialbd.ttf" if is_bold else "C:\\\\Windows\\\\Fonts\\\\arial.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size=size)
    return ImageFont.load_default()


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> List[str]:
    words = text.split()
    if not words:
        return []
    lines: List[str] = []

    def push_word(w: str):
        if draw.textlength(w, font=font) <= max_width:
            lines.append(w)
            return
        buf = ""
        for ch in w:
            nxt = buf + ch
            if draw.textlength(nxt, font=font) <= max_width or not buf:
                buf = nxt
            else:
                lines.append(buf)
                buf = ch
        if buf:
            lines.append(buf)

    current = ""
    for w in words:
        if not current:
            if draw.textlength(w, font=font) <= max_width:
                current = w
            else:
                push_word(w)
                current = lines.pop() if lines else ""
            continue
        candidate = f"{current} {w}"
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            if draw.textlength(w, font=font) <= max_width:
                current = w
            else:
                push_word(w)
                current = lines.pop() if lines else ""
    if current:
        lines.append(current)
    return lines


def draw_text_block(
    canvas: Image.Image,
    text_spec: Dict[str, Any],
    target_box: Optional[Tuple[int, int, int, int]] = None,
    opacity: float = 1.0,
    offset_y: float = 0.0,
):
    """Vẽ text lên shape (nếu có target_box) hoặc theo position tuyệt đối."""
    cw, ch = canvas.size
    style = text_spec.get("style", {})
    size_role = style.get("size", "headline")
    weight = style.get("weight", "bold")
    color = hex_to_rgba(style.get("color", "#FFFFFF"))
    align = style.get("align", "center")

    font = load_font(SIZE_MAP.get(size_role, 44), weight=weight)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    if target_box is not None:
        x0, y0, x1, y1 = target_box
        max_w = max(80, (x1 - x0) - 64)
        cx = (x0 + x1) // 2
        cy = (y0 + y1) // 2 + int(offset_y)
    else:
        pos = text_spec.get("position", {"x": 0.5, "y": 0.45, "w": 0.8})
        max_w = int(pos.get("w", 0.8) * cw)
        cx = int(pos.get("x", 0.5) * cw)
        cy = int(pos.get("y", 0.45) * ch + offset_y)

    lines = wrap_text(draw, str(text_spec.get("content", "")), font, max_w)
    line_h = int(SIZE_MAP.get(size_role, 44) * 1.26)
    start_y = cy - ((len(lines) - 1) * line_h) // 2

    for idx, line in enumerate(lines):
        ly = start_y + idx * line_h
        if align == "left" and target_box is not None:
            draw.text((target_box[0] + 32, ly), line, font=font, fill=color, anchor="lm")
        elif align == "right" and target_box is not None:
            draw.text((target_box[2] - 32, ly), line, font=font, fill=color, anchor="rm")
        else:
            draw.text((cx, ly), line, font=font, fill=color, anchor="mm")

    if opacity < 0.99:
        alpha_ch = layer.getchannel("A").point(lambda a: int(a * opacity))
        layer.putalpha(alpha_ch)

    canvas.alpha_composite(layer)
`;

  const rendererSubtitlesPy = `"""
renderer_subtitles.py — Vẽ phụ đề karaoke cuối màn hình, highlight từ đang đọc màu vàng #FACC15.
"""

from typing import Any, Dict, List
from PIL import Image, ImageDraw
from renderer_shapes import hex_to_rgba
from renderer_text import load_font


def group_words_into_lines(words: List[Dict[str, Any]], max_words: int = 6) -> List[List[Dict[str, Any]]]:
    groups: List[List[Dict[str, Any]]] = []
    bucket: List[Dict[str, Any]] = []
    for idx, w in enumerate(words):
        bucket.append(w)
        ends_sent = w["word"].endswith((".", "!", "?"))
        gap = (words[idx + 1]["start"] - w["end"]) if idx + 1 < len(words) else 0.0
        if len(bucket) >= max_words or ends_sent or gap > 0.65 or idx == len(words) - 1:
            groups.append(bucket)
            bucket = []
    return groups


def draw_karaoke_subtitle(
    canvas: Image.Image,
    words: List[Dict[str, Any]],
    time_sec: float,
    active_hex: str = "#FACC15",
):
    """Hiển thị 1–2 dòng phụ đề ở vùng y = 0.85..0.95 trên nền tối mờ 70%."""
    groups = group_words_into_lines(words)
    active_group = None
    for grp in groups:
        if grp[0]["start"] - 0.05 <= time_sec <= grp[-1]["end"] + 0.15:
            active_group = grp
            break
    if not active_group:
        return

    cw, ch = canvas.size
    font = load_font(44, weight="bold")
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    max_line_w = int(cw * 0.82)
    space_w = max(14.0, draw.textlength(" ", font=font) * 1.45)

    # Tự động ngắt dòng và phân trang tối đa 2 dòng để không che phần giữa
    all_lines: List[List[Dict[str, Any]]] = []
    cur_line: List[Dict[str, Any]] = []
    cur_w = 0.0
    for token in active_group:
        tw = draw.textlength(token["word"], font=font)
        next_w = tw if not cur_line else cur_w + space_w + tw
        if next_w > max_line_w and cur_line:
            all_lines.append(cur_line)
            cur_line = [token]
            cur_w = tw
        else:
            cur_line.append(token)
            cur_w = next_w
    if cur_line:
        all_lines.append(cur_line)

    pages: List[List[List[Dict[str, Any]]]] = [
        all_lines[i : i + 2] for i in range(0, len(all_lines), 2)
    ] or [all_lines]
    lines = pages[-1]
    for page in pages:
        if time_sec <= page[-1][-1]["end"] + 0.02:
            lines = page
            break

    line_h = 62
    box_w = int(cw * 0.88)
    box_h = max(126, len(lines) * line_h + 54)
    cy = int(ch * 0.88)
    x0, y0, x1, y1 = cw // 2 - box_w // 2, cy - box_h // 2, cw // 2 + box_w // 2, cy + box_h // 2

    # Nền đen mờ ~75% để dễ đọc trên mọi nền
    draw.rounded_rectangle([x0, y0, x1, y1], radius=28, fill=(15, 23, 42, 196))

    active_rgba = hex_to_rgba(active_hex)
    spoken_rgba = (255, 255, 255, 255)
    unread_rgba = (203, 213, 225, 230)

    start_y = cy - ((len(lines) - 1) * line_h) // 2
    for l_idx, ln_tokens in enumerate(lines):
        total_lw = sum(draw.textlength(t["word"], font=font) for t in ln_tokens) + space_w * max(0, len(ln_tokens) - 1)
        lx = cw / 2 - total_lw / 2
        ly = start_y + l_idx * line_h
        for token in ln_tokens:
            is_active = token["start"] <= time_sec <= token["end"]
            is_spoken = time_sec > token["end"]
            col = active_rgba if is_active else (spoken_rgba if is_spoken else unread_rgba)
            draw.text((lx, ly), token["word"], font=font, fill=col, anchor="lm")
            lx += draw.textlength(token["word"], font=font) + space_w

    canvas.alpha_composite(layer)
`;

  const timelinePy = `"""
timeline.py — Ánh xạ chỉ số at sang timestamp thực từ words.json và tính toán hiệu ứng fade_in / slide_up / scale_in.
"""

from typing import Any, Dict, List, Tuple


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def ease_out_cubic(t: float) -> float:
    x = clamp01(t)
    return 1.0 - (1.0 - x) ** 3


def _resolve_time_value(raw: Any, fallback: float) -> float:
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        s = raw.strip().replace(",", ".")
        if ":" in s:
            parts = [float(p) for p in s.split(":")]
            if len(parts) == 3:
                return parts[0] * 3600 + parts[1] * 60 + parts[2]
            if len(parts) == 2:
                return parts[0] * 60 + parts[1]
        try:
            return float(s)
        except ValueError:
            return fallback
    return fallback


def resolve_timeline_items(
    words: List[Dict[str, Any]],
    scene_plan: Dict[str, Any],
    total_duration: float,
) -> List[Dict[str, Any]]:
    """Chuyển đổi danh sách scenes (cả shapes/texts lẫn elements từ AI Prompt) thành start_time/end_time."""
    scenes = scene_plan.get("scenes", [])
    scene_starts: List[float] = []
    for sc in scenes:
        ats = [
            int(item.get("at", 1))
            for item in (sc.get("shapes", []) + sc.get("texts", []))
        ]
        min_at = min(ats) if ats else 1
        w = words[min(len(words) - 1, max(0, min_at - 1))] if words else {"start": 0.0}
        scene_starts.append(float(w["start"]))

    resolved_scenes: List[Dict[str, Any]] = []
    for sc_idx, sc in enumerate(scenes):
        sc_start = scene_starts[sc_idx]
        sc_end = scene_starts[sc_idx + 1] if sc_idx + 1 < len(scenes) else total_duration
        sc_end = max(sc_start + 0.5, sc_end)

        shapes_out = []
        texts_out = []

        # Hỗ trợ định dạng linh hoạt elements[] từ AI Prompt
        for el in sc.get("elements", []):
            st = _resolve_time_value(el.get("start"), sc_start)
            en = max(st + 0.4, _resolve_time_value(el.get("end"), st + 3.5))
            el_type = el.get("type", "")
            cy = float(el.get("y", 960))
            if cy <= 1.0:
                cy *= 1920.0
            y_norm = max(0.05, min(0.85, (cy / 1920.0) - 0.06))

            if el_type in ("sentence_card", "sentence-card"):
                sh_idx = len(shapes_out)
                shapes_out.append({
                    "_index": sh_idx,
                    "type": "card_3d",
                    "position": {"x": 0.1, "y": y_norm, "w": 0.8, "h": 0.11},
                    "fill": "#FEE2E2" if el.get("badge") == "cross" else "#FFFFFF",
                    "shadow": True,
                    "highlight": True,
                    "depth": 8,
                    "start_time": st,
                    "end_time": en,
                })
                texts_out.append({
                    "content": el.get("text", ""),
                    "shape_index": sh_idx,
                    "style": {
                        "size": "headline",
                        "color": "#991B1B" if el.get("badge") == "cross" else "#0F172A",
                        "weight": "bold",
                    },
                    "start_time": st,
                    "end_time": en,
                })
            elif el_type in ("topic_pill", "topic-pill"):
                sh_idx = len(shapes_out)
                shapes_out.append({
                    "_index": sh_idx,
                    "type": "pill_3d",
                    "position": {"x": 0.25, "y": y_norm, "w": 0.5, "h": 0.055},
                    "fill": el.get("bgColor", "#DDD6FE"),
                    "shadow": True,
                    "highlight": True,
                    "depth": 5,
                    "start_time": st,
                    "end_time": en,
                })
                texts_out.append({
                    "content": el.get("text", ""),
                    "shape_index": sh_idx,
                    "style": {"size": "body", "color": el.get("textColor", "#4338CA"), "weight": "bold"},
                    "start_time": st,
                    "end_time": en,
                })
            elif el_type in ("staircase_3d", "card_3d", "pill_3d", "cube_3d", "rect_3d"):
                sh_idx = len(shapes_out)
                h_norm = 0.24 if el_type == "staircase_3d" else 0.14
                shapes_out.append({
                    "_index": sh_idx,
                    "type": el_type,
                    "position": {"x": 0.12, "y": max(0.08, (cy / 1920.0) - h_norm / 2), "w": 0.76, "h": h_norm},
                    "fill": el.get("fill", "#F59E0B"),
                    "shadow": True,
                    "highlight": True,
                    "depth": int(el.get("depth", 12)),
                    "step_labels": el.get("step_labels") or el.get("stepLabels"),
                    "start_time": st,
                    "end_time": en,
                })
                if el.get("text"):
                    texts_out.append({
                        "content": el.get("text"),
                        "shape_index": sh_idx,
                        "style": {"size": "headline", "color": el.get("textColor", "#FFFFFF"), "weight": "bold"},
                        "start_time": st,
                        "end_time": en,
                    })

        for sh in sc.get("shapes", []):
            s_idx = len(shapes_out)
            at = int(sh.get("at", 1))
            start_t = float(words[min(len(words) - 1, max(0, at - 1))]["start"]) if words else 0.0
            until = sh.get("until")
            end_t = float(words[min(len(words) - 1, max(0, int(until) - 1))]["end"]) if (until and words) else sc_end
            shapes_out.append({**sh, "_index": s_idx, "start_time": start_t, "end_time": max(start_t + 0.3, end_t)})

        for tx in sc.get("texts", []):
            at = int(tx.get("at", 1))
            start_t = float(words[min(len(words) - 1, max(0, at - 1))]["start"]) if words else 0.0
            until = tx.get("until")
            end_t = float(words[min(len(words) - 1, max(0, int(until) - 1))]["end"]) if (until and words) else sc_end
            texts_out.append({**tx, "start_time": start_t, "end_time": max(start_t + 0.3, end_t)})

        resolved_scenes.append({"id": sc.get("id", f"sc{sc_idx+1}"), "shapes": shapes_out, "texts": texts_out})

    return resolved_scenes


def compute_anim_state(
    start_time: float,
    end_time: float,
    time_sec: float,
    fade_dur: float = 0.35,
    mode: str = "slide_up",
) -> Tuple[bool, float, float, float]:
    """Trả về (visible, opacity, scale, offset_y) cho frame tại time_sec."""
    if time_sec < start_time or time_sec > end_time:
        return False, 0.0, 1.0, 0.0

    elapsed = time_sec - start_time
    remaining = end_time - time_sec
    opacity = 1.0
    scale = 1.0
    offset_y = 0.0

    if elapsed < fade_dur:
        p = ease_out_cubic(elapsed / fade_dur)
        opacity = p
        if mode == "slide_up":
            offset_y = (1.0 - p) * 32.0
        elif mode == "scale_in":
            scale = 0.85 + 0.15 * p
    elif remaining < 0.22:
        opacity = ease_out_cubic(remaining / 0.22)

    return opacity > 0.01, clamp01(opacity), scale, offset_y
`;

  const videoBuilderPy = `"""
video_builder.py — Dựng frame 1080x1920 bằng Pillow và xuất MP4 H.264/AAC qua MoviePy.
"""

from typing import Any, Dict, List
import numpy as np
from PIL import Image

try:
    # MoviePy 2.x
    from moviepy import AudioFileClip, VideoClip
except ImportError:
    # MoviePy 1.x
    from moviepy.editor import AudioFileClip, VideoClip

from renderer_shapes import draw_shape, hex_to_rgba
from renderer_subtitles import draw_karaoke_subtitle
from renderer_text import draw_text_block
from timeline import compute_anim_state, resolve_timeline_items


def create_gradient_background(width: int, height: int, top_hex: str = "${palette.bgTop}", bot_hex: str = "${palette.bgBottom}") -> Image.Image:
    top = np.array(hex_to_rgba(top_hex)[:3], dtype=np.float32)
    bot = np.array(hex_to_rgba(bot_hex)[:3], dtype=np.float32)
    t = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None, None]
    grad = (top * (1.0 - t) + bot * t).astype(np.uint8)
    arr = np.repeat(grad, width, axis=1)
    return Image.fromarray(arr, mode="RGB").convert("RGBA")


def build_video(
    audio_path: str,
    words: List[Dict[str, Any]],
    scene_plan: Dict[str, Any],
    output_path: str,
    width: int = 1080,
    height: int = 1920,
    fps: int = 30,
):
    audio_clip = AudioFileClip(audio_path)
    duration = max(float(audio_clip.duration), float(words[-1]["end"]) + 0.4)
    resolved_scenes = resolve_timeline_items(words, scene_plan, duration)
    bg_base = create_gradient_background(width, height)

    def make_frame(t: float) -> np.ndarray:
        frame = bg_base.copy()

        for scene in resolved_scenes:
            shape_boxes: Dict[int, Any] = {}
            for sh in scene["shapes"]:
                vis, op, sc, oy = compute_anim_state(sh["start_time"], sh["end_time"], t, mode="slide_up")
                if not vis:
                    continue
                box = draw_shape(frame, sh, opacity=op, scale=sc, offset_y=oy)
                shape_boxes[sh["_index"]] = (box, op, oy)

            for tx in scene["texts"]:
                vis, op, _sc, oy = compute_anim_state(tx["start_time"], tx["end_time"], t, mode="slide_up")
                if not vis:
                    continue
                sh_idx = tx.get("shape_index")
                target_box = shape_boxes[sh_idx][0] if sh_idx in shape_boxes else None
                draw_text_block(frame, tx, target_box=target_box, opacity=op, offset_y=oy)

        draw_karaoke_subtitle(frame, words, t, active_hex="#FACC15")
        return np.array(frame.convert("RGB"))

    clip = VideoClip(make_frame, duration=duration)
    if hasattr(clip, "with_audio"):
        clip = clip.with_audio(audio_clip)
    else:
        clip = clip.set_audio(audio_clip)

    clip.write_videofile(
        output_path,
        fps=fps,
        codec="libx264",
        audio_codec="aac",
        audio_bitrate="192k",
        ffmpeg_params=["-crf", "23", "-pix_fmt", "yuv420p"],
    )
    audio_clip.close()
`;

  const mainPy = `"""
main.py — Điểm vào CLI của ứng dụng video_maker.
Chạy mẫu:
    python main.py --audio input.mp3 --transcript sample_words.json --scene-plan sample_scene.json --output output.mp4
"""

import argparse
from loader import load_scene_plan, load_transcript, validate_audio_path
from video_builder import build_video


def main():
    parser = argparse.ArgumentParser(description="Video Maker 9:16 (3D Shapes + Karaoke)")
    parser.add_argument("--audio", required=True, help="Đường dẫn file audio (.mp3, .wav, .m4a)")
    parser.add_argument("--transcript", default="sample_words.json", help="File JSON timestamp từng từ")
    parser.add_argument("--scene-plan", default="sample_scene.json", help="File JSON mô tả shapes và texts")
    parser.add_argument("--output", default="output.mp4", help="Đường dẫn file MP4 đầu ra")
    parser.add_argument("--fps", type=int, default=${project.fps}, help="Số khung hình/giây (mặc định: ${project.fps})")
    args = parser.parse_args()

    audio_file = validate_audio_path(args.audio)
    words = load_transcript(args.transcript)
    scene_plan = load_scene_plan(args.scene_plan, len(words))

    build_video(
        audio_path=str(audio_file),
        words=words,
        scene_plan=scene_plan,
        output_path=args.output,
        fps=args.fps,
    )
    print(f"Hoàn tất xuất video: {args.output}")


if __name__ == "__main__":
    main()
`;

  const requirementsTxt = `Pillow>=10.3.0
moviepy>=1.0.3
numpy>=1.26.0
imageio-ffmpeg>=0.5.1
`;

  const readmeMd = `# video_maker — Ứng dụng Python tạo video giảng dạy 9:16

Dự án được chia module theo chuẩn:
- \`loader.py\`: Đọc & kiểm tra audio, \`words.json\`, \`scene.json\`.
- \`renderer_shapes.py\`: Vẽ \`card_3d\`, \`pill_3d\`, \`cube_3d\`, \`rect_3d\`, \`staircase_3d\` với shadow GaussianBlur, highlight và depth.
- \`renderer_text.py\`: Hỗ trợ \`display\`, \`headline\`, \`body\`, \`caption\`, \`label\` và tự động xuống dòng.
- \`renderer_subtitles.py\`: Phụ đề karaoke highlight từng từ (\`#FACC15\`).
- \`timeline.py\`: Đồng bộ \`at\` với \`words[at-1].start\` và hiệu ứng fade-in / slide-up.
- \`video_builder.py\`: Ghép frame với \`MoviePy\` + xuất MP4 H.264 / AAC 1080×1920.
- \`sample_words.json\` & \`sample_scene.json\`: Dữ liệu được xuất trực tiếp từ dự án **${project.title}** trong KineticSub Studio.

## Cài đặt & chạy thử

\`\`\`bash
pip install -r requirements.txt
python main.py --audio ${project.audioFileName || 'input.mp3'} --transcript sample_words.json --scene-plan sample_scene.json --output output.mp4
\`\`\`
`;

  return {
    'main.py': mainPy,
    'loader.py': loaderPy,
    'renderer_shapes.py': rendererShapesPy,
    'renderer_text.py': rendererTextPy,
    'renderer_subtitles.py': rendererSubtitlesPy,
    'timeline.py': timelinePy,
    'video_builder.py': videoBuilderPy,
    'sample_words.json': sampleWordsStr,
    'sample_scene.json': sampleSceneStr,
    'requirements.txt': requirementsTxt,
    'README.md': readmeMd,
  };
}
