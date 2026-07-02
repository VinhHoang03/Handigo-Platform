import dotenv from "dotenv";
import http from "http";
import mongoose from "mongoose";

dotenv.config();

import app from "./app";
import { connectDB } from "./configs/db";
import { initSocket } from "./sockets/initSocket";
import { DispatchService } from "./services/dispatch.service";
import { validateProductionConfig } from "./configs/production";
import { createLogger } from "./utils/logger";

const PORT = Number(process.env.PORT || 5000);
const serverLogger = createLogger("Server");

const startServer = async () => {
  try {
    validateProductionConfig();
    await connectDB();

    const server = http.createServer(app);
    initSocket(server);
    DispatchService.startTimeoutMonitor();

    server.listen(PORT, "0.0.0.0", () => {
      serverLogger.info("Máy chủ đang chạy.", { port: PORT });
    });

    const shutdown = (signal: string) => {
      serverLogger.info("Nhận tín hiệu dừng máy chủ.", { signal });
      server.close(() => {
        mongoose.connection
          .close()
          .finally(() => process.exit(0));
      });

      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    serverLogger.error("Không thể khởi động máy chủ.", error);
    process.exit(1);
  }
};

startServer();
