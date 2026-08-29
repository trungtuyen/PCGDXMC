# PCGD-XMC API toàn quốc

Backend này là lớp máy chủ tham chiếu cho giao diện GitHub Pages. GitHub Pages chỉ phục vụ frontend; dữ liệu cá nhân và API phải chạy trên hạ tầng máy chủ riêng.

## Kiến trúc

- **Cấp xã:** trình duyệt/PWA phân tích dữ liệu và vẫn làm việc khi mạng yếu. Khi đồng bộ, frontend gửi gói tổng hợp nhỏ lên `POST /v1/summaries/upsert`.
- **Cấp tỉnh:** đọc các gói tổng hợp xã của một tỉnh qua `GET /v1/aggregates?level=province&province=...&year=...`.
- **Toàn quốc:** đọc gói tổng hợp của 34 tỉnh/xã qua `GET /v1/aggregates?level=national&year=...`.
- **Dữ liệu chi tiết:** bảng `persons` phân vùng hash theo `province_key`, API đọc dùng cursor và giới hạn tối đa 100 hồ sơ/lần; API ghi dùng batch tối đa 200 hồ sơ/lần.
- **Báo cáo lớn:** nên tạo từ backend/warehouse; không tải hàng triệu hồ sơ xuống điện thoại.

## Khởi tạo

1. Tạo PostgreSQL 16+ có dung lượng/IOPS phù hợp.
2. Chạy `psql "$DATABASE_URL" -f schema.sql`.
3. Cài dependency: `npm install`.
4. Khởi động: `npm start`.

Biến môi trường tối thiểu:

```text
DATABASE_URL=postgresql://...
PORT=8080
CORS_ORIGINS=https://trungtuyen.github.io
JWT_SECRET=<secret dài, quản lý bằng secret manager>
DB_POOL_MAX=30
RATE_LIMIT_MAX=600
```

Trong giai đoạn thử nghiệm có thể dùng `API_AUTH_TOKEN`, nhưng **không dùng khóa dùng chung này cho production**. Production phải dùng hệ thống định danh/JWT có claim phạm vi (`role`, `provinceKey`, `communeCode`), MFA cho quản trị và secret manager.

## Vai trò API

- `super_admin` / `national_admin`: xem toàn quốc.
- `province_admin`: chỉ xem/ghi tỉnh có trong claim `provinceKey`.
- `commune_admin`: chỉ xem/ghi xã có trong claim `provinceKey + communeCode`.

## Mục tiêu quy mô 200 triệu hồ sơ

Schema hiện đặt 16 partition khởi đầu để có cấu trúc scale ngang/đọc theo phạm vi. Con số **200 triệu hồ sơ không phải cam kết hiệu năng chỉ bằng code**: trước production phải benchmark theo phần cứng thực tế, số người truy cập đồng thời, kích thước `payload`, index, tỷ lệ đọc/ghi, backup/PITR và replica. Với quy mô quốc gia nên dùng PostgreSQL managed HA, read replica, Redis/cache, object storage, WAF/CDN và warehouse/materialized aggregates.

Dashboard tỉnh/toàn quốc không truy vấn `persons`; đây là nguyên tắc quan trọng nhất để 4G vẫn nhanh.
