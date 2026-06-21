import type { Server } from "socket.io";

let socketServer: Server | null = null;

export const setSocketServer = (io: Server) => {
  socketServer = io;
};

export const emitToUser = (userId: string, event: string, payload: unknown) => {
  socketServer?.to(`user:${userId}`).emit(event, payload);
};
