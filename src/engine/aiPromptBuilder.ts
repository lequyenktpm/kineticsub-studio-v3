import { LAYOUT_COMPOSITIONS } from './illustrationLayouts';
import { formatTimeToken } from './transcriptParser';
import { LayoutCompositionId, TranscriptCue } from './types';

export type PromptVideoStyle = 'tiktok-cards' | '3d-shapes' | 'word-reveal-dark';

export function buildSceneGenerationPrompt(
  cues: TranscriptCue[],
  options?: {
    title?: string;
    style?: PromptVideoStyle;
    compositionId?: LayoutCompositionId | 'ai-decide';
  },
): string {
  const style = options?.style ?? 'tiktok-cards';
  const is3D = style === '3d-shapes';
  const isWordReveal = style === 'word-reveal-dark';
  const aiDecideComposition = options?.compositionId === 'ai-decide';

  const totalStart = cues.length > 0 ? formatTimeToken(cues[0].start) : '00:00:00.000';
  const totalEnd =
    cues.length > 0 ? formatTimeToken(cues[cues.length - 1].end + 0.4) : '00:00:30.000';

  const compMeta =
    !aiDecideComposition && options?.compositionId
      ? LAYOUT_COMPOSITIONS.find((c) => c.id === options.compositionId)
      : undefined;

  // ── Style guide block ──────────────────────────────────────────────────────
  let styleGuide: string;

  if (isWordReveal) {
    styleGuide = `PHONG CÁCH WORD-REVEAL TỐI (@xun52000 — nền đen, chữ trắng/vàng hiện dần):
- Đặt "theme": "studio-slate" (nền tối #0F172A → #1E293B).
- KHÔNG dùng comparison_strip / topic_pill / illustration / tone_meter.
- Mỗi câu thoại → 1 "sentence_card" to, căn giữa (y ≈ 850), nền trong suốt hoặc gradient tối nhẹ.
  - "text": câu chính (tiếng Anh / ngoại ngữ), font cực lớn, "emphasisWord": từ trọng tâm, "emphasisColor": "#FACC15".
  - "subtext": nghĩa / phonetic nhỏ hơn phía dưới.
  - Dùng enterAnimation "fade-scale" hoặc "pop-up" ngắn ≤ 0.3s.
- Có thể thêm "word_stack" (y ≈ 650) cho các bài đối chiếu nhiều dạng (formal / casual / slang).
- Vùng karaoke (y ≥ 1450) vẫn để app tự render — KHÔNG đặt phần tử tại đây.
- "staircase_3d" (y ≈ 780, fill="#FACC15") được dùng khi liệt kê 3 cấp độ / bước.`;
  } else if (is3D) {
    styleGuide = `PHONG CÁCH 3D NỔI + KARAOKE ĐẬM:
- Đặt "theme": "studio-slate" (nền tối hiện đại, chữ karaoke vàng #FACC15).
- Ưu tiên dùng "card_3d", "pill_3d", "cube_3d", "staircase_3d" làm điểm nhấn chính ở Vùng C & Vùng D.`;
  } else if (aiDecideComposition) {
    // AI tự quyết định phong cách phối tối ưu dựa trên nội dung
    const compositionList = LAYOUT_COMPOSITIONS.map(
      (c) => `  - "${c.id}" → ${c.name}: ${c.description} (theme: ${c.recommendedTheme}, signature: ${c.signatureVariant})`,
    ).join('\n');

    styleGuide = `PHONG CÁCH TIKTOK GIẢNG DẠY (@englishpracticing168) — CHẾ ĐỘ AI TỰ CHỌN PHỐI TỐI ƯU (KHÔNG RANDOM):

**NHIỆM VỤ BỔ SUNG**: Đọc toàn bộ transcript, nhận diện mô típ bài (đối chiếu 2–3 từ gần nghĩa, nâng cấp câu, đồng hồ/giờ, hội thoại đời sống, checklist đúng/sai...), rồi chọn ĐÚNG 1 id dưới đây:
${compositionList}

Quy tắc chọn (ưu tiên từ trên xuống):
- Bài đối chiếu 2–3 từ gần nghĩa (Look/See/Watch, Say/Tell/Talk, Hear/Listen...) → "phrase-icon-split"
- Có giờ / clock / o'clock → "clock-spotlight"
- Nâng cấp câu boring → natural / don't say → "dialogue-upgrade"
- Các bước 1-2-3 / ladder → "flow-steps"
- Sắc thái polite/rude → "gauge-tone"
- Cảnh đời sống quán/công sở/bạn bè → "story-scenes"

Cách "tạo phong cách mới" AN TOÀN (không được linh tinh):
- KHÔNG invent type, variant, hay toạ độ ngoài 5 vùng.
- Chỉ được remix nội dung trong 1 compositionId: pill labels, icon trung tâm (tv/eye/watch/listen/walk/phone), câu quote, highlightWord, màu pastel.
- 1 bài = 1 signature illustration. Không chồng 3 sơ đồ khác nhau trong cùng 1 cảnh.

Sau khi chọn:
1. \`"compositionId": "<id đã chọn>"\`
2. \`"compositionReason": "<1 câu, nêu đúng mô típ transcript>"\`
3. Theme = theme khuyến nghị của kiểu phối.
4. Điền data sát chữ trong bài (đặc biệt phrase-icon-split: nodes, speechText, highlightWord, sceneIcon).`;
  } else {
    styleGuide = `PHONG CÁCH TIKTOK GIẢNG DẠY (@englishpracticing168)${compMeta ? ` — KIỂU PHỐI: ${compMeta.name}` : ''}:
- Đặt "theme": "${compMeta?.recommendedTheme ?? 'pastel-sunrise'}" (hoặc "soft-lavender" / "mint-breeze" / "warm-paper").
- Kết hợp thanh đối chiếu trên cùng ("comparison_strip"), nhãn ngữ cảnh ("topic_pill"), hình minh họa/sơ đồ sát ngữ cảnh (${compMeta ? `ưu tiên "${compMeta.signatureVariant}"` : 'đa dạng'}), thẻ câu nổi bật ("sentence_card"), bậc thang 3D ("staircase_3d"), và thanh sắc thái ("tone_meter").`;
  }

  const transcriptLines = cues
    .map(
      (cue, idx) =>
        `[Cue ${idx + 1} | ${formatTimeToken(cue.start)} -> ${formatTimeToken(cue.end)}] ${cue.text}`,
    )
    .join('\n');

  const extraOutputFields = aiDecideComposition
    ? `  "compositionId": "story-scenes",\n  "compositionReason": "...",\n  `
    : '  ';

  return `# VAI TRÒ
Bạn là Đạo diễn Motion Graphics tự động cho video dọc 9:16 (1080×1920).
Người dùng **KHÔNG tự thiết kế**. JSON do bạn sinh ra là **xương sống điều khiển toàn bộ chữ, hình minh họa, khối 3D và hiệu ứng ẩn/hiện** đồng bộ 100% với Audio + Transcript dưới đây.

# NHIỆM VỤ
Phân tích toàn bộ ${cues.length} câu thoại từ \`${totalStart}\` đến \`${totalEnd}\` và trả về **DUY NHẤT 1 KHỐI JSON HỢP LỆ** (không giải thích ngoài JSON) để app tự động dựng thành video hoàn chỉnh.

# ${styleGuide}
Tiêu đề bài học: "${options?.title || 'Language Lesson'}"

# HỆ THỐNG 5 VÙNG BỐ CỤC CHỐNG CHỒNG ĐÈ (BẮT BUỘC)
Khung hình rộng 1080 × cao 1920. Mọi phần tử chỉ được đặt đúng vùng Y tương ứng:
- **Vùng A (y = 185)** — \`comparison_strip\`: Thanh 2–4 mục chính xuyên suốt bài (tự sáng viền theo \`activateAt\`).
- **Vùng B (y = 335)** — \`topic_pill\`: Nhãn tiêu đề phần hiện tại (VD: \`"Picture this"\`, \`"1. Casual"\`, \`"Pro Tip"\`, \`"Quiz"\`).
- **Vùng C (y = 620)** — \`illustration\` / \`staircase_3d\` / \`word_stack\` / \`cube_3d\`: Hình minh họa hoặc sơ đồ trung tâm.
- **Vùng D (y = 970)** — \`sentence_card\` / \`card_3d\`: Câu ví dụ hoặc từ khóa cần nhấn mạnh (tách câu mục tiêu ra thẻ to rõ).
- **Vùng E (y = 1215)** — \`tone_meter\`: Thanh trượt sắc thái/mức độ (khi có sự so sánh trái-phải).
- **VÙNG CẤM (y = 1450..1850)**: Chừa trống hoàn toàn — app tự render phụ đề karaoke highlight từng từ tại đây.

# TỪ ĐIỂN ELEMENT ĐƯỢC HỖ TRỢ TRONG \`elements[]\`
1. \`comparison_strip\`:
   \`{ "type": "comparison_strip", "start": "HH:MM:SS.mmm", "end": "HH:MM:SS.mmm", "y": 185, "items": [{ "label": "...", "sublabel": "...", "activateAt": "HH:MM:SS.mmm", "accentColor": "#2563EB" }] }\`
2. \`topic_pill\`:
   \`{ "type": "topic_pill", "start": "...", "end": "...", "y": 335, "text": "...", "bgColor": "#DDD6FE", "textColor": "#4338CA" }\`
3. \`illustration\` (CHỌN \`variant\` SÁT NGHĨA VỚI CÂU THOẠI TẠI MỐC ĐÓ, không chọn bừa):
   - Cảnh đời sống: \`"cafe-water"\` (quán nước), \`"coffee-cup"\` (cà phê), \`"friends-chat"\` (bạn bè), \`"office-work"\` (công sở/sếp/lịch), \`"hotel-desk"\` (khách sạn/lễ tân), \`"lightbulb-tip"\` (mẹo hay), \`"ear-listen"\` (luyện nghe/quiz), \`"speech-bubble"\` (hội thoại), \`"pronunciation-wave"\` (sóng âm).
   - Sơ đồ & Infographic chuẩn @englishpracticing168 (hỗ trợ truyền \`data\` chứa đúng chữ trong bài):
     + \`"flow-diagram"\`: Sơ đồ 3 nút tròn nối mũi tên (\`data: { nodes: [{ label, icon: "clock"|"rocket"|"chat"|"check"|"star", color }] }\`)
     + \`"gauge-arc"\`: Đồng hồ bán nguyệt 5 mức + emoji (\`data: { value: 0..1, subtitle: "Polite" }\`)
     + \`"timeline-track"\`: Đường chạy tiến trình (\`data: { value: 0..1, labels: ["Early","On time","Late"] }\`)
     + \`"checklist-card"\`: Thẻ checklist ✔/✘ (\`data: { title: "Examples", checklist: [{ text, ok: true|false }] }\`)
     + \`"dialogue-upgrade"\`: Bảng nâng cấp câu (\`data: { upgrades: [{ prompt, upgrade, badgeColor }] }\`)
     + \`"clock-face"\`: Đồng hồ kim chỉ giờ (\`data: { timeHour: 8, timeMinute: 20, formula: "8:20", subtitle: "twenty past eight" }\`)
     + \`"spatial-boxes"\`: 3 hộp icon đối chiếu (\`data: { boxes: [{ title, subtitle, icon: "dot"|"surface"|"cube", accent }] }\`)
     + \`"avatar-speech"\`: Nhân vật kèm bóng thoại (\`data: { speechText, reactionText }\`)
     + \`"phrase-icon-split"\`: Câu quote lớn + icon giữa câu + pill từ cuối (\`data: { nodes: [{ label: "LOOK", sublabel: "on purpose" }], speechText: "I see TV every", highlightWord: "night.", sceneIcon: "tv", subtitle: "I see TV every night = wrong" }\`)
   \`{ "type": "illustration", "variant": "cafe-water", "start": "...", "end": "...", "y": 635 }\`
4. \`sentence_card\`:
   \`{ "type": "sentence_card", "start": "...", "end": "...", "y": 985, "text": "Could I have some water, please?", "subtext": "Ghi chú ngắn hoặc nghĩa (tùy chọn)", "badge": "check", "emphasisWord": "Could I", "emphasisColor": "#16A34A", "stampText": "" }\`
   (\`badge\`: \`"check"\` | \`"cross"\` | \`"question"\` | \`"none"\`; \`stampText\` dùng cho thẻ sai/cần tránh như \`"RUDE"\`)
5. \`word_stack\`: Xếp chồng 2–4 dòng đối chiếu:
   \`{ "type": "word_stack", "start": "...", "end": "...", "y": 680, "rows": [{ "prefix": "Can ", "suffix": "I...", "suffixColor": "#2563EB", "appearAt": "00:00:11.960", "phonetic": "Casual" }] }\`
6. \`staircase_3d\`: Bậc thang 3 cấp 3D:
   \`{ "type": "staircase_3d", "start": "...", "end": "...", "y": 780, "fill": "#F59E0B", "step_labels": ["Can", "Could", "May"] }\`
7. \`tone_meter\`: Thanh trượt sắc thái:
   \`{ "type": "tone_meter", "start": "...", "end": "...", "y": 1245, "title": "TONE", "leftLabel": "rude", "rightLabel": "polite", "valueStart": 0.5, "valueEnd": 0.14 }\`
8. \`card_3d\` / \`pill_3d\` / \`cube_3d\`: Khối 3D nổi có chữ (\`text\`, \`fill\`, \`textColor\`, \`depth\`).

# QUY TẮC DÀN CẢNH TỰ ĐỘNG BẮT BUỘC
1. **Phủ kín 100% thời lượng**: Từ \`${totalStart}\` đến \`${totalEnd}\`, luôn có ít nhất 1–2 thành phần thị giác đang hiển thị phù hợp với nội dung đang nói (không để màn hình trống > 1.5s).
2. **Không bao giờ chồng đè**: Trong cùng 1 vùng (B, C, D, hoặc E), phần tử cũ phải có \`end <= start\` của phần tử tiếp theo trong cùng vùng đó.
3. **Bắt đúng câu ví dụ**: Bất kỳ câu mẫu/cụm từ trọng tâm nào trong transcript (đặc biệt các câu tiếng Anh/ngoại ngữ hoặc câu nằm trong ngoặc) phải xuất hiện trên \`sentence_card\` đúng lúc Audio đọc đến cue đó.
4. **Định dạng đầu ra**: Chỉ trả về 1 object JSON theo mẫu sau:

\`\`\`json
{
  "title": "${options?.title || 'Language Lesson'}",
  "theme": "${isWordReveal ? 'studio-slate' : is3D ? 'studio-slate' : 'pastel-sunrise'}",
  ${extraOutputFields}"scenes": [
    {
      "id": "sc1",
      "elements": [
        { "type": "comparison_strip", "start": "${totalStart}", "end": "${totalEnd}", "y": 185, "items": [] }
      ]
    }
  ]
}
\`\`\`

# TRANSCRIPT CẦN CHUYỂN THÀNH VIDEO JSON
${transcriptLines}`;
}
