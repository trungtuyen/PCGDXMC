# PCGD–XMC Smart

Ứng dụng web hỗ trợ **Phổ cập giáo dục – Xóa mù chữ (PCGD–XMC)** theo hướng local-first, được xây dựng để đối chiếu và dần thay thế quy trình tính bằng workbook Excel PCGD cấp xã.

## 🚀 Chạy phần mềm ngay

**Link chạy trực tiếp:**

https://raw.githack.com/trungtuyen/PCGDXMC/main/index.html

> Link trên phục vụ trực tiếp mã nguồn public từ repository GitHub. Dữ liệu Excel người dùng chọn vẫn được xử lý trong trình duyệt và không được commit vào repository.

## Bản Beta 0.1 có gì?

- Đọc file Excel ngay trên trình duyệt; **không tải dữ liệu cá nhân lên GitHub**.
- Nhận diện các sheet `DATA`, `DuLieu`, `MaTruong`, `THONG_TIN`.
- Tái tính lõi biến phụ tương đương vùng **BA–BU** của sheet `DATA`: hệ học, lỗi mã trường, tuổi, lứa tuổi, khối đang học, 15–18 tuổi đã TN THCS, hệ THPT/GDTX/GDNN, nhóm XMC, MC/MC1/MC2, bỏ học, khuyết tật, tốt nghiệp năm trước, lưu ban, học 2 buổi.
- Dashboard nhanh theo nhóm tuổi.
- Soát lỗi dữ liệu và lỗi danh mục trường.
- Tìm kiếm dữ liệu đã tính.
- Xuất workbook kết quả gồm `TongHop`, `SoatLoi`, `DuLieuTinh`.
- PWA: có thể cài như ứng dụng sau khi GitHub Pages được bật.

## Quyền riêng tư

Repository **không chứa** file điều tra gốc hay dữ liệu họ tên/ngày sinh/số điện thoại. Excel do người dùng chọn được đọc bằng JavaScript tại máy người dùng.

> Không commit file dữ liệu PCGD thực tế vào repository public.

## GitHub Pages

Workflow triển khai GitHub Pages đã có sẵn. GitHub hiện không cho phép workflow tự tạo Pages site lần đầu bằng `GITHUB_TOKEN`, nên link GitHub Pages chính thức chỉ hoạt động sau khi Pages được bật một lần trong phần cài đặt repository.

Địa chỉ GitHub Pages dự kiến sau khi bật:

`https://trungtuyen.github.io/PCGDXMC/`

## Kiến trúc

- `index.html` — giao diện ứng dụng.
- `engine.js` — PCGD–XMC calculation engine.
- `app.js` — điều khiển giao diện, import/export.
- `styles.css` — giao diện responsive.
- `sw.js` + `manifest.webmanifest` — PWA/offline shell.
- `.github/workflows/pages.yml` — triển khai GitHub Pages.

## Nguồn thư viện

Bản web sử dụng SheetJS Community Edition 0.20.3 từ CDN chính thức để đọc/ghi XLSX.

## Trạng thái nghiệp vụ

Đây là **bản Beta kỹ thuật**. Mục tiêu hiện tại là đối chiếu chính xác logic workbook Excel trước; bộ đánh giá công nhận PCGD–XMC theo đầy đủ văn bản hiện hành sẽ được tách thành rule engine có phiên bản và kiểm thử riêng.

Không sử dụng kết quả Beta như quyết định công nhận pháp lý khi chưa được cơ quan có thẩm quyền kiểm tra.
