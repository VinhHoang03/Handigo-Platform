import type { Report, Violation } from "@/features/case-management/types/caseManagement.types";

export type CaseRow = Report | Violation;

export type AdminCaseTab = "reports" | "violations";

export type SelectedAdminCase =
  | { kind: "report"; item: Report }
  | { kind: "violation"; item: Violation };
