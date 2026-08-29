# PCGD–XMC Smart

Ứng dụng web hỗ trợ **Phổ cập giáo dục – Xóa mù chữ (PCGD–XMC)** theo hướng local-first: giáo viên nộp phiếu điều tra Excel gốc, hệ thống chuẩn hóa, tổng hợp, cho phép chọn từng thôn/xóm để xem biểu và xuất Excel.

## 🚀 Chạy phần mềm

https://raw.githack.com/trungtuyen/PCGDXMC/main/index.html

> File điều tra được xử lý trong trình duyệt. Repository không lưu dữ liệu dân cư từ phiếu điều tra.

## Beta 0.4

- Chuẩn đầu vào là file điều tra gốc có sheet `MauNhapLieu`, như **Bản Cháng.xls**.
- Nhận `.xls`, `.xlsx`, `.xlsm` và có thể chọn nhiều file cùng lúc để gộp các thôn/xóm.
- Sau khi phân tích, có bộ lọc **Phạm vi báo cáo**:
  - **Toàn xã**;
  - hoặc chọn **một thôn/xóm cụ thể**.
- Menu nghiệp vụ tách riêng:
  - **Mầm non:** `MN-1TE`, `MN-2`, `MN-CSVC`, `MN-ĐN`.
  - **Tiểu học:** `TH-1TE`, `TH-2`, `TH-CSVC`, `TH-DN`.
  - **THCS:** `THCS-1TTN`, `THCS-2.1`, `THCS-2.2`, `THCS-CSVC`, `THCS-DN`.
  - **Xóa mù chữ:** `CMC-1`, `CMC-2`, `CMC-3`, `CMC-4`.
- Chọn từng biểu để **xem trực tiếp trên web** theo thôn/xóm đang chọn.
- Xuất Excel riêng cho **Mầm non / Tiểu học / THCS / XMC** theo đúng phạm vi đang xem.
- Nút **Xuất toàn bộ phạm vi** tạo đầy đủ hồ sơ của thôn đang chọn hoặc toàn xã.
- Soát lỗi và dữ liệu chi tiết cũng tự lọc theo thôn/xóm.

## Quy trình

**Phiếu điều tra gốc → Phân tích → Chọn thôn/xóm → Chọn menu cấp học → Chọn biểu → Xem trên web → Xuất Excel**

## Lưu ý dữ liệu

Các biểu dân số, độ tuổi, đi học, tốt nghiệp, XMC, khuyết tật được tính từ phiếu điều tra. **CSVC và đội ngũ** không có trong phiếu hộ dân nên các sheet tương ứng được tạo khung để bổ sung từ nhà trường; phần mềm không tự tạo số liệu giả.

## Kiến trúc

- `index.html` — giao diện Beta 0.4 và menu nghiệp vụ.
- `core-v02.js` — đọc/gộp phiếu điều tra và calculation engine.
- `reports-v02.js` — sinh toàn bộ biểu.
- `groups-v03.js` — tách workbook riêng theo MN/TH/THCS/XMC.
- `viewer-v04.js` — lọc phạm vi thôn/xóm, xem biểu và xuất Excel theo phạm vi.
- `app.js` — điều khiển giao diện, import, menu và bộ lọc.
- `sw.js` — cache PWA Beta 0.4.

## GitHub Pages

Workflow GitHub Pages đã được cấu hình. Khi Pages được bật lần đầu trong repository, địa chỉ chính thức sẽ là:

`https://trungtuyen.github.io/PCGDXMC/`
