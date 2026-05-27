import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
// import paymentRoutes from "./routes/payment.routes";
// import requestRoutes from "./routes/request.routes";
// import platformSettingRoutes from "./routes/platformSetting.routes";
// import promotionRoutes from "./routes/promotion.routes";
// import analyticsRoutes from "./routes/analytics.route";
// import "./jobs/autoSettlement.job";
// import addressRoutes from "./routes/address.routes";
// import providerRequestRoutes from "./routes/providerRequest.routes";
// import providerRoutes from "./routes/provider.routes";
// import adminRoutes from "./routes/admin.routes";
// import serviceRoutes from "./routes/service.routes";
// import categoryRoutes from "./routes/category.routes";
// import feedbackRoutes from "./routes/feedback.routes";
// import withdrawRoutes from "./routes/withdraw.routes";
// import financeRoutes from "./routes/providerFinance.routes";
// import chatRoutes from "./routes/chat.routes";
// import aiRoutes from "./routes/ai.routes";

const app: Application = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8081",
  "http://localhost:19006",
];

app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? allowedOrigins : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      message: "Invalid JSON",
      error: err.message,
    });
  }
  next(err);
});

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

app.use("/auth", authRoutes);
// app.use("/payments", paymentRoutes);
// app.use("/requests", requestRoutes);
// app.use("/platform-settings", platformSettingRoutes);
// app.use("/promotions", promotionRoutes);
// app.use("/admin/analytics", analyticsRoutes);
// app.use("/feedback", feedbackRoutes);
app.use("/users", userRoutes);
// app.use("/categories", categoryRoutes);
// app.use("/services", serviceRoutes);
// app.use("/service-requests", requestRoutes);
// app.use("/addresses", addressRoutes);
// app.use("/provider-requests", providerRequestRoutes);
// app.use("/providers", providerRoutes);
// app.use("/admin", adminRoutes);
// app.use("/withdraw", withdrawRoutes);
// app.use("/finance", financeRoutes);
// app.use("/chat", chatRoutes);
// app.use("/ai", aiRoutes);

app.use((err: Error & { statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.use((req, res) => {
  console.log(`404 - ${req.method} ${req.path} not found`);
  res.status(404).json({ message: "Route not found" });
});

export default app;
