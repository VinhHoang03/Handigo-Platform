import { Schema, model, Types } from "mongoose";

interface OrderSubscription {
  orderId: Types.ObjectId;
  userId: string;
  sessionId: string;
  createdAt: Date;
}

const subscriptionSchema = new Schema<OrderSubscription>({
  orderId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: "Order" },
  userId: { type: String, required: true },
  sessionId: { type: String, required: true },
}, { timestamps: true, collection: "ai_agent_order_subscriptions" });
subscriptionSchema.index({ sessionId: 1, userId: 1 });

interface OrderMessage {
  _id: string;
  sessionId: string;
  userId: string;
  orderId?: Types.ObjectId;
  content: string;
  createdAt: Date;
}

const messageSchema = new Schema<OrderMessage>({
  _id: { type: String, required: true },
  sessionId: { type: String, required: true },
  userId: { type: String, required: true },
  orderId: { type: Schema.Types.ObjectId, ref: "Order" },
  content: { type: String, required: true, maxlength: 6000 },
  createdAt: { type: Date, required: true },
}, { collection: "ai_agent_order_messages" });
messageSchema.index({ sessionId: 1, userId: 1, createdAt: 1 });

const cursorSchema = new Schema<{ _id: string; token: unknown }>({
  _id: { type: String, required: true },
  token: { type: Schema.Types.Mixed, required: true },
}, { collection: "ai_agent_order_cursors" });

export const AgentOrderSubscription = model<OrderSubscription>("AgentOrderSubscription", subscriptionSchema);
export const AgentOrderMessage = model<OrderMessage>("AgentOrderMessage", messageSchema);
export const AgentOrderCursor = model("AgentOrderCursor", cursorSchema);

const caseSubscriptionSchema = new Schema<{
  caseId: Types.ObjectId; kind: "ticket" | "complaint"; userId: string; sessionId: string; createdAt: Date; initializedAt?: Date;
}>({
  caseId: { type: Schema.Types.ObjectId, required: true },
  kind: { type: String, enum: ["ticket", "complaint"], required: true },
  userId: { type: String, required: true },
  sessionId: { type: String, required: true },
  initializedAt: { type: Date },
}, { timestamps: true, collection: "ai_agent_case_subscriptions" });
caseSubscriptionSchema.index({ caseId: 1, kind: 1 }, { unique: true });
caseSubscriptionSchema.index({ sessionId: 1, userId: 1 });
export const AgentCaseSubscription = model("AgentCaseSubscription", caseSubscriptionSchema);
