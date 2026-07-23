
erDiagra
    USERS {
        string id PK "MongoDB ObjectId"
        string email UK "Bắt buộc"
        string fullName "Bắt buộc"
        string phone
        string role "CUSTOMER, PROVIDER, ADMIN"
        string status "active, locked"
        string providerOnboardingStatus
        boolean isEmailVerified
        datetime createdAt
    }

    SESSIONS {
        string id PK
        string userId FK "Bắt buộc"
        string refreshTokenHash "Bắt buộc"
        datetime expiresAt "Bắt buộc"
        datetime revokedAt
    }

    ADDRESSES {
        string id PK
        string userId FK "Bắt buộc"
        string recipientName
        string recipientPhone
        text fullAddress "Bắt buộc"
        string province "Bắt buộc"
        string ward "Bắt buộc"
        json coordinates "latitude và longitude"
        boolean isDefault
    }

    LOCATIONS {
        string id PK
        string userId FK "Bắt buộc"
        string ownerType "customer hoặc provider"
        json coordinates "GeoJSON Point"
        boolean isActive
        datetime lastUpdatedAt
    }

    PROVIDERS {
        string id PK
        string userId FK, UK "Bắt buộc"
        text description "Bắt buộc"
        int experienceYears
        string availabilityStatus
        boolean verified
        json serviceIds FK "Mảng ObjectId của services"
        json workingAreas
        decimal averageRating
        int totalCompletedOrders
        json identityDocument "Tài liệu định danh nhúng"
        json certificates "Mảng chứng chỉ nhúng"
    }

    PROVIDERAPPLICATIONS {
        string id PK
        string userId FK "Bắt buộc"
        string applicationType "initial hoặc service_addition"
        json serviceIds FK "Mảng ObjectId của services"
        json workingAreas
        json identityDocument
        json certificates
        string status "Bắt buộc"
        string reviewedBy FK
        json reviewHistory
        datetime submittedAt
    }

    BANKACCOUNTS {
        string id PK
        string userId FK "Bắt buộc"
        string bankName "Bắt buộc"
        string bankCode "Bắt buộc"
        string accountNumber "Bắt buộc"
        string accountHolderName "Bắt buộc"
        boolean isDefault
        string status
    }

    CATEGORIES {
        string id PK
        string name "Bắt buộc"
        string slug UK "Bắt buộc"
        text description
        string icon
        boolean isActive
    }

    SERVICES {
        string id PK
        string categoryId FK "Bắt buộc"
        string name "Bắt buộc"
        string slug "Bắt buộc"
        string serviceType "Bắt buộc"
        decimal fixedPrice
        decimal depositAmount
        boolean requiresOptionSelection
        boolean isActive
    }

    SERVICEOPTIONS {
        string id PK
        string serviceId FK "Bắt buộc"
        string name "Bắt buộc"
        string optionType "Bắt buộc"
        decimal price "Bắt buộc"
        string selectionGroup
        string selectionMode
        boolean allowsQuantity
        boolean isRequired
        boolean isActive
    }

    SERVICESUGGESTIONS {
        string id PK
        string providerId FK "Bắt buộc"
        string suggestionType "Bắt buộc"
        string suggestedServiceName
        string suggestedCategoryName
        string categoryId FK
        string status
        string reviewedBy FK
        string createdServiceId FK
        string createdCategoryId FK
    }

    PROMOTIONS {
        string id PK
        string name "Bắt buộc"
        string code
        string discountType "Bắt buộc"
        decimal discountValue "Bắt buộc"
        decimal maxDiscountAmount
        decimal minOrderAmount
        int usageLimit
        int usedCount
        datetime startAt "Bắt buộc"
        datetime endAt "Bắt buộc"
        string status
        boolean isActive
    }

    NEWS_ARTICLES {
        string id PK
        string slug "Bắt buộc"
        string title "Bắt buộc"
        string category "Bắt buộc"
        string coverImage "Bắt buộc"
        json content "Các khối nội dung nhúng"
        string status
        boolean isFeatured
        datetime publishedAt
        string createdBy FK "Bắt buộc"
    }

    ORDERS {
        string id PK
        string orderCode UK "Bắt buộc"
        string customerId FK "Bắt buộc"
        string providerId FK
        string preferredProviderId FK
        string serviceId FK "Bắt buộc"
        string addressId FK "Bắt buộc"
        json selectedOptionIds FK "Mảng ObjectId của serviceoptions"
        json selectedOptionsSnapshot
        string orderType
        datetime scheduledAt
        string bookingStatus
        string recurringGroupId "Nhóm đơn định kỳ"
        int occurrenceNumber
        int totalOccurrences
        string status
        string paymentMethod "Bắt buộc"
        string paymentStatus
        string currentQuotationId FK
        json pricing "Bắt buộc"
        json promotionSnapshot
        json cancellation
        json reassignment
        json confirmation
        datetime createdAt
    }

    ORDERASSIGNMENTS {
        string id PK
        string orderId FK "Bắt buộc"
        string providerId FK "Bắt buộc"
        string assignmentType
        string status
        datetime assignedAt
        datetime responseDeadline "Bắt buộc"
        text rejectReason
        datetime respondedAt
    }

    ORDERSTATUSES {
        string id PK
        string orderId FK "Bắt buộc"
        string status "Bắt buộc"
        string changedBy FK
        string changedByRole "Bắt buộc"
        text note
        datetime createdAt
    }

    REPAIRQUOTATIONS {
        string id PK
        string quotationCode UK "Bắt buộc"
        string orderId FK "Bắt buộc"
        string customerId FK "Bắt buộc"
        string providerId FK "Bắt buộc"
        string status
        decimal subtotalAmount "Bắt buộc"
        decimal discountAmount
        decimal finalAmount "Bắt buộc"
        boolean customerConfirmed
        boolean providerConfirmed
        datetime expiredAt
    }

    REPAIRQUOTATIONITEMS {
        string id PK
        string quotationId FK "Bắt buộc"
        string title "Bắt buộc"
        string itemType "Bắt buộc"
        int quantity "Bắt buộc"
        decimal unitPrice "Bắt buộc"
        decimal totalPrice "Bắt buộc"
    }

    PAYMENTS {
        string id PK
        string orderId FK "Bắt buộc"
        string customerId FK "Bắt buộc"
        decimal amount "Bắt buộc"
        string method "Bắt buộc"
        string paymentType "Bắt buộc"
        string status
        string transactionCode
        string gatewayOrderCode
        string gatewayTransactionId
        string compensatedToProviderId FK
        datetime paidAt
        datetime refundedAt
        json metadata
    }

    REFUNDS {
        string id PK
        string paymentId FK "Bắt buộc"
        string orderId FK "Bắt buộc"
        string customerId FK "Bắt buộc"
        decimal amount "Bắt buộc"
        text reason "Bắt buộc"
        string channel
        string destination
        string status
        string referenceId "Bắt buộc"
        string payoutId
        int attemptCount
        datetime nextRetryAt
        datetime completedAt
    }

    WALLETS {
        string id PK
        string userId FK, UK "Bắt buộc"
        decimal balance
        decimal pendingBalance
        string currency
    }

    WALLETTRANSACTIONS {
        string id PK
        string walletId FK "Bắt buộc"
        string userId FK "Bắt buộc"
        string relatedOrderId FK
        string relatedPaymentId FK
        string relatedWithdrawRequestId FK
        string type "Bắt buộc"
        string direction "Bắt buộc"
        decimal amount "Bắt buộc"
        decimal balanceAfter "Bắt buộc"
        string status
        string transactionCode
        text description
        json metadata
    }

    WITHDRAWREQUESTS {
        string id PK
        string userId FK "Bắt buộc"
        string walletId FK "Bắt buộc"
        string bankAccountId FK "Bắt buộc"
        decimal amount "Bắt buộc"
        string status
        text adminNote
        string reviewedBy FK
        datetime reviewedAt
    }

    AUDITLOGS {
        string id PK
        string actorId FK
        string actorRole "Bắt buộc"
        string action "Bắt buộc"
        string targetType "Bắt buộc"
        string targetId
        json oldValue
        json newValue
        text description
        datetime createdAt
    }

    CONVERSATIONS {
        string id PK
        string orderId FK, UK "Bắt buộc"
        string customerId FK "Bắt buộc"
        string providerId FK "Bắt buộc"
        json lastMessage
        datetime customerLastSeenAt
        datetime providerLastSeenAt
    }

    MESSAGES {
        string id PK
        string conversationId FK "Bắt buộc"
        string senderId FK "Bắt buộc"
        string senderRole "Bắt buộc"
        string messageType "Bắt buộc"
        text content
        string imageUrl
        string status
        datetime seenAt
        datetime createdAt
    }

    CHATBOT_CONVERSATIONS {
        string id PK
        string userId FK, UK "Bắt buộc"
        string role "Bắt buộc"
        datetime lastMessageAt
    }

    CHATBOT_MESSAGES {
        string id PK
        string conversationId FK "Bắt buộc"
        string sender "Bắt buộc"
        text content "Bắt buộc"
        string pagePath
        datetime createdAt
    }

    NOTIFICATIONS {
        string id PK
        string userId FK "Bắt buộc"
        string type "Bắt buộc"
        string title "Bắt buộc"
        text content "Bắt buộc"
        json data
        boolean isRead
        datetime readAt
        datetime createdAt
    }

    FEEDBACKS {
        string id PK
        string orderId FK, UK "Bắt buộc"
        string customerId FK "Bắt buộc"
        string providerId FK "Bắt buộc"
        string serviceId FK "Bắt buộc"
        int rating "Bắt buộc"
        text comment
        json images
        boolean isVisible
        json providerReply
    }

    COMPLAINTS {
        string id PK
        string orderId FK "Bắt buộc"
        string complainantId FK "Bắt buộc"
        string targetUserId FK "Bắt buộc"
        string complainantRole "Bắt buộc"
        string title "Bắt buộc"
        text description "Bắt buộc"
        string status
        string resolvedBy FK
        string reviewedBy FK
        string createdViolationId FK
    }

    COMPLAINTEVIDENCES {
        string id PK
        string complaintId FK "Bắt buộc"
        string uploadedBy FK "Bắt buộc"
        string fileType "Bắt buộc"
        string url "Bắt buộc"
        text note
        datetime createdAt
    }

    REPORTS {
        string id PK
        string reporterId FK "Bắt buộc"
        string targetType "Bắt buộc"
        string targetUserId FK
        string orderId FK
        string targetFeedbackId FK
        string conversationId FK
        string reportType "Bắt buộc"
        string title "Bắt buộc"
        text description "Bắt buộc"
        json evidenceFiles
        string status
        string handledBy FK
        string createdViolationId FK
    }

    SUPPORTTICKETS {
        string id PK
        string requesterId FK "Bắt buộc"
        string orderId FK
        string category "Bắt buộc"
        string priority
        string subject "Bắt buộc"
        text description "Bắt buộc"
        string status
        string assignedAdminId FK
        json responses
        json attachments
        string resolvedBy FK
        string createdViolationId FK
    }

    VIOLATIONS {
        string id PK
        string userId FK "Bắt buộc"
        string sourceType
        string sourceId
        string relatedReportId FK
        string relatedComplaintId FK
        string relatedSupportTicketId FK
        string orderId FK
        string violationType "Bắt buộc"
        string severity "Bắt buộc"
        string penaltyType "Bắt buộc"
        json penalty
        string status
        string handledBy FK "Bắt buộc"
        datetime startAt
        datetime endAt
    }

    USERS ||--o{ SESSIONS : "có"
    USERS ||--o{ ADDRESSES : "sở hữu"
    USERS ||--o{ LOCATIONS : "có vị trí"
    USERS ||--o| PROVIDERS : "có hồ sơ provider"
    USERS ||--o{ PROVIDERAPPLICATIONS : "nộp hồ sơ"
    USERS o|--o{ PROVIDERAPPLICATIONS : "duyệt hồ sơ"
    SERVICES }o--o{ PROVIDERS : "được cung cấp"
    SERVICES }o--o{ PROVIDERAPPLICATIONS : "được đăng ký"
    USERS ||--o{ BANKACCOUNTS : "sở hữu"

    CATEGORIES ||--o{ SERVICES : "phân loại"
    SERVICES ||--o{ SERVICEOPTIONS : "có tùy chọn"
    PROVIDERS ||--o{ SERVICESUGGESTIONS : "đề xuất"
    CATEGORIES o|--o{ SERVICESUGGESTIONS : "thuộc danh mục"
    USERS o|--o{ SERVICESUGGESTIONS : "duyệt đề xuất"
    SERVICES o|--o{ SERVICESUGGESTIONS : "được tạo thành"
    CATEGORIES o|--o{ SERVICESUGGESTIONS : "danh mục được tạo"
    USERS ||--o{ NEWS_ARTICLES : "tạo bài viết"

    USERS ||--o{ ORDERS : "đặt đơn"
    PROVIDERS o|--o{ ORDERS : "nhận đơn"
    PROVIDERS o|--o{ ORDERS : "được ưu tiên"
    SERVICES ||--o{ ORDERS : "được đặt"
    ADDRESSES ||--o{ ORDERS : "địa chỉ thực hiện"
    SERVICEOPTIONS }o--o{ ORDERS : "được chọn"
    REPAIRQUOTATIONS o|--o| ORDERS : "báo giá hiện tại"
    ORDERS ||--o{ ORDERASSIGNMENTS : "được phân công"
    PROVIDERS ||--o{ ORDERASSIGNMENTS : "nhận phân công"
    ORDERS ||--o{ ORDERSTATUSES : "có lịch sử trạng thái"
    USERS o|--o{ ORDERSTATUSES : "thay đổi trạng thái"
    ORDERS ||--o{ REPAIRQUOTATIONS : "có báo giá"
    USERS ||--o{ REPAIRQUOTATIONS : "xác nhận báo giá"
    PROVIDERS ||--o{ REPAIRQUOTATIONS : "lập báo giá"
    REPAIRQUOTATIONS ||--o{ REPAIRQUOTATIONITEMS : "gồm hạng mục"

    ORDERS ||--o{ PAYMENTS : "có thanh toán"
    USERS ||--o{ PAYMENTS : "thanh toán"
    PROVIDERS o|--o{ PAYMENTS : "được bồi hoàn"
    PAYMENTS ||--o{ REFUNDS : "có hoàn tiền"
    ORDERS ||--o{ REFUNDS : "được hoàn tiền"
    USERS ||--o{ REFUNDS : "nhận hoàn tiền"
    USERS ||--o| WALLETS : "sở hữu ví"
    WALLETS ||--o{ WALLETTRANSACTIONS : "có giao dịch"
    USERS ||--o{ WALLETTRANSACTIONS : "thực hiện giao dịch"
    ORDERS o|--o{ WALLETTRANSACTIONS : "liên quan"
    PAYMENTS o|--o{ WALLETTRANSACTIONS : "liên quan"
    WITHDRAWREQUESTS o|--o{ WALLETTRANSACTIONS : "liên quan"
    USERS ||--o{ WITHDRAWREQUESTS : "yêu cầu rút tiền"
    WALLETS ||--o{ WITHDRAWREQUESTS : "rút từ ví"
    BANKACCOUNTS ||--o{ WITHDRAWREQUESTS : "nhận tiền"
    USERS o|--o{ WITHDRAWREQUESTS : "duyệt rút tiền"
    USERS o|--o{ AUDITLOGS : "thực hiện hành động"

    ORDERS ||--o| CONVERSATIONS : "có hội thoại"
    USERS ||--o{ CONVERSATIONS : "tham gia với vai trò customer"
    PROVIDERS ||--o{ CONVERSATIONS : "tham gia với vai trò provider"
    CONVERSATIONS ||--o{ MESSAGES : "gồm tin nhắn"
    USERS ||--o{ MESSAGES : "gửi tin nhắn"
    USERS ||--o| CHATBOT_CONVERSATIONS : "có hội thoại chatbot"
    CHATBOT_CONVERSATIONS ||--o{ CHATBOT_MESSAGES : "gồm tin nhắn"
    USERS ||--o{ NOTIFICATIONS : "nhận thông báo"

    ORDERS ||--o| FEEDBACKS : "có đánh giá"
    USERS ||--o{ FEEDBACKS : "viết đánh giá"
    PROVIDERS ||--o{ FEEDBACKS : "nhận đánh giá"
    SERVICES ||--o{ FEEDBACKS : "được đánh giá"
    ORDERS ||--o{ COMPLAINTS : "bị khiếu nại"
    USERS ||--o{ COMPLAINTS : "gửi khiếu nại"
    USERS ||--o{ COMPLAINTS : "bị khiếu nại"
    USERS o|--o{ COMPLAINTS : "xử lý khiếu nại"
    USERS o|--o{ COMPLAINTS : "duyệt khiếu nại"
    VIOLATIONS o|--o| COMPLAINTS : "được tạo từ"
    COMPLAINTS ||--o{ COMPLAINTEVIDENCES : "có bằng chứng"
    USERS ||--o{ COMPLAINTEVIDENCES : "tải bằng chứng"
    USERS ||--o{ REPORTS : "gửi báo cáo"
    USERS o|--o{ REPORTS : "là đối tượng báo cáo"
    ORDERS o|--o{ REPORTS : "liên quan"
    FEEDBACKS o|--o{ REPORTS : "bị báo cáo"
    CONVERSATIONS o|--o{ REPORTS : "bị báo cáo"
    USERS o|--o{ REPORTS : "xử lý báo cáo"
    VIOLATIONS o|--o| REPORTS : "được tạo từ"
    USERS ||--o{ SUPPORTTICKETS : "gửi yêu cầu hỗ trợ"
    ORDERS o|--o{ SUPPORTTICKETS : "liên quan"
    USERS o|--o{ SUPPORTTICKETS : "được phân công"
    USERS o|--o{ SUPPORTTICKETS : "giải quyết"
    VIOLATIONS o|--o| SUPPORTTICKETS : "được tạo từ"
    USERS ||--o{ VIOLATIONS : "nhận vi phạm"
    REPORTS o|--o| VIOLATIONS : "dẫn đến"
    COMPLAINTS o|--o| VIOLATIONS : "dẫn đến"
    SUPPORTTICKETS o|--o| VIOLATIONS : "dẫn đến"
    ORDERS o|--o{ VIOLATIONS : "liên quan"
    USERS ||--o{ VIOLATIONS : "xử lý vi phạm"
