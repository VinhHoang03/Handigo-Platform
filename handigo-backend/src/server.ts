import dotenv from "dotenv";
import http from "http";
import mongoose from "mongoose";
import { validateProductionConfig } from "./configs/production";
import { createLogger } from "./utils/logger";

dotenv.config();

const PORT = Number(process.env.PORT || 5000);
const REQUEST_TIMEOUT_MS = 120_000;
const HEADERS_TIMEOUT_MS = 60_000;
const KEEP_ALIVE_TIMEOUT_MS = 5_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const serverLogger = createLogger("Server");

const startServer = async () => {
  try {
    validateProductionConfig();

    const [
      { default: app },
      { connectDB },
      { initSocket },
      { DispatchService },
      {
        startRefundReconciliationMonitor,
        stopRefundReconciliationMonitor,
      },
      { startReassignmentMonitor, stopReassignmentMonitor },
    ] = await Promise.all([
      import("./app"),
      import("./configs/db"),
      import("./sockets/initSocket"),
      import("./services/dispatch.service"),
      import("./services/orderCancellation.service"),
      import("./services/orderReassignment.service"),
    ]);

    await connectDB();

    const server = http.createServer(app);
    server.requestTimeout = REQUEST_TIMEOUT_MS;
    server.headersTimeout = HEADERS_TIMEOUT_MS;
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
    server.setTimeout(REQUEST_TIMEOUT_MS);

    const io = initSocket(server);
    DispatchService.startTimeoutMonitor();
    startRefundReconciliationMonitor();
    startReassignmentMonitor();

    server.listen(PORT, "0.0.0.0", () => {
      serverLogger.info("Máy chủ đang chạy.", { port: PORT });
    });

    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      serverLogger.info("Nhận tín hiệu dừng máy chủ.", { signal });
      DispatchService.stopTimeoutMonitor();
      stopRefundReconciliationMonitor();
      stopReassignmentMonitor();
      io.disconnectSockets(true);

      const forceShutdownTimer = setTimeout(() => {
        serverLogger.error("Đóng máy chủ quá thời gian cho phép.");
        server.closeAllConnections();
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);
      forceShutdownTimer.unref();

      try {
        server.closeIdleConnections();
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
        await mongoose.connection.close();
        clearTimeout(forceShutdownTimer);
        serverLogger.info("Đã đóng máy chủ an toàn.");
        process.exit(0);
      } catch (error) {
        clearTimeout(forceShutdownTimer);
        serverLogger.error("Đóng máy chủ thất bại.", error);
        server.closeAllConnections();
        process.exit(1);
      }
    };

    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));
  } catch (error) {
    serverLogger.error("Không thể khởi động máy chủ.", error);
    process.exit(1);
  }
};

void startServer();
