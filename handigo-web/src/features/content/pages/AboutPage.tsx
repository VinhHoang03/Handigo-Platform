import { Link } from "react-router-dom";
import { PublicContentLayout, SectionTitle } from "../components/PublicContentLayout";

const values = [
  ["favorite", "Tận tâm", "Phục vụ khách hàng bằng cả trái tim, luôn đặt lợi ích của khách hàng lên trên hết."],
  ["lightbulb", "Sáng tạo", "Không ngừng đổi mới công nghệ và quy trình để mang lại trải nghiệm tối ưu."],
  ["balance", "Công bằng", "Xây dựng hệ sinh thái minh bạch, đôi bên cùng có lợi cho đối tác và khách hàng."],
  ["verified_user", "Tin cậy", "Duy trì chất lượng dịch vụ đồng nhất và bảo vệ thông tin người dùng."],
];

const milestones = [
  ["2021", "Khởi nguồn ý tưởng", "Handigo ra đời với khát vọng giải quyết bài toán tìm thợ chất lượng cho gia đình đô thị."],
  ["2022", "Ra mắt ứng dụng", "Phiên bản đầu tiên chính thức hoạt động và phục vụ 10.000 người dùng trong ba tháng."],
  ["2023", "Mở rộng dịch vụ", "Phủ sóng tại ba thành phố lớn với hơn 50 nhóm dịch vụ tiện ích."],
  ["2026", "Dẫn đầu trải nghiệm", "Tiếp tục nâng cấp khả năng ghép nối thông minh, minh bạch và an toàn."],
];

const leaders = [
  ["Nguyễn Văn A", "Giám đốc điều hành (CEO)", "https://lh3.googleusercontent.com/aida-public/AB6AXuAHH6xzwCC474C8LI4Cmlf1j_Qqap3pbP1i4Rem02CV_cRbXs708Q7TpqwlX1zTrsC_xLgdKIFK_XsRa4CSnNpXXIhFArexF03d0a45c4xDI-ZDX5MhqpP4LCm9u1iU23-jJteL7XS6tXEzF3PdKIyJJPIkecfh_fBCVQMs7dz5baeHMTVg8Nq_SvQSsNuGuiI6fPOX--Zo17xzF_D_E-Wo6nq6fpR3F3ojbxq4XeR7h26JK_dkPWlNFExQf3fT0Nmfl1-SS-FA0ihO"],
  ["Trần Thị B", "Giám đốc công nghệ (CTO)", "https://lh3.googleusercontent.com/aida-public/AB6AXuBR7sPRUuVVaSbvLOWzenFIjZQ6NzEjUeWw8sUWvOqwF1mO7Xz2Jo4mSgQaZQ9Syv4kj6Icf0WGzlz0wIYn-65Rki6XwHp1iol7PAC3l3sN7hMJVsDRn6yGPMMNgixPjCBl7aYOa4F98YJFBAv8InkSTpyCWkPOxq1In9xzC1tdjVHn1jZxORlm8xQbmU-Q8hipBtZLCXZi2njPttbFGF0UH-_K8Vy-7_2OBRylF_zXacEeQLwf-XDmxMpBJgy9bPjCc2RFyPLhf0yb"],
  ["Lê Văn C", "Giám đốc vận hành (COO)", "https://lh3.googleusercontent.com/aida-public/AB6AXuBSxg83TKzxSB5lYUF9aP2vPfvWAlFL8zErajmBngzFJkECP4W5wAY5Az7K8DFZ1lRUaUXMO4hx03MZciJdXom4rMlg7wygivT9FDxPsqZDYX2mhfVzBai4xDBlNTTR5rWxHJdIxSVA_e0t-_KYL2XMhSOb1ttBjBEZcesNR3CBJwEXX7WJ5rPjJbUMDPTEm3PQn44d66ZgD8DJlSd-xyUrbeGSvIqiySs2Ct-_AkPSuEVnwDLEneKy9etdD-Nq8b-Mp72RAoGDfI6e"],
];

export default function AboutPage() {
  return (
    <PublicContentLayout>
      <section className="px-6 py-16 text-center sm:py-24">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-secondary">Về Handigo</p>
        <h1 className="mx-auto max-w-4xl font-headline-xl text-4xl font-bold leading-tight text-primary sm:text-5xl lg:text-6xl">Nâng tầm chất lượng cuộc sống Việt</h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-on-surface-variant">Chúng tôi kết nối dịch vụ gia đình thông minh, nhanh chóng và đáng tin cậy để bạn dành thời gian cho những điều quan trọng hơn.</p>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:py-20">
        <img className="h-[360px] w-full rounded-3xl object-cover shadow-lg" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAyc8jKcKqga8g-rHvM1gGbudktIZr19-Vi9BrgTfMZIcAn9xvKofK9jkeBbgPa9_UyKbtR37wyG2z1qRmQajv6obRLSau7aHROiI2oam9P1SckHrnZEM211GSdiQvyTbSUCE8qENuUzuqIeTPfc6Q_56YOfpyizTN1TBfSC3UGzEckX2MQqE4CSZNpcglTQ_Iwa1_q0AOnnSFQ31G3MJIXjxywqkl9mjCig0qb40xA2DE7_TmW6dSLCzmSX06ZDGvpP3HHriUZkmu3" alt="Chuyên gia Handigo gặp gỡ khách hàng" />
        <div>
          <h2 className="font-headline-lg text-3xl font-bold text-primary">Chúng tôi là ai?</h2>
          <p className="mt-5 leading-7 text-on-surface-variant">Handigo là nền tảng kết nối chuyên gia dịch vụ tận tâm với các gia đình hiện đại. Chúng tôi xây dựng một hệ sinh thái chăm sóc ngôi nhà toàn diện, nơi chất lượng, minh bạch và sự an tâm luôn được đặt lên hàng đầu.</p>
          <p className="mt-4 leading-7 text-on-surface-variant">Công nghệ giúp quy trình đặt lịch, theo dõi và đánh giá dịch vụ trở nên rõ ràng, đồng thời tạo thêm cơ hội phát triển bền vững cho nhà cung cấp.</p>
        </div>
      </section>

      <section className="bg-surface-container-low px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionTitle title="Giá trị cốt lõi" description="Những nguyên tắc định hướng mọi quyết định và trải nghiệm tại Handigo." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(([icon, title, text]) => <article key={title} className="rounded-3xl border border-outline-variant/30 bg-white p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className="material-symbols-outlined grid h-14 w-14 place-items-center rounded-2xl bg-primary-fixed text-3xl text-primary mx-auto">{icon}</span><h3 className="mt-5 text-xl font-bold text-primary">{title}</h3><p className="mt-3 text-sm leading-6 text-on-surface-variant">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <div className="grid gap-6 overflow-hidden rounded-3xl bg-primary px-8 py-12 text-center text-white shadow-xl sm:grid-cols-3">
          {[["50.000+", "Khách hàng tin dùng"], ["5.000+", "Đối tác chuyên nghiệp"], ["100+", "Loại dịch vụ đa dạng"]].map(([number, label]) => <div key={label}><p className="text-4xl font-bold text-primary-fixed">{number}</p><p className="mt-2 text-sm font-semibold uppercase tracking-wider text-white/80">{label}</p></div>)}
        </div>
      </section>

      <section className="bg-surface-container px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-5xl"><SectionTitle title="Đội ngũ lãnh đạo" /><div className="grid gap-10 sm:grid-cols-3">{leaders.map(([name, role, image]) => <article key={name} className="text-center"><img src={image} alt={name} className="mx-auto h-44 w-44 rounded-full object-cover shadow-lg"/><h3 className="mt-5 text-xl font-bold text-primary">{name}</h3><p className="mt-1 text-sm font-semibold uppercase tracking-wide text-secondary">{role}</p></article>)}</div></div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 lg:py-20">
        <SectionTitle title="Hành trình phát triển" />
        <div className="relative space-y-6 before:absolute before:bottom-3 before:left-5 before:top-3 before:w-px before:bg-outline-variant">
          {milestones.map(([year, title, text]) => <article key={year} className="relative flex gap-5"><span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{year.slice(2)}</span><div className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm"><p className="font-bold text-secondary">{year}</p><h3 className="mt-1 text-lg font-bold text-primary">{title}</h3><p className="mt-2 text-sm leading-6 text-on-surface-variant">{text}</p></div></article>)}
        </div>
        <div className="mt-12 text-center"><Link to="/customer/services" className="inline-flex rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg hover:bg-primary/90">Khám phá dịch vụ</Link></div>
      </section>
    </PublicContentLayout>
  );
}
