import { MaterialIcon } from '../common/MaterialIcon';

const heroImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNY5fqqLhhOZkLGN75N3T7PdMr4qQa0zILrxIUNZv5QYU47Id_ZxQnWSFHlBtHBFjg1mVZtjWT6ZmDjM6ctpGLZ91TCkSVzPRW1NcOevNUXU_5JX7VKvRjEBH8zYBTUDHRg4jhpKAMRsEEJ36AxEIXgq96DgSB4FfPWzdYw_lQeQ3g6a9y7XCFwKzTeZy1JB8m0xCGGlNqbXA9D5KgLxnnrh-4kBFVPUc0Cl9DCnxDAh9sHXz7ygV6dmoYuBrLwlc01AvLAIQxEXA';

const avatarImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuv1vh3JOEa-UPi_zgZHwazwz4LBJ2usS0bTI8n_Hs0ssKwi6xodp-Lks4bHX4RpFZhzGFowkNfkM55es-_4iuRB9Kip4Wr26O8Xp2Ebr58-I4NhsyZ-_dmHtigaXKG0QqSXCTc6-SZQSAllPB7x78G4OXXrX46RHj6_9Ze8ZnqQid2XC8sVY7qjPAaAOS_Pm_LMwAPUCm36N61viZ40O1TA11M6Hs5ZkS5fzVxeaGZ3_0QfGFLg7xfQ1jQeuqjNHtYs_-GQyxKrk';

const SearchInput = ({ icon, placeholder }: { icon: string; placeholder: string }) => (
  <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-surface-container-low dark:bg-on-surface-variant/5 rounded-xl">
    <MaterialIcon className="text-primary">{icon}</MaterialIcon>
    <input className="bg-transparent border-none focus:ring-0 w-full text-body-md font-body-md" placeholder={placeholder} type="text" />
  </div>
);

const HeroSearch = () => (
  <div className="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant shadow-lg rounded-2xl p-2 flex flex-col md:flex-row items-stretch gap-2">
    <SearchInput icon="search" placeholder="Tìm dịch vụ (sửa điện, nước...)" />
    <SearchInput icon="location_on" placeholder="Vị trí của bạn" />
    <button className="bg-primary hover:bg-primary-container text-white px-8 py-3 rounded-xl font-label-md text-label-md shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2">
      Tìm thợ ngay
    </button>
  </div>
);

const SocialProof = () => (
  <div className="flex items-center gap-4 md:gap-6 pt-4">
    <div className="flex -space-x-3">
      {[0, 1, 2].map((item) => (
        <img key={item} alt="Ảnh đại diện người dùng" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-surface" src={avatarImage} />
      ))}
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary-container text-on-primary-container text-[8px] md:text-[10px] flex items-center justify-center border-2 border-surface font-bold">+2k</div>
    </div>
    <p className="font-label-sm text-label-sm text-on-surface-variant">Hơn <span className="font-bold text-on-surface">50,000+</span> việc đã hoàn thành thành công</p>
  </div>
);

const HeroVisual = () => (
  <div className="relative">
    <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-primary/10 via-secondary-container/10 to-transparent blur-3xl rounded-full" />
    <img alt="Minh họa dịch vụ tại nhà" className="w-full h-auto drop-shadow-2xl floating-anim" src={heroImage} />
    <div className="absolute top-1/4 -left-4 md:-left-8 glass-card p-2 md:p-4 rounded-xl md:rounded-2xl shadow-xl flex items-center gap-2 md:gap-4 animate-bounce">
      <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
        <MaterialIcon filled>engineering</MaterialIcon>
      </div>
      <div>
        <p className="font-label-md text-label-md text-on-surface">Thợ đang đến</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">Chỉ còn 5 phút</p>
      </div>
    </div>
  </div>
);

export const HeroSection = () => (
  <section className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center overflow-hidden">
    <div className="space-y-8">
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container/20 text-on-secondary-container rounded-full border border-secondary-container/30">
        <MaterialIcon className="text-sm" filled>verified</MaterialIcon>
        <span className="text-label-sm font-label-sm">Dịch vụ tin cậy cho mọi ngôi nhà</span>
      </div>
      <h1 className="text-3xl md:text-5xl lg:text-headline-xl font-headline-xl text-on-surface tracking-tight leading-tight">
        Đặt Dịch Vụ Tại Nhà <br />
        <span className="text-primary">Nhanh Chóng &amp; Uy Tín</span>
      </h1>
      <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[500px]">
        Kết nối với hàng nghìn thợ chuyên nghiệp đã qua kiểm duyệt. Khắc phục sự cố ngôi nhà của bạn chỉ với vài cú chạm.
      </p>
      <HeroSearch />
      <SocialProof />
    </div>
    <HeroVisual />
  </section>
);
