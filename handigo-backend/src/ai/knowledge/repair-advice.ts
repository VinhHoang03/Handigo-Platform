import { repairCases, repairLimitations, repairReferences, repairReviewedAt, repairSafetyGuides } from "./repair-cases";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const contains = (text: string, term: string) => ` ${text.replace(/[^a-z0-9]+/g, " ")} `.includes(` ${normalize(term)} `);

// Chỉ là bước sàng lọc bổ sung; không thay thế việc model đọc ngữ cảnh và nguồn an toàn.
export function repairSafetyAdvice(description: string) {
  const clauses = normalize(description).split(/[,.!?;\n]+|\b(?:nhung|tuy nhien)\b/);
  const present = (pattern: RegExp) => clauses.some((clause) => {
    for (const match of clause.matchAll(new RegExp(pattern.source, "g"))) {
      if (!/(?:khong|chua|het)(?:\s+(?:co|thay|bi|con|ngui|dau hieu)){0,3}\s*$/.test(clause.slice(0, match.index))) return true;
    }
    return false;
  });
  const key = present(/mui khet|(?:co|boc|ra|phat) khoi|khoi (?:boc|bay|lan)|tia lua|dang chay|phat chay|chay no/)
      ? "fire" : present(/dien giat|ro dien|cham dien|te tay|te khi cham|nuoc (?:tran|ngap|chay).{0,30}(?:o cam|tu dien|bang dien)/)
        ? "electric" : present(/(?:tron|do chung|do them).{0,60}(?:javen|axit|acid|thuoc tay|hoa chat|thong cong)/)
          ? "chemical" : null;
  if (!key) return null;
  const guide = repairSafetyGuides[key];
  return { status: "urgent" as const, title: guide.title, message: guide.message,
    references: guide.references.map((id) => repairReferences[id]), reviewedAt: repairReviewedAt };
}

export function assessRepairDescription(description: string) {
  const urgent = repairSafetyAdvice(description);
  if (urgent) return urgent;
  const text = normalize(description);
  const scored = repairCases.map((item) => ({ item,
    deviceScore: Math.max(0, ...item.devices.filter((term) => contains(text, term)).map((term) => normalize(term).length)),
    symptomScore: item.symptoms.filter((term) => contains(text, term)).length,
  })).filter((row) => row.deviceScore > 0);
  const specific = scored.some((row) => row.deviceScore > 4);
  const deviceMatches = scored.filter((row) => !specific || row.deviceScore > 4);
  const matched = deviceMatches.filter((row) => row.symptomScore > 0)
    .sort((a, b) => b.deviceScore - a.deviceScore || b.symptomScore - a.symptomScore).slice(0, 2);
  const cases = matched.map(({ item }) => ({ id: item.id, title: item.title, questions: item.questions,
    possibleCauses: item.possibleCauses, safeActions: item.safeActions, avoidActions: item.avoidActions,
    serviceQueries: item.serviceQueries, references: item.references.map((key) => repairReferences[key]) }));
  return { status: cases.length ? "advice" as const : "needs_details" as const,
    cases, questions: cases.length ? [] : [deviceMatches.length
      ? "Thiết bị đang gặp biểu hiện gì, bắt đầu khi nào và có mã lỗi không?"
      : "Bạn đang gặp sự cố ở thiết bị hoặc khu vực nào, và biểu hiện cụ thể là gì?"],
    safetyQuestion: "Có khói, mùi khét, tia lửa, cảm giác tê giật hoặc nước gần điện không?",
    limitations: repairLimitations, reviewedAt: repairReviewedAt };
}

export function formatRepairSafetyAdvice(advice: NonNullable<ReturnType<typeof repairSafetyAdvice>>) {
  return `${advice.message}\n\nNguồn: ${advice.references.map((source) => `${source.title}: ${source.url}`).join("; ")}`;
}
