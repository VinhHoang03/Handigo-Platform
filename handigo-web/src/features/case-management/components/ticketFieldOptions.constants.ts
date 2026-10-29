import { SUPPORT_CATEGORY_LABELS } from "./supportLabels.constants";
import type { SupportTicketCategory } from "../types/caseManagement.types";

export const CATEGORY_OPTIONS = (Object.entries(SUPPORT_CATEGORY_LABELS) as Array<[SupportTicketCategory, string]>).map(([value, label]) => ({ value, label }));
