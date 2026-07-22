import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authService } from "@/features/auth/services/auth.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { customerServiceApi } from "@/features/customer-service/api/customerService.api";
import type { Service } from "@/types/booking";
import { BrandLogo } from "./BrandLogo";
import { ConfirmDialog } from "./ConfirmDialog";
import { NavbarLinks } from "./navbar/NavbarLinks";
import { NavbarMobileMenu } from "./navbar/NavbarMobileMenu";
import { NavbarUserMenu } from "./navbar/NavbarUserMenu";
import { createNavbarItems, normalizeRole } from "./navbar/navbar.types";
import type { AppRole, NavbarItem } from "./navbar/navbar.types";

export type { AppRole };

interface NavbarProps {
  role?: AppRole;
  isScrolled?: boolean;
  userAvatar?: string | null;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
}

export function Navbar({
  role,
  isScrolled,
  userAvatar,
  showStatusToggle = false,
  isOnline = false,
  onStatusToggle,
}: NavbarProps) {
  const [internalScrolled, setInternalScrolled] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authenticatedRole = normalizeRole(user?.role);
  const currentRole = isAuthenticated ? authenticatedRole : role;
  const scrolled = isScrolled ?? internalScrolled;
  const navItems = useMemo(
    () => createNavbarItems(currentRole),
    [currentRole],
  );
  // Thiếu ảnh thì `InitialsAvatar` lùi về chữ cái đầu, không gọi CDN ngoài.
  const avatar = userAvatar || user?.avatar;

  useEffect(() => {
    const handleScroll = () => setInternalScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const serviceData = await customerServiceApi.services({
          limit: 6,
          bookedOnly: "true",
        });
        setServices(serviceData.items);
      } catch {
        setServices([]);
      }
    };

    void loadServices();
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await authService.logout();
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmOpen(false);
    }
  };

  const handleBookService = () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "/customer/bookings/new" } });
      return;
    }
    navigate("/customer/bookings/new");
  };

  const isActive = (item: NavbarItem) => {
    if (item.path === "#") return false;
    if (item.activePrefix)
      return location.pathname.startsWith(item.activePrefix);
    return location.pathname === item.path;
  };

  return (
    <nav
      className={`fixed left-1/2 z-[70] w-[calc(100%-32px)] max-w-7xl -translate-x-1/2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest/85 px-4 py-3 text-primary shadow-sm backdrop-blur-xl transition-all duration-300 sm:px-6 ${
        scrolled ? "top-2 shadow-xl" : "top-4"
      }`}
    >
      <div className="relative flex items-center justify-between gap-3">
        <BrandLogo compact to="/" />

        <NavbarLinks navItems={navItems} isActive={isActive} services={services} />

        <NavbarMobileMenu
          navItems={navItems}
          isActive={isActive}
          isOpen={isNavOpen}
          setIsOpen={setIsNavOpen}
        />

        <NavbarUserMenu
          isAuthenticated={isAuthenticated}
          currentRole={currentRole}
          user={user}
          avatar={avatar}
          showStatusToggle={showStatusToggle}
          isOnline={isOnline}
          onStatusToggle={onStatusToggle}
          onBookService={handleBookService}
          onRequestLogout={() => setIsLogoutConfirmOpen(true)}
        />
      </div>

      <ConfirmDialog
        open={isLogoutConfirmOpen}
        title="Xác nhận đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản hiện tại?"
        busy={isLoggingOut}
        variant="danger"
        onCancel={() => setIsLogoutConfirmOpen(false)}
        onConfirm={() => void handleLogout()}
      />
    </nav>
  );
}
