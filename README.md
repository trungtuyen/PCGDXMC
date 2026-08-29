# PCGD–XMC Smart

Ứng dụng web hỗ trợ **Phổ cập giáo dục – Xóa mù chữ (PCGD–XMC)** theo hướng local-first: giáo viên nộp phiếu điều tra Excel, hệ thống chuẩn hóa, tổng hợp và sinh các biểu PCGD–XMC để xuất lại Excel.

## 🚀 Chạy phần mềm ngay

**Link chạy trực tiếp:**

https://raw.githack.com/trungtuyen/PCGDXMC/main/index.html

> File điều tra được xử lý trong trình duyệt của người dùng. Repository không lưu danh sách dân cư, họ tên, ngày sinh hay số điện thoại từ phiếu điều tra.

## Beta 0.2

- Nhận trực tiếp file điều tra có sheet `MauNhapLieu`, gồm cả **`.xls` đời cũ** và `.xlsx`.
- Đã thiết kế theo mẫu thực tế **`Bản Cháng.xls`**.
- Cho phép **chọn nhiều file cùng lúc** để gộp nhiều thôn/xóm thành dữ liệu cấp xã.
- Tự nhận diện thôn/xóm từ địa chỉ hoặc tên file.
- Chuẩn hóa dữ liệu về cấu trúc tương đương `DATA` và tính các biến phụ BA–BU.
- Soát lỗi và chỉ rõ **file nguồn + dòng Excel + đối tượng**.
- Tự động sinh các biểu từ dữ liệu điều tra:
  - `MN-1TE`, `MN-2`
  - `TH-1TE`, `TH-2`
  - `THCS-1TTN`, `THCS-2.1`, `THCS-2.2`
  - `CMC-1`, `CMC-2`, `CMC-3`, `CMC-4`
- Tạo sẵn các sheet `MN-CSVC`, `MN-ĐN`, `TH-CSVC`, `TH-DN`, `THCS-CSVC`, `THCS-DN`. Các sheet này cần bổ sung số liệu nhà trường vì phiếu điều tra hộ dân không chứa dữ liệu CSVC/đội ngũ.
- Nút **Xuất toàn bộ biểu Excel** tạo một workbook mới gồm `TongQuan`, `SoatLoi`, `DATA` và toàn bộ các biểu trên.

## Quy trình sử dụng

1. Giáo viên hoàn thiện phiếu điều tra `.xls/.xlsx`.
2. Cán bộ PCGD chọn một file hoặc nhiều file cùng lúc.
3. Nhấn **Phân tích và tạo biểu**.
4. Kiểm tra tab **Soát lỗi** và sửa phiếu nếu cần.
5. Nhấn **Xuất toàn bộ biểu Excel**.

## Quyền riêng tư

Repository **không chứa file điều tra gốc**. Không commit dữ liệu PCGD thực tế vào repository public.

## GitHub Pages

Workflow GitHub Pages đã được cấu hình. GitHub không cho phép `GITHUB_TOKEN` tự tạo Pages site lần đầu, nên hiện bản chạy trực tiếp sử dụng raw.githack. Khi Pages được bật một lần trong repository, địa chỉ dự kiến là:

`https://trungtuyen.github.io/PCGDXMC/`

## Kiến trúc

- `index.html` — giao diện Beta 0.2.
- `core-v02.js` — đọc/gộp phiếu điều tra và calculation engine.
- `reports-v02.js` — sinh bộ biểu và workbook Excel.
- `app.js` — điều khiển giao diện/import/export.
- `styles.css` — giao diện responsive.
- `sw.js` + `manifest.webmanifest` — PWA/offline shell.
- `.github/workflows/pages.yml` — workflow GitHub Pages.

## Nguồn thư viện

Ứng dụng sử dụng SheetJS Community Edition 0.20.3 từ CDN chính thức để đọc và ghi `.xls/.xlsx` trong trình duyệt.

## Trạng thái nghiệp vụ

Beta 0.2 ưu tiên tự động hóa quy trình **phiếu điều tra → dữ liệu chuẩn hóa → biểu tổng hợp**. Các kết luận “gợi ý mức” cần tiếp tục được đối chiếu với đầy đủ điều kiện pháp lý và số liệu CSVC/đội ngũ trước khi dùng làm kết luận công nhận chính thức.
