import type { Complaint, Report, Violation } from "@/features/case-management/types/caseManagement.types";

export type CaseRow = Complaint | Report | Violation;

export type AdminCaseTab = "complaints" | "reports" | "violations";

export type SelectedAdminCase =
  | { kind: "complaint"; item: Complaint }
  | { kind: "report"; item: Report }
  | { kind: "violation"; item: Violation };
