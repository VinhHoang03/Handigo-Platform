import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types } from "mongoose";
import User from "../models/user.model";
import { Session } from "../models/session.model";

let onConnection: (socket: unknown) => void;
const disconnectedRooms: string[] = [];
class FakeServer {
  use() {}
  on(name: string, handler: typeof onConnection) { if (name === "connection") onConnection = handler; }
  in(room: string) { return { disconnectSockets: () => disconnectedRooms.push(room) }; }
}
require.cache[require.resolve("socket.io")] = { exports: { Server: FakeServer } } as NodeModule;
require.cache[require.resolve("../configs/cors")] = { exports: { isAllowedOrigin: () => true } } as NodeModule;

async function run() {
  const user = new User({ email: "kiem-thu@example.com", fullName: "Khách kiểm thử", role: "CUSTOMER", status: "active" });
  const query = <T>(value: T): any => Object.assign(Promise.resolve(value), { select: () => query(value), lean: () => query(value) });
  mock.method(User, "findOne", () => query(user));
  mock.method(User.prototype, "save", async function (this: InstanceType<typeof User>) { return this; });
  mock.method(Session, "updateMany", async () => ({ modifiedCount: 1 }) as never);
  let middleware: (packet: unknown[], next: (error?: Error) => void) => Promise<void>;
  let disconnected = false;
  const socket = { user: { id: user.id, role: "CUSTOMER" }, join() {}, on() {},
    use: (handler: typeof middleware) => { middleware = handler; }, disconnect: () => { disconnected = true; } };
  try {
    const { initSocket } = require("../sockets/initSocket") as typeof import("../sockets/initSocket");
    const { updateUserStatus } = require("../services/admin.service") as typeof import("../services/admin.service");
    initSocket({} as never); onConnection!(socket);
    let denied: Error | undefined;
    await middleware!(["message:send", {}], (error) => { denied = error; });
    assert.equal(denied, undefined);
    await updateUserStatus(new Types.ObjectId().toString(), user.id, "locked");
    assert.deepEqual(disconnectedRooms, [`user:${user.id}`], "Khóa tài khoản phải ngắt các socket đang mở ngay.");
    await middleware!(["message:send", {}], (error) => { denied = error; });
    assert.ok(denied); assert.equal(disconnected, true);
    user.status = "active"; user.role = "PROVIDER"; disconnected = false;
    await middleware!(["order:location:update", {}], (error) => { denied = error; });
    assert.ok(denied); assert.equal(disconnected, true, "Socket có role cũ phải kết nối lại.");
    console.log("Đạt: ngắt socket khi khóa tài khoản, chặn sự kiện sau khóa và role đã thay đổi.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
