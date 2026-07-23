import { Download, FileText } from "lucide-react";
import { downloadUrl, isImageUrl } from "./application-detail.utils";

export function AssetPreview({ url, label }: { url: string; label: string }) {
  return (
    <div>
      <a href={url} target="_blank" rel="noreferrer" className="block">
        {isImageUrl(url) ? (
          <img src={url} alt={label} className="h-36 w-full rounded-lg border border-outline-variant/40 object-cover" />
        ) : (
          <span className="flex h-36 items-center justify-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low text-sm font-bold text-primary">
            <FileText size={18} /> Xem tài liệu
          </span>
        )}
      </a>
      <span className="mt-1 block text-xs font-semibold text-on-surface-variant">{label}</span>
      <a href={downloadUrl(url)} download target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
        <Download size={14} /> Tải xuống
      </a>
    </div>
  );
}
