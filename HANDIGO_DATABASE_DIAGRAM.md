
Table users {
  id varchar [pk, note: 'MongoDB ObjectId']
  email varchar [not null, unique]
  fullName varchar [not null]
  phone varchar
  role varchar [not null, note: 'CUSTOMER, PROVIDER, ADMIN']
  status varchar [not null, note: 'active, locked']
  providerOnboardingStatus varchar
  isEmailVerified boolean
  createdAt datetime
}

Table sessions {
  id varchar [pk]
  userId varchar [not null, ref: > users.id]
  refreshTokenHash varchar [not null]
  expiresAt datetime [not null]
  revokedAt datetime
}

Table addresses {
  id varchar [pk]
  userId varchar [not null, ref: > users.id]
  recipientName varchar
  recipientPhone varchar
  fullAddress text [not null]
  province varchar [not null]
  ward varchar [not null]
  coordinates json [note: 'latitude and longitude']
  isDefault boolean
}

Table locations {
  id varchar [pk]
  userId varchar [not null, ref: > users.id]
  ownerType varchar [not null, note: 'customer or provider']
  coordinates json [not null, note: 'GeoJSON Point']
  isActive boolean
  lastUpdatedAt datetime
}

Table providers {
  id varchar [pk]
  userId varchar [not null, unique, ref: > users.id]
  description text [not null]
  experienceYears int
  availabilityStatus varchar
  verified boolean
  serviceIds json [note: 'ObjectId array referencing services']
  workingAreas json
  averageRating decimal
  totalCompletedOrders int
  identityDocument json [note: 'Embedded identity document']
  certificates json [note: 'Embedded certificate array']
}

Table providerapplications {
  id varchar [pk]
  userId varchar [not null, ref: > users.id]
  applicationType varchar [not null, note: 'initial or service_addition']
  serviceIds json [note: 'ObjectId array referencing services']
  workingAreas json
  identityDocument json
  certificates json
  status varchar [not null]
  reviewedBy varchar [ref: > users.id]
  reviewHistory json
  submittedAt datetime
}

Table bankaccounts {
  id varchar [pk]
  userId varchar [not null, ref: > users.id]
  bankName varchar [not null]
  bankCode varchar [not null]
  accountNumber varchar [not null]
  accountHolderName varchar [not null]
  isDefault boolean
  status varchar
}

Table categories {
  id varchar [pk]
  name varchar [not null]
  slug varchar [not null, unique]
  description text
  icon varchar
  isActive boolean
}

Table services {
  id varchar [pk]
  categoryId varchar [not null, ref: > categories.id]
  name varchar [not null]
  slug varchar [not null]
  serviceType varchar [not null]
  fixedPrice decimal
  depositAmount decimal
  requiresOptionSelection boolean
  isActive boolean
}

Table serviceoptions {
  id varchar [pk]
  serviceId varchar [not null, ref: > services.id]
  name varchar [not null]
  optionType varchar [not null]
  price decimal [not null]
  selectionGroup varchar
  selectionMode varchar
  allowsQuantity boolean
  isRequired boolean
  isActive boolean
}

Table servicesuggestions {
  id varchar [pk]
  providerId varchar [not null, ref: > providers.id]
  suggestionType varchar [not null]
  suggestedServiceName varchar
  suggestedCategoryName varchar
  categoryId varchar [ref: > categories.id]
  status varchar
  reviewedBy varchar [ref: > users.id]
  createdServiceId varchar [ref: > services.id]
  createdCategoryId varchar [ref: > categories.id]
}

Table promotions {
  id varchar [pk]
  name varchar [not null]
  code varchar
  discountType varchar [not null]
  discountValue decimal [not null]
  maxDiscountAmount decimal
  minOrderAmount decimal
  usageLimit int
  usedCount int
  startAt datetime [not null]
  endAt datetime [not null]
  status varchar
  isActive boolean
}

Table news_articles {
  id varchar [pk]
  slug varchar [not null]
  title varchar [not null]
  category varchar [not null]
  coverImage varchar [not null]
  content json [not null, note: 'Embedded content blocks']
  status varchar
  isFeatured boolean
  publishedAt datetime
  createdBy varchar [not null, ref: > users.id]
}

Table orders {
  id varchar [pk]
  orderCode varchar [not null, unique]
  customerId varchar [not null, ref: > users.id]
  providerId varchar [ref: > providers.id]
  preferredProviderId varchar [ref: > providers.id]
  serviceId varchar [not null, ref: > services.id]
  addressId varchar [not null, ref: > addresses.id]
  selectedOptionIds json [note: 'ObjectId array referencing serviceoptions']
  selectedOptionsSnapshot json
  orderType varchar
  scheduledAt datetime
  bookingStatus varchar
  recurringGroupId varchar [note: 'Groups recurring orders']
  occurrenceNumber int
  totalOccurrences int
  status varchar
  paymentMethod varchar [not null]
  paymentStatus varchar
  currentQuotationId varchar [ref: > repairquotations.id]
  pricing json [not null]
  promotionSnapshot json
  cancellation json
  reassignment json
  confirmation json
  createdAt datetime
}

Table orderassignments {
  id varchar [pk]
  orderId varchar [not null, ref: > orders.id]
  providerId varchar [not null, ref: > providers.id]
  assignmentType varchar
  status varchar
  assignedAt datetime
  responseDeadline datetime [not null]
  rejectReason text
  respondedAt datetime
}

Table orderstatuses {
  id varchar [pk]
  orderId varchar [not null, ref: > orders.id]
  status varchar [not null]
  changedBy varchar [ref: > users.id]
  changedByRole varchar [not null]
  note text
  createdAt datetime
}

Table repairquotations {
  id varchar [pk]
  quotationCode varchar [not null, unique]
  orderId varchar [not null, ref: > orders.id]
  customerId varchar [not null, ref: > users.id]
  providerId varchar [not null, ref: > providers.id]
  status varchar
  subtotalAmount decimal [not null]
  discountAmount decimal
  finalAmount decimal [not null]
  customerConfirmed boolean
  providerConfirmed boolean
  expiredAt datetime
}

Table repairquotationitems {
  id varchar [pk]
  quotationId varchar [not null, ref: > repairquotations.id]
  title varchar [not null]
  itemType varchar [not null]
  quantity int [not null]
  unitPrice decimal [not null]
  totalPrice decimal [not null]
}

Table payments {
  id varchar [pk]
  orderId varchar [not null, ref: > orders.id]
  customerId varchar [not null, ref: > users.id]
  amount decimal [not null]
  method varchar [not null]
  paymentType varchar [not null]
  status varchar
  transactionCode varchar
  gatewayOrderCode varchar
  gatewayTransactionId varchar
  compensatedToProviderId varchar [ref: > providers.id]
  paidAt datetime
  refundedAt datetime
  metadata json
}

Table refunds {
  id varchar [pk]
  paymentId varchar [not null, ref: > payments.id]
  orderId varchar [not null, ref: > orders.id]
  customerId varchar [not null, ref: > users.id]
  amount decimal [not null]
  reason text [not null]
  channel varchar
  destination varchar
  status varchar
  referenceId varchar [not null]
  payoutId varchar
  attemptCount int
  nextRetryAt datetime
  completedAt datetime
}

Table wallets {
  id varchar [pk]
  userId varchar [not null, unique, ref: > users.id]
  balance decimal
  pendingBalance decimal
  currency varchar
}

Table wallettransactions {
  id varchar [pk]
  walletId varchar [not null, ref: > wallets.id]
  userId varchar [not null, ref: > users.id]
  relatedOrderId varchar [ref: > orders.id]
  relatedPaymentId varchar [ref: > payments.id]
  relatedWithdrawRequestId varchar [ref: > withdrawrequests.id]
  type varchar [not null]
  direction varchar [not null]
  amount decimal [not null]
  balanceAfter decimal [not null]
  status varchar
  transactionCode varchar
  description text
  metadata json
}

Table withdrawrequests {
  id varchar [pk]
  userId varchar [not null, ref: > users.id]
  walletId varchar [not null, ref: > wallets.id]
  bankAccountId varchar [not null, ref: > bankaccounts.id]
  amount decimal [not null]
  status varchar
  adminNote text
  reviewedBy varchar [ref: > users.id]
  reviewedAt datetime
}

Table auditlogs {
  id varchar [pk]
  actorId varchar [ref: > users.id]
  actorRole varchar [not null]
  action varchar [not null]
  targetType varchar [not null]
  targetId varchar
  oldValue json
  newValue json
  description text
  createdAt datetime
}

Table conversations {
  id varchar [pk]
  orderId varchar [not null, unique, ref: > orders.id]
  customerId varchar [not null, ref: > users.id]
  providerId varchar [not null, ref: > providers.id]
  lastMessage json
  customerLastSeenAt datetime
  providerLastSeenAt datetime
}

Table messages {
  id varchar [pk]
  conversationId varchar [not null, ref: > conversations.id]
  senderId varchar [not null, ref: > users.id]
  senderRole varchar [not null]
  messageType varchar [not null]
  content text
  imageUrl varchar
  status varchar
  seenAt datetime
  createdAt datetime
}

Table chatbot_conversations {
  id varchar [pk]
  userId varchar [not null, unique, ref: > users.id]
  role varchar [not null]
  lastMessageAt datetime
}

Table chatbot_messages {
  id varchar [pk]
  conversationId varchar [not null, ref: > chatbot_conversations.id]
  sender varchar [not null]
  content text [not null]
  pagePath varchar
  createdAt datetime
}

Table notifications {
  id varchar [pk]
  userId varchar [not null, ref: > users.id]
  type varchar [not null]
  title varchar [not null]
  content text [not null]
  data json
  isRead boolean
  readAt datetime
  createdAt datetime
}

Table feedbacks {
  id varchar [pk]
  orderId varchar [not null, unique, ref: > orders.id]
  customerId varchar [not null, ref: > users.id]
  providerId varchar [not null, ref: > providers.id]
  serviceId varchar [not null, ref: > services.id]
  rating int [not null]
  comment text
  images json
  isVisible boolean
  providerReply json
}

Table complaints {
  id varchar [pk]
  orderId varchar [not null, ref: > orders.id]
  complainantId varchar [not null, ref: > users.id]
  targetUserId varchar [not null, ref: > users.id]
  complainantRole varchar [not null]
  title varchar [not null]
  description text [not null]
  status varchar
  resolvedBy varchar [ref: > users.id]
  reviewedBy varchar [ref: > users.id]
  createdViolationId varchar [ref: > violations.id]
}

Table complaintevidences {
  id varchar [pk]
  complaintId varchar [not null, ref: > complaints.id]
  uploadedBy varchar [not null, ref: > users.id]
  fileType varchar [not null]
  url varchar [not null]
  note text
  createdAt datetime
}

Table reports {
  id varchar [pk]
  reporterId varchar [not null, ref: > users.id]
  targetType varchar [not null]
  targetUserId varchar [ref: > users.id]
  orderId varchar [ref: > orders.id]
  targetFeedbackId varchar [ref: > feedbacks.id]
  conversationId varchar [ref: > conversations.id]
  reportType varchar [not null]
  title varchar [not null]
  description text [not null]
  evidenceFiles json
  status varchar
  handledBy varchar [ref: > users.id]
  createdViolationId varchar [ref: > violations.id]
}

Table supporttickets {
  id varchar [pk]
  requesterId varchar [not null, ref: > users.id]
  orderId varchar [ref: > orders.id]
  category varchar [not null]
  priority varchar
  subject varchar [not null]
  description text [not null]
  status varchar
  assignedAdminId varchar [ref: > users.id]
  responses json
  attachments json
  resolvedBy varchar [ref: > users.id]
  createdViolationId varchar [ref: > violations.id]
}

Table violations {
  id varchar [pk]
  userId varchar [not null, ref: > users.id]
  sourceType varchar
  sourceId varchar
  relatedReportId varchar [ref: > reports.id]
  relatedComplaintId varchar [ref: > complaints.id]
  relatedSupportTicketId varchar [ref: > supporttickets.id]
  orderId varchar [ref: > orders.id]
  violationType varchar [not null]
  severity varchar [not null]
  penaltyType varchar [not null]
  penalty json
  status varchar
  handledBy varchar [not null, ref: > users.id]
  startAt datetime
  endAt datetime
}

TableGroup identity_and_provider {
  users
  sessions
  addresses
  locations
  providers
  providerapplications
  bankaccounts
}

TableGroup catalog_and_content {
  categories
  services
  serviceoptions
  servicesuggestions
  promotions
  news_articles
}

TableGroup orders_and_quotations {
  orders
  orderassignments
  orderstatuses
  repairquotations
  repairquotationitems
}

TableGroup finance {
  payments
  refunds
  wallets
  wallettransactions
  withdrawrequests
  auditlogs
}

TableGroup communication {
  conversations
  messages
  chatbot_conversations
  chatbot_messages
  notifications
}

TableGroup trust_and_support {
  feedbacks
  complaints
  complaintevidences
  reports
  supporttickets
  violations
}

