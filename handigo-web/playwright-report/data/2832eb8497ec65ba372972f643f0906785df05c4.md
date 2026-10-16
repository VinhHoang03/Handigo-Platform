# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: real-api.spec.ts >> Backend thật >> Tạo đơn bằng service, option và address lấy từ backend thật
- Location: tests\e2e\real-api.spec.ts:62:3

# Error details

```
Error: {"success":false,"message":"Chưa có chuyên gia phù hợp với dịch vụ và địa chỉ đã chọn."}

expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 409
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - navigation [ref=e4]:
      - generic [ref=e5]:
        - link "Logo Handigo Handigo" [ref=e6] [cursor=pointer]:
          - /url: /
          - img "Logo Handigo" [ref=e7]
          - generic [ref=e8]: Handigo
        - generic [ref=e9]:
          - link "Trang chủ" [ref=e10] [cursor=pointer]:
            - /url: /
          - link "Dịch vụ expand_more" [ref=e12] [cursor=pointer]:
            - /url: /customer/services
            - text: Dịch vụ
            - generic [ref=e13]: expand_more
          - link "Giới thiệu" [ref=e14] [cursor=pointer]:
            - /url: /gioi-thieu
          - link "Tin tức" [ref=e15] [cursor=pointer]:
            - /url: /tin-tuc
          - link "Hỗ trợ" [ref=e16] [cursor=pointer]:
            - /url: /ho-tro
        - generic [ref=e17]:
          - button "cleaning_services Đặt dịch vụ" [ref=e18] [cursor=pointer]:
            - generic [ref=e19]: cleaning_services
            - text: Đặt dịch vụ
          - button "Thông báo" [ref=e21] [cursor=pointer]:
            - generic [ref=e22]: notifications
          - button "Tin nhắn" [ref=e24] [cursor=pointer]:
            - generic [ref=e25]: chat_bubble
          - button "Mở menu tài khoản" [ref=e27] [cursor=pointer]:
            - img "Ảnh đại diện" [ref=e28]
    - main [ref=e29]:
      - generic [ref=e30]:
        - generic [ref=e31]:
          - heading "Đặt dịch vụ tại nhà nhanh chóng & uy tín" [level=1] [ref=e32]
          - paragraph [ref=e33]: Kết nối với hàng nghìn thợ chuyên nghiệp đã qua kiểm duyệt. Khắc phục sự cố ngôi nhà của bạn chỉ với vài cú chạm.
          - generic [ref=e34]:
            - generic [ref=e36]:
              - generic [ref=e37]: search
              - textbox "Tìm dịch vụ" [ref=e38]
            - button "location_on Vị trí của bạn" [ref=e39] [cursor=pointer]:
              - generic [ref=e40]: location_on
              - generic [ref=e41]: Vị trí của bạn
            - button "Tìm thợ ngay" [ref=e42] [cursor=pointer]
          - generic [ref=e43]:
            - generic [ref=e44]:
              - img "Ảnh đại diện người dùng" [ref=e45]
              - img "Ảnh đại diện người dùng" [ref=e46]
              - img "Ảnh đại diện người dùng" [ref=e47]
              - generic [ref=e48]: +2k
            - paragraph [ref=e49]: Hơn 50,000+ việc đã hoàn thành thành công
        - generic [ref=e50]:
          - img "Minh họa dịch vụ tại nhà" [ref=e53]
          - generic [ref=e54]:
            - generic [ref=e55]: engineering
            - generic [ref=e57]:
              - paragraph [ref=e58]: Thợ đang đến
              - paragraph [ref=e59]: Chỉ còn 5 phút
      - generic [ref=e60]:
        - generic [ref=e61]:
          - generic [ref=e62]:
            - heading "Danh mục dịch vụ" [level=2] [ref=e63]
            - paragraph [ref=e64]: Mọi vấn đề trong gia đình đều có chuyên gia phù hợp hỗ trợ bạn
          - link "Xem tất cả arrow_forward" [ref=e65] [cursor=pointer]:
            - /url: /customer/services
            - text: Xem tất cả
            - generic [ref=e66]: arrow_forward
        - generic [ref=e67]:
          - link [ref=e68] [cursor=pointer]:
            - /url: /customer/services?categoryId=6a32b9f5311d1698ee5a99d5
            - generic [ref=e69]:
              - heading "Chuyển Nhà & Vận Chuyển" [level=3] [ref=e72]
              - paragraph [ref=e73]: Xem các dịch vụ phù hợp trong danh mục
          - link [ref=e74] [cursor=pointer]:
            - /url: /customer/services?categoryId=6a32ba1b311d1698ee5a99d6
            - generic [ref=e75]:
              - heading "Chăm Sóc Nhà Cửa" [level=3] [ref=e78]
              - paragraph [ref=e79]: Xem các dịch vụ phù hợp trong danh mục
          - link [ref=e80] [cursor=pointer]:
            - /url: /customer/services?categoryId=6a316da0dbe9d7f4da84ad10
            - generic [ref=e81]:
              - heading "Diệt Côn Trùng" [level=3] [ref=e84]
              - paragraph [ref=e85]: Xem các dịch vụ phù hợp trong danh mục
          - link [ref=e86] [cursor=pointer]:
            - /url: /customer/services?categoryId=6a32b8a4311d1698ee5a99d3
            - generic [ref=e87]:
              - heading "Lắp Đặt & Thi Công" [level=3] [ref=e90]
              - paragraph [ref=e91]: Xem các dịch vụ phù hợp trong danh mục
          - link [ref=e92] [cursor=pointer]:
            - /url: /customer/services?categoryId=6a32bdf1311d1698ee5a99d9
            - generic [ref=e93]:
              - heading "Nội Thất & Đồ Gỗ" [level=3] [ref=e96]
              - paragraph [ref=e97]: Xem các dịch vụ phù hợp trong danh mục
          - link [ref=e98] [cursor=pointer]:
            - /url: /customer/services?categoryId=6a32b9b9311d1698ee5a99d4
            - generic [ref=e99]:
              - heading "Sơn & Hoàn Thiện Nhà Cửa" [level=3] [ref=e102]
              - paragraph [ref=e103]: Xem các dịch vụ phù hợp trong danh mục
          - link [ref=e104] [cursor=pointer]:
            - /url: /customer/services?categoryId=6a316d25dbe9d7f4da84ad0d
            - generic [ref=e105]:
              - heading "Thiết Bị Gia Dụng" [level=3] [ref=e108]
              - paragraph [ref=e109]: Xem các dịch vụ phù hợp trong danh mục
          - link [ref=e110] [cursor=pointer]:
            - /url: /customer/services?categoryId=6a3064441b36f54714e526bf
            - generic [ref=e111]:
              - heading "Vệ Sinh & Làm Sạch" [level=3] [ref=e114]
              - paragraph [ref=e115]: Xem các dịch vụ phù hợp trong danh mục
      - generic [ref=e117]:
        - generic [ref=e119]:
          - heading "Thợ chuyên nghiệp trong hệ thống" [level=2] [ref=e120]
          - paragraph [ref=e121]: Các thợ có điểm đánh giá cao và hồ sơ đã được xác minh
        - region "Danh sách thợ nổi bật" [ref=e122]:
          - generic [ref=e124]:
            - generic [ref=e125]:
              - img "Peter Nguyễn" [ref=e126]
              - generic [ref=e127]:
                - generic [ref=e128]: star
                - generic [ref=e129]: "5.0"
            - generic [ref=e130]:
              - heading "Peter Nguyễn" [level=4] [ref=e131]
              - generic [ref=e132]:
                - generic [ref=e133]: location_on
                - generic [ref=e134]: Phường Đồng Hới, Tỉnh Quảng Trị
              - generic [ref=e135]:
                - generic [ref=e136]: Vệ Sinh Điều Hòa
                - generic [ref=e137]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e138] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e140]:
            - generic [ref=e141]:
              - img "Tran Duc Trung K DN" [ref=e142]
              - generic [ref=e143]:
                - generic [ref=e144]: star
                - generic [ref=e145]: "5.0"
            - generic [ref=e146]:
              - heading "Tran Duc Trung K DN" [level=4] [ref=e147]
              - generic [ref=e148]:
                - generic [ref=e149]: location_on
                - generic [ref=e150]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e151]:
                - generic [ref=e152]: Sửa rò rỉ vòi nước nhà bếp
                - generic [ref=e153]: Bình Nóng Lạnh
              - link "Xem dịch vụ" [ref=e154] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e156]:
            - generic [ref=e157]:
              - img "Phạm Chánh" [ref=e158]
              - generic [ref=e159]:
                - generic [ref=e160]: star
                - generic [ref=e161]: "5.0"
            - generic [ref=e162]:
              - heading "Phạm Chánh" [level=4] [ref=e163]
              - generic [ref=e164]:
                - generic [ref=e165]: location_on
                - generic [ref=e166]: Phường An Hải, Thành phố Đà Nẵng
              - generic [ref=e167]:
                - generic [ref=e168]: Sửa rò rỉ vòi nước nhà bếp
                - generic [ref=e169]: Chuyển Trọ
              - link "Xem dịch vụ" [ref=e170] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e172]:
            - generic [ref=e173]:
              - img "Bùi Lê Long Đại" [ref=e174]
              - generic [ref=e175]:
                - generic [ref=e176]: star
                - generic [ref=e177]: "0.0"
            - generic [ref=e178]:
              - heading "Bùi Lê Long Đại" [level=4] [ref=e179]
              - generic [ref=e180]:
                - generic [ref=e181]: location_on
                - generic [ref=e182]: Xã Bảo Lâm, Tỉnh Cao Bằng
              - generic [ref=e183]:
                - generic [ref=e184]: Chuyển Nhà
                - generic [ref=e185]: Vệ Sinh Điều Hòa
              - link "Xem dịch vụ" [ref=e186] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e188]:
            - generic [ref=e189]:
              - img "Provider01" [ref=e190]
              - generic [ref=e191]:
                - generic [ref=e192]: star
                - generic [ref=e193]: "0.0"
            - generic [ref=e194]:
              - heading "Provider01" [level=4] [ref=e195]
              - generic [ref=e196]:
                - generic [ref=e197]: location_on
                - generic [ref=e198]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e199]:
                - generic [ref=e200]: Vệ Sinh Điều Hòa
                - generic [ref=e201]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e202] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e204]:
            - generic [ref=e205]:
              - img "Provider02" [ref=e206]
              - generic [ref=e207]:
                - generic [ref=e208]: star
                - generic [ref=e209]: "0.0"
            - generic [ref=e210]:
              - heading "Provider02" [level=4] [ref=e211]
              - generic [ref=e212]:
                - generic [ref=e213]: location_on
                - generic [ref=e214]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e215]:
                - generic [ref=e216]: Vệ Sinh Điều Hòa
                - generic [ref=e217]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e218] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e220]:
            - generic [ref=e221]:
              - img "Provider03" [ref=e222]
              - generic [ref=e223]:
                - generic [ref=e224]: star
                - generic [ref=e225]: "0.0"
            - generic [ref=e226]:
              - heading "Provider03" [level=4] [ref=e227]
              - generic [ref=e228]:
                - generic [ref=e229]: location_on
                - generic [ref=e230]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e231]:
                - generic [ref=e232]: Vệ Sinh Điều Hòa
                - generic [ref=e233]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e234] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e236]:
            - generic [ref=e237]:
              - img "Nguyễn Ngọc Anh Tuấn" [ref=e238]
              - generic [ref=e239]:
                - generic [ref=e240]: star
                - generic [ref=e241]: "0.0"
            - generic [ref=e242]:
              - heading "Nguyễn Ngọc Anh Tuấn" [level=4] [ref=e243]
              - generic [ref=e244]:
                - generic [ref=e245]: location_on
                - generic [ref=e246]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e247]:
                - generic [ref=e248]: Sửa rò rỉ vòi nước nhà bếp
                - generic [ref=e249]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e250] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e252]:
            - generic [ref=e253]:
              - img "Hà Văn Ân" [ref=e254]
              - generic [ref=e255]:
                - generic [ref=e256]: star
                - generic [ref=e257]: "0.0"
            - generic [ref=e258]:
              - heading "Hà Văn Ân" [level=4] [ref=e259]
              - generic [ref=e260]:
                - generic [ref=e261]: location_on
                - generic [ref=e262]: Phường Tân Giang, Tỉnh Cao Bằng
              - generic [ref=e263]: Sửa rò rỉ vòi nước nhà bếp
              - link "Xem dịch vụ" [ref=e265] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e267]:
            - generic [ref=e268]:
              - img "Peter Nguyễn" [ref=e269]
              - generic [ref=e270]:
                - generic [ref=e271]: star
                - generic [ref=e272]: "5.0"
            - generic [ref=e273]:
              - heading "Peter Nguyễn" [level=4] [ref=e274]
              - generic [ref=e275]:
                - generic [ref=e276]: location_on
                - generic [ref=e277]: Phường Đồng Hới, Tỉnh Quảng Trị
              - generic [ref=e278]:
                - generic [ref=e279]: Vệ Sinh Điều Hòa
                - generic [ref=e280]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e281] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e283]:
            - generic [ref=e284]:
              - img "Tran Duc Trung K DN" [ref=e285]
              - generic [ref=e286]:
                - generic [ref=e287]: star
                - generic [ref=e288]: "5.0"
            - generic [ref=e289]:
              - heading "Tran Duc Trung K DN" [level=4] [ref=e290]
              - generic [ref=e291]:
                - generic [ref=e292]: location_on
                - generic [ref=e293]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e294]:
                - generic [ref=e295]: Sửa rò rỉ vòi nước nhà bếp
                - generic [ref=e296]: Bình Nóng Lạnh
              - link "Xem dịch vụ" [ref=e297] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e299]:
            - generic [ref=e300]:
              - img "Phạm Chánh" [ref=e301]
              - generic [ref=e302]:
                - generic [ref=e303]: star
                - generic [ref=e304]: "5.0"
            - generic [ref=e305]:
              - heading "Phạm Chánh" [level=4] [ref=e306]
              - generic [ref=e307]:
                - generic [ref=e308]: location_on
                - generic [ref=e309]: Phường An Hải, Thành phố Đà Nẵng
              - generic [ref=e310]:
                - generic [ref=e311]: Sửa rò rỉ vòi nước nhà bếp
                - generic [ref=e312]: Chuyển Trọ
              - link "Xem dịch vụ" [ref=e313] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e315]:
            - generic [ref=e316]:
              - img "Bùi Lê Long Đại" [ref=e317]
              - generic [ref=e318]:
                - generic [ref=e319]: star
                - generic [ref=e320]: "0.0"
            - generic [ref=e321]:
              - heading "Bùi Lê Long Đại" [level=4] [ref=e322]
              - generic [ref=e323]:
                - generic [ref=e324]: location_on
                - generic [ref=e325]: Xã Bảo Lâm, Tỉnh Cao Bằng
              - generic [ref=e326]:
                - generic [ref=e327]: Chuyển Nhà
                - generic [ref=e328]: Vệ Sinh Điều Hòa
              - link "Xem dịch vụ" [ref=e329] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e331]:
            - generic [ref=e332]:
              - img "Provider01" [ref=e333]
              - generic [ref=e334]:
                - generic [ref=e335]: star
                - generic [ref=e336]: "0.0"
            - generic [ref=e337]:
              - heading "Provider01" [level=4] [ref=e338]
              - generic [ref=e339]:
                - generic [ref=e340]: location_on
                - generic [ref=e341]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e342]:
                - generic [ref=e343]: Vệ Sinh Điều Hòa
                - generic [ref=e344]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e345] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e347]:
            - generic [ref=e348]:
              - img "Provider02" [ref=e349]
              - generic [ref=e350]:
                - generic [ref=e351]: star
                - generic [ref=e352]: "0.0"
            - generic [ref=e353]:
              - heading "Provider02" [level=4] [ref=e354]
              - generic [ref=e355]:
                - generic [ref=e356]: location_on
                - generic [ref=e357]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e358]:
                - generic [ref=e359]: Vệ Sinh Điều Hòa
                - generic [ref=e360]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e361] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e363]:
            - generic [ref=e364]:
              - img "Provider03" [ref=e365]
              - generic [ref=e366]:
                - generic [ref=e367]: star
                - generic [ref=e368]: "0.0"
            - generic [ref=e369]:
              - heading "Provider03" [level=4] [ref=e370]
              - generic [ref=e371]:
                - generic [ref=e372]: location_on
                - generic [ref=e373]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e374]:
                - generic [ref=e375]: Vệ Sinh Điều Hòa
                - generic [ref=e376]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e377] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e379]:
            - generic [ref=e380]:
              - img "Nguyễn Ngọc Anh Tuấn" [ref=e381]
              - generic [ref=e382]:
                - generic [ref=e383]: star
                - generic [ref=e384]: "0.0"
            - generic [ref=e385]:
              - heading "Nguyễn Ngọc Anh Tuấn" [level=4] [ref=e386]
              - generic [ref=e387]:
                - generic [ref=e388]: location_on
                - generic [ref=e389]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e390]:
                - generic [ref=e391]: Sửa rò rỉ vòi nước nhà bếp
                - generic [ref=e392]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e393] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e395]:
            - generic [ref=e396]:
              - img "Hà Văn Ân" [ref=e397]
              - generic [ref=e398]:
                - generic [ref=e399]: star
                - generic [ref=e400]: "0.0"
            - generic [ref=e401]:
              - heading "Hà Văn Ân" [level=4] [ref=e402]
              - generic [ref=e403]:
                - generic [ref=e404]: location_on
                - generic [ref=e405]: Phường Tân Giang, Tỉnh Cao Bằng
              - generic [ref=e406]: Sửa rò rỉ vòi nước nhà bếp
              - link "Xem dịch vụ" [ref=e408] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e410]:
            - generic [ref=e411]:
              - img "Peter Nguyễn" [ref=e412]
              - generic [ref=e413]:
                - generic [ref=e414]: star
                - generic [ref=e415]: "5.0"
            - generic [ref=e416]:
              - heading "Peter Nguyễn" [level=4] [ref=e417]
              - generic [ref=e418]:
                - generic [ref=e419]: location_on
                - generic [ref=e420]: Phường Đồng Hới, Tỉnh Quảng Trị
              - generic [ref=e421]:
                - generic [ref=e422]: Vệ Sinh Điều Hòa
                - generic [ref=e423]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e424] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e426]:
            - generic [ref=e427]:
              - img "Tran Duc Trung K DN" [ref=e428]
              - generic [ref=e429]:
                - generic [ref=e430]: star
                - generic [ref=e431]: "5.0"
            - generic [ref=e432]:
              - heading "Tran Duc Trung K DN" [level=4] [ref=e433]
              - generic [ref=e434]:
                - generic [ref=e435]: location_on
                - generic [ref=e436]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e437]:
                - generic [ref=e438]: Sửa rò rỉ vòi nước nhà bếp
                - generic [ref=e439]: Bình Nóng Lạnh
              - link "Xem dịch vụ" [ref=e440] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e442]:
            - generic [ref=e443]:
              - img "Phạm Chánh" [ref=e444]
              - generic [ref=e445]:
                - generic [ref=e446]: star
                - generic [ref=e447]: "5.0"
            - generic [ref=e448]:
              - heading "Phạm Chánh" [level=4] [ref=e449]
              - generic [ref=e450]:
                - generic [ref=e451]: location_on
                - generic [ref=e452]: Phường An Hải, Thành phố Đà Nẵng
              - generic [ref=e453]:
                - generic [ref=e454]: Sửa rò rỉ vòi nước nhà bếp
                - generic [ref=e455]: Chuyển Trọ
              - link "Xem dịch vụ" [ref=e456] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e458]:
            - generic [ref=e459]:
              - img "Bùi Lê Long Đại" [ref=e460]
              - generic [ref=e461]:
                - generic [ref=e462]: star
                - generic [ref=e463]: "0.0"
            - generic [ref=e464]:
              - heading "Bùi Lê Long Đại" [level=4] [ref=e465]
              - generic [ref=e466]:
                - generic [ref=e467]: location_on
                - generic [ref=e468]: Xã Bảo Lâm, Tỉnh Cao Bằng
              - generic [ref=e469]:
                - generic [ref=e470]: Chuyển Nhà
                - generic [ref=e471]: Vệ Sinh Điều Hòa
              - link "Xem dịch vụ" [ref=e472] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e474]:
            - generic [ref=e475]:
              - img "Provider01" [ref=e476]
              - generic [ref=e477]:
                - generic [ref=e478]: star
                - generic [ref=e479]: "0.0"
            - generic [ref=e480]:
              - heading "Provider01" [level=4] [ref=e481]
              - generic [ref=e482]:
                - generic [ref=e483]: location_on
                - generic [ref=e484]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e485]:
                - generic [ref=e486]: Vệ Sinh Điều Hòa
                - generic [ref=e487]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e488] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e490]:
            - generic [ref=e491]:
              - img "Provider02" [ref=e492]
              - generic [ref=e493]:
                - generic [ref=e494]: star
                - generic [ref=e495]: "0.0"
            - generic [ref=e496]:
              - heading "Provider02" [level=4] [ref=e497]
              - generic [ref=e498]:
                - generic [ref=e499]: location_on
                - generic [ref=e500]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e501]:
                - generic [ref=e502]: Vệ Sinh Điều Hòa
                - generic [ref=e503]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e504] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e506]:
            - generic [ref=e507]:
              - img "Provider03" [ref=e508]
              - generic [ref=e509]:
                - generic [ref=e510]: star
                - generic [ref=e511]: "0.0"
            - generic [ref=e512]:
              - heading "Provider03" [level=4] [ref=e513]
              - generic [ref=e514]:
                - generic [ref=e515]: location_on
                - generic [ref=e516]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e517]:
                - generic [ref=e518]: Vệ Sinh Điều Hòa
                - generic [ref=e519]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e520] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e522]:
            - generic [ref=e523]:
              - img "Nguyễn Ngọc Anh Tuấn" [ref=e524]
              - generic [ref=e525]:
                - generic [ref=e526]: star
                - generic [ref=e527]: "0.0"
            - generic [ref=e528]:
              - heading "Nguyễn Ngọc Anh Tuấn" [level=4] [ref=e529]
              - generic [ref=e530]:
                - generic [ref=e531]: location_on
                - generic [ref=e532]: Phường Ngũ Hành Sơn, Thành phố Đà Nẵng
              - generic [ref=e533]:
                - generic [ref=e534]: Sửa rò rỉ vòi nước nhà bếp
                - generic [ref=e535]: Sửa Chữa Điều Hòa
              - link "Xem dịch vụ" [ref=e536] [cursor=pointer]:
                - /url: /customer/services
          - generic [ref=e538]:
            - generic [ref=e539]:
              - img "Hà Văn Ân" [ref=e540]
              - generic [ref=e541]:
                - generic [ref=e542]: star
                - generic [ref=e543]: "0.0"
            - generic [ref=e544]:
              - heading "Hà Văn Ân" [level=4] [ref=e545]
              - generic [ref=e546]:
                - generic [ref=e547]: location_on
                - generic [ref=e548]: Phường Tân Giang, Tỉnh Cao Bằng
              - generic [ref=e549]: Sửa rò rỉ vòi nước nhà bếp
              - link "Xem dịch vụ" [ref=e551] [cursor=pointer]:
                - /url: /customer/services
      - generic [ref=e552]:
        - generic [ref=e553]:
          - generic [ref=e554]: map
          - heading "Theo dõi tiến độ" [level=3] [ref=e556]
          - paragraph [ref=e557]: Theo dõi trạng thái thực hiện dịch vụ ngay trên ứng dụng.
        - generic [ref=e558]:
          - generic [ref=e559]: verified_user
          - heading "Thợ đã xác minh" [level=3] [ref=e561]
          - paragraph [ref=e562]: Hồ sơ và chuyên môn của thợ được kiểm tra trước khi hoạt động.
        - generic [ref=e563]:
          - generic [ref=e564]: payments
          - heading "Thanh toán an toàn" [level=3] [ref=e566]
          - paragraph [ref=e567]: Chi phí rõ ràng và hỗ trợ thanh toán thuận tiện trên hệ thống.
        - generic [ref=e568]:
          - generic [ref=e569]: support_agent
          - heading "Hỗ trợ khi cần" [level=3] [ref=e571]
          - paragraph [ref=e572]: Đội ngũ hỗ trợ sẵn sàng tiếp nhận và xử lý vấn đề của bạn.
      - generic [ref=e575]:
        - generic [ref=e576]:
          - generic [ref=e577]: 10,000+
          - paragraph [ref=e578]: Khách hàng tin dùng
        - generic [ref=e579]:
          - generic [ref=e580]: 2,000+
          - paragraph [ref=e581]: Thợ chuyên nghiệp
        - generic [ref=e582]:
          - generic [ref=e583]: 50,000+
          - paragraph [ref=e584]: Công việc đã hoàn thành
      - generic [ref=e585]:
        - heading "Đánh giá từ khách hàng" [level=2] [ref=e588]
        - generic [ref=e589]:
          - generic [ref=e590]:
            - generic [ref=e591]:
              - generic [ref=e592]: star
              - generic [ref=e593]: star
              - generic [ref=e594]: star
              - generic [ref=e595]: star
              - generic [ref=e596]: star
            - generic [ref=e597]:
              - img "Nguyễn Anh Tuấn" [ref=e598]
              - generic [ref=e599]:
                - heading "Nguyễn Anh Tuấn" [level=4] [ref=e600]
                - paragraph [ref=e601]: Vệ Sinh Điều Hòa
          - generic [ref=e602]:
            - generic [ref=e603]:
              - generic [ref=e604]: star
              - generic [ref=e605]: star
              - generic [ref=e606]: star
              - generic [ref=e607]: star
              - generic [ref=e608]: star
            - paragraph [ref=e609]: "\"Rất xứng đáng\""
            - generic [ref=e610]:
              - img "Nguyễn Anh Tuấn" [ref=e611]
              - generic [ref=e612]:
                - heading "Nguyễn Anh Tuấn" [level=4] [ref=e613]
                - paragraph [ref=e614]: Sửa Chữa Điều Hòa
          - generic [ref=e615]:
            - generic [ref=e616]:
              - generic [ref=e617]: star
              - generic [ref=e618]: star
              - generic [ref=e619]: star
              - generic [ref=e620]: star
              - generic [ref=e621]: star
            - paragraph [ref=e622]: "\"rất hài lòng\""
            - generic [ref=e623]:
              - img "Nguyễn Anh Tuấn" [ref=e624]
              - generic [ref=e625]:
                - heading "Nguyễn Anh Tuấn" [level=4] [ref=e626]
                - paragraph [ref=e627]: Vệ Sinh Điều Hòa
          - generic [ref=e628]:
            - generic [ref=e629]:
              - generic [ref=e630]: star
              - generic [ref=e631]: star
              - generic [ref=e632]: star
              - generic [ref=e633]: star
              - generic [ref=e634]: star
            - paragraph [ref=e635]: "\"sạch, đẹp\""
            - generic [ref=e636]:
              - img "duc trung" [ref=e637]
              - generic [ref=e638]:
                - heading "duc trung" [level=4] [ref=e639]
                - paragraph [ref=e640]: Vệ Sinh Điều Hòa
          - generic [ref=e641]:
            - generic [ref=e642]:
              - generic [ref=e643]: star
              - generic [ref=e644]: star
              - generic [ref=e645]: star
              - generic [ref=e646]: star
              - generic [ref=e647]: star
            - paragraph [ref=e648]: "\"tốt, chuyên nghiệp\""
            - generic [ref=e649]:
              - img "duc trung" [ref=e650]
              - generic [ref=e651]:
                - heading "duc trung" [level=4] [ref=e652]
                - paragraph [ref=e653]: Sửa Chữa Điều Hòa
          - generic [ref=e654]:
            - generic [ref=e655]:
              - generic [ref=e656]: star
              - generic [ref=e657]: star
              - generic [ref=e658]: star
              - generic [ref=e659]: star
              - generic [ref=e660]: star
            - generic [ref=e661]:
              - img "Mai Đăng Khoa" [ref=e662]
              - generic [ref=e663]:
                - heading "Mai Đăng Khoa" [level=4] [ref=e664]
                - paragraph [ref=e665]: Chuyển Nhà
            - generic [ref=e666]:
              - paragraph [ref=e667]: Phản hồi của thợ
              - paragraph [ref=e668]: Cảm ơn anh đã ủng hộ ạ <3
    - contentinfo [ref=e669]:
      - generic [ref=e670]:
        - generic [ref=e671]:
          - link "Logo Handigo Handigo" [ref=e672] [cursor=pointer]:
            - /url: /
            - img "Logo Handigo" [ref=e673]
            - generic [ref=e674]: Handigo
          - paragraph [ref=e675]: © 2026 Handigo Inc. Chuyên gia đáng tin cậy cho dịch vụ tại nhà.Giải pháp công nghệ kết nối thợ chuyên nghiệp hàng đầu Việt Nam.
          - generic [ref=e676]:
            - link "social_leaderboard" [ref=e677] [cursor=pointer]:
              - /url: /customer
            - link "smart_display" [ref=e679] [cursor=pointer]:
              - /url: /customer
            - link "language" [ref=e681] [cursor=pointer]:
              - /url: /customer
        - generic [ref=e683]:
          - heading "Dịch Vụ" [level=4] [ref=e684]
          - list [ref=e685]:
            - listitem [ref=e686]:
              - link "Sửa nước" [ref=e687] [cursor=pointer]:
                - /url: /customer
            - listitem [ref=e688]:
              - link "Sửa điện" [ref=e689] [cursor=pointer]:
                - /url: /customer
            - listitem [ref=e690]:
              - link "Vệ sinh" [ref=e691] [cursor=pointer]:
                - /url: /customer
            - listitem [ref=e692]:
              - link "Máy lạnh" [ref=e693] [cursor=pointer]:
                - /url: /customer
        - generic [ref=e694]:
          - heading "Công Ty" [level=4] [ref=e695]
          - list [ref=e696]:
            - listitem [ref=e697]:
              - link "Về chúng tôi" [ref=e698] [cursor=pointer]:
                - /url: /customer
            - listitem [ref=e699]:
              - link "Tuyển dụng" [ref=e700] [cursor=pointer]:
                - /url: /customer
            - listitem [ref=e701]:
              - link "Blog" [ref=e702] [cursor=pointer]:
                - /url: /customer
            - listitem [ref=e703]:
              - link "Báo chí" [ref=e704] [cursor=pointer]:
                - /url: /customer
        - generic [ref=e705]:
          - heading "Hỗ Trợ" [level=4] [ref=e706]
          - list [ref=e707]:
            - listitem [ref=e708]:
              - link "Trung tâm trợ giúp" [ref=e709] [cursor=pointer]:
                - /url: /customer
            - listitem [ref=e710]:
              - link "Điều khoản dịch vụ" [ref=e711] [cursor=pointer]:
                - /url: /customer
            - listitem [ref=e712]:
              - link "Chính sách bảo mật" [ref=e713] [cursor=pointer]:
                - /url: /customer
            - listitem [ref=e714]:
              - link "An toàn" [ref=e715] [cursor=pointer]:
                - /url: /customer
        - generic [ref=e716]:
          - heading "Tải Ứng Dụng" [level=4] [ref=e717]
          - generic [ref=e718]:
            - button "play_arrow TẢI TRÊN Google Play" [ref=e719] [cursor=pointer]:
              - generic [ref=e720]: play_arrow
              - generic [ref=e721]:
                - generic [ref=e722]: TẢI TRÊN
                - text: Google Play
            - button "ios Tải về trên App Store" [ref=e723] [cursor=pointer]:
              - generic [ref=e724]: ios
              - generic [ref=e725]:
                - generic [ref=e726]: Tải về trên
                - text: App Store
  - button "Mở Trợ lý Handigo" [ref=e727] [cursor=pointer]
```

# Test source

```ts
  14  | 
  15  | async function api(
  16  |   page: import('@playwright/test').Page,
  17  |   path: string,
  18  |   init?: ApiInit,
  19  |   token?: string,
  20  | ): Promise<ApiResult> {
  21  |   return page.evaluate(async ({ path, init }) => {
  22  |     const response = await fetch(`/api${path}`, {
  23  |       credentials: 'include',
  24  |       ...init,
  25  |       headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  26  |     });
  27  |     return { status: response.status, body: await response.json().catch(() => null) };
  28  |   }, {
  29  |     path,
  30  |     init: {
  31  |       ...init,
  32  |       headers: {
  33  |         ...(init?.headers || {}),
  34  |         ...(token ? { Authorization: `Bearer ${token}` } : {}),
  35  |       },
  36  |     },
  37  |   });
  38  | }
  39  | 
  40  | test.describe('Backend thật', () => {
  41  |   test.skip(!realApiEnabled, 'Bật E2E_REAL_API=1 để chạy với backend thật.');
  42  | 
  43  |   test('CUSTOMER đăng nhập qua API và mở được trang đặt dịch vụ', async ({ page }) => {
  44  |     test.skip(!customerEmail || !customerPassword,
  45  |       'Cần E2E_CUSTOMER_EMAIL và E2E_CUSTOMER_PASSWORD của tài khoản test.');
  46  | 
  47  |     await login(page);
  48  |     await expect(page).toHaveURL(/\/customer$/);
  49  |     await page.goto('/customer/bookings/new');
  50  |     await expect(page.getByRole('heading', { name: /Chọn loại dịch vụ/ })).toBeVisible();
  51  |   });
  52  | 
  53  |   test('CUSTOMER không truy cập được trang ADMIN', async ({ page }) => {
  54  |     test.skip(!customerEmail || !customerPassword,
  55  |       'Cần E2E_CUSTOMER_EMAIL và E2E_CUSTOMER_PASSWORD của tài khoản test.');
  56  | 
  57  |     await login(page);
  58  |     await page.goto('/admin/users');
  59  |     await expect(page).toHaveURL(/\/customer$/);
  60  |   });
  61  | 
  62  |   test('Tạo đơn bằng service, option và address lấy từ backend thật', async ({ page }) => {
  63  |     test.skip(!customerEmail || !customerPassword,
  64  |       'Cần E2E_CUSTOMER_EMAIL và E2E_CUSTOMER_PASSWORD của tài khoản test.');
  65  | 
  66  |     const token = await login(page);
  67  |     await expect(page).toHaveURL(/\/customer$/);
  68  |     if (!token) throw new Error('Không lấy được access token sau khi đăng nhập.');
  69  | 
  70  |     const addresses = await api(page, '/addresses', undefined, token);
  71  |     expect(addresses.status, JSON.stringify(addresses.body)).toBe(200);
  72  |     const addressBody = addresses.body as ApiEnvelope<AddressRecord[]> | null;
  73  |     const address = addressBody?.data?.[0] ?? null;
  74  |     if (!address?._id) {
  75  |       test.skip(true, 'Tài khoản test chưa có địa chỉ trong backend.');
  76  |       return;
  77  |     }
  78  | 
  79  |     const services = await api(page, '/services?page=1&limit=100', undefined, token);
  80  |     expect(services.status, JSON.stringify(services.body)).toBe(200);
  81  |     const servicesBody = services.body as ApiEnvelope<{ items?: ServiceRecord[] }> | null;
  82  |     const items = servicesBody?.data?.items ?? [];
  83  |     let selectedService: ServiceRecord | null = null;
  84  |     let selectedOption: ServiceOptionRecord | null = null;
  85  |     for (const candidate of items) {
  86  |       if (!candidate.isActive || candidate.isDeleted) continue;
  87  |       const options = await api(page, `/services/${candidate._id}/options`, undefined, token);
  88  |       if (options.status !== 200) continue;
  89  |       const optionsBody = options.body as ApiEnvelope<ServiceOptionRecord[]> | null;
  90  |       const activeOption = optionsBody?.data?.find((option) => option.isActive && !option.isDeleted) ?? null;
  91  |       if (activeOption) {
  92  |         selectedService = candidate;
  93  |         selectedOption = activeOption;
  94  |         break;
  95  |       }
  96  |     }
  97  |     if (!selectedService || !selectedOption) {
  98  |       test.skip(true, 'Backend chưa có service đang hoạt động kèm option để tạo đơn.');
  99  |       return;
  100 |     }
  101 | 
  102 |     const createOrder = await api(page, '/orders', {
  103 |       method: 'POST',
  104 |       body: JSON.stringify({
  105 |         serviceId: selectedService._id,
  106 |         selectedOptionIds: [selectedOption._id],
  107 |         selectedOptions: [{ optionId: selectedOption._id, quantity: 1 }],
  108 |         addressId: address._id,
  109 |         orderType: 'normal',
  110 |         problemDescription: 'Kiểm thử tích hợp backend thật bằng Playwright.',
  111 |         paymentMethod: 'cash',
  112 |       }),
  113 |     }, token);
> 114 |     expect(createOrder.status, JSON.stringify(createOrder.body)).toBe(201);
      |                                                                  ^ Error: {"success":false,"message":"Chưa có chuyên gia phù hợp với dịch vụ và địa chỉ đã chọn."}
  115 |     const createdOrder = (createOrder.body as ApiEnvelope<OrderRecord> | null)?.data;
  116 |     if (!createdOrder) {
  117 |       throw new Error(`Backend không trả về đơn hàng: ${JSON.stringify(createOrder.body)}`);
  118 |     }
  119 |     expect(createdOrder?._id).toBeTruthy();
  120 |     expect(createdOrder.serviceId).toBeTruthy();
  121 |     expect(createdOrder.addressId).toBe(address._id);
  122 | 
  123 |     const detail = await api(page, `/orders/${createdOrder._id}`, undefined, token);
  124 |     expect(detail.status, JSON.stringify(detail.body)).toBe(200);
  125 |     const detailOrder = (detail.body as ApiEnvelope<OrderRecord> | null)?.data;
  126 |     expect(detailOrder?._id).toBe(createdOrder._id);
  127 | 
  128 |     // Đơn chưa thanh toán được xóa để mỗi lần chạy không tạo dữ liệu rác.
  129 |     const cleanup = await api(page, `/orders/${createdOrder._id}/unpaid`, { method: 'DELETE' }, token);
  130 |     expect([200, 204, 404]).toContain(cleanup.status);
  131 |   });
  132 | });
  133 | 
```