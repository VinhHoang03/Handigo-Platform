import { AsyncLocalStorage } from "node:async_hooks";

export const orderActorContext = new AsyncLocalStorage<{
  id: string;
  role: "customer" | "provider" | "admin";
}>();
