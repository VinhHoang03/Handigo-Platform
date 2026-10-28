export type TurnPlan =
  | { kind: "history"; tool: string; args: unknown; replaceDraft?: boolean }
  | { kind: "voucher"; args: unknown }
  | { kind: "draft"; fallback: string }
  | { kind: "address"; args: unknown };
