import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types } from "mongoose";
import { Provider } from "../models/provider.model";
import { Order } from "../models/order.model";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import * as chat from "../services/chat.service";
import { emitToConversation, setSocketServer } from "../sockets/socketServer";

async function run() {
  const oldUser = new Types.ObjectId(); const newUser = new Types.ObjectId(); const customerId = new Types.ObjectId();
  const oldProvider = new Types.ObjectId(); const newProvider = new Types.ObjectId(); const orderId = new Types.ObjectId();
  const conversation = new Conversation({ orderId, customerId, providerId: oldProvider, providerLastSeenAt: new Date() });
  const order = { _id: orderId, customerId, providerId: newProvider as Types.ObjectId | null, status: "accepted" };
  const query = <T>(value: T): any => Object.assign(Promise.resolve(value), { select: () => query(value), lean: () => query(value),
    populate: () => query(value), sort: () => query(value), skip: () => query(value), limit: () => query(value) });
  mock.method(Provider, "findOne", (filter: any) => query(filter._id ? { _id: newProvider, userId: newUser }
    : { _id: String(filter.userId) === String(newUser) ? newProvider : oldProvider }));
  mock.method(Order, "findOne", () => query(order));
  mock.method(Order, "find", (filter: any) => ({ distinct: async () => String(filter.providerId) === String(newProvider) ? [orderId] : [] }));
  mock.method(Conversation, "findOne", () => query(conversation));
  mock.method(Conversation, "findOneAndUpdate", (_filter: any, update: any) => { conversation.set(update.$set); return query(conversation); });
  mock.method(Conversation.prototype, "save", async function (this: InstanceType<typeof Conversation>) { return this; });
  mock.method(Conversation, "updateMany", async (filter: any, update: any) => {
    if (filter.orderId.$in.some((id: unknown) => String(id) === String(orderId))) conversation.set(update.$set);
    return {} as never;
  });
  const rows = (filter: any) => String(filter.providerId) === String(newProvider) && filter.orderId.$in.length ? [conversation] : [];
  mock.method(Conversation, "find", (filter: any) => query(rows(filter)));
  mock.method(Conversation, "countDocuments", (filter: any) => query(rows(filter).length));
  mock.method(Message, "find", () => query([])); mock.method(Message, "countDocuments", () => query(0));
  const deliveries: string[][] = [];
  setSocketServer({ to: (rooms: string[]) => ({ emit: () => deliveries.push(rooms) }) } as never);
  try {
    await assert.rejects(chat.getMessages(String(oldUser), "PROVIDER", conversation.id), /không có quyền/);
    await chat.getMessages(String(newUser), "PROVIDER", conversation.id);
    assert.equal(String(conversation.providerId), String(newProvider)); assert.equal(conversation.providerLastSeenAt, null);
    const current = await chat.getOrCreateConversationByOrder(String(newUser), "PROVIDER", String(orderId));
    assert.equal(String(current.providerId), String(newProvider));
    assert.equal((await chat.getMyConversations(String(newUser), "PROVIDER")).items.length, 1);
    assert.equal((await chat.getMyConversations(String(oldUser), "PROVIDER")).items.length, 0);
    order.providerId = null;
    await chat.getMessages(String(customerId), "CUSTOMER", conversation.id);
    await assert.rejects(chat.getMessages(String(oldUser), "PROVIDER", conversation.id), /chưa có nhà cung cấp/);
    order.providerId = newProvider;
    emitToConversation(conversation.id, "message:new", {});
    await new Promise(setImmediate);
    assert.deepEqual(deliveries, [[`user:${customerId}`, `user:${newUser}`]], "Sự kiện chỉ tới khách và thợ hiện tại, dù thợ cũ còn giữ room.");
    console.log("Đạt: chat theo thợ hiện tại, chặn thợ cũ, cập nhật danh sách và người nhận realtime sau đổi thợ.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
