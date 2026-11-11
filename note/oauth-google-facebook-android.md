# Cấu hình đăng nhập Google và Facebook cho Handigo Android

Nếu web đã đăng nhập được, dùng lại Google Cloud project và Meta App của **cùng môi trường** rồi thêm cấu hình Android. Các ID và token được cấp từ trang quản trị của Google và Meta.

## Google

1. Vào **Google Cloud → Google Auth Platform → Clients**, lấy **Web OAuth Client ID** của Handigo Web.
2. Trong cùng project, tạo **Android OAuth Client** với package `com.handigo.handigo_app` và SHA-1 của chứng chỉ ký bản cài đặt.
3. Dùng **Web OAuth Client ID** cho `GOOGLE_SERVER_CLIENT_ID` trên app và `VITE_GOOGLE_CLIENT_ID` trên web. Backend phải chấp nhận ID này qua `GOOGLE_CLIENT_ID` hoặc `GOOGLE_CLIENT_IDS`.

## Facebook

1. Vào **Meta Developer Console**, mở Meta App của Handigo Web, thêm nền tảng Android với package `com.handigo.handigo_app` và key hash của chứng chỉ ký.
2. Lấy **App ID** và **Client Token** trong phần cài đặt Meta App. Dùng cùng **App ID** cho `FACEBOOK_APP_ID` trên app và backend, và `VITE_FACEBOOK_APP_ID` trên web.
3. Truyền **Client Token** qua `FACEBOOK_CLIENT_TOKEN` cho app. **App Secret** chỉ đặt ở backend qua `FACEBOOK_APP_SECRET`.

## Chạy thử

Khi chạy hoặc build Flutter, truyền ba giá trị của app bằng `--dart-define`. Xem lệnh mẫu trong [README của app](../handigo-app/README.md#đăng-nhập-google-và-facebook-trên-android).

APK dev dùng bộ cấu hình của backend dev. Với bản phát hành, đăng ký SHA-1 và key hash của chứng chỉ thực tế ký bản cài đặt, kể cả chứng chỉ Play App Signing nếu phát hành qua Google Play.
