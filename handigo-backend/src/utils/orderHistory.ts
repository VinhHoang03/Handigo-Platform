import mongoose, { ClientSession, Model, Schema, Types } from "mongoose";
import { OrderStatus } from "../models/orderStatus.model";
import { orderActorContext } from "./orderActorContext";

type State = { _id: Types.ObjectId; status: string; statusVersion?: number };
type HistoryOperation = { before: State[]; status: string; session: ClientSession; owned: boolean };

export const recordOrderStatus = async (order: State, previousStatus: string | null, session: ClientSession) => {
  const actor = orderActorContext.getStore();
  await OrderStatus.updateOne({ orderId: order._id, statusVersion: order.statusVersion ?? 1 }, { $setOnInsert: {
    status: order.status, previousStatus, eventType: "status_changed",
    changedBy: actor?.id ?? null, changedByRole: actor?.role ?? "system",
  } }, { upsert: true, session, runValidators: true });
};

// Lịch sử và trạng thái được ghi trong cùng transaction; không tái dựng dữ liệu cũ.
export const installOrderHistory = (schema: Schema) => {
  const pending = new WeakMap<object, HistoryOperation>();
  const finish = async (operation: object, failed = false) => {
    const state = pending.get(operation);
    if (!state) return;
    if (state.owned) {
      try {
        if (failed) await state.session.abortTransaction();
        else {
          try { await state.session.commitTransaction(); }
          catch (error) {
            if (state.session.inTransaction()) await state.session.abortTransaction();
            throw error;
          }
        }
      } finally { pending.delete(operation); await state.session.endSession(); }
    } else pending.delete(operation);
  };
  schema.pre("save", async function () {
    if (!this.isNew && !this.isModified("status")) return;
    const owned = !this.$session();
    const session = this.$session() ?? await mongoose.startSession();
    if (owned) { session.startTransaction(); this.$session(session); }
    pending.set(this, { before: [], status: String(this.get("status")), session, owned });
    try {
      const previous = this.isNew ? null : await (this.constructor as Model<State>).findById(this._id).select("status statusVersion").session(session).lean();
      this.set("statusVersion", (previous?.statusVersion ?? 0) + (previous?.status === this.get("status") ? 0 : 1));
      pending.get(this)!.before = previous ? [previous] : [];
    } catch (error) { await finish(this, true); if (owned) this.$session(null); throw error; }
  });
  schema.post("save", async function (document) {
    const operation = pending.get(this);
    if (!operation) return;
    try {
      if (operation.before[0]?.status !== document.get("status")) await recordOrderStatus({ _id: document._id as Types.ObjectId, status: String(document.get("status")), statusVersion: Number(document.get("statusVersion")) }, operation.before[0]?.status ?? null, operation.session);
      await finish(this);
    } catch (error) { await finish(this, true); throw error; }
    finally { if (operation.owned) document.$session(null); }
  });
  schema.post("save", async function (error: Error, document: mongoose.Document, next: (error?: Error) => void) {
    const owned = pending.get(document)?.owned;
    await finish(document, true); if (owned) document.$session(null); next(error);
  });
  for (const method of ["findOneAndUpdate", "updateOne", "updateMany"] as const) {
    schema.pre(method, async function () {
      const update = this.getUpdate();
      if (!update || Array.isArray(update)) return;
      const status = update.$set?.status ?? update.status;
      if (typeof status !== "string") return;
      const owned = !this.getOptions().session;
      const session = this.getOptions().session ?? await mongoose.startSession();
      if (owned) { session.startTransaction(); this.session(session); }
      pending.set(this, { before: [], status, session, owned });
      try {
        const query = this.model.find(this.getFilter()).select("status statusVersion").session(session);
        if (this.getOptions().sort) query.sort(this.getOptions().sort);
        if (method !== "updateMany") query.limit(1);
        const before = await query.lean() as State[];
        pending.get(this)!.before = before;
        if (before.length) this.setQuery({ $and: [this.getFilter(), { $or: before.map(order => ({ _id: order._id, status: order.status })) }] });
        if (before.some(order => order.status !== status)) update.$inc = { ...update.$inc, statusVersion: 1 };
        this.setUpdate(update);
        this.setOptions({ runValidators: true });
      } catch (error) { await finish(this, true); throw error; }
    });
    schema.post(method, async function (result) {
      const operation = pending.get(this);
      if (!operation) return;
      try {
        if (result && (!("modifiedCount" in result) || result.modifiedCount > 0)) {
          for (const previous of operation.before) {
            if (previous.status === operation.status) continue;
            await recordOrderStatus({ ...previous, status: operation.status, statusVersion: (previous.statusVersion ?? 0) + 1 }, previous.status, operation.session);
          }
        }
        await finish(this);
      } catch (error) { await finish(this, true); throw error; }
    });
    schema.post(method, async function (error: Error, _result: unknown, next: (error?: Error) => void) {
      await finish(this, true); next(error);
    });
  }
};
