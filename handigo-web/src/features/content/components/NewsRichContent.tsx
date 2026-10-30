import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/core";
import { isSafeNewsLink, newsTextStyles } from "../utils/newsRichContent";
import "./news-rich-content.css";

function renderNode(node: JSONContent): ReactNode {
  if (node.type === "text") {
    let text: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") text = <strong>{text}</strong>;
      else if (mark.type === "italic") text = <em>{text}</em>;
      else if (mark.type === "underline") text = <u>{text}</u>;
      else if (mark.type === "strike") text = <s>{text}</s>;
      else if (mark.type === "textStyle") text = <span style={newsTextStyles(mark.attrs)}>{text}</span>;
      else if (mark.type === "link" && isSafeNewsLink(mark.attrs?.href)) text = <a href={mark.attrs?.href} target="_blank" rel="noopener noreferrer nofollow">{text}</a>;
    }
    return text;
  }
  const children = node.content?.map((child, index) => <Fragment key={index}>{renderNode(child)}</Fragment>);
  const alignment = node.attrs?.textAlign;
  const style: CSSProperties = ["left", "center", "right", "justify"].includes(alignment) ? { textAlign: alignment } : {};
  switch (node.type) {
    case "doc": return children;
    case "paragraph": return <p style={style}>{children?.length ? children : <br />}</p>;
    case "heading": {
      const level = node.attrs?.level;
      if (level === 1) return <h2 className="news-rich-heading-1" style={style}>{children}</h2>;
      if (level === 3) return <h4 className="news-rich-heading-3" style={style}>{children}</h4>;
      return <h3 className="news-rich-heading-2" style={style}>{children}</h3>;
    }
    case "blockquote": return <blockquote>{children}</blockquote>;
    case "bulletList": return <ul>{children}</ul>;
    case "orderedList": return <ol start={Number.isInteger(node.attrs?.start) ? node.attrs?.start : 1} type={["1", "a", "A", "i", "I"].includes(node.attrs?.type) ? node.attrs?.type : "1"}>{children}</ol>;
    case "listItem": return <li>{children}</li>;
    case "horizontalRule": return <hr />;
    case "hardBreak": return <br />;
    default: return null;
  }
}

export function NewsRichContent({ content }: { content: JSONContent }) {
  return <div className="news-rich-content">{renderNode(content)}</div>;
}
