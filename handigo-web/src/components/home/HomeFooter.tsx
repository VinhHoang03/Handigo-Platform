import { Link } from "react-router-dom";
import { BrandLogo } from "../common/BrandLogo";
import { SocialLink } from "./HomeCards";

const FooterColumn = ({ title, links }: { title: string; links: string[] }) => (
  <div>
    <h4 className="font-label-md text-label-md font-bold text-on-surface mb-4">
      {title}
    </h4>
    <ul className="font-body-md text-body-md text-on-surface-variant">
      {links.map((link) => (
        <li key={link}>
          <Link className="inline-flex min-h-11 items-center transition-all hover:text-primary" to="#">
            {link}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

export const HomeFooter = () => (
  <footer className="mt-xl border-t border-outline-variant/50 bg-surface-container-lowest">
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 px-4 md:px-8 py-16 max-w-7xl mx-auto">
      <div className="col-span-2 space-y-4">
        <BrandLogo compact />
        <p className="font-body-md text-body-md text-on-surface-variant">
          © 2026 Handigo Inc. Chuyên gia đáng tin cậy cho dịch vụ tại nhà.
          <br />
          Giải pháp công nghệ kết nối thợ chuyên nghiệp hàng đầu Việt Nam.
        </p>
        <div className="flex gap-4">
          <SocialLink icon="social_leaderboard" />
          <SocialLink icon="smart_display" />
          <SocialLink icon="language" />
        </div>
      </div>
      <FooterColumn
        title="Dịch Vụ"
        links={["Sửa nước", "Sửa điện", "Vệ sinh", "Máy lạnh"]}
      />
      <FooterColumn
        title="Công Ty"
        links={["Về chúng tôi", "Tuyển dụng", "Blog", "Báo chí"]}
      />
      <FooterColumn
        title="Hỗ Trợ"
        links={[
          "Trung tâm trợ giúp",
          "Điều khoản dịch vụ",
          "Chính sách bảo mật",
          "An toàn",
        ]}
      />
      {/* Cột "Tải Ứng Dụng" với huy hiệu Google Play / App Store đã gỡ: Handigo
          hiện chỉ có bản web, hai huy hiệu đó không có link và hứa một thứ không
          tồn tại. Thêm lại khi nào thực sự phát hành ứng dụng di động. */}
    </div>
  </footer>
);
