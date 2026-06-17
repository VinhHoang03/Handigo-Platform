
KIẾN TRÚC:
Feature-Based + Clean Architecture

==================================================
QUY TẮC TỔNG QUÁT
==================================================

Khi triển khai BẤT KỲ chức năng nào:
- KHÔNG được nhét toàn bộ code vào pages/components
- LUÔN chia theo feature
- LUÔN tách riêng:
  - UI
  - Business Logic
  - API Layer
  - State Layer
  - Types
- KHÔNG gọi API trực tiếp trong reusable component
- LUÔN dùng TypeScript types/interfaces
- LUÔN tái sử dụng component chung nếu có

==================================================
CẤU TRÚC ROOT
==================================================

src/
│
├── api/
├── assets/
├── components/
├── config/
├── constants/
├── features/
├── hooks/
├── pages/
├── services/
├── store/
├── types/
└── utils/

==================================================
QUY TẮC TRIỂN KHAI FEATURE
==================================================

Khi tạo feature mới:

1. Tạo folder trong:
src/features/

Ví dụ:
src/features/auth/

2. Trong feature phải có:

src/features/auth/
│
├── api/
├── components/
├── hooks/
├── pages/
├── services/
├── store/
├── types/
└── utils/

==================================================
TRÁCH NHIỆM TỪNG LAYER
==================================================

--------------------------------------------------
api/
--------------------------------------------------

Mục đích:
- Chỉ dùng để gọi backend

Quy tắc:
- Dùng axios/fetch
- KHÔNG business logic
- KHÔNG UI logic
- KHÔNG xử lý state

Ví dụ:
login.api.ts
register.api.ts

--------------------------------------------------
services/
--------------------------------------------------

Mục đích:
- Xử lý business logic

Quy tắc:
- Combine nhiều API
- Xử lý token/session
- Transform dữ liệu
- Validate dữ liệu
- Cache nếu cần

Ví dụ:
auth.service.ts

--------------------------------------------------
hooks/
--------------------------------------------------

Mục đích:
- Reusable logic cho feature

Quy tắc:
- Gọi service
- Quản lý loading/error state
- Expose state cho UI

Ví dụ:
useAuth.ts

--------------------------------------------------
components/
--------------------------------------------------

Mục đích:
- UI component của feature

Quy tắc:
- Chỉ render UI
- KHÔNG gọi API trực tiếp
- KHÔNG chứa business logic lớn

Ví dụ:
LoginForm.tsx
RegisterForm.tsx

--------------------------------------------------
pages/
--------------------------------------------------

Mục đích:
- Route-level page

Quy tắc:
- Compose components
- Kết nối hooks
- Handle routing

Ví dụ:
LoginPage.tsx

--------------------------------------------------
store/
--------------------------------------------------

Mục đích:
- State dùng chung của feature

Quy tắc:
- Redux Toolkit/Zustand
- Chỉ lưu shared state

Ví dụ:
auth.store.ts

--------------------------------------------------
types/
--------------------------------------------------

Mục đích:
- Chứa types/interfaces

Quy tắc:
- Định nghĩa request/response model
- Hạn chế dùng any

Ví dụ:
auth.types.ts

--------------------------------------------------
utils/
--------------------------------------------------

Mục đích:
- Helper/util cho feature

Quy tắc:
- Chỉ chứa helper nhỏ
- KHÔNG chứa API logic

==================================================
FLOW TRIỂN KHAI CHỨC NĂNG
==================================================

Khi triển khai 1 feature:

BƯỚC 1
Tạo types trước.

Ví dụ:
- LoginRequest
- LoginResponse
- User

BƯỚC 2
Tạo API layer.

Ví dụ:
auth.api.ts

Mục đích:
- giao tiếp backend

BƯỚC 3
Tạo service layer.

Ví dụ:
auth.service.ts

Mục đích:
- xử lý auth logic
- token handling

BƯỚC 4
Tạo hooks.

Ví dụ:
useAuth.ts

Mục đích:
- loading/error state
- gọi service

BƯỚC 5
Tạo UI components.

Ví dụ:
LoginForm.tsx

Mục đích:
- render UI

BƯỚC 6
Tạo page.

Ví dụ:
LoginPage.tsx

Mục đích:
- compose màn hình hoàn chỉnh

==================================================
VÍ DỤ FEATURE AUTHENTICATION
==================================================

src/features/auth/
│
├── api/
│   ├── login.api.ts
│   └── register.api.ts
│
├── components/
│   ├── LoginForm.tsx
│   └── RegisterForm.tsx
│
├── hooks/
│   └── useAuth.ts
│
├── pages/
│   ├── LoginPage.tsx
│   └── RegisterPage.tsx
│
├── services/
│   └── auth.service.ts
│
├── store/
│   └── auth.store.ts
│
├── types/
│   └── auth.types.ts
│
└── utils/
    └── auth.helper.ts

==================================================
DATA FLOW
==================================================

UI Component
→ Hook
→ Service
→ API
→ Backend

KHÔNG được:

UI Component
→ API trực tiếp

==================================================
QUY TẮC COMPONENT CHUNG
==================================================

Reusable UI PHẢI nằm trong:

src/components/

Ví dụ:
- Button
- Modal
- Input
- Table
- Loader

UI riêng của feature:
src/features/{feature}/components/

==================================================
QUY TẮC STATE
==================================================

Global App State:
src/store/

Feature State:
src/features/{feature}/store/

Local UI State:
useState()

==================================================
QUY TẮC IMPORT
==================================================

LUÔN dùng alias import.

ĐÚNG:
@/features/auth
@/components/Button

SAI:
../../../../components

==================================================
QUY TẮC CLEAN CODE
==================================================

BẮT BUỘC:
- component nhỏ
- logic tái sử dụng
- typed đầy đủ
- modular structure
- tách biệt responsibility

KHÔNG được:
- duplicate logic
- component quá lớn
- trộn UI + business logic
- gọi API trực tiếp trong UI
