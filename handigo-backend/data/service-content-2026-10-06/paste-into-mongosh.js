// Dán toàn bộ file vào một dòng lệnh MỚI của MongoDB Shell. File UTF-8 không BOM.
// mongosh tự chờ các lệnh database; không thêm async/await vào bản này.
(function updateHandigoContent() {
  const payload = {
  "categories": [
    {
      "id": "6a3064441b36f54714e526bf",
      "name": "Vệ Sinh & Làm Sạch",
      "isDeleted": false,
      "previous": {
        "description": "Các dịch vụ vệ sinh nhà cửa"
      },
      "set": {
        "description": "Các dịch vụ làm sạch không gian sống, bề mặt và thiết bị trong gia đình, giúp loại bỏ bụi bẩn, cặn bám và giữ khu vực sử dụng gọn gàng. Phạm vi vệ sinh được xác nhận theo diện tích, số lượng thiết bị, chất liệu và mức độ bẩn. Đồ dùng cá nhân và khu vực cần bảo vệ được trao đổi trước khi thực hiện; khách hàng kiểm tra kết quả sau khi hoàn tất."
      }
    },
    {
      "id": "6a316cfadbe9d7f4da84ad0c",
      "name": "Điện Nước & Hệ Thống Kỹ Thuật",
      "isDeleted": false,
      "previous": {
        "description": "..."
      },
      "set": {
        "description": "Các dịch vụ kiểm tra, sửa chữa và bảo dưỡng hệ thống điện, cấp thoát nước cùng thiết bị kỹ thuật trong nhà. Hỗ trợ xử lý rò rỉ, tắc nghẽn hoặc thiết bị vận hành bất thường theo tình trạng thực tế. Kỹ thuật viên xác định nguyên nhân, thống nhất phương án và vật tư trước khi sửa chữa, sau đó kiểm tra độ kín hoặc khả năng hoạt động của hạng mục đã xử lý."
      }
    },
    {
      "id": "6a316d25dbe9d7f4da84ad0d",
      "name": "Thiết Bị Gia Dụng",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Dịch vụ kiểm tra và xử lý sự cố của các thiết bị gia dụng như máy giặt, tủ lạnh, máy sấy và máy rửa chén. Công việc được lựa chọn theo triệu chứng, model thiết bị và khả năng tiếp cận linh kiện. Khách hàng được thông báo nguyên nhân dự kiến, phương án và chi phí trước khi thực hiện; thiết bị được chạy thử và hướng dẫn sử dụng sau khi hoàn tất."
      }
    },
    {
      "id": "6a316d80dbe9d7f4da84ad0f",
      "name": "Điều hòa & Thông gió",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Các dịch vụ vệ sinh, kiểm tra và sửa chữa điều hòa cùng quạt thông gió, hỗ trợ duy trì khả năng làm mát và lưu thông không khí. Phạm vi thực hiện phụ thuộc loại máy, vị trí lắp đặt và tình trạng thiết bị. Kỹ thuật viên bảo vệ khu vực thi công, xử lý hạng mục đã thống nhất rồi kiểm tra vận hành, thoát nước hoặc lưu lượng gió trước khi bàn giao."
      }
    },
    {
      "id": "6a316da0dbe9d7f4da84ad10",
      "name": "Diệt Côn Trùng",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Dịch vụ khảo sát và kiểm soát sinh vật gây hại trong khu vực sinh hoạt như gián, kiến, mối và chuột. Phương án được lựa chọn theo loài, dấu hiệu hoạt động, đường xâm nhập và điều kiện tại nhà. Khách hàng được hướng dẫn chuẩn bị khu vực, bảo vệ thực phẩm, trẻ nhỏ và vật nuôi, đồng thời nhận hướng dẫn phòng ngừa và theo dõi sau xử lý. Hiệu quả phụ thuộc nguồn phát sinh và việc thực hiện biện pháp phòng ngừa."
      }
    },
    {
      "id": "6a32b8a4311d1698ee5a99d3",
      "name": "Lắp Đặt & Thi Công",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Các dịch vụ lắp đặt và thi công hạng mục nhỏ trong nhà như vách ngăn, rèm cửa hoặc hồ cá. Trước khi thực hiện cần khảo sát kích thước, nền hoặc tường, đường điện nước liên quan và điều kiện vận chuyển vật liệu. Phương án, vật liệu và phạm vi được thống nhất trước khi thi công; hạng mục được kiểm tra độ chắc chắn, khả năng sử dụng và hoàn thiện bề mặt khi bàn giao."
      }
    },
    {
      "id": "6a32b9b9311d1698ee5a99d4",
      "name": "Sơn & Hoàn Thiện Nhà Cửa",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Dịch vụ xử lý bề mặt, sơn hoàn thiện và chống thấm cho các hạng mục nhà ở. Phương án được lựa chọn theo vật liệu nền, mức độ xuống cấp, vị trí thấm và điều kiện thời tiết. Công việc bao gồm chuẩn bị khu vực, xử lý nền và thi công các lớp theo yêu cầu của vật liệu đã thống nhất. Khách hàng được hướng dẫn thời gian khô, bảo dưỡng và thời điểm kiểm tra kết quả."
      }
    },
    {
      "id": "6a32b9f5311d1698ee5a99d5",
      "name": "Chuyển Nhà & Vận Chuyển",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Các dịch vụ hỗ trợ chuyển trọ, chuyển nhà và vận chuyển hàng hóa theo danh sách đồ đạc, địa chỉ cùng điều kiện giao nhận. Phương án được thống nhất dựa trên khối lượng, kích thước, quãng đường, tầng lầu và khả năng tiếp cận của phương tiện. Đồ đạc được kiểm đếm, bảo vệ phù hợp và sắp xếp khi vận chuyển; người nhận kiểm tra số lượng và tình trạng khi bàn giao."
      }
    },
    {
      "id": "6a32ba1b311d1698ee5a99d6",
      "name": "Chăm Sóc Nhà Cửa",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Các dịch vụ chăm sóc những hạng mục sinh hoạt và cảnh quan nhỏ quanh nhà, giúp không gian sử dụng gọn gàng và thuận tiện hơn. Công việc được xác nhận theo hiện trạng, diện tích, loại cây hoặc vật dụng cần chăm sóc. Người thực hiện lựa chọn dụng cụ phù hợp, bảo vệ khu vực xung quanh và hướng dẫn khách hàng cách duy trì kết quả sau khi hoàn tất."
      }
    },
    {
      "id": "6a32bd29311d1698ee5a99d8",
      "name": "Điện Tử & Nhà Thông Minh",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Dịch vụ kiểm tra, lắp đặt và cấu hình thiết bị điện tử trong gia đình như tivi, camera và thiết bị điều khiển. Phạm vi được xác nhận theo model, hạ tầng điện mạng và nhu cầu sử dụng. Kỹ thuật viên kiểm tra kết nối, xử lý hạng mục đã thống nhất rồi hướng dẫn vận hành. Tài khoản và quyền truy cập thiết bị được bàn giao cho khách hàng để chủ động quản lý."
      }
    },
    {
      "id": "6a32bdf1311d1698ee5a99d9",
      "name": "Nội Thất & Đồ Gỗ",
      "isDeleted": false,
      "previous": {
        "description": "..."
      },
      "set": {
        "description": "Dịch vụ lắp ráp, căn chỉnh và hoàn thiện đồ nội thất như giường, tủ cùng các hạng mục gỗ trong nhà. Công việc dựa trên cấu tạo sản phẩm, phụ kiện đi kèm, kích thước phòng và tình trạng vật liệu. Người thực hiện kiểm tra đủ bộ phận, lắp đúng hướng dẫn, siết liên kết và căn chỉnh cánh hoặc ngăn kéo trước khi bàn giao; việc khoan cố định chỉ thực hiện tại vị trí đã thống nhất."
      }
    }
  ],
  "services": [
    {
      "id": "6a316ee7dbe9d7f4da84ad11",
      "name": "Sửa rò rỉ vòi nước nhà bếp",
      "isDeleted": false,
      "previous": {
        "description": "..."
      },
      "set": {
        "description": "Kiểm tra và xử lý tình trạng vòi nước nhà bếp nhỏ giọt, rò tại chân vòi, đầu nối hoặc đường cấp dưới chậu. Kỹ thuật viên xác định điểm rò, kiểm tra gioăng, lõi van và dây cấp để lựa chọn sửa chữa hoặc thay bộ phận phù hợp. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra điểm rò và đường cấp",
            "description": "Quan sát khi mở và đóng vòi, kiểm tra chân vòi, đầu nối, dây cấp và tình trạng van khóa để xác định nguồn rò."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Khóa nước và xử lý bộ phận hỏng",
            "description": "Khóa nguồn cấp, tháo bộ phận cần sửa và vệ sinh vị trí lắp. Thay gioăng, lõi van hoặc dây cấp khi đã thống nhất với khách hàng."
          },
          {
            "title": "Lắp lại và thử độ kín",
            "description": "Lắp các đầu nối đúng vị trí, mở nước từ từ và thử nhiều lần đóng mở vòi. Kiểm tra rò tại các mối nối và khu vực dưới chậu."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32be55311d1698ee5a99da",
      "name": "Sửa Chữa Điều Hòa",
      "isDeleted": false,
      "previous": {
        "description": "Dịch vụ kiểm tra và sửa chữa điều hòa tại nhà dành cho các tình trạng như không lạnh, làm lạnh yếu, chảy nước, phát tiếng ồn, báo lỗi hoặc không hoạt động. Kỹ thuật viên sẽ kiểm tra thiết bị, xác định nguyên nhân và thông báo phương án cùng chi phí sửa chữa trước khi thực hiện. Chi phí thực tế phụ thuộc vào tình trạng thiết bị, loại linh kiện cần thay thế và mức độ hư hỏng."
      },
      "set": {
        "description": "Kiểm tra và sửa chữa điều hòa tại nhà khi máy không lạnh, làm lạnh yếu, chảy nước, phát tiếng ồn, báo lỗi hoặc không hoạt động. Kỹ thuật viên kiểm tra phần điện, thoát nước và hệ thống làm lạnh theo triệu chứng; linh kiện chỉ thay khi có căn cứ và đã được khách hàng đồng ý. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Chẩn đoán tình trạng điều hòa",
            "description": "Ghi nhận mã lỗi, kiểm tra nguồn điện, dàn lạnh, dàn nóng và đường thoát nước. Kiểm tra môi chất lạnh khi triệu chứng cho thấy cần thiết."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Xử lý nguyên nhân đã xác định",
            "description": "Ngắt nguồn trước khi sửa. Thực hiện sửa đường thoát nước, kết nối điện hoặc thay bộ phận theo phương án đã thống nhất; nếu có rò môi chất, xử lý điểm rò trước khi nạp phù hợp."
          },
          {
            "title": "Chạy thử và kiểm tra vận hành",
            "description": "Khởi động lại, theo dõi khả năng làm mát, tiếng ồn và nước thoát. Đối chiếu thông số cần thiết với loại máy và kiểm tra lỗi còn xuất hiện hay không."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32be71311d1698ee5a99db",
      "name": "Sửa Chữa Quạt Thông Gió",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra quạt thông gió khi không quay, hút yếu, phát tiếng ồn hoặc rung bất thường. Dịch vụ tập trung vào nguồn điện, cánh quạt, điểm cố định và bộ phận truyền động; việc sửa chữa được lựa chọn theo cấu tạo và tình trạng thực tế của quạt. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra nguồn điện và cơ cấu quạt",
            "description": "Ghi nhận triệu chứng, kiểm tra công tắc, dây nối, cánh và độ chắc của giá lắp; xác định có kẹt hoặc cọ sát hay không."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Sửa chữa và căn chỉnh quạt",
            "description": "Ngắt điện, tháo bộ phận cần tiếp cận và xử lý chỗ kẹt, liên kết lỏng hoặc linh kiện hỏng theo phương án được duyệt."
          },
          {
            "title": "Thử lưu lượng gió và tiếng ồn",
            "description": "Lắp lại bảo vệ, cấp điện để chạy thử và kiểm tra hướng gió, độ rung, tiếng ồn cùng công tắc điều khiển."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32bea8311d1698ee5a99dc",
      "name": "Máy Giặt",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra và xử lý sự cố máy giặt như không cấp nước, không xả, không vắt, báo lỗi hoặc rung mạnh. Kỹ thuật viên khảo sát đường cấp thoát nước, bộ phận chuyển động và hệ thống điện theo model máy; dịch vụ sửa chữa không mặc định bao gồm tháo lồng để vệ sinh chuyên sâu. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Chẩn đoán theo chu trình giặt",
            "description": "Ghi nhận mã lỗi và thời điểm phát sinh, kiểm tra cấp nước, đường xả, chân máy, khóa cửa và các bộ phận liên quan đến triệu chứng."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Sửa bộ phận và kết nối liên quan",
            "description": "Ngắt điện, khóa nước khi cần, xử lý tắc nghẽn hoặc thay bộ phận đã thống nhất. Căn chỉnh chân và kiểm tra các đầu nối khi lắp lại."
          },
          {
            "title": "Chạy thử cấp nước, xả và vắt",
            "description": "Chạy chương trình thử phù hợp để kiểm tra nước vào ra, khả năng quay vắt, tiếng ồn và rò nước; xác nhận lỗi đã được xử lý."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32becd311d1698ee5a99dd",
      "name": "Tủ Lạnh",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra tủ lạnh khi làm lạnh yếu, không lạnh, đóng tuyết bất thường, chảy nước hoặc phát tiếng ồn. Kỹ thuật viên đánh giá cửa và gioăng, lưu thông khí, thoát nước, phần điện và hệ thống làm lạnh theo triệu chứng; thời gian đạt nhiệt độ sử dụng phụ thuộc loại tủ và lượng thực phẩm. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra khoang tủ và hệ thống làm lạnh",
            "description": "Ghi nhận nhiệt độ, độ kín cửa, tình trạng tuyết và nước đọng. Kiểm tra quạt, thoát nước và linh kiện liên quan khi cần."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Xử lý hạng mục đã thống nhất",
            "description": "Ngắt nguồn, bảo vệ thực phẩm và xử lý điểm tắc, gioăng hoặc bộ phận hỏng. Với hệ thống môi chất, kiểm tra và xử lý rò trước khi thực hiện công việc tiếp theo."
          },
          {
            "title": "Kiểm tra hoạt động và theo dõi nhiệt độ",
            "description": "Cấp điện, kiểm tra quạt và máy nén hoạt động phù hợp, theo dõi xu hướng giảm nhiệt. Hướng dẫn thời gian theo dõi thêm trước khi đánh giá nhiệt độ ổn định."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32bee0311d1698ee5a99de",
      "name": "Máy Sấy Quần Áo",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra máy sấy khi không nóng, sấy lâu khô, không quay hoặc phát tiếng ồn. Phương án xử lý phụ thuộc máy sấy thông hơi, ngưng tụ hay bơm nhiệt; kiểm tra đường gió và bộ lọc là phần quan trọng để xác định nguyên nhân. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra đường gió và mã lỗi",
            "description": "Kiểm tra bộ lọc xơ vải, đường thoát khí hoặc bình nước ngưng, tình trạng lồng và mã lỗi theo loại máy."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Vệ sinh điểm tắc và sửa bộ phận hỏng",
            "description": "Ngắt điện, làm sạch khu vực cần tiếp cận và sửa hoặc thay linh kiện đã thống nhất, tránh làm hỏng cảm biến và đường dẫn khí."
          },
          {
            "title": "Thử chu trình sấy phù hợp",
            "description": "Chạy thử với tải phù hợp, kiểm tra độ nóng, chuyển động lồng, thoát khí hoặc nước ngưng và theo dõi lỗi."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32bf04311d1698ee5a99df",
      "name": "Máy Rửa Chén",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra máy rửa chén khi không cấp nước, không xả, rửa không sạch, rò nước hoặc báo lỗi. Dịch vụ xem xét đường nước, bộ lọc, tay phun và các linh kiện liên quan; hướng xử lý dựa trên model máy và tình trạng lắp đặt. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra cấp thoát nước và khoang rửa",
            "description": "Ghi nhận mã lỗi, kiểm tra ống nước, bộ lọc, tay phun, gioăng cửa và dấu hiệu nước rò."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Xử lý tắc hoặc linh kiện hỏng",
            "description": "Ngắt điện và khóa nước khi tháo lắp. Làm sạch điểm tắc, căn chỉnh hoặc thay bộ phận đã được khách hàng đồng ý."
          },
          {
            "title": "Chạy thử và kiểm tra độ kín",
            "description": "Chạy chương trình thử, kiểm tra nước vào ra, tay phun, gia nhiệt khi cần và rò nước tại cửa hoặc các đầu nối."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32bf34311d1698ee5a99e0",
      "name": "Bóng Đèn",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra và thay bóng đèn trong nhà khi đèn không sáng, nhấp nháy hoặc ánh sáng không phù hợp. Bóng thay thế cần tương thích đui, điện áp, công suất và bộ đèn; sự cố thuộc đường dây hoặc thiết bị điều khiển cần được xác nhận riêng trước khi sửa. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra bóng và bộ đèn",
            "description": "Xác định loại đui, thông số bóng và tình trạng bộ đèn; kiểm tra công tắc, nguồn cấp theo dấu hiệu thực tế."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Ngắt điện và thay đúng loại bóng",
            "description": "Cô lập nguồn tại mạch liên quan, kiểm tra trước khi chạm vào và tháo bóng cũ. Lắp bóng tương thích, tránh tiếp xúc khi bóng còn nóng."
          },
          {
            "title": "Thử sáng và kiểm tra lắp đặt",
            "description": "Cấp điện trở lại, thử công tắc, kiểm tra nhấp nháy và độ chắc của bóng hoặc chụp đèn."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32bf5f311d1698ee5a99e1",
      "name": "Dọn Dẹp Nhà Cửa",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Dọn dẹp và vệ sinh các khu vực sinh hoạt theo phạm vi đã thống nhất, gồm thu gom rác, lau bụi, làm sạch sàn và các bề mặt có thể tiếp cận. Mức độ bẩn, diện tích và vật liệu bề mặt được kiểm tra trước khi thực hiện; đồ có giá trị và giấy tờ cá nhân do khách hàng bố trí bảo quản. Phạm vi áp dụng đơn giá được xác nhận theo dịch vụ và số lượng hoặc khối lượng đã chọn; hạng mục ngoài phạm vi cần được thông báo và thống nhất riêng trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Chuẩn bị khu vực và dụng cụ",
            "description": "Thống nhất thứ tự phòng, phân loại rác và bảo vệ đồ cần giữ khô. Chọn dụng cụ cùng dung dịch phù hợp với chất liệu."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Làm sạch theo từng khu vực",
            "description": "Lau bụi từ trên xuống, vệ sinh bề mặt, khu bếp và khu vệ sinh trong phạm vi đã chọn; dùng dụng cụ riêng để hạn chế nhiễm bẩn chéo."
          },
          {
            "title": "Lau sàn và kiểm tra chi tiết",
            "description": "Hút hoặc quét bụi trước khi lau, xử lý góc dễ bỏ sót và giữ lối đi an toàn khi sàn còn ướt. Thu gom dụng cụ sau khi hoàn tất."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32bfc5311d1698ee5a99e3",
      "name": "Bình Nóng Lạnh",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra bình nóng lạnh khi không làm nóng, nóng yếu, rò nước hoặc thiết bị bảo vệ ngắt bất thường. Công việc chú trọng an toàn điện, đường nước và bộ phận gia nhiệt; chỉ vận hành khi việc kiểm tra cho thấy đủ điều kiện an toàn. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra điện và đường nước",
            "description": "Ghi nhận triệu chứng, kiểm tra nguồn, thiết bị bảo vệ, dấu hiệu rò và kết nối nước; kiểm tra nối đất và linh kiện theo cấu tạo bình."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Cô lập nguồn và sửa bộ phận",
            "description": "Ngắt điện, khóa và xả nước theo yêu cầu công việc. Thay gioăng hoặc bộ phận hỏng đã thống nhất, kiểm tra độ kín khi lắp lại."
          },
          {
            "title": "Nạp nước và kiểm tra an toàn",
            "description": "Nạp đầy, xả khí trước khi cấp điện; kiểm tra rò nước, chức năng bảo vệ theo hướng dẫn thiết bị và khả năng gia nhiệt."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32bfd7311d1698ee5a99e4",
      "name": "Cắt Tỉa Hoa",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Cắt tỉa cây hoa và cây cảnh nhỏ để loại bỏ phần khô héo, điều chỉnh tán và giữ khu vực trồng gọn gàng. Cách tỉa phụ thuộc giống cây, giai đoạn sinh trưởng và mong muốn của khách hàng; không mặc định bao gồm đốn cây lớn hoặc làm việc trên cao. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Đánh giá cây và xác định phần cần tỉa",
            "description": "Kiểm tra cành khô, sâu bệnh, mật độ tán và mùa ra hoa để thống nhất mức độ cắt phù hợp."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Chuẩn bị và cắt tỉa theo giống cây",
            "description": "Vệ sinh dụng cụ, bảo vệ cây lân cận và cắt từng phần theo phương án; hạn chế cắt quá nhiều làm cây suy yếu."
          },
          {
            "title": "Thu gom và kiểm tra tán cây",
            "description": "Thu gom cành lá, kiểm tra dáng tán và các vết cắt; sắp lại chậu hoặc khu vực xung quanh theo thỏa thuận."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32bfe9311d1698ee5a99e5",
      "name": "Diệt Gián",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Khảo sát và kiểm soát gián tại khu vực bếp, nơi chứa đồ và các điểm ẩn náu trong nhà. Phương án kết hợp vệ sinh nguồn thức ăn, giảm nơi trú và đặt bả hoặc xử lý phù hợp theo hướng dẫn sản phẩm; cần thời gian theo dõi để đánh giá hiệu quả. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Xác định điểm trú và đường di chuyển",
            "description": "Kiểm tra dấu vết ở khe tủ, khu ẩm và gần nguồn thức ăn; nhận diện mức độ xuất hiện và điều kiện phát sinh."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Chuẩn bị và xử lý điểm hoạt động",
            "description": "Hướng dẫn cất thực phẩm, bảo vệ đồ dùng và lựa chọn vị trí bả hoặc biện pháp phù hợp, tránh tầm với của trẻ nhỏ và vật nuôi."
          },
          {
            "title": "Ghi nhận vị trí và hướng dẫn theo dõi",
            "description": "Bàn giao các vị trí đã xử lý, hướng dẫn vệ sinh và thời gian tiếp cận theo nhãn sản phẩm; thống nhất cách ghi nhận gián còn xuất hiện."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32bffc311d1698ee5a99e6",
      "name": "Diệt Chuột",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Khảo sát và kiểm soát chuột dựa trên dấu vết, đường di chuyển và điểm xâm nhập vào nhà. Ưu tiên hạn chế nguồn thức ăn, bịt điểm xâm nhập phù hợp và bố trí bẫy; nếu sử dụng chế phẩm, vị trí và cách sử dụng phải theo nhãn và bảo vệ người cùng vật nuôi. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Khảo sát dấu vết và lối vào",
            "description": "Kiểm tra phân, vết gặm, khu chứa thức ăn và các khe quanh đường ống để xác định vùng hoạt động."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Bố trí biện pháp kiểm soát",
            "description": "Đặt bẫy hoặc hộp bả bảo vệ ở vị trí phù hợp theo phương án đã thống nhất, hướng dẫn tránh tiếp xúc và xử lý nguồn thu hút chuột."
          },
          {
            "title": "Lập lịch kiểm tra và phòng ngừa",
            "description": "Ghi lại vị trí đặt, hướng dẫn kiểm tra bẫy và xử lý xác theo vệ sinh; đề xuất bịt khe, bảo quản thực phẩm và theo dõi dấu vết mới."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c00a311d1698ee5a99e7",
      "name": "Diệt Kiến, Mối",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Khảo sát và xử lý kiến hoặc mối theo loài và dấu hiệu hoạt động; hai nhóm cần phương án khác nhau. Kiến được kiểm tra đường đi và nguồn thức ăn, còn mối cần xác định đường mui, khu gỗ bị ảnh hưởng và phạm vi lan rộng trước khi lựa chọn biện pháp. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Phân biệt loài và khảo sát phạm vi",
            "description": "Kiểm tra đường đi của kiến hoặc dấu hiệu mối, vị trí gỗ bị ảnh hưởng và điều kiện ẩm; tránh phá bỏ dấu vết mối trước khi đánh giá."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Thực hiện phương án theo từng loài",
            "description": "Dùng bả hoặc biện pháp xử lý phù hợp với loài và nhãn sản phẩm; bảo vệ thực phẩm, người và vật nuôi tại khu vực liên quan."
          },
          {
            "title": "Hướng dẫn theo dõi và giảm tái phát",
            "description": "Ghi nhận điểm xử lý, thời gian kiểm tra lại theo phương án và hướng dẫn giảm nguồn thức ăn, độ ẩm hoặc tiếp xúc gỗ với nền."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c030311d1698ee5a99e8",
      "name": "Bồn Cầu",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra và xử lý bồn cầu khi xả yếu, nước chảy liên tục, rò ở két hoặc đầu nối, hoặc có dấu hiệu tắc. Kỹ thuật viên xác định nguyên nhân ở cơ cấu xả, đường cấp hay đường thoát để chọn sửa chữa, thay phụ kiện hoặc thông tắc phù hợp. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra cơ cấu xả và điểm rò",
            "description": "Kiểm tra mực nước két, van cấp, van xả, các đầu nối và khả năng thoát khi xả thử."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Sửa phụ kiện hoặc xử lý tắc",
            "description": "Khóa nước khi cần, thay phụ kiện đúng loại hoặc dùng dụng cụ thông phù hợp. Hạn chế thao tác có thể làm hỏng men và đường ống."
          },
          {
            "title": "Thử xả và kiểm tra độ kín",
            "description": "Mở nước, thử nhiều lần xả, kiểm tra thời gian nạp két và xác nhận không còn rò ở hạng mục vừa sửa."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c037311d1698ee5a99e9",
      "name": "Máy Bơm",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra máy bơm nước khi không chạy, không lên nước, áp lực yếu, phát tiếng ồn hoặc ngắt liên tục. Phương án sửa phụ thuộc loại bơm, nguồn nước, đường hút đẩy và bộ điều khiển; không chạy thử khô khi máy không được thiết kế cho điều kiện đó. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra nguồn và đường hút đẩy",
            "description": "Kiểm tra nguồn điện, nước cấp, van, điểm lọt khí và bộ điều khiển áp lực theo loại máy."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Xử lý nguyên nhân và lắp lại",
            "description": "Ngắt điện, giảm áp và xử lý điểm tắc, đầu nối hoặc bộ phận hỏng đã thống nhất; mồi nước khi loại bơm yêu cầu."
          },
          {
            "title": "Chạy thử lưu lượng và độ ổn định",
            "description": "Kiểm tra nước ra, áp lực, rò tại đầu nối, tiếng ồn và khả năng tự đóng ngắt khi có chức năng này."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c066311d1698ee5a99ea",
      "name": "Chuyển Trọ",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Hỗ trợ chuyển đồ từ phòng trọ cũ đến nơi ở mới theo danh sách và điều kiện giao nhận đã xác nhận. Công việc có thể gồm bảo vệ đồ, bốc xếp và vận chuyển trong phạm vi thỏa thuận; cần khai báo đồ dễ vỡ, kích thước lớn, tầng lầu và lối tiếp cận để bố trí phù hợp. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm đếm và bảo vệ đồ đạc",
            "description": "Xác nhận danh sách, đánh dấu đồ dễ vỡ và đóng gói hoặc bọc bảo vệ theo phạm vi đã thống nhất; tách giấy tờ và vật có giá trị để khách tự giữ."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Bốc xếp và vận chuyển",
            "description": "Sắp đồ nặng phía dưới, cố định hàng trên xe và vận chuyển theo tuyến đã xác nhận. Tháo lắp đồ chỉ thực hiện nếu nằm trong thỏa thuận."
          },
          {
            "title": "Giao đồ và đối chiếu tình trạng",
            "description": "Đưa đồ vào vị trí có thể tiếp cận tại nơi đến, đối chiếu danh sách và kiểm tra dấu hiệu hư hỏng cùng khách hàng."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c079311d1698ee5a99eb",
      "name": "Chuyển Nhà",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Hỗ trợ chuyển đồ gia đình giữa hai địa chỉ, dựa trên khảo sát số lượng, kích thước và điều kiện bốc xếp. Phạm vi đóng gói, tháo lắp nội thất và sắp đặt tại nơi mới cần được xác nhận trước; thiết bị đặc biệt hoặc đồ có giá trị cao được trao đổi riêng về cách vận chuyển. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Lập danh sách và chuẩn bị từng phòng",
            "description": "Đánh dấu thùng theo phòng, bảo vệ đồ dễ vỡ và thống nhất thứ tự chuyển. Khách hàng tự bảo quản tiền, giấy tờ và vật có giá trị."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Tháo lắp theo phạm vi và vận chuyển",
            "description": "Tháo bộ phận nội thất đã thống nhất, lưu phụ kiện theo bộ, bốc xếp và cố định đồ trên phương tiện phù hợp."
          },
          {
            "title": "Sắp đặt và kiểm đếm tại nơi mới",
            "description": "Chuyển vào phòng đã chỉ định, lắp lại hạng mục thuộc phạm vi và đối chiếu số lượng cùng tình trạng đồ đạc."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c08d311d1698ee5a99ec",
      "name": "Vận Chuyển Hàng Hóa",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Vận chuyển hàng hóa giữa các địa chỉ theo loại hàng, khối lượng, kích thước và điều kiện giao nhận đã xác nhận. Khách hàng cần cung cấp đặc tính hàng dễ vỡ, yêu cầu giữ đứng hoặc bảo quản riêng; khả năng tiếp nhận hàng đặc biệt được kiểm tra trước khi đặt dịch vụ. Phạm vi áp dụng đơn giá được xác nhận theo dịch vụ và số lượng hoặc khối lượng đã chọn; hạng mục ngoài phạm vi cần được thông báo và thống nhất riêng trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Đối chiếu hàng và chuẩn bị giao nhận",
            "description": "Kiểm tra số kiện, kích thước, tình trạng bao gói và người nhận; ghi nhận dấu hiệu hư hỏng có sẵn trước khi bốc xếp."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Xếp và cố định hàng trên phương tiện",
            "description": "Phân bố tải phù hợp, bảo vệ điểm tiếp xúc và cố định kiện để hạn chế xê dịch; tuân thủ hướng đặt được xác nhận."
          },
          {
            "title": "Vận chuyển và bàn giao theo danh sách",
            "description": "Đưa hàng đến địa chỉ, dỡ tại khu vực đã thống nhất và cùng người nhận kiểm tra số kiện, tình trạng bao gói và hàng hóa."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c0ab311d1698ee5a99ed",
      "name": "Sơn Chống Thấm",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Khảo sát và thi công lớp chống thấm tại khu vực phù hợp như tường hoặc bề mặt ngoài trời theo nguyên nhân thấm đã xác định. Phương án phụ thuộc nền, vết nứt, nguồn nước và điều kiện tiếp cận; không chỉ phủ sơn lên bề mặt khi nguyên nhân rò hoặc nền hỏng chưa được xử lý. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Xác định nguồn thấm và chuẩn bị nền",
            "description": "Khảo sát vết thấm, nứt và thoát nước; làm sạch phần bong yếu, xử lý nền theo phương án và chờ điều kiện khô phù hợp."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Thi công hệ chống thấm đã thống nhất",
            "description": "Che chắn khu vực, xử lý các vị trí tiếp giáp và thi công từng lớp theo định mức cùng thời gian chờ của nhà sản xuất."
          },
          {
            "title": "Kiểm tra lớp phủ và thời gian bảo dưỡng",
            "description": "Kiểm tra độ phủ và điểm dễ sót; chờ vật liệu đạt điều kiện trước khi thử nước khi phù hợp. Hướng dẫn thời điểm đánh giá kết quả."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c0b7311d1698ee5a99ee",
      "name": "Sơn Ngoại Thất",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Sơn hoàn thiện các bề mặt ngoài nhà theo diện tích, vật liệu nền và màu đã thống nhất. Công việc gồm bảo vệ khu vực, làm sạch và xử lý phần bong hoặc nứt phù hợp trước khi sơn; kế hoạch thi công phụ thuộc thời tiết và điều kiện tiếp cận an toàn. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra nền và che chắn khu vực",
            "description": "Khảo sát bong tróc, độ ẩm và vết nứt, che cửa cùng vật dụng; chuẩn bị phương án tiếp cận phù hợp với vị trí thi công."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Xử lý bề mặt và thi công sơn",
            "description": "Làm sạch, sửa điểm nền cần thiết, thi công lớp lót và lớp phủ theo hệ vật liệu cùng thời gian chờ đã thống nhất."
          },
          {
            "title": "Kiểm tra màu và bề mặt hoàn thiện",
            "description": "Kiểm tra vùng thiếu phủ, vệt chảy và mép tiếp giáp khi đủ điều kiện; xử lý điểm cần sửa và tháo che chắn cẩn thận."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c0c3311d1698ee5a99ef",
      "name": "Tivi",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra tivi khi không lên nguồn, mất hình, mất tiếng hoặc gặp lỗi kết nối và sử dụng. Dịch vụ ưu tiên xác định lỗi nguồn, dây tín hiệu và cài đặt trước khi kết luận hỏng linh kiện; sửa màn hình hoặc bo mạch được báo riêng theo tình trạng và khả năng cung ứng. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra nguồn, tín hiệu và cài đặt",
            "description": "Thử ổ điện, dây tín hiệu, nguồn phát, âm lượng và kết nối theo triệu chứng; ghi nhận model cùng lỗi hiển thị."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Xử lý cấu hình hoặc linh kiện hỏng",
            "description": "Điều chỉnh cấu hình, thay dây hoặc sửa linh kiện theo phương án đã duyệt. Ngắt điện khi tháo máy và bảo vệ tấm nền."
          },
          {
            "title": "Thử hình ảnh, âm thanh và kết nối",
            "description": "Kiểm tra các chức năng liên quan đến lỗi bằng nguồn phát phù hợp; xác nhận máy hoạt động ổn định trong thời gian chạy thử."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c0db311d1698ee5a99f0",
      "name": "Camera",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Hỗ trợ khảo sát, lắp đặt, cấu hình hoặc xử lý sự cố camera theo nhu cầu được xác nhận. Vị trí lắp cần phù hợp góc quan sát, nguồn điện và đường truyền; kiểm tra xem trực tiếp, ghi hình và truy cập từ thiết bị của khách hàng trước khi bàn giao quyền quản lý. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Khảo sát vị trí và hạ tầng điện mạng",
            "description": "Xác nhận góc nhìn, điểm lắp, nguồn điện, mạng và nhu cầu lưu trữ; với máy đang dùng, kiểm tra triệu chứng và kết nối hiện tại."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Lắp đặt hoặc xử lý hạng mục đã duyệt",
            "description": "Cố định camera, đi dây phù hợp hoặc sửa kết nối theo phạm vi; cấu hình trên tài khoản khách hàng và tránh lưu thông tin truy cập của khách."
          },
          {
            "title": "Thử xem trực tiếp và ghi hình",
            "description": "Kiểm tra hình ảnh, thời gian hệ thống, lưu trữ và khả năng xem lại theo chức năng được chọn; bàn giao quyền quản lý và hướng dẫn đổi mật khẩu."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c139311d1698ee5a99f1",
      "name": "Xây Vách Ngăn",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Khảo sát và thi công vách ngăn theo kích thước, vật liệu cùng công năng đã thống nhất. Cần kiểm tra nền, trần, vị trí điện nước và khả năng chịu lực trước khi lắp; những thay đổi ảnh hưởng kết cấu công trình cần được đánh giá chuyên môn riêng. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Đo đạc và xác định điểm liên kết",
            "description": "Kiểm tra kích thước, cao độ, vị trí cửa và các đường kỹ thuật để thống nhất bản bố trí cùng vật liệu."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Thi công khung và bề mặt vách",
            "description": "Bảo vệ khu vực, lắp khung hoặc phần xây theo vật liệu được duyệt, tạo các vị trí mở và hoàn thiện liên kết."
          },
          {
            "title": "Kiểm tra độ chắc và hoàn thiện",
            "description": "Kiểm tra độ thẳng, khe tiếp giáp, bề mặt và hoạt động của cửa nếu có; xử lý điểm cần chỉnh trước khi bàn giao."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c147311d1698ee5a99f2",
      "name": "Xây Hồ Cá",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Khảo sát và thi công hồ cá theo kích thước, vị trí, vật liệu và hệ thống lọc được thống nhất. Công việc cần đánh giá nền chịu tải, cấp thoát nước, chống thấm và khả năng bảo trì; hồ mới chỉ đưa vào sử dụng sau các bước kiểm tra và chuẩn bị nước phù hợp. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Khảo sát nền và thiết kế bố trí",
            "description": "Xác nhận kích thước, tải trọng, cấp thoát nước và vị trí lọc; thống nhất cấu tạo cùng vật liệu trước khi thi công."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Thi công hồ và hệ thống liên quan",
            "description": "Làm nền, thành hồ và chống thấm theo phương án, lắp đường ống cùng bộ lọc trong phạm vi đã chọn; tuân thủ thời gian dưỡng vật liệu."
          },
          {
            "title": "Thử kín và vận hành hệ lọc",
            "description": "Kiểm tra rò nước sau thời gian chờ phù hợp, thử tuần hoàn và thoát nước. Hướng dẫn chuẩn bị nước trước khi thả cá."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c177311d1698ee5a99f3",
      "name": "Lắp Rèm Cửa",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Đo và lắp thanh hoặc ray rèm cùng bộ rèm tại vị trí đã thống nhất. Người thực hiện kiểm tra vật liệu tường, kích thước cửa và trọng lượng rèm để chọn liên kết phù hợp; rèm điện cần xác nhận thêm nguồn và chức năng điều khiển. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Đo kích thước và xác định điểm khoan",
            "description": "Kiểm tra độ cao, độ phủ rèm, vật liệu nền và đường điện nước liên quan trước khi đánh dấu vị trí."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Lắp giá, thanh hoặc ray rèm",
            "description": "Bảo vệ khu vực, dùng phụ kiện phù hợp với nền và tải, cố định giá rồi treo rèm theo cấu tạo sản phẩm."
          },
          {
            "title": "Căn chỉnh và thử kéo rèm",
            "description": "Kiểm tra độ cân, liên kết và hành trình đóng mở; căn chỉnh nếp hoặc điểm vướng theo điều kiện thực tế."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c184311d1698ee5a99f4",
      "name": "Lắp Giường",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Lắp ráp giường theo cấu tạo sản phẩm và bộ phụ kiện khách hàng cung cấp. Người thực hiện kiểm tra đủ bộ phận, tình trạng vật liệu và vị trí đặt, sau đó lắp đúng hướng dẫn và kiểm tra liên kết chịu lực; bộ phận thiếu hoặc hỏng được thông báo trước khi tiếp tục. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra bộ phận và vị trí đặt",
            "description": "Đối chiếu khung, vạt, ốc và phụ kiện với hướng dẫn; kiểm tra kích thước phòng, lối đi và nền đặt giường."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Lắp khung và các bộ phận theo thứ tự",
            "description": "Ghép đầu giường, thành, chân và vạt theo hướng dẫn; bảo vệ bề mặt và siết liên kết phù hợp với vật liệu."
          },
          {
            "title": "Căn chỉnh và kiểm tra độ chắc",
            "description": "Kiểm tra các điểm chịu lực, độ cân và bộ phận chuyển động nếu có; siết lại điểm cần thiết trước khi sử dụng."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32c196311d1698ee5a99f5",
      "name": "Lắp Tủ",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Lắp ráp và căn chỉnh tủ theo cấu tạo, kích thước cùng phụ kiện đi kèm. Công việc gồm kiểm tra bộ phận, lắp thân và cánh, căn bản lề hoặc ngăn kéo; việc cố định chống lật cần thống nhất vị trí và loại liên kết phù hợp với tường. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra bộ tủ và vị trí lắp",
            "description": "Đối chiếu tấm, bản lề, ray, ốc và kích thước phòng; kiểm tra bề mặt vật liệu cùng khoảng mở cánh."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Lắp thân, cánh và phụ kiện",
            "description": "Lắp theo hướng dẫn, bảo vệ cạnh tấm và siết đúng liên kết; cố định chống lật tại vị trí đã thống nhất khi cấu tạo yêu cầu."
          },
          {
            "title": "Căn chỉnh cánh và ngăn kéo",
            "description": "Kiểm tra độ cân của thân, khe cánh, ray kéo và độ chắc liên kết; thử đóng mở để xử lý điểm cọ hoặc lệch."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a32cf975c77c11180dfb663",
      "name": "Vệ Sinh Điều Hòa",
      "isDeleted": false,
      "previous": {
        "description": "Dịch vụ vệ sinh điều hòa tại nhà giúp làm sạch dàn lạnh, lưới lọc và khu vực thoát nước. Áp dụng một đơn giá cố định cho mỗi máy; khách hàng chỉ cần chọn số lượng máy."
      },
      "set": {
        "description": "Vệ sinh điều hòa tại nhà để làm sạch lưới lọc, bề mặt dàn lạnh và khu vực thoát nước có thể tiếp cận. Phạm vi dàn nóng được xác nhận theo vị trí lắp và điều kiện an toàn. Khách hàng chọn số lượng máy theo đơn giá hiện có; vệ sinh không mặc định gồm sửa chữa, thay linh kiện hoặc nạp môi chất lạnh. Phạm vi áp dụng đơn giá được xác nhận theo dịch vụ và số lượng hoặc khối lượng đã chọn; hạng mục ngoài phạm vi cần được thông báo và thống nhất riêng trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra hoạt động và che chắn",
            "description": "Chạy thử để ghi nhận lỗi có sẵn, ngắt nguồn và bảo vệ tường, sàn cùng phần điện tử trước khi vệ sinh."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Làm sạch các bộ phận trong phạm vi",
            "description": "Tháo lưới lọc và phần vỏ phù hợp, vệ sinh dàn lạnh cùng đường thoát có thể tiếp cận; làm sạch dàn nóng khi thuộc phạm vi và đủ điều kiện an toàn."
          },
          {
            "title": "Lắp lại và thử hoạt động",
            "description": "Làm khô phần cần thiết, lắp đúng vị trí và cấp điện; kiểm tra khả năng làm mát, tiếng ồn và nước thoát sau vệ sinh."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a366460ac7eea32d2d65769",
      "name": "Vệ Sinh Quạt Thông Gió",
      "isDeleted": false,
      "previous": {
        "description": "..."
      },
      "set": {
        "description": "Vệ sinh quạt thông gió để loại bỏ bụi bám trên lưới, cánh và các bề mặt có thể tiếp cận. Dịch vụ phụ thuộc vị trí lắp và khả năng tháo an toàn; không mặc định bao gồm vệ sinh toàn bộ ống gió hoặc sửa động cơ. Quạt được kiểm tra hoạt động trước và sau khi làm sạch. Phạm vi áp dụng đơn giá được xác nhận theo dịch vụ và số lượng hoặc khối lượng đã chọn; hạng mục ngoài phạm vi cần được thông báo và thống nhất riêng trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra và ngắt nguồn quạt",
            "description": "Ghi nhận hoạt động, kiểm tra vị trí tháo và bảo vệ khu vực bên dưới; ngắt nguồn trước khi tiếp cận cánh."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Tháo phần phù hợp và làm sạch",
            "description": "Làm sạch lưới, cánh và vỏ bằng dụng cụ phù hợp; tránh để nước vào động cơ, dây và bộ phận điện."
          },
          {
            "title": "Lắp lại và chạy thử",
            "description": "Làm khô bộ phận đã vệ sinh, lắp đủ bảo vệ, kiểm tra độ chắc và thử hướng gió, tiếng ồn cùng độ rung."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a39186cae89695fae24e939",
      "name": "Thông Cống",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Khảo sát và xử lý tắc nghẽn đường thoát nước có thể tiếp cận tại nhà. Kỹ thuật viên xác định vị trí, loại ống và dấu hiệu tắc để chọn dụng cụ phù hợp; đường ống vỡ, sụt hoặc cần đào mở phải được báo phương án riêng trước khi thực hiện. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Xác định vị trí và nguyên nhân tắc",
            "description": "Kiểm tra tốc độ thoát, các điểm liên quan và vị trí tiếp cận; nhận diện nguy cơ đường ống hỏng cần xử lý khác."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Thông bằng dụng cụ phù hợp",
            "description": "Che chắn và dùng dụng cụ phù hợp với loại ống; không tự ý trộn hóa chất hoặc gây áp lực vượt điều kiện đường ống."
          },
          {
            "title": "Xả thử và kiểm tra thoát nước",
            "description": "Cho nước chảy thử qua điểm đã xử lý, kiểm tra thoát và rò tại vị trí tiếp cận; thu gom cặn cùng chất thải phát sinh."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a391a7b375cd583316bb7b3",
      "name": "Sửa Điều Khiển",
      "isDeleted": true,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Kiểm tra điều khiển từ xa của thiết bị gia đình khi không phản hồi, nút bấm kém hoặc tín hiệu chập chờn. Dịch vụ phân biệt lỗi pin, tiếp điểm, tín hiệu và ghép nối trước khi sửa; khả năng sửa hoặc thay phụ thuộc loại điều khiển và thiết bị tương thích. Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Kiểm tra pin và khả năng truyền tín hiệu",
            "description": "Kiểm tra pin, tiếp điểm, nút bấm và tín hiệu hoặc ghép nối theo loại điều khiển; thử với thiết bị khách hàng đang sử dụng."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Vệ sinh hoặc sửa bộ phận phù hợp",
            "description": "Tháo pin trước khi thao tác, xử lý tiếp điểm, nút hoặc linh kiện theo phương án đã thống nhất; cấu hình ghép nối lại khi cần."
          },
          {
            "title": "Thử các chức năng chính",
            "description": "Kiểm tra nguồn, điều chỉnh và các nút liên quan trên thiết bị thực tế; xác nhận khả năng phản hồi sau xử lý."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    },
    {
      "id": "6a3a3e873419e6d74de65bb8",
      "name": "Vệ Sinh Nhà Cửa",
      "isDeleted": false,
      "previous": {
        "description": null
      },
      "set": {
        "description": "Vệ sinh không gian nhà ở theo khu vực và khối lượng đã chọn, gồm lau bụi bề mặt, làm sạch sàn, bếp và khu vệ sinh trong phạm vi xác nhận. Dụng cụ và dung dịch được chọn theo vật liệu để hạn chế hư hại; vết bẩn lâu ngày hoặc khu vực khó tiếp cận cần được đánh giá trước khi thực hiện. Phạm vi áp dụng đơn giá được xác nhận theo dịch vụ và số lượng hoặc khối lượng đã chọn; hạng mục ngoài phạm vi cần được thông báo và thống nhất riêng trước khi thực hiện. Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.",
        "processSteps": [
          {
            "title": "Xác nhận yêu cầu và điều kiện thực hiện",
            "description": "Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác."
          },
          {
            "title": "Chuẩn bị từng khu vực cần vệ sinh",
            "description": "Xác nhận bề mặt và chất liệu, di chuyển đồ trong phạm vi thỏa thuận, che vật cần bảo vệ và chuẩn bị dụng cụ riêng cho khu vệ sinh."
          },
          {
            "title": "Thống nhất phương án và phạm vi công việc",
            "description": "Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý."
          },
          {
            "title": "Làm sạch bề mặt và khu sinh hoạt",
            "description": "Vệ sinh từ trên xuống, từ ít bẩn đến nhiều bẩn; làm sạch bếp, khu vệ sinh và các bề mặt thuộc phạm vi bằng dung dịch phù hợp."
          },
          {
            "title": "Làm sạch sàn và kiểm tra tổng thể",
            "description": "Hút hoặc quét trước khi lau, xử lý góc và mép dễ bỏ sót, kiểm tra các vùng đã vệ sinh và thu gom rác phát sinh."
          },
          {
            "title": "Nghiệm thu và hướng dẫn sau dịch vụ",
            "description": "Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất."
          }
        ]
      }
    }
  ]
};
  const target = db.getSiblingDB('FixNow');
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const pending = { categories: [], services: [] };
  const backup = { database: 'FixNow', createdAt: new Date(), documents: [] };

  for (const [collection, count] of [['categories', 11], ['services', 33]]) {
    const entries = payload[collection];
    if (!Array.isArray(entries) || entries.length !== count || new Set(entries.map((entry) => entry.id)).size !== count) {
      throw new Error(`Số bản ghi hoặc ID không hợp lệ trong ${collection}.`);
    }
    for (const entry of entries) {
      if (!/^[0-9a-f]{24}$/i.test(entry.id) || typeof entry.isDeleted !== 'boolean') throw new Error('ID hoặc trạng thái không hợp lệ.');
      const allowed = collection === 'services' ? ['description', 'processSteps'] : ['description'];
      if (!same(Object.keys(entry.set).sort(), allowed.sort()) || typeof entry.set.description !== 'string' || entry.set.description.trim().length < 200) {
        throw new Error(`Mô tả hoặc field cập nhật không hợp lệ: ${entry.name}.`);
      }
      if (collection === 'services') {
        const steps = entry.set.processSteps;
        if (!Array.isArray(steps) || steps.length < 4 || steps.length > 20 || steps.some((step) =>
          typeof step.title !== 'string' || !step.title.trim() || step.title.length > 120 ||
          typeof step.description !== 'string' || !step.description.trim() || step.description.length > 2000 ||
          !same(Object.keys(step).sort(), ['description', 'title']))) {
          throw new Error(`Quy trình không hợp lệ: ${entry.name}.`);
        }
      }
    }
    const documents = target.getCollection(collection).find({ _id: { $in: entries.map((entry) => ObjectId(entry.id)) } }).toArray();
    const byId = new Map(documents.map((document) => [document._id.toString(), document]));
    for (const entry of entries) {
      const original = byId.get(entry.id);
      if (!original || original.name !== entry.name || original.isDeleted !== entry.isDeleted) throw new Error(`Không khớp ID, tên hoặc trạng thái: ${entry.name}.`);
      const keys = Object.keys(entry.set);
      if (keys.every((key) => same(original[key], entry.set[key]))) continue;
      if (keys.some((key) => !same(original[key], entry.previous[key]))) throw new Error(`Nội dung đã thay đổi so với bản xuất: ${entry.name}. Dừng để tránh ghi đè.`);
      const filter = { _id: original._id, name: original.name, isDeleted: original.isDeleted };
      for (const key of [...keys, 'updatedAt']) {
        filter[key] = owns(original, key) ? { $eq: original[key], $exists: true } : { $exists: false };
      }
      pending[collection].push({ entry, filter });
      backup.documents.push({ collection, before: original, after: entry.set });
    }
  }

  const total = pending.categories.length + pending.services.length;
  print(`Database FixNow: chuẩn bị cập nhật ${pending.categories.length}/11 danh mục và ${pending.services.length}/33 dịch vụ, gồm cả dịch vụ đã xóa mềm. Trạng thái được giữ nguyên.`);
  if (total === 0) {
    print('Toàn bộ 44 bản ghi đã có nội dung mới. Không cần cập nhật thêm.');
    return;
  }
  const backupResult = target.getCollection('handigo_content_backups').insertOne({ ...backup, source: 'service-content-2026-10-06' });
  print(`Đã sao lưu tại FixNow.handigo_content_backups, ID: ${backupResult.insertedId}`);
  const session = target.getMongo().startSession({ readPreference: { mode: 'primary' } });
  try {
    session.withTransaction(() => {
      const transactionDb = session.getDatabase('FixNow');
      for (const collection of ['categories', 'services']) {
        const changes = pending[collection];
        if (!changes.length) continue;
        const transactionCollection = transactionDb.getCollection(collection);
        const result = transactionCollection.bulkWrite(changes.map(({ entry, filter }) => ({
          updateOne: { filter, update: { $set: { ...entry.set, updatedAt: new Date() } }, upsert: false },
        })), { ordered: true });
        if (result.matchedCount !== changes.length) throw new Error(`Có bản ghi ${collection} thay đổi trong lúc cập nhật. Hủy giao dịch.`);
        const updated = transactionCollection.find({ _id: { $in: changes.map(({ entry }) => ObjectId(entry.id)) } }).toArray();
        const byId = new Map(updated.map((document) => [document._id.toString(), document]));
        for (const { entry } of changes) {
          const document = byId.get(entry.id);
          if (!document || document.isDeleted !== entry.isDeleted || !Object.keys(entry.set).every((key) => same(document[key], entry.set[key]))) {
            throw new Error(`Kết quả sau ghi không khớp: ${entry.name}. Hủy giao dịch.`);
          }
        }
      }
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    session.endSession();
  }
  print(`Đã cập nhật và kiểm tra ${total} bản ghi thành công.`);
  print(`Bản sao lưu: FixNow.handigo_content_backups, ID: ${backupResult.insertedId}`);
})();
