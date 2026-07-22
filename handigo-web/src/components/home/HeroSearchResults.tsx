import type { CatalogSearchResult } from "@/features/home/api/home.api";
import { MaterialIcon } from "../common/MaterialIcon";

const resultTypeLabel: Record<CatalogSearchResult["type"], string> = {
  category: "Danh mục",
  service: "Dịch vụ",
  option: "Tùy chọn",
};

const resultTypeIcon: Record<CatalogSearchResult["type"], string> = {
  category: "category",
  service: "home_repair_service",
  option: "tune",
};

/** Skeleton bám theo đúng hình dạng một dòng kết quả, thay cho spinner chung chung. */
const ResultsSkeleton = () => (
  <div className="space-y-1" aria-hidden="true">
    {[0, 1, 2].map((row) => (
      <div key={row} className="flex items-center gap-3 px-3 py-2.5">
        <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-surface-container-high" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3 w-1/2 animate-pulse rounded bg-surface-container-high" />
          <div className="h-2.5 w-1/3 animate-pulse rounded bg-surface-container" />
        </div>
      </div>
    ))}
  </div>
);

type HeroSearchResultsProps = {
  listboxId: string;
  query: string;
  results: CatalogSearchResult[];
  isSearching: boolean;
  selectedResult: CatalogSearchResult | null;
  onSelect: (result: CatalogSearchResult) => void;
};

export const HeroSearchResults = ({
  listboxId,
  query,
  results,
  isSearching,
  selectedResult,
  onSelect,
}: HeroSearchResultsProps) => (
  <div
    id={listboxId}
    role="listbox"
    className="absolute inset-x-0 top-[calc(100%+10px)] z-20 max-h-80 overflow-y-auto rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-1.5 shadow-[0_16px_40px_-8px_rgba(19,27,46,0.18)]"
  >
    {isSearching && results.length === 0 && <ResultsSkeleton />}

    {results.map((result) => (
      <button
        key={`${result.type}-${result.id}`}
        type="button"
        role="option"
        aria-selected={selectedResult?.id === result.id}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(result)}
        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:translate-y-0 hover:bg-surface-container-low"
      >
        <MaterialIcon className="mt-0.5 shrink-0 text-[20px] text-on-surface-variant">
          {resultTypeIcon[result.type]}
        </MaterialIcon>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-on-surface">
            {result.name}
          </span>
          <span className="block truncate text-xs text-on-surface-variant">
            {resultTypeLabel[result.type]}
            {result.description ? ` · ${result.description}` : ""}
          </span>
        </span>
      </button>
    ))}

    {!isSearching && results.length === 0 && (
      <p className="px-3 py-6 text-center text-sm text-on-surface-variant">
        Không có dịch vụ nào khớp với “{query.trim()}”.
        <br />
        <span className="text-xs">Thử từ khoá ngắn hơn, ví dụ “điều hoà”.</span>
      </p>
    )}
  </div>
);
