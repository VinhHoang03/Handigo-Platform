import { useState } from "react";
import { ReliableImage } from "@/components/common/ReliableImage";
import type { Service } from "@/types/booking";
import { getServiceImage } from "../utils/serviceDisplay";
import { Share2 } from "lucide-react";

interface ServiceGalleryProps {
  service: Service;
  categoryName: string;
}

/** Ảnh bìa dịch vụ, tên danh mục và tiêu đề. */
export function ServiceGallery({ service, categoryName }: ServiceGalleryProps) {
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: service.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 2000);
    } catch {
      if (!navigator.share) {
        setShareState("failed");
        window.setTimeout(() => setShareState("idle"), 2000);
      }
    }
  };

  return (
    <section className="overflow-hidden rounded-xl bg-surface-container-lowest p-5 shadow-sm">
      <ReliableImage
        src={getServiceImage(service)}
        alt={`Thợ Handigo làm dịch vụ ${service.name}`}
        className="mb-5 aspect-[16/9] w-full rounded-lg bg-surface-container object-cover"
      />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase text-primary">{categoryName}</p>
          <h1 className="mt-2 text-balance text-3xl font-bold text-on-background">{service.name}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {shareState !== "idle" && (
            <span role="status" className="text-label-sm text-on-surface-variant">
              {shareState === "copied" ? "Đã chép liên kết" : "Không chép được"}
            </span>
          )}
          <button
            type="button"
            onClick={() => void share()}
            aria-label={`Chia sẻ dịch vụ ${service.name}`}
            className="grid h-11 w-11 place-items-center rounded-full border border-outline-variant hover:bg-surface-container-low"
          >
            <Share2 aria-hidden="true" size={24} />
          </button>
        </div>
      </div>
    </section>
  );
}
