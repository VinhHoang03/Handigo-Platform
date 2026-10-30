# Quan hệ package được đối chiếu với mã nguồn

Ngày đối chiếu: 20/10/2026.

Đã thêm 81 quan hệ import trực tiếp và 2 quan hệ giao tiếp runtime (HTTP/JSON, Socket.IO).

Mũi tên đi từ package sử dụng tới package được sử dụng. Import kiểu dữ liệu cũng được tính là phụ thuộc. Mỗi đường có tooltip dẫn tới một ví dụ trong code.

Bổ sung ba package còn thiếu trong sheet: handigo-web/src/routes, handigo-web/src/assets và handigo-backend/src/ai. Đổi nhãn script thành scripts để khớp thư mục thực tế. Không thêm quan hệ giả định cho các thư mục rỗng hoặc chưa được import.

Giữ nguyên toàn bộ 8 sheet class diagram của bản người dùng vừa lưu. File sao lưu trước chỉnh sửa được lưu cùng thư mục kết quả.

Các quan hệ sau được trích từ AST của TypeScript, gồm import tĩnh, export từ module khác, import động và require. Không tính dependency cùng package; không vẽ các thư viện bên ngoài hoặc file CSS thành package riêng.

| Dự án | Package sử dụng | Package được sử dụng | Ví dụ trong mã nguồn |
|---|---|---|---|
| handigo-backend | ai | middlewares | handigo-backend/src/ai/agent/agent.service.ts:2 |
| handigo-backend | ai | models | handigo-backend/src/ai/agent/order-actions.ts:1 |
| handigo-backend | ai | services | handigo-backend/src/ai/agent/agent-loop.service.ts:17 |
| handigo-backend | ai | utils | handigo-backend/src/ai/agent/agent-loop.service.ts:1 |
| handigo-backend | ai | validations | handigo-backend/src/ai/quotation/quotation-agent.ts:6 |
| handigo-backend | app.ts | ai | handigo-backend/src/app.ts:34 |
| handigo-backend | app.ts | configs | handigo-backend/src/app.ts:42 |
| handigo-backend | app.ts | controllers | handigo-backend/src/app.ts:46 |
| handigo-backend | app.ts | middlewares | handigo-backend/src/app.ts:45 |
| handigo-backend | app.ts | routes | handigo-backend/src/app.ts:6 |
| handigo-backend | app.ts | utils | handigo-backend/src/app.ts:43 |
| handigo-backend | configs | utils | handigo-backend/src/configs/db.ts:2 |
| handigo-backend | controllers | middlewares | handigo-backend/src/controllers/address.controller.ts:2 |
| handigo-backend | controllers | models | handigo-backend/src/controllers/order.controller.ts:3 |
| handigo-backend | controllers | services | handigo-backend/src/controllers/address.controller.ts:3 |
| handigo-backend | controllers | sockets | handigo-backend/src/controllers/chat.controller.ts:4 |
| handigo-backend | controllers | utils | handigo-backend/src/controllers/admin.controller.ts:4 |
| handigo-backend | controllers | validations | handigo-backend/src/controllers/bankAccount.controller.ts:5 |
| handigo-backend | middlewares | configs | handigo-backend/src/middlewares/adminAssetUpload.middleware.ts:3 |
| handigo-backend | middlewares | models | handigo-backend/src/middlewares/approvedProvider.middleware.ts:2 |
| handigo-backend | middlewares | services | handigo-backend/src/middlewares/orderAttachmentUpload.middleware.ts:4 |
| handigo-backend | middlewares | utils | handigo-backend/src/middlewares/adminAssetUpload.middleware.ts:7 |
| handigo-backend | models | sockets | handigo-backend/src/models/notification.model.ts:3 |
| handigo-backend | models | utils | handigo-backend/src/models/address.model.ts:7 |
| handigo-backend | routes | controllers | handigo-backend/src/routes/address.routes.ts:10 |
| handigo-backend | routes | middlewares | handigo-backend/src/routes/address.routes.ts:12 |
| handigo-backend | routes | validations | handigo-backend/src/routes/address.routes.ts:19 |
| handigo-backend | scripts | ai | handigo-backend/src/scripts/testAgentAddressResolution.ts:14 |
| handigo-backend | scripts | configs | handigo-backend/src/scripts/testRewardDepositVoucher.ts:12 |
| handigo-backend | scripts | models | handigo-backend/src/scripts/migrateAirConditionerCleaningOptions.ts:3 |
| handigo-backend | scripts | services | handigo-backend/src/scripts/seedProviderOverview.ts:13 |
| handigo-backend | scripts | sockets | handigo-backend/src/scripts/testAgentOrderProgress.ts:12 |
| handigo-backend | scripts | utils | handigo-backend/src/scripts/migrateAirConditionerCleaningOptions.ts:5 |
| handigo-backend | scripts | validations | handigo-backend/src/scripts/testAdminRewardOffers.ts:12 |
| handigo-backend | server.ts | app.ts | handigo-backend/src/server.ts:32 |
| handigo-backend | server.ts | configs | handigo-backend/src/server.ts:4 |
| handigo-backend | server.ts | services | handigo-backend/src/server.ts:35 |
| handigo-backend | server.ts | sockets | handigo-backend/src/server.ts:34 |
| handigo-backend | server.ts | utils | handigo-backend/src/server.ts:5 |
| handigo-backend | services | ai | handigo-backend/src/services/agentAddress.service.ts:8 |
| handigo-backend | services | configs | handigo-backend/src/services/orderCancellation.service.ts:4 |
| handigo-backend | services | middlewares | handigo-backend/src/services/agentPayment.service.ts:4 |
| handigo-backend | services | models | handigo-backend/src/services/address.service.ts:1 |
| handigo-backend | services | sockets | handigo-backend/src/services/admin.service.ts:5 |
| handigo-backend | services | utils | handigo-backend/src/services/address.service.ts:7 |
| handigo-backend | services | validations | handigo-backend/src/services/agentAddress.service.ts:9 |
| handigo-backend | sockets | configs | handigo-backend/src/sockets/initSocket.ts:8 |
| handigo-backend | sockets | models | handigo-backend/src/sockets/initSocket.ts:4 |
| handigo-backend | sockets | services | handigo-backend/src/sockets/initSocket.ts:5 |
| handigo-backend | sockets | utils | handigo-backend/src/sockets/initSocket.ts:16 |
| handigo-backend | sockets | validations | handigo-backend/src/sockets/initSocket.ts:12 |
| handigo-backend | utils | configs | handigo-backend/src/utils/paymentRedirect.ts:2 |
| handigo-backend | utils | models | handigo-backend/src/utils/orderAddress.ts:1 |
| handigo-backend | utils | validations | handigo-backend/src/utils/bookingPolicy.ts:1 |
| handigo-backend | validations | models | handigo-backend/src/validations/complaint.validator.ts:2 |
| handigo-backend | validations | utils | handigo-backend/src/validations/user.validator.ts:7 |
| handigo-web | api | features | handigo-web/src/api/client.ts:3 |
| handigo-web | App.tsx | components | handigo-web/src/App.tsx:3 |
| handigo-web | App.tsx | features | handigo-web/src/App.tsx:6 |
| handigo-web | App.tsx | pages | handigo-web/src/App.tsx:25 |
| handigo-web | App.tsx | routes | handigo-web/src/App.tsx:7 |
| handigo-web | components | assets | handigo-web/src/components/auth/AuthLayout.tsx:3 |
| handigo-web | components | features | handigo-web/src/components/auth/ProfileRoute.tsx:2 |
| handigo-web | components | hooks | handigo-web/src/components/common/Navbar.tsx:13 |
| handigo-web | components | pages | handigo-web/src/components/auth/HomeRoute.tsx:1 |
| handigo-web | components | realtime | handigo-web/src/components/common/notification-bell/useNotificationSocket.ts:2 |
| handigo-web | components | types | handigo-web/src/components/common/navbar/NavbarLinks.tsx:4 |
| handigo-web | components | utils | handigo-web/src/components/common/chart/BarChart.tsx:13 |
| handigo-web | features | api | handigo-web/src/features/admin/api/admin.api.ts:1 |
| handigo-web | features | components | handigo-web/src/features/admin/components/applications/ApplicationDetailModal.tsx:1 |
| handigo-web | features | realtime | handigo-web/src/features/booking/components/detail/useBookingDetailData.ts:5 |
| handigo-web | features | types | handigo-web/src/features/admin/components/category-services/category-service.helpers.ts:3 |
| handigo-web | features | utils | handigo-web/src/features/admin/components/cases/useCaseDetailController.ts:9 |
| handigo-web | main.tsx | App.tsx | handigo-web/src/main.tsx:12 |
| handigo-web | main.tsx | features | handigo-web/src/main.tsx:13 |
| handigo-web | pages | components | handigo-web/src/pages/LandingPage.tsx:12 |
| handigo-web | pages | features | handigo-web/src/pages/LandingPage.tsx:15 |
| handigo-web | realtime | api | handigo-web/src/realtime/authenticatedSocket.ts:7 |
| handigo-web | routes | components | handigo-web/src/routes/admin-routes.tsx:2 |
| handigo-web | routes | features | handigo-web/src/routes/admin-lazy-pages.tsx:7 |
| handigo-web | utils | types | handigo-web/src/utils/orderStatus.ts:19 |

## Phạm vi

Chỉ sửa sheet package diagram, không thay đổi mã nguồn ứng dụng. Sơ đồ giữ lại các khung/thẻ file đã có; public là thư mục cấp gốc của handigo-web và tsconfig thực tế là các file .json, nên vị trí/nhãn cũ của các ô này cần hiệu chỉnh nếu tiếp tục chuẩn hóa cây thư mục. Chúng không được sử dụng để suy ra phụ thuộc import.

Kiểm tra: XML đọc lại thành công; đủ 9 sheet; 8 sheet class giữ nguyên; không trùng ID; mọi đầu mút quan hệ đều tồn tại; từng dependency import có dẫn chứng trong package-dependencies.json. Chưa render bằng ứng dụng draw.io.
