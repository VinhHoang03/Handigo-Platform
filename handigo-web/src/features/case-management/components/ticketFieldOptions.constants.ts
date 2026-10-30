import { SUPPORT_CATEGORY_LABELS } from "./supportLabels.constants";
import type { SupportTicketCategory } from "../types/caseManagement.types";

const CREATE_CATEGORIES: SupportTicketCategory[] = ["PAYMENT", "ACCOUNT", "TECHNICAL", "APPEAL", "GUIDANCE"];
export const CATEGORY_OPTIONS = CREATE_CATEGORIES.map(value => ({ value, label: SUPPORT_CATEGORY_LABELS[value] }));
