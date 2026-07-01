# Kiến trúc dự án Handigo

Tài liệu này mô tả cấu trúc hiện tại của repository Handigo dựa trên mã nguồn đang có. Nội dung chỉ ghi nhận những thành phần tồn tại trong repo, không giả định thêm dịch vụ hoặc ứng dụng chưa được triển khai.

## Tổng quan

Handigo là nền tảng kết nối khách hàng với provider dịch vụ tại nhà.

Repository hiện có các phần chính:

- `handigo-backend`: API backend Node.js, Express.js, TypeScript, MongoDB/Mongoose.
- `handigo-web`: ứng dụng web React, Vite, TypeScript, Tailwind CSS.
- `handigo-design`: các file HTML tĩnh dùng làm thiết kế/tham khảo giao diện.
- `docs`: thư mục tài liệu dự án.
- Các file tài liệu gốc ở root như `README.md`, `DEPLOYMENT.md`, `HANDIGO_PROJECT_INFO.md`.

Hiện tại repository không có ứng dụng mobile riêng như React Native, Flutter, Android native hoặc iOS native. Các thư mục mobile xuất hiện trong `.agents` chỉ là skill/template hỗ trợ công cụ, không phải mã nguồn sản phẩm Handigo.

## Vai trò người dùng

Các role được định nghĩa trong backend gồm:

- `CUSTOMER`
- `PROVIDER`
- `ADMIN`

Trong `user.model.ts`, role mặc định là `CUSTOMER`. Role `PROVIDER` được dùng cùng các module provider/provider application, còn route admin dùng kiểm tra role `ADMIN`.

## Cấu trúc thư mục cấp cao

```text
.
├── handigo-backend/
│   ├── src/
│   ├── postman/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── handigo-web/
│   ├── src/
│   ├── public/
│   ├── stitch/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── handigo-design/
│   ├── news/
│   └── *.html
├── docs/
├── README.md
├── DEPLOYMENT.md
├── HANDIGO_PROJECT_INFO.md
└── ARCHITECTURE.md
```

Các thư mục `.agents`, `.codex`, `.codex-kit` và `codex` là cấu hình/công cụ hỗ trợ agent, không phải thành phần runtime của sản phẩm.

## Backend

### Công nghệ

Backend nằm trong `handigo-backend`.

Các công nghệ chính:

- Node.js `>=20`
- Express.js 5
- TypeScript
- MongoDB với Mongoose
- JWT
- Zod cho validation
- Socket.IO cho realtime
- Multer và Cloudinary cho upload/tài nguyên ảnh
- PayOS cho thanh toán
- Nodemailer cho email
- Google Cloud Vision và Google Generative AI cho OCR/tác vụ AI đang có trong dependency
- Dockerfile riêng cho backend

### Script

Các script trong `handigo-backend/package.json`:

- `dev`: chạy `src/server.ts` bằng `ts-node-dev`.
- `build`: biên dịch TypeScript và chạy `tsc-alias`.
- `start`: chạy `dist/server.js`.
- `seed:payment`: seed dữ liệu payment test.
- `seed:categories`: seed category.
- `migrate:provider-service-ids`: migrate service id của provider.
- `migrate:provider-applications`: migrate review history của provider application.
- `ocr:test`: test Google Vision OCR.
- `test`: hiện chỉ in lỗi "no test specified".

### Entry point và vòng đời server

- `src/server.ts` nạp biến môi trường bằng `dotenv`, validate config production, kết nối MongoDB, tạo HTTP server, khởi tạo Socket.IO và chạy `DispatchService.startTimeoutMonitor()`.
- `src/app.ts` cấu hình Express app, CORS, cookie parser, JSON body parser, route, health check, logging request, xử lý lỗi và 404.
- Health check hiện có tại `GET /health`.

### Cấu trúc backend

```text
handigo-backend/src/
├── app.ts
├── server.ts
├── configs/
├── controllers/
├── middlewares/
├── models/
├── modules/
├── routes/
├── scripts/
├── services/
├── sockets/
├── utils/
└── validations/
```

Ý nghĩa các thư mục:

- `configs`: cấu hình database, JWT, CORS, Cloudinary, PayOS và production config.
- `controllers`: nhận request/response cho từng domain.
- `services`: chứa xử lý nghiệp vụ chính.
- `routes`: khai báo endpoint và gắn middleware/controller.
- `models`: schema Mongoose và type liên quan.
- `validations`: schema/validator dữ liệu đầu vào.
- `middlewares`: auth, role, validate, upload và các middleware chuyên biệt.
- `modules`: module tách riêng, hiện có `ocr`.
- `sockets`: khởi tạo và quản lý Socket.IO.
- `utils`: helper chung như token, OTP, mail, profile validation, provider area.
- `scripts`: seed, migrate và script kiểm thử OCR.

### Route đang được mount

Trong `src/app.ts`, các nhóm route đang được mount:

- `/auth`
- `/payments`
- `/vouchers`
- `/withdrawals`
- `/wallets`
- `/bank-accounts`
- `/notifications`
- `/dashboard`
- `/system-configs`
- `/feedback`
- `/users`
- `/categories`
- `/services`
- `/service-suggestions`
- `/search`
- `/admin/assets`
- `/api/ocr`
- `/provider-applications`
- `/provider-application-assets`
- `/provider-assets`
- `/providers`
- `/admin`
- `/addresses`
- `/vietnam-addresses`
- `/orders`
- `/chat`
- `/locations`

Một số route cũ hoặc dự kiến còn đang comment trong `app.ts`, ví dụ request, promotion, analytics, ai.

### Model dữ liệu

Các model Mongoose hiện có:

- `address`
- `auditLog`
- `bankAccount`
- `category`
- `complaint`
- `conversation`
- `feedback`
- `location`
- `message`
- `notification`
- `order`
- `orderAssignment`
- `orderStatus`
- `payment`
- `promotion`
- `provider`
- `providerApplication`
- `repairQuotation`
- `repairQuotationItem`
- `report`
- `service`
- `serviceOption`
- `servicePackage`
- `serviceSuggestion`
- `session`
- `user`
- `violation`
- `voucher`
- `voucherUsage`
- `wallet`
- `walletTransaction`
- `withdrawRequest`

`models/common.ts` định nghĩa các type/helper dùng chung như `Money`, `ObjectId`, `IBaseDocument`, `baseFields`, `objectIdRef`.

### Xác thực và phân quyền

- `auth.middleware.ts` đọc Bearer token từ header `Authorization`.
- Token được verify bằng `ACCESS_TOKEN_SECRET` hoặc fallback `JWT_SECRET`.
- Middleware tìm user chưa bị xóa mềm (`isDeleted: false`) và chặn user có `status: "locked"`.
- Sau khi xác thực, `req.user` chứa `id`, `email`, `role` lấy từ user trong database.
- `role.middleware.ts` kiểm tra role hiện tại có nằm trong danh sách role được phép hay không.

### Validation và lỗi

- Backend dùng Zod và middleware validate riêng trong `middlewares/validate.middleware.ts`.
- `app.ts` có xử lý lỗi JSON invalid, lỗi Zod, lỗi chung và route 404.
- Response lỗi hiện không đồng nhất hoàn toàn giữa mọi nhánh cũ/mới; tài liệu này chỉ ghi nhận trạng thái hiện có.

### Realtime

Backend dùng Socket.IO:

- `src/sockets/initSocket.ts`
- `src/sockets/socketServer.ts`

Server HTTP được tạo trong `server.ts`, sau đó truyền vào `initSocket(server)`.

### Biến môi trường mẫu

Backend có `.env.example` với các nhóm cấu hình:

- Server: `NODE_ENV`, `PORT`
- Database: `MONGO_URI`
- CORS/frontend: `FRONTEND_URL`, `FRONTEND_URLS`
- JWT: `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`
- OAuth: `GOOGLE_CLIENT_ID`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
- Cloudinary: `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- PayOS: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, return/cancel URL
- Email: `EMAIL_USER`, `EMAIL_PASSWORD`

Không đọc hoặc ghi `.env` thật khi cập nhật tài liệu này.

## Frontend web

### Công nghệ

Frontend nằm trong `handigo-web`.

Các công nghệ chính:

- React 19
- Vite
- TypeScript
- React Router DOM 7
- Tailwind CSS 4
- Zustand
- Axios
- Socket.IO Client
- Lucide React
- Google OAuth
- Dockerfile và `nginx.conf` cho triển khai web

### Script

Các script trong `handigo-web/package.json`:

- `dev`: chạy Vite dev server.
- `build`: chạy `tsc -b` và `vite build`.
- `lint`: chạy ESLint.
- `preview`: chạy Vite preview.

### Cấu hình build

- `vite.config.ts` dùng `@vitejs/plugin-react`, `vite-plugin-checker` và `@vitejs/plugin-basic-ssl` khi chạy dev server.
- Dev server dùng HTTPS và port `5173`.
- Alias `@` trỏ tới `src`.
- `tsconfig.app.json` bật các rule TypeScript như `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- `tailwind.config.js` khai báo design token màu sắc, radius, spacing, font family, font size và plugin `@tailwindcss/forms`, `@tailwindcss/container-queries`.

### Cấu trúc frontend

```text
handigo-web/src/
├── App.tsx
├── main.tsx
├── index.css
├── App.css
├── api/
├── assets/
├── components/
├── config/
├── constants/
├── features/
├── helpers/
├── hooks/
├── pages/
├── types/
└── utils/
```

Ý nghĩa các thư mục:

- `api`: client Axios dùng chung và helper token.
- `assets`: ảnh/logo dùng trong app.
- `components`: component dùng chung và component theo khu vực như auth, home, profile.
- `config`: cấu hình UI/navigation.
- `constants`, `helpers`, `hooks`, `types`, `utils`: mã dùng chung.
- `features`: module theo domain/tính năng.
- `pages`: page cấp cao còn nằm ngoài feature.

### Feature frontend

Các feature hiện có trong `src/features`:

- `admin`
- `auth`
- `bank-account`
- `booking`
- `chat`
- `content`
- `customer`
- `customer-service`
- `feedback`
- `notification`
- `profile`
- `provider`
- `provider-application`
- `service-suggestion`
- `tracking`
- `wallet`

Mỗi feature thường tách theo các thư mục con như `api`, `components`, `hooks`, `pages`, `services`, `types`, `utils` tùy nhu cầu thực tế của feature đó.

### Routing frontend

`src/App.tsx` dùng `BrowserRouter`, `Routes`, `Route` và `RouteGuard`.

Nhóm route chính đang có:

- Public/auth: `/`, `/login`, `/signin`, `/register`, `/forgot-password`
- Nội dung: `/gioi-thieu`, `/tin-tuc`, `/tin-tuc/:articleId`, `/ho-tro`
- Customer: `/customer`, `/customer/profile`, `/customer/services`, `/customer/services/:serviceId`, `/customer/bookings`, `/customer/bookings/new`, `/customer/bookings/new/location`, `/customer/bookings/new/payment`, `/customer/bookings/success`, `/customer/bookings/:bookingId`, `/customer/providers/:providerId`, `/customer/wallet`, `/customer/orders/:orderId/feedback`
- Provider: `/provider`, `/provider/orders`, `/provider/orders/:orderId`, `/provider/schedule`, `/provider/profile`, `/provider/wallet`, `/provider/bank-accounts`, `/provider/feedbacks`, `/provider/service-suggestions`
- Provider application: `/register-provider`
- Admin: `/admin/users`, `/admin/provider-applications`, `/admin/categories`, `/admin/services`, `/admin/service-suggestions`, `/admin/feedbacks`, `/admin/promotions`, `/admin/withdrawals`, `/admin/notifications`, `/admin/system-configs`
- Fallback: `*`

`ProviderAssignmentModal` được render ở cấp app bên ngoài `Routes`.

### API client

`src/api/client.ts` tạo Axios instance:

- `baseURL` lấy từ `VITE_API_BASE_URL`, fallback `http://localhost:5000`.
- `withCredentials: true`.
- Tự gắn access token vào header `Authorization`.
- Tự refresh token qua `/auth/refresh-token` khi token gần hết hạn hoặc gặp HTTP 401.
- Có cơ chế tránh refresh trùng bằng `refreshPromise` và `navigator.locks` khi browser hỗ trợ.
- Khi refresh lỗi không phải network error, auth store sẽ logout.

### Biến môi trường mẫu

Frontend có `.env.example` với:

- `VITE_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_FACEBOOK_APP_ID`
- `VITE_GOOGLE_MAPS_API_KEY`

## Thiết kế HTML tĩnh

`handigo-design` chứa các file HTML tĩnh cho một số màn hình:

- `serviceDetailCustomer.html`
- `serviceCustomer.html`
- `serviceAdmin.html`
- `schedule.html`
- `publicProfileProvider.html`
- `categoryAdmin.html`
- `dashboardProvider.html`
- `news/gioithieu.html`
- `news/news.html`
- `news/hotropage.html`
- `news/newsdetail.html`

`handigo-web/stitch` chứa thêm các bản thiết kế/tham khảo như `screen.png`, `DESIGN.md`, `code.html`. Đây là tài nguyên tham khảo frontend, không phải entrypoint runtime chính.

## Mobile apps

Không tìm thấy mã nguồn mobile app trong repository hiện tại.

Không có các thư mục hoặc file runtime phổ biến như:

- React Native app
- Flutter app
- Android native project
- iOS native project

Vì vậy tài liệu này không mô tả kiến trúc mobile app riêng. Nếu sau này thêm mobile app, cần cập nhật phần này theo mã nguồn thật.

## Quy ước code hiện có

### Backend

- TypeScript strict mode bật trong `tsconfig.json`.
- Module backend dùng CommonJS khi build.
- Code tổ chức theo lớp:
  - route khai báo endpoint/middleware;
  - controller xử lý request/response;
  - service xử lý nghiệp vụ;
  - model định nghĩa schema MongoDB;
  - validation kiểm tra dữ liệu đầu vào.
- Tên file backend dùng dạng domain + vai trò, ví dụ `auth.controller.ts`, `auth.service.ts`, `auth.routes.ts`, `auth.validator.ts`.
- Model dùng Mongoose schema và export model mặc định.
- Một số model dùng soft delete qua `isDeleted`, `deletedAt`.
- Route bảo vệ dùng `authMiddleware` và role middleware tùy module.
- Upload/tài nguyên có middleware riêng theo ngữ cảnh như provider asset, provider application asset, order attachment, feedback upload, admin asset.

### Frontend

- TypeScript dùng JSX transform `react-jsx`.
- Import nội bộ có alias `@/*`.
- UI được tổ chức theo feature và component dùng chung.
- Page component thường nằm trong `features/<feature>/pages`.
- API theo feature thường nằm trong `features/<feature>/api`.
- Type theo feature thường nằm trong `features/<feature>/types`.
- State auth dùng Zustand trong `features/auth/store/auth.store.ts`.
- Component bảo vệ route dùng `RouteGuard`.
- Component/common chứa các thành phần tái sử dụng như modal, pagination, navbar, status badge, form field, notification bell.

## Dependency chính

### Backend dependencies

- `express`
- `mongoose`
- `jsonwebtoken`
- `bcrypt`
- `zod`
- `cors`
- `cookie-parser`
- `dotenv`
- `multer`
- `cloudinary`
- `socket.io`
- `nodemailer`
- `node-cron`
- `axios`
- `@payos/node`
- `@google-cloud/vision`
- `@google/generative-ai`
- `google-auth-library`
- `pdf-lib`
- `mongoose-paginate-v2`

### Backend devDependencies

- `typescript`
- `ts-node`
- `ts-node-dev`
- `nodemon`
- `tsc-alias`
- Các package `@types/*` cho Node, Express, CORS, JWT, Multer, Nodemailer, Cookie Parser, Bcrypt.

### Frontend dependencies

- `react`
- `react-dom`
- `react-router-dom`
- `axios`
- `zustand`
- `socket.io-client`
- `lucide-react`
- `@react-oauth/google`

### Frontend devDependencies

- `vite`
- `typescript`
- `@vitejs/plugin-react`
- `vite-plugin-checker`
- `@vitejs/plugin-basic-ssl`
- `tailwindcss`
- `@tailwindcss/forms`
- `@tailwindcss/container-queries`
- `@tailwindcss/postcss`
- `postcss`
- `autoprefixer`
- `eslint`
- `typescript-eslint`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `globals`
- Các package `@types/*` cho Node, React và React DOM.

## Triển khai

Repo có:

- `handigo-backend/Dockerfile`
- `handigo-web/Dockerfile`
- `handigo-web/nginx.conf`
- `DEPLOYMENT.md`

Tài liệu này không mô tả chi tiết hạ tầng production ngoài các file đang tồn tại trên.

## Ghi chú bảo trì

- Khi thêm route backend mới, cập nhật `src/app.ts`, route/controller/service/validation tương ứng và tài liệu này nếu route là nhóm chức năng mới.
- Khi thêm feature frontend mới, ưu tiên đặt trong `src/features/<feature>` theo cấu trúc đang dùng.
- Khi thêm mobile app thật, tạo phần kiến trúc mobile dựa trên mã nguồn được thêm vào.
- Không đưa `.env`, secret, token hoặc credential thật vào tài liệu.
