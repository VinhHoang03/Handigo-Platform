# Cấu hình Google Cloud Vision OCR bằng ADC

Backend dùng `@google-cloud/vision` và **Application Default Credentials (ADC)**. Code chỉ khởi tạo:

```ts
const client = new vision.ImageAnnotatorClient();
```

Code không chứa API key, đường dẫn JSON hoặc thông tin tài khoản. Google Auth Library tự tìm credential phù hợp với môi trường chạy.

## Bạn cần làm gì ở máy local?

Bạn đã có Google Cloud project và billing cho Places, vì vậy có thể dùng lại chính project đó. Places vẫn dùng API key hiện tại; Vision OCR dùng credential ADC và không dùng chung API key Places.

### Bước 1: Bật Cloud Vision API

Mở Google Cloud Console, chọn đúng project đang dùng cho Places, sau đó vào:

```text
APIs & Services → Library → Cloud Vision API → Enable
```

Hoặc dùng lệnh sau sau khi đã cài Google Cloud CLI:

```powershell
gcloud services enable vision.googleapis.com --project YOUR_PROJECT_ID
```

Thay `YOUR_PROJECT_ID` bằng Project ID, không phải tên hiển thị của project.

### Bước 2: Cài Google Cloud CLI

Kiểm tra máy đã có CLI hay chưa:

```powershell
gcloud --version
```

Nếu PowerShell báo không tìm thấy lệnh, cài Google Cloud CLI rồi mở lại terminal.

### Bước 3: Chọn tài khoản và project

```powershell
gcloud init
gcloud config set project YOUR_PROJECT_ID
```

`gcloud init` cấu hình tài khoản dùng cho CLI. Đây chưa phải credential ADC mà Node.js sử dụng, nên vẫn cần bước tiếp theo.

### Bước 4: Tạo credential ADC cho ứng dụng local

```powershell
gcloud auth application-default login
```

Trình duyệt sẽ mở để bạn đăng nhập tài khoản Google có quyền truy cập project. Lệnh này tạo credential ADC trong thư mục cấu hình của người dùng trên máy, không tạo file trong repository.

Sau đó gắn project dùng để tính quota và billing cho credential:

```powershell
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

Nếu lệnh báo thiếu quyền `serviceusage.services.use`, tài khoản cần quyền **Service Usage Consumer** (`roles/serviceusage.serviceUsageConsumer`) trên project.

### Bước 5: Xóa cấu hình JSON cũ nếu đã từng đặt

ADC ưu tiên `GOOGLE_APPLICATION_CREDENTIALS` trước credential do `gcloud auth application-default login` tạo ra. Nếu `.env` backend đang có dòng dưới đây thì hãy xóa dòng đó:

```env
GOOGLE_APPLICATION_CREDENTIALS=...
```

Nếu biến chỉ được đặt trong PowerShell hiện tại, xóa bằng:

```powershell
Remove-Item Env:\GOOGLE_APPLICATION_CREDENTIALS -ErrorAction SilentlyContinue
```

Không cần thêm API key hoặc biến môi trường mới cho OCR local.

### Bước 6: Chạy backend

```powershell
cd handigo-backend
npm run dev
```

Khi OCR được gọi, Google client sẽ tự đọc ADC đã tạo ở bước 4.

## Kiểm tra ADC

Có thể kiểm tra credential có lấy được access token hay không:

```powershell
gcloud auth application-default print-access-token
```

Nếu lệnh trả về token, ADC local đã tồn tại. Không copy token này vào `.env`, source code hoặc gửi cho người khác.

Để test OCR, đăng nhập Handigo lấy access token rồi gọi:

```powershell
curl.exe -X POST "http://localhost:5000/api/ocr/extract" `
  -H "Authorization: Bearer HANDIGO_ACCESS_TOKEN" `
  -F "file=@C:\duong-dan\sample.png"
```

Response thành công:

```json
{
  "success": true,
  "text": "Nội dung được nhận diện đầy đủ"
}
```

## Cấu hình production

ADC là cơ chế tìm credential, không có nghĩa production phải chạy `gcloud auth application-default login`. Không chạy lệnh đăng nhập cá nhân trong server production.

### Nếu deploy trên Google Cloud

Với Cloud Run, Compute Engine, GKE hoặc App Engine:

1. Tạo Service Account dành cho backend.
2. Cấp quyền tối thiểu cần thiết để gọi dịch vụ và sử dụng project quota.
3. Gán Service Account đó cho Cloud Run service, VM, pod hoặc workload.
4. Không đặt `GOOGLE_APPLICATION_CREDENTIALS`.
5. Không đưa JSON key vào image.

ADC sẽ lấy credential từ metadata server của Google Cloud. Đây là hướng production ưu tiên vì không phải quản lý file key dài hạn.

### Nếu deploy ngoài Google Cloud

Ưu tiên Workload Identity Federation nếu nền tảng hỗ trợ. Nếu buộc phải dùng Service Account JSON:

1. Lưu JSON trong secret manager của nền tảng.
2. Mount secret thành file chỉ đọc.
3. Đặt `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới file đã mount.

```env
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/google-vision.json
```

Đây vẫn là ADC: biến môi trường chỉ định một nguồn credential trong chuỗi tìm kiếm ADC. Không copy file vào source code hoặc Docker image.

## ADC hoạt động như thế nào?

Google Auth Library tìm credential theo thứ tự chính:

```text
1. GOOGLE_APPLICATION_CREDENTIALS, nếu biến này tồn tại
2. Credential local do gcloud auth application-default login tạo ra
3. Service Account được gán cho workload trên Google Cloud
```

Vì vậy:

- Local: dùng bước 2.
- Production trên Google Cloud: dùng bước 3.
- Production ngoài Google Cloud khi chưa có federation: có thể dùng bước 1.

## Luồng OCR

```text
Người dùng tải file
→ Backend xác thực JWT và validate file
→ Vision client lấy credential qua ADC
→ Backend gửi file tới Google Cloud Vision
→ Vision trả kết quả nhận diện
→ Backend trích xuất text hoặc gợi ý trường CCCD/chứng chỉ
→ Response trả về frontend
```

Raw text OCR không được ghi database. OCR chỉ gợi ý thông tin CCCD, hộ chiếu và chứng chỉ; người dùng phải xác nhận dữ liệu, còn admin là bên duyệt hồ sơ provider.

## API và giới hạn

```http
POST /api/ocr/extract
Authorization: Bearer <access-token>
Content-Type: multipart/form-data
```

Form field là `file`:

- JPG, JPEG, PNG hoặc PDF.
- Tối đa 10 MB.
- PDF tối đa 5 trang.
- Backend kiểm tra MIME type và chữ ký đầu tệp.
- Ảnh dùng `client.textDetection()`.
- PDF dùng `client.batchAnnotateFiles()`.
- Endpoint có JWT và rate limit để bảo vệ quota, chi phí.

## Cấu trúc module

- `src/modules/ocr/ocr.service.ts`: khởi tạo Vision client bằng ADC, gọi OCR và phân tích gợi ý tài liệu.
- `src/modules/ocr/ocr.controller.ts`: xử lý request/response.
- `src/modules/ocr/ocr.routes.ts`: khai báo endpoint, JWT và rate limit.
- `src/modules/ocr/ocr.types.ts`: định nghĩa loại tài liệu và kết quả.
- `src/modules/ocr/ocr.upload.ts`: validate multipart upload.

Khi mở rộng OCR CCCD hoặc chứng chỉ nghề, thêm parser theo `OcrDocumentKind`; phần xác thực ADC và phần gọi Vision không cần thay đổi.

## Lỗi thường gặp

- `Could not load the default credentials`: chưa chạy `gcloud auth application-default login`, hoặc server production chưa được gán Service Account.
- `PERMISSION_DENIED`: tài khoản/Service Account không có quyền cần thiết, Vision API chưa bật hoặc đang chọn sai project.
- `API has not been used...`: bật `vision.googleapis.com` trong đúng project.
- Quota project error: chạy `gcloud auth application-default set-quota-project YOUR_PROJECT_ID`.
- Local vẫn đọc JSON cũ: xóa biến `GOOGLE_APPLICATION_CREDENTIALS` khỏi `.env` và terminal rồi khởi động lại backend.
