# PCGD–XMC Smart

Ứng dụng web hỗ trợ **Phổ cập giáo dục – Xóa mù chữ (PCGD–XMC)** theo hướng local-first: giáo viên nộp phiếu điều tra Excel, hệ thống chuẩn hóa, tổng hợp và sinh các biểu để xuất lại Excel.

## 🚀 Chạy phần mềm

https://raw.githack.com/trungtuyen/PCGDXMC/main/index.html

> File điều tra được xử lý trong trình duyệt. Repository không lưu dữ liệu dân cư từ phiếu điều tra.

## Beta 0.3

- Nhận trực tiếp `.xls`, `.xlsx`, `.xlsm`, gồm mẫu `MauNhapLieu` như **Bản Cháng.xls**.
- Chọn nhiều file cùng lúc để gộp các thôn/xóm thành dữ liệu cấp xã.
- Soát lỗi theo **file nguồn + dòng Excel + đối tượng**.
- Tách giao diện và file xuất theo từng nhóm nghiệp vụ:
  - **Mầm non:** `MN-1TE`, `MN-2`, `MN-CSVC`, `MN-ĐN`.
  - **Tiểu học:** `TH-1TE`, `TH-2`, `TH-CSVC`, `TH-DN`.
  - **THCS:** `THCS-1TTN`, `THCS-2.1`, `THCS-2.2`, `THCS-CSVC`, `THCS-DN`.
  - **Xóa mù chữ:** `CMC-1`, `CMC-2`, `CMC-3`, `CMC-4`.
- Có nút **Xuất riêng** cho từng nhóm và nút **Xuất toàn bộ hồ sơ**.
- Có bộ **Tổng hợp cấp xã** gồm `TongQuan`, `SoatLoi`, `DATA`.

## Lưu ý dữ liệu

Các biểu dân số, độ tuổi, đi học, tốt nghiệp, XMC, khuyết tật được tính từ phiếu điều tra. **CSVC và đội ngũ** không có trong phiếu hộ dân nên các sheet tương ứng được tạo sẵn để bổ sung từ nhà trường; phần mềm không tự tạo số liệu giả.

## Kiến trúc

- `index.html` — giao diện Beta 0.3.
- `core-v02.js` — đọc/gộp phiếu điều tra và calculation engine.
- `reports-v02.js` — sinh toàn bộ biểu.
- `groups-v03.js` — tách và xuất workbook riêng theo MN/TH/THCS/XMC.
- `app.js` — giao diện, import và export.
- `sw.js` — cache PWA Beta 0.3.

## GitHub Pages

Workflow GitHub Pages đã được cấu hình. Khi Pages được bật lần đầu trong repository, địa chỉ chính thức sẽ là:

`https://trungtuyen.github.io/PCGDXMC/`
