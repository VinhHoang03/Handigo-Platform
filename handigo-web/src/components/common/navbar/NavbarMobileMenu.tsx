import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import type { NavbarItem } from "./navbar.types";
import { Menu, X } from "lucide-react";

interface NavbarMobileMenuProps {
  navItems: NavbarItem[];
  isActive: (item: NavbarItem) => boolean;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

/** Nút mở/đóng + bảng menu di động (dưới ngưỡng `xl`). */
export function NavbarMobileMenu({
  navItems,
  isActive,
  isOpen,
  setIsOpen,
}: NavbarMobileMenuProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Mở menu điều hướng"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="ml-auto grid h-11 w-11 place-items-center rounded-xl text-primary hover:bg-surface-container-low xl:hidden"
      >
        {isOpen ? <X aria-hidden="true" size={24} /> : <Menu aria-hidden="true" size={24} />}
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+16px)] z-50 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 shadow-[0_18px_46px_rgba(19,27,46,0.16)] xl:hidden">
          <div className="grid gap-1 sm:grid-cols-2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                  isActive(item)
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
