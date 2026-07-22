import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  homeApi,
  type CatalogSearchResult,
} from "@/features/home/api/home.api";
import { MaterialIcon } from "../common/MaterialIcon";
import { HeroSearchResults } from "./HeroSearchResults";

/**
 * Ô tìm kiếm chính của trang chủ: gợi ý dịch vụ theo từ khoá (debounce 250ms)
 * và cho phép lấy vị trí hiện tại để thu hẹp kết quả.
 */
export const HeroSearch = () => {
  const navigate = useNavigate();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [selectedResult, setSelectedResult] =
    useState<CatalogSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Vị trí của bạn");
  const [isLocating, setIsLocating] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const keyword = query.trim().replace(/\s+/g, " ");
    if (!keyword || selectedResult?.name === query) {
      return;
    }

    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await homeApi.searchCatalog(keyword);
        if (currentRequest === requestId.current) {
          setResults(data);
          setIsOpen(true);
        }
      } catch {
        if (currentRequest === requestId.current) setResults([]);
      } finally {
        if (currentRequest === requestId.current) setIsSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, selectedResult]);

  const openResult = (result: CatalogSearchResult) => {
    setSelectedResult(result);
    setQuery(result.name);
    setIsOpen(false);

    if (result.type === "category") {
      navigate(`/customer/services?categoryId=${result.id}`);
      return;
    }
    navigate(
      `/customer/services/${result.type === "option" ? result.serviceId : result.id}`,
    );
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedResult) {
      openResult(selectedResult);
      return;
    }
    if (results[0]) {
      openResult(results[0]);
      return;
    }
    const keyword = query.trim().replace(/\s+/g, " ");
    if (keyword)
      navigate(`/customer/services?search=${encodeURIComponent(keyword)}`);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setLocationLabel("Trình duyệt không hỗ trợ định vị");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationLabel("Đã xác định vị trí");
        setIsLocating(false);
      },
      () => {
        setLocationLabel("Không thể lấy vị trí");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <form
      onSubmit={submitSearch}
      role="search"
      className="flex flex-col items-stretch gap-1 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-1.5 shadow-[0_2px_4px_rgba(19,27,46,0.04),0_12px_32px_-8px_rgba(19,27,46,0.10)] md:flex-row md:items-center"
    >
      <div className="relative flex-[1.6]">
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors focus-within:bg-surface-container-low">
          <MaterialIcon className="shrink-0 text-[20px] text-on-surface-variant">
            search
          </MaterialIcon>
          <input
            className="w-full border-none bg-transparent text-body-md text-on-surface outline-none placeholder:text-on-surface-variant/80 focus:ring-0"
            placeholder="Bạn cần sửa gì?"
            aria-label="Tìm dịch vụ"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            value={query}
            autoComplete="off"
            onFocus={() => setIsOpen(true)}
            onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setIsOpen(false);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedResult(null);
              setResults([]);
              setIsSearching(false);
            }}
          />
          {isSearching && (
            <MaterialIcon className="shrink-0 animate-spin text-[18px] text-on-surface-variant">
              progress_activity
            </MaterialIcon>
          )}
        </div>

        {isOpen && query.trim() && (
          <HeroSearchResults
            listboxId={listboxId}
            query={query}
            results={results}
            isSearching={isSearching}
            selectedResult={selectedResult}
            onSelect={openResult}
          />
        )}
      </div>

      <span
        aria-hidden="true"
        className="hidden h-7 w-px bg-outline-variant/60 md:block"
      />

      <button
        type="button"
        onClick={locate}
        className="flex flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:translate-y-0 hover:bg-surface-container-low"
      >
        <MaterialIcon
          className={`shrink-0 text-[20px] text-on-surface-variant ${isLocating ? "animate-spin" : ""}`}
        >
          {isLocating ? "progress_activity" : "location_on"}
        </MaterialIcon>
        <span className="truncate text-body-md text-on-surface-variant">
          {locationLabel}
        </span>
      </button>

      <button
        type="submit"
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-label-md font-semibold text-on-primary shadow-[0_6px_16px_-4px_rgba(42,28,166,0.45)] transition-colors duration-200 hover:translate-y-0 hover:bg-primary-hover active:scale-[0.98]"
      >
        Tìm thợ
      </button>
    </form>
  );
};
