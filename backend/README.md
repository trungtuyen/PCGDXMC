# PCGD-XMC API toàn quốc

Backend này phục vụ giao diện GitHub Pages/PWA. **GitHub Pages chỉ giữ frontend; dữ liệu cá nhân phải nằm trên hạ tầng backend riêng.**

## Kiến trúc vận hành

- **Xã/phường/đặc khu:** PWA phân tích/nhập dữ liệu, có hàng đợi offline; đồng bộ gói tổng hợp nhỏ qua `POST /v1/summaries/upsert`.
- **Tỉnh/thành:** `GET /v1/aggregates?level=province&province=...&year=...`.
- **Toàn quốc:** `GET /v1/aggregates?level=national&year=...`.
- **Hồ sơ chi tiết:** `persons` phân vùng theo `province_key`; đọc cursor tối đa 100 hồ sơ/lần, ghi batch tối đa 200.
- **Báo cáo:** tỉnh/toàn quốc dùng `commune_summaries`, không quét hàng trăm triệu hồ sơ.

## Khởi tạo production

```bash
cd backend
cp .env.example .env   # chỉ dùng local; production dùng Secret Manager
npm install
npm run migrate
```

Tạo tài khoản quản trị đầu tiên bằng biến môi trường, không ghi mật khẩu vào GitHub:

```bash
ADMIN_USERNAME=admin \
ADMIN_PASSWORD='mat-khau-rat-manh-toi-thieu-12-ky-tu' \
ADMIN_DISPLAY_NAME='Quản trị hệ thống' \
ADMIN_ROLE=super_admin \
npm run create-admin
```

Khởi động:

```bash
npm start
```

Hoặc container:

```bash
docker build -t pcgdxmc-api .
docker run --rm -p 8080:8080 --env-file .env pcgdxmc-api
```

## Đăng nhập và phân quyền

`POST /v1/auth/login` nhận `username/password`. Mật khẩu được băm bcrypt trong `app_users`; API trả JWT hết hạn theo `JWT_EXPIRES_IN` (mặc định 8 giờ). Frontend giữ JWT trong **sessionStorage**, không lưu mật khẩu và không giữ JWT lâu dài trong localStorage.

Vai trò:

- `super_admin`: toàn quyền hệ thống.
- `national_admin`: xem tổng hợp toàn quốc, không mặc nhiên được xem hồ sơ chi tiết từng xã.
- `province_admin`: tổng hợp đúng tỉnh được cấp.
- `commune_admin`: dữ liệu chi tiết và tổng hợp đúng xã được cấp.

Production nên bổ sung MFA/SSO cho quản trị cấp tỉnh/toàn quốc nếu hạ tầng định danh cho phép.

## Chống trùng dữ liệu

`person_identity_registry` có thể chặn một định danh bị tạo thành hai `person_id`. Chỉ gửi `identityHash` trong payload, **không gửi/lưu số định danh rõ trong registry**. Tốt nhất tạo HMAC/SHA-256 bằng secret ở backend hoặc hệ thống nguồn. Không dùng hash đơn giản của CCCD nếu không có salt/secret.

## Migrate

`npm run migrate` chạy `schema.sql` rồi các file `migrations/*.sql` theo thứ tự tên. Các migration hiện được viết idempotent để chạy lại an toàn ở môi trường mới.

## Benchmark

Sau khi API đã triển khai:

```bash
TARGET_URL=https://api.example.vn \
AUTH_TOKEN='<jwt>' \
CONCURRENCY=100 \
REQUESTS=10000 \
P95_LIMIT_MS=1500 \
npm run loadtest
```

Kết quả gồm RPS, tỷ lệ lỗi, p50/p95/p99/max. Script trả exit code lỗi nếu >1% request thất bại hoặc p95 vượt ngưỡng. Dùng `TEST_PATH` để benchmark endpoint cụ thể, ví dụ một xã:

```bash
TEST_PATH='/v1/persons?province=thai-nguyen&commune=na-ri&limit=50' npm run loadtest
```

## Mục tiêu 200 triệu hồ sơ

Code hiện tạo nền đúng cho quy mô lớn: partition, cursor pagination, batch, aggregate tách riêng, gzip/Brotli, rate limit và audit. Tuy nhiên **200 triệu hồ sơ là mục tiêu capacity chứ không phải SLA tự động**. Trước khi nhận dữ liệu thật cần benchmark theo phần cứng và workload thực.

Production cấp quốc gia nên có:

- PostgreSQL managed HA + PITR + read replica;
- connection pooling (PgBouncer hoặc dịch vụ tương đương);
- Redis/cache cho dashboard nóng;
- object storage cho Excel/PDF/backup xuất;
- CDN/WAF/DDoS ở edge;
- monitoring latency, error rate, DB connections, replication lag;
- backup restore drill định kỳ;
- data-retention và audit policy.

## Nguyên tắc 4G

Dashboard tỉnh/toàn quốc chỉ trao đổi vài nghìn gói tổng hợp đã nén. Điện thoại không tải bảng `persons`. Hồ sơ chi tiết chỉ được phân trang theo phạm vi xã và hàng đợi offline giữ thay đổi khi mất mạng.
