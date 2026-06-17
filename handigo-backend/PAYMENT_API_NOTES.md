# FixNow Payment API Notes

## Files changed

- `src/app.ts`: mounted payment routes at `/api/v1/payments`.
- `src/routes/payment.routes.ts`: payment routes.
- `src/controllers/payment.controller.ts`: controller responses and error handling.
- `src/services/payment.service.ts`: business logic for PayOS, cash tracking, fixed-price platform fee charging, inspection deposit refund/compensation.
- `src/validations/payment.validation.ts`: Zod schemas.
- `src/models/payment.model.ts`: expanded payment fields.
- `src/models/order.model.ts`: added payment/matching state fields.
- `src/models/walletTransaction.model.ts`: added transaction code and metadata.
- `MODELS_DOCUMENTATION.md`: added update notes.
- `postman/fixnow-payment.postman_collection.json`: Postman collection for testing.

## Business rules implemented

### Fixed-price services

- Customer can create payment by `PAYOS` or `CASH`.
- Fixed-price payment uses `paymentType = full`.
- Fixed-price orders have `depositAmount = 0`.
- Cash payment is only tracked as a `Payment` record. It does not create provider debt.
- Provider platform fee is not charged during customer payment creation.
- When provider accepts a fixed-price order, the order/matching flow should call:

```ts
await chargeProviderPlatformFeeOnAccept(orderId, providerUserId);
```

This service:

- rejects inspection-quote orders,
- checks provider wallet balance,
- deducts `order.pricing.platformCommissionAmount`,
- creates a `WalletTransaction` with `type = platform_fee`,
- sets `order.platformFeeChargedAt`,
- prevents duplicate charging.

### Inspection-quote services

- Customer must pay inspection deposit through PayOS.
- Cash deposit is rejected.
- Inspection deposit uses `paymentType = inspection_deposit`.
- PayOS webhook success sets:
  - `payment.status = paid`,
  - `order.depositAmount`,
  - `order.depositPaidAt`,
  - `order.readyForMatching = true`.
- The deposit belongs to the platform.
- No platform fee is deducted from provider wallet for inspection-quote services.

### No provider found

Use:

```ts
await refundInspectionDepositIfNoProvider(orderId);
```

This marks the paid inspection deposit as `refunded` and sets `order.readyForMatching = false`.

### Customer no-show on inspection order

Use:

```ts
await compensateProviderFromInspectionDeposit(orderId, providerUserId, reason);
```

This transfers the paid inspection deposit into the provider wallet as a `WalletTransaction` with `type = provider_earning`.

## API endpoints

### `POST /api/v1/payments/create`

Requires bearer token.

Fixed PayOS:

```json
{
  "orderId": "ORDER_ID",
  "method": "PAYOS",
  "paymentType": "FULL",
  "returnUrl": "http://localhost:5173/payment/success",
  "cancelUrl": "http://localhost:5173/payment/cancel"
}
```

Fixed cash:

```json
{
  "orderId": "ORDER_ID",
  "method": "CASH",
  "paymentType": "FULL"
}
```

Inspection deposit:

```json
{
  "orderId": "ORDER_ID",
  "method": "PAYOS",
  "paymentType": "INSPECTION_DEPOSIT",
  "returnUrl": "http://localhost:5173/payment/success",
  "cancelUrl": "http://localhost:5173/payment/cancel"
}
```

### `POST /api/v1/payments/payos-webhook`

Public endpoint for PayOS webhook. The payload must pass `payos.webhooks.verify`.

### `GET /api/v1/payments/:id`

Requires bearer token.

### `GET /api/v1/payments/order/:orderId`

Requires bearer token.

Returns payments and the successful fixed-price platform fee transaction if one exists.

### `GET /api/v1/payments/history`

Requires bearer token.

Supported query:

- `page`
- `limit`
- `status=pending|paid|failed|refunded`
- `method=payos|vnpay|cash`
- `paymentType=full|remaining|inspection_deposit`

## Postman usage

1. Import `postman/fixnow-payment.postman_collection.json`.
2. Set collection variable `baseUrl`, default is `http://localhost:5000`.
3. Login using the auth collection and copy access token into `token`.
4. Set `orderId` to an existing order id.
5. Run the create payment request that matches the order type.

The PayOS webhook sample requires a valid PayOS signature. For real testing, use PayOS webhook delivery or generate a valid signed payload.

## Verification

Build command passed:

```bash
npm run build
```
