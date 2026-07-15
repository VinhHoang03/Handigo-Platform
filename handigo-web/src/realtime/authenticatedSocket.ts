import {
  io,
  type ManagerOptions,
  type Socket,
  type SocketOptions,
} from 'socket.io-client';
import { refreshAccessToken } from '@/api/client';
import { tokenStorage } from '@/api/tokenStorage';

type AuthenticatedSocketOptions = Partial<ManagerOptions & SocketOptions>;

const SOCKET_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AUTH_ERROR_MESSAGES = new Set([
  'Missing socket token',
  'Invalid socket token',
]);

export const createAuthenticatedSocket = (
  options: AuthenticatedSocketOptions = {},
): { socket: Socket; dispose: () => void } => {
  let refreshing = false;
  let authRefreshAttempted = false;
  const socket = io(SOCKET_URL, {
    ...options,
    autoConnect: false,
    auth: (callback) => {
      const token = tokenStorage.get();
      callback(token ? { token } : {});
    },
  });

  const handleConnectError = (error: Error) => {
    if (
      refreshing ||
      authRefreshAttempted ||
      !AUTH_ERROR_MESSAGES.has(error.message)
    ) {
      return;
    }

    refreshing = true;
    authRefreshAttempted = true;
    void refreshAccessToken()
      .then(() => {
        if (!socket.connected) socket.connect();
      })
      .catch(() => undefined)
      .finally(() => {
        refreshing = false;
      });
  };

  const handleConnect = () => {
    authRefreshAttempted = false;
  };

  socket.on('connect', handleConnect);
  socket.on('connect_error', handleConnectError);
  socket.connect();

  return {
    socket,
    dispose: () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    },
  };
};
