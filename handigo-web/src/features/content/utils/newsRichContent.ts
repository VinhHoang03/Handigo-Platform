import type { JSONContent } from "@tiptap/core";
import type { NewsContentBlock } from "../api/news.api";

export const newsFonts = ["Be Vietnam Pro", "Arial", "Times New Roman", "Georgia", "Verdana", "Tahoma", "Courier New"];
export const newsFontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72];
export const newsLineHeights = ["1", "1.25", "1.5", "1.75", "2"];
const nodeTypes = ["doc", "paragraph", "heading", "text", "hardBreak", "blockquote", "bulletList", "orderedList", "listItem", "horizontalRule"];
const markTypes = ["bold", "italic", "underline", "strike", "textStyle", "link"];
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function isSafeNewsLink(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000 || Array.from(value).some(char => char.charCodeAt(0) <= 32)) return false;
  try { return ["http:", "https:", "mailto:"].includes(new URL(value).protocol); } catch { return false; }
}

/** Kiểm tra giới hạn cây trước khi đưa bản khôi phục vào bộ soạn thảo. */
export function isNewsRichDocument(value: unknown): value is JSONContent {
  let count = 0;
  const visit = (node: unknown, depth: number, parent?: string): boolean => {
    if (++count > 5000 || depth > 12 || !object(node) || !nodeTypes.includes(String(node.type))) return false;
    if (depth === 0 ? node.type !== "doc" : node.type === "doc") return false;
    if (["paragraph", "heading"].includes(parent ?? "") && !["text", "hardBreak"].includes(String(node.type))) return false;
    if (["doc", "blockquote", "listItem"].includes(parent ?? "") && !["paragraph", "heading", "blockquote", "bulletList", "orderedList", "horizontalRule"].includes(String(node.type))) return false;
    if (["bulletList", "orderedList"].includes(parent ?? "") && node.type !== "listItem") return false;
    if (node.type === "text" && (typeof node.text !== "string" || !node.text.length)) return false;
    if (node.attrs !== undefined && !object(node.attrs)) return false;
    if (node.type === "heading" && (!object(node.attrs) || typeof node.attrs.level !== "number" || ![1, 2, 3].includes(node.attrs.level))) return false;
    if (node.marks !== undefined && (!Array.isArray(node.marks) || node.marks.length > 6 || !node.marks.every(mark =>
      object(mark) && markTypes.includes(String(mark.type)) && (mark.attrs === undefined || object(mark.attrs))))) return false;
    if (["text", "hardBreak", "horizontalRule"].includes(String(node.type))) return node.content === undefined;
    const children = node.content ?? [];
    if (!Array.isArray(children) || children.length > 100) return false;
    if (["doc", "blockquote", "bulletList", "orderedList", "listItem"].includes(String(node.type)) && !children.length) return false;
    if (node.type === "listItem" && (!object(children[0]) || children[0].type !== "paragraph")) return false;
    return children.every(child => visit(child, depth + 1, String(node.type)));
  };
  return visit(value, 0);
}

export const safeNewsColor = (value: unknown): string | undefined =>
  typeof value === "string" && value.length <= 50 && /^(#[\da-f]{6}|rgba?\([\d\s.,%]+\))$/i.test(value) ? value : undefined;

export function newsTextStyles(attrs: Record<string, unknown> = {}) {
  const font = typeof attrs.fontFamily === "string" ? attrs.fontFamily.replace(/["']/g, "") : "";
  const size = typeof attrs.fontSize === "string" && /^\d+(\.\d+)?px$/.test(attrs.fontSize) && parseFloat(attrs.fontSize) >= 8 && parseFloat(attrs.fontSize) <= 96 ? attrs.fontSize : undefined;
  return {
    ...(newsFonts.includes(font) ? { fontFamily: font } : {}),
    ...(size ? { fontSize: size } : {}),
    ...(safeNewsColor(attrs.color) ? { color: safeNewsColor(attrs.color) } : {}),
    ...(safeNewsColor(attrs.backgroundColor) ? { backgroundColor: safeNewsColor(attrs.backgroundColor) } : {}),
    ...(newsLineHeights.includes(String(attrs.lineHeight)) ? { lineHeight: String(attrs.lineHeight) } : {}),
  };
}

export function normalizeNewsRichContent(doc: JSONContent): JSONContent {
  const visit = (node: JSONContent): JSONContent => {
    const attrs: Record<string, unknown> = {};
    if (["paragraph", "heading"].includes(node.type ?? "")) {
      if (["left", "center", "right", "justify"].includes(node.attrs?.textAlign)) attrs.textAlign = node.attrs?.textAlign;
      if (node.type === "heading") attrs.level = [1, 2, 3].includes(node.attrs?.level) ? node.attrs?.level : 2;
    }
    if (node.type === "orderedList") {
      const start = node.attrs?.start;
      attrs.start = Number.isInteger(start) && start >= 1 && start <= 10000 ? start : 1;
      if (["1", "a", "A", "i", "I"].includes(node.attrs?.type)) attrs.type = node.attrs?.type;
    }
    const marks = node.marks?.filter(mark => markTypes.includes(mark.type) && (mark.type !== "link" || isSafeNewsLink(mark.attrs?.href))).map(mark => {
      if (mark.type === "link") return { type: "link", attrs: { href: mark.attrs?.href, target: "_blank", rel: "noopener noreferrer nofollow" } };
      if (mark.type === "textStyle") return { type: "textStyle", attrs: newsTextStyles(mark.attrs) };
      return { type: mark.type };
    });
    return { type: node.type, ...(node.text !== undefined ? { text: node.text } : {}),
      ...(Object.keys(attrs).length ? { attrs } : {}), ...(marks?.length ? { marks } : {}),
      ...(node.content ? { content: node.content.map(visit) } : {}) };
  };
  return visit(doc);
}

const inlineText = (text: string): JSONContent[] => text.split("\n").flatMap((line, index) => [
  ...(index ? [{ type: "hardBreak" }] : []), ...(line ? [{ type: "text", text: line }] : []),
]);

export const newsRichContentFromBlocks = (blocks: NewsContentBlock[]): JSONContent => ({
  type: "doc", content: blocks.map(block => {
    if (block.type === "list") return { type: "bulletList", content: block.items.map(item => ({ type: "listItem", content: [{ type: "paragraph", content: inlineText(item) }] })) };
    if (block.type === "quote") return { type: "blockquote", content: [{ type: "paragraph", content: inlineText(block.text) }] };
    return { type: block.type === "heading" ? "heading" : "paragraph", ...(block.type === "heading" ? { attrs: { level: 2 } } : {}), content: inlineText(block.text) };
  }),
});

const textOf = (node: JSONContent): string => node.type === "text" ? node.text ?? "" : node.type === "hardBreak" ? "\n" :
  (node.content ?? []).map(textOf).join(["doc", "listItem", "blockquote", "bulletList", "orderedList"].includes(node.type ?? "") ? "\n" : "");
const chunks = (text: string, length: number) => {
  const result: string[] = [];
  for (let i = 0; i < text.length; i += length) result.push(text.slice(i, i + length));
  return result;
};

/** Bản chữ thuần để client cũ vẫn đọc được nội dung bài định dạng. */
export function newsBlocksFromRichContent(doc: JSONContent): NewsContentBlock[] {
  const blocks: NewsContentBlock[] = [];
  for (const node of doc.content ?? []) {
    if (["bulletList", "orderedList"].includes(node.type ?? "")) {
      const items = (node.content ?? []).flatMap(item => chunks(textOf(item).trim(), 500));
      for (let i = 0; i < items.length; i += 30) blocks.push({ type: "list", items: items.slice(i, i + 30) });
    } else {
      const type = node.type === "heading" ? "heading" : node.type === "blockquote" ? "quote" : "paragraph";
      for (const text of chunks(textOf(node).trim(), 5000)) blocks.push({ type, text });
    }
  }
  return blocks.length ? blocks : [{ type: "paragraph", text: "" }];
}
