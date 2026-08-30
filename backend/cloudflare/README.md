# PCGD-XMC API trên Cloudflare Workers

Worker này giữ nguyên hợp đồng API trong `backend/server.js`, nhưng dùng runtime Cloudflare Workers và kết nối Neon PostgreSQL qua Hyperdrive.

## Production

- `DATABASE_URL` không nằm trong source hoặc Worker secrets; Hyperdrive giữ thông tin kết nối Neon.
- `JWT_SECRET` là Worker secret và không được commit.
- CORS mặc định chỉ cho phép origin GitHub Pages `https://trungtuyen.github.io`.
- Mật khẩu được kiểm tra và băm bằng `pgcrypto` trong PostgreSQL để tránh chạy bcrypt trên CPU của Worker.
- Workers Logs và traces được bật trong `wrangler.jsonc`.

Sau khi tạo Hyperdrive, thêm binding `HYPERDRIVE` vào `wrangler.jsonc`, chạy `npm run types`, `npm run check`, rồi `npm run build` trước khi triển khai.

