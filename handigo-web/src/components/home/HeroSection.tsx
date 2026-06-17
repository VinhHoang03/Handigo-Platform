import { MaterialIcon } from '../common/MaterialIcon';

const heroImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNY5fqqLhhOZkLGN75N3T7PdMr4qQa0zILrxIUNZv5QYU47Id_ZxQnWSFHlBtHBFjg1mVZtjWT6ZmDjM6ctpGLZ91TCkSVzPRW1NcOevNUXU_5JX7VKvRjEBH8zYBTUDHRg4jhpKAMRsEEJ36AxEIXgq96DgSB4FfPWzdYw_lQeQ3g6a9y7XCFwKzTeZy1JB8m0xCGGlNqbXA9D5KgLxnnrh-4kBFVPUc0Cl9DCnxDAh9sHXz7ygV6dmoYuBrLwlc01AvLAIQxEXA';

const avatarImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuv1vh3JOEa-UPi_zgZHwazwz4LBJ2usS0bTI8n_Hs0ssKwi6xodp-Lks4bHX4RpFZhzGFowkNfkM55es-_4iuRB9Kip4Wr26O8Xp2Ebr58-I4NhsyZ-_dmHtigaXKG0QqSXCTc6-SZQSAllPB7x78G4OXXrX46RHj6_9Ze8ZnqQid2XC8sVY7qjPAaAOS_Pm_LMwAPUCm36N61viZ40O1TA11M6Hs5ZkS5fzVxeaGZ3_0QfGFLg7xfQ1jQeuqjNHtYs_-GQyxKrk';

const SearchInput = ({ icon, placeholder }: { icon: string; placeholder: string }) => (
  <div className="flex flex-1 items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3">
    <MaterialIcon className="text-primary">{icon}</MaterialIcon>
    <input
      className="w-full border-none bg-transparent font-body-md text-body-md outline-none focus:ring-0"
      placeholder={placeholder}
      type="text"
    />
  </div>
);

const HeroSearch = () => (
  <div className="flex flex-col items-stretch gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-2 shadow-lg md:flex-row">
    <SearchInput icon="search" placeholder="Tìm dịch vụ (sửa điện, nước...)" />
    <SearchInput icon="location_on" placeholder="Vị trí của bạn" />
    <button className="flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 font-label-md text-label-md text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-container">
      Tìm thợ ngay
    </button>
  </div>
);

const SocialProof = () => (
  <div className="flex items-center gap-4 pt-4 md:gap-6">
    <div className="flex -space-x-3">
      {[0, 1, 2].map((item) => (
        <img
          key={item}
          alt="Ảnh đại diện người dùng"
          className="h-8 w-8 rounded-full border-2 border-surface md:h-10 md:w-10"
          src={avatarImage}
        />
      ))}
      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-primary-container text-[8px] font-bold text-on-primary-container md:h-10 md:w-10 md:text-[10px]">
        +2k
      </div>
    </div>
    <p className="font-label-sm text-label-sm text-on-surface-variant">
      Hơn <span className="font-bold text-on-surface">50,000+</span> việc đã hoàn thành thành công
    </p>
  </div>
);

const HeroVisual = () => (
  <div className="relative py-5">
    <div className="absolute left-1/2 top-1/2 -z-10 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-primary/10 via-secondary-container/10 to-transparent blur-3xl" />
    <div className="aspect-[16/10] w-full">
      <img alt="Minh họa dịch vụ tại nhà" className="h-full w-full object-contain drop-shadow-2xl floating-anim" src={heroImage} />
    </div>
    <div className="glass-card absolute -left-4 top-1/4 flex animate-bounce items-center gap-2 rounded-xl p-2 shadow-xl md:-left-8 md:gap-4 md:rounded-2xl md:p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary md:h-12 md:w-12">
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
  <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 md:px-8 lg:grid-cols-2">
    <div className="space-y-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-secondary-container/30 bg-secondary-container/20 px-3 py-1 text-on-secondary-container">
        <MaterialIcon className="text-sm" filled>verified</MaterialIcon>
        <span className="text-label-sm font-label-sm">Dịch vụ tin cậy cho mọi ngôi nhà</span>
      </div>
      <h1 className="font-headline-xl text-3xl leading-tight tracking-tight text-on-surface md:text-5xl lg:text-headline-xl">
        Đặt dịch vụ tại nhà <br />
        <span className="text-primary">nhanh chóng &amp; uy tín</span>
      </h1>
      <p className="max-w-[500px] font-body-lg text-body-lg text-on-surface-variant">
        Kết nối với hàng nghìn thợ chuyên nghiệp đã qua kiểm duyệt. Khắc phục sự cố ngôi nhà của bạn chỉ với vài cú chạm.
      </p>
      <HeroSearch />
      <SocialProof />
    </div>
    <HeroVisual />
  </section>
);
