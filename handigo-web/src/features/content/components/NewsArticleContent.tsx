import type { NewsContentBlock } from "../api/news.api";
import type { JSONContent } from "@tiptap/core";
import { NewsRichContent } from "./NewsRichContent";
import { isNewsRichDocument } from "../utils/newsRichContent";

export function NewsArticleContent({ content, richContent }: { content: NewsContentBlock[]; richContent?: JSONContent }) {
  if (richContent && isNewsRichDocument(richContent)) return <NewsRichContent content={richContent} />;
  return content.map((block, index) => {
    const key = `${block.type}-${index}`;
    if (block.type === "heading") return <h2 key={key} className="pt-4 text-3xl font-bold text-primary">{block.text}</h2>;
    if (block.type === "quote") return <blockquote key={key} className="rounded-2xl border-l-4 border-secondary bg-surface-container-low p-6 font-medium text-on-surface">{block.text}</blockquote>;
    if (block.type === "list") return <ul key={key} className="space-y-2 pl-5">{block.items.map((item, i) => <li key={i} className="list-disc pl-1">{item}</li>)}</ul>;
    return <p key={key}>{block.text}</p>;
  });
}
