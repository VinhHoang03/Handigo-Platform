import {
  PublicContentLayout,
  SectionTitle,
} from "../components/PublicContentLayout";

const values = [
  [
    "favorite",
    "Tận tâm",
    "Phục vụ khách hàng bằng cả trái tim, luôn đặt lợi ích của khách hàng lên trên hết.",
  ],
  [
    "lightbulb",
    "Sáng tạo",
    "Không ngừng đổi mới công nghệ và quy trình để mang lại trải nghiệm tối ưu.",
  ],
  [
    "balance",
    "Công bằng",
    "Xây dựng hệ sinh thái minh bạch, đôi bên cùng có lợi cho đối tác và khách hàng.",
  ],
  [
    "verified_user",
    "Tin cậy",
    "Duy trì chất lượng dịch vụ đồng nhất và bảo vệ thông tin người dùng.",
  ],
];

const milestones = [
  [
    "Tháng 5/2026",
    "Khởi tạo Handigo",
    "Hoàn thiện ý tưởng nền tảng, xác định quy trình kết nối khách hàng với provider dịch vụ tại nhà.",
  ],
  [
    "Tháng 6/2026",
    "Xây dựng hệ sinh thái",
    "Phát triển các luồng đặt dịch vụ, quản lý đơn, hồ sơ provider và vận hành dành cho quản trị viên.",
  ],
  [
    "Tháng 7/2026",
    "Hoàn thiện trải nghiệm",
    "Nâng cấp khả năng ghép nối, thanh toán, hỗ trợ và minh bạch thông tin trên toàn hệ thống.",
  ],
];

const leaders = [
  [
    "Nguyễn Văn A",
    "Giám đốc điều hành (CEO)",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAHH6xzwCC474C8LI4Cmlf1j_Qqap3pbP1i4Rem02CV_cRbXs708Q7TpqwlX1zTrsC_xLgdKIFK_XsRa4CSnNpXXIhFArexF03d0a45c4xDI-ZDX5MhqpP4LCm9u1iU23-jJteL7XS6tXEzF3PdKIyJJPIkecfh_fBCVQMs7dz5baeHMTVg8Nq_SvQSsNuGuiI6fPOX--Zo17xzF_D_E-Wo6nq6fpR3F3ojbxq4XeR7h26JK_dkPWlNFExQf3fT0Nmfl1-SS-FA0ihO",
  ],
  [
    "Trần Thị B",
    "Giám đốc công nghệ (CTO)",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBR7sPRUuVVaSbvLOWzenFIjZQ6NzEjUeWw8sUWvOqwF1mO7Xz2Jo4mSgQaZQ9Syv4kj6Icf0WGzlz0wIYn-65Rki6XwHp1iol7PAC3l3sN7hMJVsDRn6yGPMMNgixPjCBl7aYOa4F98YJFBAv8InkSTpyCWkPOxq1In9xzC1tdjVHn1jZxORlm8xQbmU-Q8hipBtZLCXZi2njPttbFGF0UH-_K8Vy-7_2OBRylF_zXacEeQLwf-XDmxMpBJgy9bPjCc2RFyPLhf0yb",
  ],
  [
    "Lê Văn C",
    "Giám đốc vận hành (COO)",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBSxg83TKzxSB5lYUF9aP2vPfvWAlFL8zErajmBngzFJkECP4W5wAY5Az7K8DFZ1lRUaUXMO4hx03MZciJdXom4rMlg7wygivT9FDxPsqZDYX2mhfVzBai4xDBlNTTR5rWxHJdIxSVA_e0t-_KYL2XMhSOb1ttBjBEZcesNR3CBJwEXX7WJ5rPjJbUMDPTEm3PQn44d66ZgD8DJlSd-xyUrbeGSvIqiySs2Ct-_AkPSuEVnwDLEneKy9etdD-Nq8b-Mp72RAoGDfI6e",
  ],
];

export default function AboutPage() {
  return (
    <PublicContentLayout>
      <section className="px-6 pb-8 pt-8 text-center sm:pb-10 sm:pt-10">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-secondary">
          Về Handigo
        </p>
        <h1 className="mx-auto max-w-6xl font-headline-xl text-4xl font-bold leading-tight text-primary sm:text-5xl lg:whitespace-nowrap xl:text-6xl">
          Nâng tầm chất lượng cuộc sống Việt
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-on-surface-variant">
          Chúng tôi kết nối dịch vụ gia đình thông minh, nhanh chóng và đáng tin
          cậy để bạn dành thời gian cho những điều quan trọng hơn.
        </p>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-6 px-6 pb-10 pt-4 lg:grid-cols-2 lg:gap-8 lg:pb-12 lg:pt-6">
        <img
          width="1200"
          height="720"
          className="h-auto w-full rounded-3xl object-contain shadow-lg"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAyc8jKcKqga8g-rHvM1gGbudktIZr19-Vi9BrgTfMZIcAn9xvKofK9jkeBbgPa9_UyKbtR37wyG2z1qRmQajv6obRLSau7aHROiI2oam9P1SckHrnZEM211GSdiQvyTbSUCE8qENuUzuqIeTPfc6Q_56YOfpyizTN1TBfSC3UGzEckX2MQqE4CSZNpcglTQ_Iwa1_q0AOnnSFQ31G3MJIXjxywqkl9mjCig0qb40xA2DE7_TmW6dSLCzmSX06ZDGvpP3HHriUZkmu3"
          alt="Chuyên gia Handigo gặp gỡ khách hàng"
        />
        <div>
          <h2 className="font-headline-lg text-3xl font-bold text-primary">
            Chúng tôi là ai?
          </h2>
          <p className="mt-5 leading-7 text-on-surface-variant">
            Handigo là nền tảng kết nối khách hàng với các chuyên gia dịch vụ uy
            tín, giúp việc tìm kiếm và đặt lịch các dịch vụ gia đình trở nên
            nhanh chóng, minh bạch và thuận tiện hơn. Chúng tôi hướng đến việc
            xây dựng một hệ sinh thái nơi khách hàng dễ dàng tiếp cận những nhà
            cung cấp chất lượng, đồng thời tạo môi trường phát triển bền vững
            cho cộng đồng Provider.
          </p>
          <p className="mt-4 leading-7 text-on-surface-variant">
            Công nghệ giúp quy trình đặt lịch, theo dõi và đánh giá dịch vụ trở
            nên rõ ràng, đồng thời tạo thêm cơ hội phát triển bền vững cho nhà
            cung cấp.
          </p>
          <p className="mt-4 leading-7 text-on-surface-variant">
            Không chỉ là một ứng dụng đặt dịch vụ, Handigo còn không ngừng ứng
            dụng công nghệ để nâng cao trải nghiệm người dùng. Từ gợi ý dịch vụ
            phù hợp, hỗ trợ chăm sóc khách hàng đến tối ưu quy trình làm việc
            cho Provider, chúng tôi mong muốn mang đến một trải nghiệm hiện đại,
            tiện lợi và hiệu quả cho cả hai bên.
          </p>
          <p className="mt-4 leading-7 text-on-surface-variant">
            Chúng tôi tin rằng sự minh bạch, chất lượng và uy tín là nền tảng để
            xây dựng niềm tin lâu dài. Handigo luôn đồng hành cùng khách hàng
            trong việc chăm sóc ngôi nhà và hỗ trợ các Provider phát triển sự
            nghiệp, góp phần tạo nên một cộng đồng dịch vụ chuyên nghiệp, đáng
            tin cậy và bền vững. Tôi thích phản hồi này hơn
          </p>
        </div>
      </section>

      <section className="bg-surface-container-low px-6 py-12 lg:py-14">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            title="Giá trị cốt lõi"
            description="Những nguyên tắc định hướng mọi quyết định và trải nghiệm tại Handigo."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(([icon, title, text]) => (
              <article
                key={title}
                className="rounded-3xl border border-outline-variant/30 bg-white p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-fixed text-primary">
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined block text-[28px] leading-none"
                  >
                    {icon}
                  </span>
                </span>
                <h3 className="mt-5 text-xl font-bold text-primary">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:py-14">
        <div className="grid gap-5 overflow-hidden rounded-3xl bg-primary px-8 py-10 text-center text-white shadow-xl sm:grid-cols-3">
          {[
            ["50.000+", "Khách hàng tin dùng"],
            ["5.000+", "Đối tác chuyên nghiệp"],
            ["100+", "Loại dịch vụ đa dạng"],
          ].map(([number, label]) => (
            <div key={label}>
              <p className="text-4xl font-bold text-primary-fixed">{number}</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-white/80">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-container px-6 py-12 lg:py-14">
        <div className="mx-auto max-w-5xl">
          <SectionTitle title="Đội ngũ lãnh đạo" />
          <div className="grid gap-8 sm:grid-cols-3">
            {leaders.map(([name, role, image]) => (
              <article key={name} className="text-center">
                <img
                  src={image}
                  alt={name}
                  width="176"
                  height="176"
                  loading="lazy"
                  className="mx-auto h-44 w-44 rounded-full object-cover shadow-lg"
                />
                <h3 className="mt-4 text-xl font-bold text-primary">{name}</h3>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-secondary">
                  {role}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12 lg:py-14">
        <SectionTitle title="Hành trình phát triển" />
        <div className="relative space-y-4 before:absolute before:bottom-3 before:left-5 before:top-3 before:w-px before:bg-outline-variant">
          {milestones.map(([period, title, text], index) => (
            <article key={period} className="relative flex gap-5">
              <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold leading-none text-white">
                T{index + 5}
              </span>
              <div className="min-w-0 flex-1 rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm">
                <p className="font-bold text-secondary">{period}</p>
                <h3 className="mt-1 text-lg font-bold text-primary">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  {text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicContentLayout>
  );
}
