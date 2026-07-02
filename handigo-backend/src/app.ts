import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import paymentRoutes from "./routes/payment.routes";
import voucherRoutes from "./routes/voucher.routes";
import walletRoutes from "./routes/wallet.routes";
import withdrawalRoutes from "./routes/withdrawal.routes";
import bankAccountRoutes from "./routes/bankAccount.routes";
import notificationRoutes from "./routes/notification.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import systemConfigRoutes from "./routes/systemConfig.routes";
import addressRoutes from "./routes/address.routes";
import vietnamAddressRoutes from "./routes/vietnamAddress.routes";
import categoryRoutes from "./routes/category.routes";
import serviceRoutes from "./routes/service.routes";
import feedbackRoutes from "./routes/feedback.routes";
import complaintRoutes from "./routes/complaint.routes";
import reportRoutes from "./routes/report.routes";
import supportTicketRoutes from "./routes/supportTicket.routes";
import violationRoutes from "./routes/violation.routes";
import providerApplicationRoutes from "./routes/providerApplication.routes";
import providerApplicationAssetRoutes from "./routes/providerApplicationAsset.routes";
import providerAssetRoutes from "./routes/providerAsset.routes";
import providerRoutes from "./routes/provider.routes";
import adminRoutes from "./routes/admin.routes";
import chatRoutes from "./routes/chat.routes";
import locationRoutes from "./routes/location.routes";
import orderRoutes from "./routes/order.routes";
import adminAssetRoutes from "./routes/adminAsset.routes";
import serviceSuggestionRoutes from "./routes/serviceSuggestion.routes";
import searchRoutes from "./routes/search.routes";
import ocrRoutes from "./routes/ocr.routes";
import { isAllowedOrigin } from "./configs/cors";
import { createLogger } from "./utils/logger";

const app: Application = express();
const appLogger = createLogger("App");

app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Nguồn truy cập không được phép."));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Cho phép popup Google OAuth hoạt động đúng với chính sách COOP.
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      message: "JSON không hợp lệ",
      error: err.message,
    });
  }
  next(err);
});

app.use((req, res, next) => {
  appLogger.info("Yêu cầu HTTP", {
    method: req.method,
    path: req.path,
  });
  next();
});

app.use("/auth", authRoutes);
app.use("/payments", paymentRoutes);
app.use("/vouchers", voucherRoutes);
app.use("/withdrawals", withdrawalRoutes);
app.use("/wallets", walletRoutes);
app.use("/bank-accounts", bankAccountRoutes);
app.use("/notifications", notificationRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/system-configs", systemConfigRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/complaints", complaintRoutes);
app.use("/reports", reportRoutes);
app.use("/support-tickets", supportTicketRoutes);
app.use("/violations", violationRoutes);
app.use("/users", userRoutes);
app.use("/categories", categoryRoutes);
app.use("/services", serviceRoutes);
app.use("/service-suggestions", serviceSuggestionRoutes);
app.use("/search", searchRoutes);
app.use("/admin/assets", adminAssetRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/provider-applications", providerApplicationRoutes);
app.use("/provider-application-assets", providerApplicationAssetRoutes);
app.use("/provider-assets", providerAssetRoutes);
app.use("/providers", providerRoutes);
app.use("/admin", adminRoutes);
app.use("/addresses", addressRoutes);
app.use("/vietnam-addresses", vietnamAddressRoutes);
app.use("/orders", orderRoutes);
app.use("/chat", chatRoutes);
app.use("/locations", locationRoutes);

app.use(
  (
    err: Error & { statusCode?: number },
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    appLogger.error("Lỗi xử lý request", err, {
      method: req.method,
      path: req.path,
    });
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu yêu cầu không hợp lệ",
        errors: err.issues,
      });
    }

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
      success: false,
      message: err.message || "Lỗi máy chủ nội bộ",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  },
);

app.use((req, res) => {
  appLogger.info("Không tìm thấy route", {
    method: req.method,
    path: req.path,
  });
  res.status(404).json({ message: "Không tìm thấy route" });
});

export default app;
