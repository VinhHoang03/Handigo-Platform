import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import type { NewsContentBlock } from "@/features/content/api/news.api";
import { newsBlocksFromRichContent, newsRichContentFromBlocks, normalizeNewsRichContent } from "@/features/content/utils/newsRichContent";
import { NewsEditorToolbar } from "./NewsEditorToolbar";
import { newsEditorExtensions } from "./newsEditorExtensions";
import "@/features/content/components/news-rich-content.css";

interface Props {
  content: NewsContentBlock[];
  richContent?: JSONContent;
  disabled: boolean;
  onChange: (content: NewsContentBlock[], richContent: JSONContent) => void;
}

export function NewsRichTextEditor({ content, richContent, disabled, onChange }: Props) {
  const editor = useEditor({
    extensions: newsEditorExtensions(),
    content: richContent ? normalizeNewsRichContent(richContent) : newsRichContentFromBlocks(content),
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": "Nội dung bài viết", "aria-multiline": "true", class: "news-rich-content min-h-[420px] px-6 py-8 outline-none sm:px-10" } },
    onUpdate: ({ editor }) => {
      const doc = normalizeNewsRichContent(editor.getJSON());
      onChange(newsBlocksFromRichContent(doc), doc);
    },
  });
  const text = useEditorState({ editor, selector: ({ editor }) => editor?.getText() ?? "" }) ?? "";
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  if (!editor) return <p role="status" className="p-6">Đang tải bộ soạn thảo…</p>;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return <section aria-label="Soạn nội dung bài viết" className="news-rich-editor">
    <NewsEditorToolbar editor={editor} disabled={disabled} />
    <EditorContent editor={editor} />
    <p className="border-t border-outline-variant/30 px-6 py-3 text-xs text-on-surface-variant">{words} từ · {text.length} ký tự · Bôi chọn chữ để định dạng · Enter để tạo đoạn mới</p>
  </section>;
}
