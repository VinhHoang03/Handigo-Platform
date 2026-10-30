import { useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Minus, Link, Unlink, Undo2, Redo2, RemoveFormatting, IndentIncrease, IndentDecrease } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { isSafeNewsLink, newsFonts, newsFontSizes, newsLineHeights } from "@/features/content/utils/newsRichContent";

const selectClass = "min-h-10 min-w-0 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

function Tool({ label, children, active = false, disabled = false, onClick }: {
  label: string; children: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return <button type="button" aria-label={label} title={label} aria-pressed={active} disabled={disabled}
    onMouseDown={event => event.preventDefault()} onClick={onClick}
    className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-30 ${active ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:bg-surface-container-low"}`}>{children}</button>;
}

export function NewsEditorToolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const state = useEditorState({ editor, selector: ({ editor }) => ({
    bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"), strike: editor.isActive("strike"),
    bulletList: editor.isActive("bulletList"), orderedList: editor.isActive("orderedList"), quote: editor.isActive("blockquote"), link: editor.isActive("link"),
    heading: editor.getAttributes("heading").level ?? 0,
    textStyle: editor.getAttributes("textStyle"), align: editor.getAttributes("paragraph").textAlign ?? editor.getAttributes("heading").textAlign ?? "left",
    undo: editor.can().undo(), redo: editor.can().redo(), indent: editor.can().sinkListItem("listItem"), outdent: editor.can().liftListItem("listItem"),
  }) });
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  return <>
    <fieldset disabled={disabled} aria-label="Công cụ định dạng bài viết" className="sticky top-0 z-20 min-w-0 space-y-2 border-y border-outline-variant/40 bg-surface-container-lowest px-3 py-3 disabled:opacity-50">
      <legend className="sr-only">Công cụ định dạng bài viết</legend>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Kiểu đoạn" value={state.heading} className={selectClass} onChange={event => {
          const level = Number(event.target.value);
          if (level === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
        }}><option value={0}>Đoạn văn</option><option value={1}>Tiêu đề 1</option><option value={2}>Tiêu đề 2</option><option value={3}>Tiêu đề 3</option></select>
        <select aria-label="Phông chữ" value={state.textStyle.fontFamily?.replace(/["']/g, "") ?? ""} className={`${selectClass} max-w-40`} onChange={event => {
          if (event.target.value) editor.chain().focus().setFontFamily(event.target.value).run(); else editor.chain().focus().unsetFontFamily().run();
        }}><option value="">Phông mặc định</option>{newsFonts.map(font => <option key={font} value={font}>{font}</option>)}</select>
        <select aria-label="Cỡ chữ" value={state.textStyle.fontSize ?? ""} className={`${selectClass} w-24`} onChange={event => {
          if (event.target.value) editor.chain().focus().setFontSize(event.target.value).run(); else editor.chain().focus().unsetFontSize().run();
        }}><option value="">Cỡ chữ</option>{newsFontSizes.map(size => <option key={size} value={`${size}px`}>{size} px</option>)}</select>
        <select aria-label="Giãn dòng" value={state.textStyle.lineHeight ?? ""} className={`${selectClass} w-28`} onChange={event => {
          if (event.target.value) editor.chain().focus().setLineHeight(event.target.value).run(); else editor.chain().focus().unsetLineHeight().run();
        }}><option value="">Giãn dòng</option>{newsLineHeights.map(height => <option key={height} value={height}>{height}</option>)}</select>
        <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/40 px-2 text-xs font-semibold" title="Màu chữ">Chữ
          <input aria-label="Màu chữ" type="color" value={/^#[\da-f]{6}$/i.test(state.textStyle.color ?? "") ? state.textStyle.color : "#131b2e"} onChange={event => editor.chain().focus().setColor(event.target.value).run()} className="size-7 cursor-pointer border-0 bg-transparent" />
        </label>
        <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant/40 px-2 text-xs font-semibold" title="Màu nền chữ">Nền
          <input aria-label="Màu nền chữ" type="color" value={/^#[\da-f]{6}$/i.test(state.textStyle.backgroundColor ?? "") ? state.textStyle.backgroundColor : "#fff2a8"} onChange={event => editor.chain().focus().setBackgroundColor(event.target.value).run()} className="size-7 cursor-pointer border-0 bg-transparent" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Tool label="In đậm (Ctrl+B)" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={18} /></Tool>
        <Tool label="In nghiêng (Ctrl+I)" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={18} /></Tool>
        <Tool label="Gạch chân (Ctrl+U)" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={18} /></Tool>
        <Tool label="Gạch ngang" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={18} /></Tool>
        <span aria-hidden="true" className="mx-1 h-6 border-l border-outline-variant/50" />
        {([{ value: "left", label: "Căn trái", Icon: AlignLeft }, { value: "center", label: "Căn giữa", Icon: AlignCenter }, { value: "right", label: "Căn phải", Icon: AlignRight }, { value: "justify", label: "Căn đều", Icon: AlignJustify }]).map(({ value, label, Icon }) =>
          <Tool key={value} label={label} active={state.align === value} onClick={() => editor.chain().focus().setTextAlign(value).run()}><Icon size={18} /></Tool>)}
        <span aria-hidden="true" className="mx-1 h-6 border-l border-outline-variant/50" />
        <Tool label="Danh sách dấu chấm" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={18} /></Tool>
        <Tool label="Danh sách đánh số" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={18} /></Tool>
        <Tool label="Tăng cấp danh sách" disabled={!state.indent} onClick={() => editor.chain().focus().sinkListItem("listItem").run()}><IndentIncrease size={18} /></Tool>
        <Tool label="Giảm cấp danh sách" disabled={!state.outdent} onClick={() => editor.chain().focus().liftListItem("listItem").run()}><IndentDecrease size={18} /></Tool>
        <Tool label="Trích dẫn" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={18} /></Tool>
        <Tool label="Chèn đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={18} /></Tool>
        <Tool label="Chèn hoặc sửa liên kết" active={state.link} onClick={() => { setUrl(editor.getAttributes("link").href ?? ""); setLinkError(""); setLinkOpen(true); }}><Link size={18} /></Tool>
        <Tool label="Bỏ liên kết" disabled={!state.link} onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}><Unlink size={18} /></Tool>
        <Tool label="Xóa định dạng" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run()}><RemoveFormatting size={18} /></Tool>
        <span aria-hidden="true" className="mx-1 h-6 border-l border-outline-variant/50" />
        <Tool label="Hoàn tác (Ctrl+Z)" disabled={!state.undo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={18} /></Tool>
        <Tool label="Làm lại (Ctrl+Shift+Z)" disabled={!state.redo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={18} /></Tool>
      </div>
    </fieldset>
    <Modal open={linkOpen} title="Chèn liên kết" size="sm" onClose={() => setLinkOpen(false)}>
      <form onSubmit={event => {
        event.preventDefault();
        const href = url.trim();
        if (!isSafeNewsLink(href)) { setLinkError("Nhập liên kết https://, http:// hoặc mailto: hợp lệ."); return; }
        if (editor.state.selection.empty && !editor.isActive("link")) editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
        else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
        setLinkOpen(false);
      }} className="space-y-4">
        <label className="block text-sm font-semibold">Đường dẫn<input autoFocus value={url} maxLength={2000} onChange={event => setUrl(event.target.value)} placeholder="https://example.com" className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant px-3" /></label>
        {linkError && <p role="alert" className="text-sm text-error">{linkError}</p>}
        <div className="flex justify-end gap-3"><button type="button" onClick={() => setLinkOpen(false)} className="min-h-11 px-4">Hủy</button><button type="submit" className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-on-primary">Áp dụng</button></div>
      </form>
    </Modal>
  </>;
}
