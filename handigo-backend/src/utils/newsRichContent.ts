export interface NewsRichNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: NewsRichNode[];
}

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const optional = (value: unknown, test: (value: unknown) => boolean) => value === undefined || value === null || test(value);
const fonts = ["Arial", "Times New Roman", "Georgia", "Verdana", "Tahoma", "Courier New", "Be Vietnam Pro"];
const blocks = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "horizontalRule"];
const color = (value: unknown) => typeof value === "string" && /^(#[\da-f]{6}|rgba?\([\d\s.,%]+\))$/i.test(value) && value.length <= 50;

export function isSafeNewsLink(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000 || /[\u0000-\u0020]/.test(value)) return false;
  try { return ["http:", "https:", "mailto:"].includes(new URL(value).protocol); } catch { return false; }
}

/** Chỉ nhận cây nội dung có giới hạn, không lưu HTML hoặc thuộc tính tùy ý từ client. */
export function isNewsRichContent(value: unknown): value is NewsRichNode {
  let count = 0;
  let textLength = 0;
  const mark = (value: unknown): boolean => {
    if (!object(value) || !keys(value, ["type", "attrs"])) return false;
    const attrs = value.attrs;
    if (["bold", "italic", "underline", "strike"].includes(String(value.type))) return attrs === undefined;
    if (!object(attrs)) return false;
    if (value.type === "link") return keys(attrs, ["href", "target", "rel", "class"]) && isSafeNewsLink(attrs.href)
      && optional(attrs.target, item => item === "_blank" || item === "_self")
      && optional(attrs.rel, item => typeof item === "string" && item.length <= 100)
      && optional(attrs.class, item => item === "");
    return value.type === "textStyle" && keys(attrs, ["fontFamily", "fontSize", "color", "backgroundColor", "lineHeight"])
      && optional(attrs.fontFamily, item => typeof item === "string" && fonts.includes(item.replace(/["']/g, "")))
      && optional(attrs.fontSize, item => typeof item === "string" && /^\d+(\.\d+)?px$/.test(item) && parseFloat(item) >= 8 && parseFloat(item) <= 96)
      && optional(attrs.color, color) && optional(attrs.backgroundColor, color)
      && optional(attrs.lineHeight, item => ["1", "1.25", "1.5", "1.75", "2"].includes(String(item)));
  };
  const visit = (node: unknown, depth: number, parent?: string): boolean => {
    if (++count > 5000 || depth > 12 || !object(node) || !keys(node, ["type", "text", "attrs", "marks", "content"])) return false;
    const type = node.type;
    if (typeof type !== "string") return false;
    if (depth === 0 ? type !== "doc" : type === "doc") return false;
    if (parent === "doc" || parent === "blockquote") { if (!blocks.includes(type)) return false; }
    if (["paragraph", "heading"].includes(parent ?? "") && !["text", "hardBreak"].includes(type)) return false;
    if (["bulletList", "orderedList"].includes(parent ?? "") && type !== "listItem") return false;
    if (parent === "listItem" && !blocks.includes(type)) return false;
    const attrs = node.attrs;
    if (attrs !== undefined) {
      if (!object(attrs)) return false;
      if (type === "paragraph" || type === "heading") {
        if (!keys(attrs, type === "heading" ? ["textAlign", "level"] : ["textAlign"]) ||
          !optional(attrs.textAlign, item => ["left", "center", "right", "justify"].includes(String(item)))) return false;
        if (type === "heading" && (typeof attrs.level !== "number" || ![1, 2, 3].includes(attrs.level))) return false;
      } else if (type === "orderedList") {
        if (!keys(attrs, ["start", "type"]) || !optional(attrs.start, item => Number.isInteger(item) && Number(item) >= 1 && Number(item) <= 10000)
          || !optional(attrs.type, item => ["1", "a", "A", "i", "I"].includes(String(item)))) return false;
      } else if (Object.keys(attrs).length) return false;
    }
    if (type === "heading" && (!object(attrs) || typeof attrs.level !== "number" || ![1, 2, 3].includes(attrs.level))) return false;
    if (node.marks !== undefined && (!["text", "hardBreak"].includes(type) || !Array.isArray(node.marks) || node.marks.length > 6 || !node.marks.every(mark))) return false;
    if (type === "text") {
      if (typeof node.text !== "string" || !node.text.length || node.content !== undefined || node.attrs !== undefined) return false;
      textLength += node.text.length;
      return textLength <= 100000;
    }
    if (node.text !== undefined) return false;
    if (["horizontalRule", "hardBreak"].includes(type)) return node.content === undefined;
    if (!["doc", "paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem"].includes(type)) return false;
    const children = node.content ?? [];
    if (!Array.isArray(children) || children.length > 100) return false;
    if (["doc", "blockquote", "bulletList", "orderedList", "listItem"].includes(type) && !children.length) return false;
    if (type === "listItem" && (!object(children[0]) || children[0].type !== "paragraph")) return false;
    return children.every(child => visit(child, depth + 1, type));
  };
  return visit(value, 0);
}
