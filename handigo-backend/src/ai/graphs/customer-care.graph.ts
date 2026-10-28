import { buildConfirmedActionGraph, type ConfirmedActionDependencies } from "./confirmed-action.graph";

export const CUSTOMER_CARE_WRITE_TOOLS = ["create_support_ticket", "reply_support_ticket", "cancel_support_ticket",
  "create_complaint", "add_complaint_evidence", "cancel_complaint", "submit_booking_feedback"] as const;

export const buildCustomerCareActionGraph = (deps: ConfirmedActionDependencies) =>
  buildConfirmedActionGraph("customer-care", CUSTOMER_CARE_WRITE_TOOLS, deps);
