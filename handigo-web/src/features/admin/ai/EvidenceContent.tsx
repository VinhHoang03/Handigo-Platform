import { evidenceLines } from "./assessmentPresentation";

export function EvidenceContent({ quote }: { quote: string }) {
  return <blockquote className="space-y-1 whitespace-pre-wrap">{evidenceLines(quote).map((line, index) => <p key={index}>{line}</p>)}</blockquote>;
}
