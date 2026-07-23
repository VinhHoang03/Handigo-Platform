import type { NewsContentBlock } from "@/features/content/api/news.api";
import { blockLabels } from "./news.constants";

interface NewsContentBlocksEditorProps {
  content: NewsContentBlock[];
  onChange: (content: NewsContentBlock[]) => void;
}

const blockTypes = Object.keys(blockLabels) as NewsContentBlock["type"][];

export function NewsContentBlocksEditor({ content, onChange }: NewsContentBlocksEditorProps) {
  const updateBlock = (index: number, block: NewsContentBlock) => {
    onChange(content.map((item, itemIndex) => (itemIndex === index ? block : item)));
  };

  const changeBlockType = (index: number, type: NewsContentBlock["type"]) => {
    updateBlock(index, type === "list" ? { type: "list", items: [""] } : { type, text: "" });
  };

  const addBlock = (type: NewsContentBlock["type"]) => {
    onChange([...content, type === "list" ? { type: "list", items: [""] } : { type, text: "" }]);
  };

  const removeBlock = (index: number) => {
    onChange(content.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-on-surface">Nội dung bài viết</h3>
          <p className="text-sm text-on-surface-variant">Chọn định dạng riêng cho từng khối nội dung.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {blockTypes.map((type) => (
            <button key={type} type="button" onClick={() => addBlock(type)} className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
              + {blockLabels[type]}
            </button>
          ))}
        </div>
      </div>

      {content.map((block, index) => (
        <div key={index} className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-on-primary">{index + 1}</span>
            <select
              value={block.type}
              onChange={(event) => changeBlockType(index, event.target.value as NewsContentBlock["type"])}
              className="min-h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold outline-none focus:border-primary"
            >
              {blockTypes.map((type) => (
                <option key={type} value={type}>{blockLabels[type]}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={content.length === 1}
              onClick={() => removeBlock(index)}
              className="ml-auto grid h-10 w-10 place-items-center rounded-lg text-error hover:bg-error/10 disabled:opacity-30"
              aria-label={`Xóa khối ${index + 1}`}
            >
              <span className="material-symbols-outlined block text-[20px] leading-none">delete</span>
            </button>
          </div>
          {block.type === "list" ? (
            <textarea
              required
              rows={4}
              value={block.items.join("\n")}
              onChange={(event) => updateBlock(index, { type: "list", items: event.target.value.split("\n") })}
              placeholder="Mỗi dòng là một mục trong danh sách"
              className="w-full resize-y rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          ) : (
            <textarea
              required
              rows={block.type === "heading" ? 2 : 4}
              maxLength={5000}
              value={block.text}
              onChange={(event) => updateBlock(index, { type: block.type, text: event.target.value })}
              placeholder={blockLabels[block.type]}
              className="w-full resize-y rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          )}
        </div>
      ))}
    </section>
  );
}
