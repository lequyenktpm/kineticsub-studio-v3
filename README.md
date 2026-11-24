# KineticSub Studio — Trình tạo Video TikTok Tự động hoá bằng AI

Ứng dụng tạo video ngắn dọc 9:16 (1080×1920) tự động đồng bộ phụ đề Karaoke kinetic và thẻ minh họa trực quan từ Audio & Transcript.

## 🚀 Tính năng mới cập nhật (v3)

1. **Xuất Prompt ZIP cho AI Web (Không cần API)**:
   - Trong tab **"Batch Hàng Loạt"**, bạn có thể chọn chế độ **"Xuất Prompt ZIP (thủ công)"**.
   - Mỗi file video/audio sẽ được tạo thành **1 file `.prompt.txt` riêng biệt** chứa toàn bộ transcript, mốc thời gian và hướng dẫn đạo diễn.
   - Khi tạo xong bài nào sẽ **tự động lưu ngay bài đó vào máy**, đồng thời đóng gói thành **file `.zip`** tại thư mục bạn đã chọn.
   - Bạn chỉ cần mở ChatGPT / Claude / Gemini web, dán prompt vào và lấy JSON trả về dán vào ứng dụng để render.

2. **Nút "Chọn nơi lưu" & Tự động lưu từng video ngay khi xong**:
   - Tích hợp nút **"Chọn thư mục lưu trên máy"** (sử dụng Native File System API của trình duyệt) hoặc nhập đường dẫn thư mục tùy chỉnh.
   - Khi render hàng loạt: **xử lý xong video nào sẽ lưu ngay lập tức video đó vào máy** chứ không phải chờ render hết tất cả mới lưu.

3. **Lựa chọn "Cách phối minh họa" đa dạng + Ngẫu nhiên + AI tự quyết định**:
   - **✨ AI tự chọn tối ưu theo context**: Prompt sẽ yêu cầu AI tự phân tích nội dung bài học để chọn cách phối (Cảnh đời sống, Sơ đồ 3 bước, Đồng hồ sắc thái, Thẻ Checklist, Nâng cấp câu, v.v.) và ghi rõ lý do vào JSON.
   - **🔀 Phối ngẫu nhiên**: Mỗi video trong batch sẽ tự động được gán một phong cách phối đồ họa ngẫu nhiên khác nhau.
   - **Chọn thủ công**: Tự do chọn 1 trong 9 phong cách infographic định sẵn.

4. **Hỗ trợ 2 Template Video TikTok chuẩn xu hướng**:
   - **📱 TikTok Cards (@englishpracticing168)**:
     - Thẻ bài học pastel thanh lịch, có thanh so sánh (`comparison_strip`), thẻ chủ đề (`topic_pill`), hình minh họa infographic / đồng hồ / sơ đồ, thẻ câu nhấn mạnh (`sentence_card`) với dấu tick ✔/✘, và karaoke chạy mượt ở đáy.
   - **⚡ Word Reveal Dark (@xun52000)**:
     - Nền tối hiện đại studio slate / đen sâu, chữ Kinetic Typography cỡ lớn căn giữa, hiệu ứng pop-up / fade-scale nổi bật, màu vàng neon highlight chữ trọng tâm, phong cách tối giản cuốn hút giữ chân người xem.

---

## 🛠️ Cách cài đặt & Chạy trên máy

**Yêu cầu:** Node.js v18+ hoặc Bun.

1. **Cài đặt thư viện:**
   ```bash
   npm install
   ```
2. **Khởi động ứng dụng:**
   ```bash
   npm run dev
   ```
3. Mở trình duyệt tại: `http://localhost:3000` (hoặc cổng hiển thị trên terminal).

4. **Chạy test tự động:**
   ```bash
   npx tsx --test src/engine/engine.test.ts
   ```

