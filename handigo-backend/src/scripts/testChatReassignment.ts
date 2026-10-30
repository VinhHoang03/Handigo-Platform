import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Provider } from "../models/provider.model";
import { Order } from "../models/order.model";
import User from "../models/user.model";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import * as chat from "../services/chat.service";
import * as penaltyPolicy from "../services/penaltyPolicy.service";
import { emitToConversation, setSocketServer } from "../sockets/socketServer";

async function run() {
  const customerId = new Types.ObjectId(); const otherCustomer = new Types.ObjectId();
  const providerId = new Types.ObjectId(); const otherProvider = new Types.ObjectId();
  const providerUser = new Types.ObjectId(); const otherUser = new Types.ObjectId();
  const order = { _id: new Types.ObjectId(), customerId, providerId, status: "accepted",
    orderCode: "HD001", createdAt: new Date(), scheduledAt: null };
  const conversations: InstanceType<typeof Conversation>[] = [];
  const messages: any[] = [];
  mock.method(penaltyPolicy, "assertFeatureAllowed", async () => ({} as never));
  const matches = (row: any, filter: any) => Object.entries(filter).every(([key, value]) =>
    key === "isDeleted" ? !row.isDeleted : String(row[key]) === String(value));
  const query = <T>(value: T): any => Object.assign(Promise.resolve(value), {
    session: () => query(value), select: () => query(value), lean: () => query(value),
    populate: () => query(value), sort: () => query(value), skip: () => query(value), limit: () => query(value),
  });
  // Mô phỏng khóa ghi hồ sơ thợ giữa các giao dịch độc lập.
  let tail = Promise.resolve();
  const session: any = { endSession: async () => {} };
  mock.method(mongoose, "startSession", async () => ({ ...session,
    withTransaction: async (work: () => Promise<unknown>) => {
      const before = tail; let release!: () => void;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await before;
      try { return await work(); } finally { release(); }
    },
  }));
  mock.method(Provider, "findOne", (filter: any) => query(filter._id
    ? { _id: filter._id, userId: String(filter._id) === String(providerId) ? providerUser : otherUser }
    : { _id: String(filter.userId) === String(providerUser) ? providerId : otherProvider }));
  mock.method(Provider, "updateOne", async (_filter: any, _update: any, options: any) => {
    assert.ok(options.session); assert.equal(options.runValidators, true);
    return { matchedCount: 1 } as never;
  });
  mock.method(User, "findById", () => query({ fullName: "Thợ Handigo" }));
  mock.method(Order, "findOne", () => query(order));
  let chatEnabled = true;
  mock.method(Order, "exists", () => query(chatEnabled ? { _id: order._id } : null));
  mock.method(Conversation, "findOne", (filter: any) => query(conversations.find((row) => matches(row, filter)) ?? null));
  mock.method(Conversation, "findById", (id: any) => query(conversations.find((row) => String(row._id) === String(id))));
  mock.method(Conversation, "create", async (rows: any[], options: any) => {
    assert.ok(options.session);
    const created = rows.map((row) => new Conversation(row)); conversations.push(...created); return created as never;
  });
  mock.method(Conversation.prototype, "save", async function (this: InstanceType<typeof Conversation>) { return this; });
  mock.method(Conversation, "find", (filter: any) => query(conversations.filter((row) => matches(row, filter))));
  mock.method(Conversation, "countDocuments", (filter: any) => query(conversations.filter((row) => matches(row, filter)).length));
  mock.method(Message, "findById", (id: any) => query(messages.find((row) => String(row._id) === String(id)) ?? null));
  mock.method(Message, "find", () => query(messages));
  mock.method(Message, "countDocuments", () => query(messages.length));
  mock.method(Message, "create", async (rows: any[]) => {
    const created = rows.map((row) => ({ ...row, _id: row._id ?? new Types.ObjectId(), createdAt: new Date() }));
    messages.push(...created); return created as never;
  });
  const deliveries: string[][] = [];
  setSocketServer({ to: (rooms: string[]) => ({ emit: () => deliveries.push(rooms) }) } as never);
  try {
    const initial = await Promise.all(Array.from({ length: 5 }, () =>
      chat.getOrCreateConversationByOrder(String(customerId), "CUSTOMER", String(order._id))));
    const first = initial[0];
    assert.ok(first); assert.equal(conversations.length, 1);
    assert.ok(initial.every((row) => String(row?._id) === String(first._id)));
    await assert.rejects(chat.getOrCreateConversationByOrder(String(otherCustomer), "CUSTOMER", String(order._id)), /không có quyền/);
    await assert.rejects(chat.getOrCreateConversationByOrder(String(otherUser), "PROVIDER", String(order._id)), /không có quyền/);
    assert.equal(conversations.length, 1);
    order._id = new Types.ObjectId();
    const results = await Promise.all(Array.from({ length: 5 }, () =>
      chat.getOrCreateConversationByOrder(String(customerId), "CUSTOMER", String(order._id))));
    assert.ok(results.every((row) => String(row?._id) === String(first._id)));
    assert.equal(conversations.length, 1, "Đặt lại hoặc mở đồng thời vẫn dùng chat cũ.");
    const assignmentId = new Types.ObjectId();
    await chat.createAssignmentWelcome(order as never, providerId, String(providerUser), assignmentId, session);
    await chat.createAssignmentWelcome(order as never, providerId, String(providerUser), assignmentId, session);
    assert.equal(messages.length, 1, "Mỗi lượt nhận đơn chỉ có một lời chào.");
    assert.equal(String(messages[0].conversationId), String(first._id));
    assert.equal(String(first.orderId), String(order._id));
    order.providerId = otherProvider;
    const second = await chat.getOrCreateConversationByOrder(String(customerId), "CUSTOMER", String(order._id));
    assert.ok(second); assert.notEqual(String(second._id), String(first._id));
    assert.equal(String(first.providerId), String(providerId), "Đổi thợ không chuyển lịch sử cho thợ mới.");
    await assert.rejects(chat.getMessages(String(otherUser), "PROVIDER", String(first._id)), /không thuộc/);
    await chat.getMessages(String(providerUser), "PROVIDER", String(first._id));
    assert.equal((await chat.getMyConversations(String(providerUser), "PROVIDER")).items.length, 1);
    emitToConversation(String(first._id), "message:new", {});
    await new Promise(setImmediate);
    assert.deepEqual(deliveries, [[`user:${customerId}`, `user:${providerUser}`]]);
    order.providerId = providerId;
    assert.equal(String((await chat.getOrCreateConversationByOrder(String(customerId), "CUSTOMER", String(order._id)))?._id), String(first._id));
    order.customerId = otherCustomer;
    await chat.getOrCreateConversationByOrder(String(otherCustomer), "CUSTOMER", String(order._id));
    assert.equal(conversations.length, 3, "Khách khác có chat riêng.");
    await assert.rejects(chat.getMessages(String(otherCustomer), "CUSTOMER", String(first._id)), /không thuộc/);
    chatEnabled = false;
    await assert.rejects(chat.sendMessage(String(customerId), "CUSTOMER", String(first._id), { content: "Kiểm tra" }), /chưa sẵn sàng/);
    console.log("Đạt: tái sử dụng chat, lời chào không trùng, đổi thợ tách lịch sử, phân quyền và người nhận realtime.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
