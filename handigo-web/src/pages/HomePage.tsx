import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import {
  CategoryCard,
  ProviderCard,
  FeatureCard,
  StatItem,
  TestimonialCard,
  SocialLink,
  FooterColumn,
  AppBadge
} from '../components/HomeComponents';

const HomePage: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-surface text-on-surface selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      {/* Navigation */}
      <nav className={`bg-surface/80 dark:bg-inverse-surface/80 backdrop-blur-md text-primary dark:text-primary-fixed-dim docked fixed left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-7xl rounded-xl border border-outline-variant/30 dark:border-outline/20 flex justify-between items-center px-6 py-3 z-50 transition-all duration-300 ${isScrolled ? 'shadow-xl top-2' : 'top-4'}`}>
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="FixNow Logo" className="h-8 md:h-10 w-auto object-contain" />
          <span className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed">FixNow</span>
        </div>
        <div className="hidden md:flex items-center gap-8 font-body-md text-body-md">
          <Link className="text-primary font-bold border-b-2 border-primary pb-1" to="/">Trang chủ</Link>
          <Link className="text-on-surface-variant hover:text-primary transition-colors" to="#">Dịch vụ</Link>
          <Link className="text-on-surface-variant hover:text-primary transition-colors" to="#">Trở thành đối tác</Link>
          <Link className="text-on-surface-variant hover:text-primary transition-colors" to="#">Về chúng tôi</Link>
          <Link className="text-on-surface-variant hover:text-primary transition-colors" to="#">Hỗ trợ</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/signin" className="px-4 py-2 text-on-surface-variant hover:bg-surface-container-low dark:hover:bg-on-surface-variant/10 rounded-lg transition-all font-label-md text-label-md">Đăng nhập</Link>
          <button className="px-5 py-2 bg-primary-container text-on-primary-container font-label-md text-label-md rounded-xl shadow-md active:scale-95 transition-all">Đăng ký</button>
        </div>
      </nav>

      <main className="pt-32 pb-xl">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center overflow-hidden">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container/20 text-on-secondary-container rounded-full border border-secondary-container/30">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <span className="text-label-sm font-label-sm">Dịch vụ tin cậy cho mọi ngôi nhà</span>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-headline-xl font-headline-xl text-on-surface tracking-tight leading-tight">
              Đặt Dịch Vụ Tại Nhà <br />
              <span className="text-primary">Nhanh Chóng &amp; Uy Tín</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[500px]">
              Kết nối với hàng nghìn thợ chuyên nghiệp đã qua kiểm duyệt. Khắc phục sự cố ngôi nhà của bạn chỉ với vài cú chạm.
            </p>
            <div className="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant shadow-lg rounded-2xl p-2 flex flex-col md:flex-row items-stretch gap-2">
              <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-surface-container-low dark:bg-on-surface-variant/5 rounded-xl">
                <span className="material-symbols-outlined text-primary">search</span>
                <input className="bg-transparent border-none focus:ring-0 w-full text-body-md font-body-md" placeholder="Tìm dịch vụ (Sửa điện, nước...)" type="text" />
              </div>
              <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-surface-container-low dark:bg-on-surface-variant/5 rounded-xl border-l-0 md:border-l border-outline-variant/30">
                <span className="material-symbols-outlined text-on-surface-variant">location_on</span>
                <input className="bg-transparent border-none focus:ring-0 w-full text-body-md font-body-md" placeholder="Vị trí của bạn" type="text" />
              </div>
              <button className="bg-primary hover:bg-primary-container text-white px-8 py-3 rounded-xl font-label-md text-label-md shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2">
                Tìm thợ ngay
              </button>
            </div>
            <div className="flex items-center gap-4 md:gap-6 pt-4">
              <div className="flex -space-x-3">
                <img alt="User avatar" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-surface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuv1vh3JOEa-UPi_zgZHwazwz4LBJ2usS0bTI8n_Hs0ssKwi6xodp-Lks4bHX4RpFZhzGFowkNfkM55es-_4iuRB9Kip4Wr26O8Xp2Ebr58-I4NhsyZ-_dmHtigaXKG0QqSXCTc6-SZQSAllPB7x78G4OXXrX46RHj6_9Ze8ZnqQid2XC8sVY7qjPAaAOS_Pm_LMwAPUCm36N61viZ40O1TA11M6Hs5ZkS5fzVxeaGZ3_0QfGFLg7xfQ1jQeuqjNHtYs_-GQyxKrk" />
                <img alt="User avatar" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-surface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDftQyxT-Rj2wiZG6TM304SRibpHRlIiq_F4FCv96uStxbKY2lff-aJnMK_v-NSzW28EMwxGmfR0HEH6HeEB6r-BLnhPQHx9nQZy9kTo1Appq88y7PDK-ZJASfAwSG-c_Wi7_qTzZ-NXIhHWvmA_D7nL_sClsyFS2eU2MZSk181DS25lYUSKo0Fqdww8JsCgbY0mvJBmE6dDf2HH9sMgCd8jj24js-ykcgPYpyxQ1Bt7PSTslJG5cSgpVhXATOJyyPBNARn1djDmdw" />
                <img alt="User avatar" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-surface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCN9ywuHVlspTrWPe-50dUTICKiLosXOgoA6gxOqXXQSMX_Ce8hT0dw6HeAXZfH3G9djjvw_yL-tfFtxc45MQwklG2jrfP7e2nQoM6OHPgOUp5WeMbvttNWOOUyAsalIl6ADZVAwtuxFFQHh5IwEXN_kn65S-oE3N0qXU6fVDsWDgrAWEV226jn69vjiYu3Dnf5yqU5JARXderdbD-oHNwrXEuJHLYfD3lyYr2bS0aY_oQ-gj88wtBQdaRYUNAkUbrbiJNt7pEv5ps" />
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary-container text-on-primary-container text-[8px] md:text-[10px] flex items-center justify-center border-2 border-surface font-bold">+2k</div>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Hơn <span className="font-bold text-on-surface">50,000+</span> việc đã hoàn thành thành công</p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-primary/10 via-secondary-container/10 to-transparent blur-3xl rounded-full"></div>
            <img alt="Home Service Illustration" className="w-full h-auto drop-shadow-2xl floating-anim" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNY5fqqLhhOZkLGN75N3T7PdMr4qQa0zILrxIUNZv5QYU47Id_ZxQnWSFHlBtHBFjg1mVZtjWT6ZmDjM6ctpGLZ91TCkSVzPRW1NcOevNUXU_5JX7VKvRjEBH8zYBTUDHRg4jhpKAMRsEEJ36AxEIXgq96DgSB4FfPWzdYw_lQeQ3g6a9y7XCFwKzTeZy1JB8m0xCGGlNqbXA9D5KgLxnnrh-4kBFVPUc0Cl9DCnxDAh9sHXz7ygV6dmoYuBrLwlc01AvLAIQxEXA" />
            <div className="absolute top-1/4 -left-4 md:-left-8 glass-card p-2 md:p-4 rounded-xl md:rounded-2xl shadow-xl flex items-center gap-2 md:gap-4 animate-bounce hover:pause">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>engineering</span>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface">Thợ đang đến</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Chỉ còn 5 phút</p>
              </div>
            </div>
            <div className="absolute bottom-1/4 -right-2 md:-right-4 glass-card p-2 md:p-4 rounded-xl md:rounded-2xl shadow-xl flex items-center gap-2 md:gap-4 animate-pulse">
              <div className="flex gap-0.5 md:gap-1 text-tertiary">
                <span className="material-symbols-outlined text-xs md:text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined text-xs md:text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined text-xs md:text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined text-xs md:text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined text-xs md:text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              </div>
              <p className="font-label-md text-label-md text-on-surface">Dịch vụ 5 sao</p>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 mt-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-lg gap-4">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Danh Mục Dịch Vụ</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">Mọi vấn đề gia đình của bạn đều có chuyên gia của chúng tôi</p>
            </div>
            <button className="flex items-center gap-2 text-primary font-label-md text-label-md hover:underline w-fit">
              Xem tất cả <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <CategoryCard icon="bolt" title="Sửa điện" desc="Lắp đặt, khắc phục sự cố điện" color="primary" />
            <CategoryCard icon="water_drop" title="Sửa nước" desc="Sửa rò rỉ, thông tắc đường ống" color="secondary" />
            <CategoryCard icon="ac_unit" title="Máy lạnh" desc="Vệ sinh, nạp gas, sửa máy lạnh" color="tertiary" />
            <CategoryCard icon="cleaning_services" title="Vệ sinh" desc="Vệ sinh nhà cửa, thảm, sofa" color="primary" />
            <CategoryCard icon="kitchen" title="Gia dụng" desc="Sửa tủ lạnh, máy giặt, lò vi sóng" color="secondary" />
            <CategoryCard icon="router" title="Internet/Wifi" desc="Cài đặt, tối ưu hóa mạng wifi" color="tertiary" />
            <CategoryCard icon="videocam" title="Camera" desc="Lắp đặt, sửa chữa camera an ninh" color="primary" />
            <CategoryCard icon="format_paint" title="Sơn sửa nhà" desc="Sơn nước, bả tường, trang trí" color="secondary" />
          </div>
        </section>

        {/* Providers Section */}
        <section className="bg-surface-container-low/50 py-xl mt-xl">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-lg">
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Thợ Chuyên Nghiệp Đang Online</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">Những người thợ xuất sắc nhất luôn sẵn sàng giúp đỡ bạn</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <ProviderCard
                name="Nguyễn Văn An"
                category="Sửa Điện"
                rating="4.9"
                dist="1.2km"
                tags={["Lắp mạch", "Sửa điều hòa"]}
                img="https://lh3.googleusercontent.com/aida-public/AB6AXuCYIAvzP5vKq0dj-aTyphUu9WU6u18hwNOF4UNrDsBlDdN4BHsGTMRcDNc6VEakzuAeM3SA3rCMGwdWKbSeGZ2wl__H07QQ1Smutoqb8lfSj4wQoUShpuR77GhIpODN2ShF1PQQVn01GBpbVWseaRoCSpGYIwD8iyDHHZFB0z4MEbc40sk6xtxnBEY2jh55VMWAC6IrFMNiCduW-GXTsJSvcoKFrfBMqXl6F36r7pbIFg6cPzjExYrtoMV9BeRvp0m6aAO0Hf8brGE"
                catColor="secondary-container"
              />
              <ProviderCard
                name="Trần Thị Minh"
                category="Sửa Nước"
                rating="5.0"
                dist="0.8km"
                tags={["Dò rò rỉ", "Thông cống"]}
                img="https://lh3.googleusercontent.com/aida-public/AB6AXuBPucMLBHkVaY4kHlrQNA_NqKQmDuR1wGEHtgTeUGtAJx-1Lxagsbp4duHPfOPBd6hZoqVGd7nCmT56RWINZz2nhZvTRnX-k7UrGQZOZKMW0t4a54cmRIH95rb6qPZeRTg9Bwn-wjWECcBGMrQzlAKQ2rM8hwAKyTopHqQmc6OSPDFRMEyUmEQrI-vLqBaZcciiaiu9jFQdLANnSxppBK6veM3u725jqhIgQRfnzQ4k2RHZpX9vs4rgrWoGcEdV2PbrwT8GjB6HA0A"
                catColor="primary-container"
              />
              <ProviderCard
                name="Lê Hoàng Nam"
                category="Vệ Sinh"
                rating="4.8"
                dist="3.5km"
                tags={["Giặt sofa", "Vệ sinh sâu"]}
                img="https://lh3.googleusercontent.com/aida-public/AB6AXuC3TXR-quYXbMUMn1OgK62bKa9XOsue3w7IoILHJnWOvtexy0HxACJmYmwUXPms7lDAe8wAWJfO1ekBe-UJzoM01HDmmhZ8ov2J7QGONPj_k_WlxmfETa_hKHPAW0L4PGoBMXql4ALm7FqmLEeuGiQIAVqIzg21YJWwu0yLbgLP2Ug5U1K8zLpkX7Hrca9rh1ZGYSF6LPrTZVCbfhSWi2-0QRRbekvm2Q8hMZJpb8d3lwti6yt2m3c3mTzDX8UWqhfz8WjmyvIi0TY"
                catColor="secondary-container"
              />
              <ProviderCard
                name="Phạm Quốc Bảo"
                category="Gia Dụng"
                rating="4.9"
                dist="2.1km"
                tags={["Sửa tủ lạnh", "Tivi"]}
                img="https://lh3.googleusercontent.com/aida-public/AB6AXuBqvS4-iI9luQEE3oOpRu63IEV22P2r-16ZFbg5WfJt604jzMT_mfxVCwfdGfn3_v10UjRR4GV4uzWzLxwVTwa7OCQ0n9OQnvUB1AN6EA27r5SSx9T1q6Mo3ATz05Qo3HOAPVbfwDzVCvwjJYJPR48P47qB1fTnLDitsHLzuB4BWj_5-q20e5irFEN8Ld-tPwPpq-OnUAzTxvITNjmwqbBp5NDHdFGGQ7wrE8dFtRyQtbz7beF9vuh9DDdzde0_MihNY3wtWTIdjTo"
                catColor="primary-container"
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 mt-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          <FeatureCard icon="map" title="Real-time Tracking" desc="Theo dõi thợ di chuyển đến nhà bạn trên bản đồ theo thời gian thực." color="primary" />
          <FeatureCard icon="verified_user" title="Verified Partners" desc="100% thợ được kiểm tra lý lịch và kỹ năng chuyên môn khắt khe." color="secondary" fill />
          <FeatureCard icon="payments" title="Secure Payment" desc="Thanh toán an toàn qua ứng dụng, minh bạch giá cả, không phụ phí." color="tertiary" />
          <FeatureCard icon="support_agent" title="24/7 Support" desc="Đội ngũ hỗ trợ luôn sẵn sàng giải quyết mọi vấn đề của bạn." color="primary" />
        </section>

        {/* Stats Section */}
        <section className="mt-xl bg-primary py-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-white text-center">
            <StatItem val="10,000+" label="Khách hàng tin dùng" />
            <StatItem val="2,000+" label="Thợ chuyên nghiệp" />
            <StatItem val="50,000+" label="Việc đã hoàn thành" />
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 mt-xl">
          <h2 className="font-headline-lg text-headline-lg text-on-surface text-center mb-lg">Đánh Giá Từ Khách Hàng</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <TestimonialCard
              quote="Dịch vụ tuyệt vời! Thợ đến đúng giờ, làm việc rất chuyên nghiệp và sạch sẽ. Tôi chắc chắn sẽ quay lại sử dụng lần sau."
              name="Chị Lan Anh"
              loc="Quận 7, TP.HCM"
              img="https://lh3.googleusercontent.com/aida-public/AB6AXuBDnylXUCQdfCtcqA2g1BI2goqPGcD2HdeB_amLWNYc-biLBAAPg76vmoGhjalU_MIaonKvndL1rwIpIxXaj_Q_XgSOMKI3x_nczEE3RHaK72BzULvAaTDHpjAjBIGfQHHz0nZUzt1FS5fVfIYZGzzMxaukSQwU74qgvItB1OOsoJxF6loeoNywd9f53r9hfixA9nz3tpo_A_DY81WZgOXhO0sXhJJQsMECfJHFF1zcSo41drkS5l_CIizQKjAK8WqkL4rqKHxF3a8"
              hasQuoteIcon
            />
            <TestimonialCard
              quote="App rất dễ dùng, tìm thợ điện nhanh bất ngờ. Giá cả cũng rất hợp lý, minh bạch ngay trên app nên rất yên tâm."
              name="Anh Minh Đức"
              loc="Quận Cầu Giấy, Hà Nội"
              img="https://lh3.googleusercontent.com/aida-public/AB6AXuDRLGm1ns0QjxhKD2PItyBxJBDXZAaaqgKGXSJ07gitrV3siXXIACarq07oFoh82B7LR0j6bD-5gelDXUO2V-WnSyk2AxCKGem9SYCi-oe9vdSQH_l83VPQYHDQCYwCRTa8CMLelC-fAHhtk8Htz6ONxMn_VoMwCHlg73DSMckFVnruGfKBv5vvafLI_9eCT2Vj1e7IiHF2DKzqNwDhzsLgTMO6G9gkNf0sx0sEvJJHkwmNAul3Lg3MsIFYwIIlS32Pzjo96pfBLdQ"
            />
            <TestimonialCard
              quote="Lần đầu tiên tôi thấy dịch vụ giúp việc nhà bài bản như thế này. Đội ngũ thợ rất lịch sự và tận tâm. Rất đáng 5 sao!"
              name="Chị Thu Thủy"
              loc="Quận Hải Châu, Đà Nẵng"
              img="https://lh3.googleusercontent.com/aida-public/AB6AXuDhJEEPf4lDAM3c9MGcf3CMoCrHup6SG7fxFTJbiGmc8nmtfhIyOcbIHfifnO9T7cZh68wc5v7oOsCZ3dV5ydDu6GJBMVNLkSqwxHk7w6ulM30yti4eYbSOjtJv79H09kwkIQ7gYWpa7gZnN8Q8D4HHwWZoxIDDvS-McsAFyBqbVJwVMyqd9Lgw8RTpFd2vuDN9WtsQGkCrj2dFfzNc5-Ed6HSoYjCqMKwpVmb4nbiil1u6L5FWOyTooGIMmdFH5K1Nk7_753GTMpg"
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest dark:bg-inverse-surface border-t border-outline-variant/50 mt-xl">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 px-4 md:px-8 py-16 max-w-7xl mx-auto">
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="FixNow Logo" className="h-8 w-auto object-contain" />
              <span className="font-headline-md text-headline-md font-bold text-primary">FixNow</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              © 2024 FixNow Inc. The Dependable Expert in Home Services. <br />
              Giải pháp công nghệ kết nối thợ chuyên nghiệp hàng đầu Việt Nam.
            </p>
            <div className="flex gap-4">
              <SocialLink icon="social_leaderboard" />
              <SocialLink icon="smart_display" />
              <SocialLink icon="language" />
            </div>
          </div>
          <FooterColumn title="Dịch Vụ" links={["Plumbing", "Electrical", "Cleaning", "HVAC"]} />
          <FooterColumn title="Công Ty" links={["About Us", "Careers", "Blog", "Press"]} />
          <FooterColumn title="Hỗ Trợ" links={["Help Center", "Terms of Service", "Privacy Policy", "Safety"]} />
          <div className="space-y-4">
            <h4 className="font-label-md text-label-md font-bold text-on-surface mb-4">Tải Ứng Dụng</h4>
            <div className="space-y-2">
              <AppBadge icon="play_arrow" store="Google Play" label="GET IT ON" />
              <AppBadge icon="ios" store="App Store" label="Download on the" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
