import { Link, useParams } from "react-router-dom";
import { PublicContentLayout } from "../components/PublicContentLayout";
import { newsArticles } from "../data/content.data";

export default function NewsDetailPage() {
  const { articleId } = useParams();
  const article = newsArticles.find((item) => item.id === articleId) ?? newsArticles[0];
  const related = newsArticles.filter((item) => item.id !== article.id).slice(0, 3);

  return (
    <PublicContentLayout>
      <article className="mx-auto max-w-4xl px-6 py-10 lg:py-16">
        <Link to="/tin-tuc" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3"><span className="material-symbols-outlined text-lg">arrow_back</span>Quay lại Tin tức</Link>
        <div className="mt-8 text-center"><span className="rounded-full bg-primary-fixed px-4 py-2 text-xs font-bold text-primary">{article.category}</span><h1 className="mt-6 font-headline-xl text-4xl font-bold leading-tight text-on-surface sm:text-5xl">{article.title}</h1><div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-on-surface-variant"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-white">HT</span><span className="font-semibold text-on-surface">Nguyễn Minh Tuấn</span><span>•</span><span>{article.date}</span><span>•</span><span>{article.readTime}</span></div></div>
        <img src={article.image} alt={article.title} className="mt-10 h-[280px] w-full rounded-3xl object-cover shadow-lg sm:h-[460px]" />
        <div className="prose-none mx-auto mt-10 max-w-3xl space-y-6 text-base leading-8 text-on-surface-variant">
          <p className="text-xl font-medium leading-8 text-on-surface">Việc bảo dưỡng điều hòa định kỳ không chỉ kéo dài tuổi thọ thiết bị mà còn tiết kiệm đáng kể chi phí điện năng hàng tháng. Dưới đây là những bước đơn giản bạn có thể thực hiện tại nhà.</p>
          <p>Điều hòa là thiết bị quen thuộc trong gia đình hiện đại. Tuy nhiên, bụi bẩn tích tụ lâu ngày có thể khiến máy chạy yếu, tiêu tốn nhiều điện năng và tạo mùi khó chịu.</p>
          <h2 className="pt-4 text-3xl font-bold text-primary">Tại sao cần vệ sinh điều hòa thường xuyên?</h2>
          <p>Màng lọc bên trong dàn lạnh sẽ bám bụi sau một thời gian sử dụng. Điều này cản trở luồng gió và tạo điều kiện cho vi khuẩn, nấm mốc phát triển, ảnh hưởng trực tiếp đến sức khỏe hô hấp.</p>
          <h2 className="pt-4 text-3xl font-bold text-primary">Các bước bảo dưỡng đơn giản tại nhà</h2>
          <p>Trước khi bắt đầu, hãy ngắt hoàn toàn nguồn điện. Tháo mặt nạ và lưới lọc bụi, rửa sạch dưới vòi nước rồi để khô tự nhiên. Với dàn nóng, cần loại bỏ lá cây và vật cản xung quanh để bảo đảm khả năng thoát nhiệt.</p>
          <div className="rounded-2xl border-l-4 border-secondary bg-surface-container-low p-6"><h3 className="font-bold text-on-surface">Lưu ý quan trọng</h3><p className="mt-2">Không tự tháo linh kiện điện hoặc xử lý gas lạnh nếu không có dụng cụ chuyên dụng. Hãy gọi kỹ thuật viên khi máy phát tiếng động bất thường, chảy nước hoặc không làm lạnh.</p></div>
          <h2 className="pt-4 text-3xl font-bold text-primary">Khi nào cần gọi thợ chuyên nghiệp?</h2>
          <p>Khoảng sáu tháng một lần, điều hòa nên được bảo dưỡng chuyên sâu gồm kiểm tra gas, vệ sinh dàn đồng bằng bơm áp lực và kiểm tra các kết nối điện.</p>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-5 rounded-3xl bg-primary p-8 text-center text-white sm:flex-row sm:text-left"><div><h3 className="text-2xl font-bold">Bạn cần bảo trì điều hòa?</h3><p className="mt-2 text-white/75">Đội ngũ Handigo sẵn sàng hỗ trợ nhanh chóng.</p></div><Link to="/customer/services" className="shrink-0 rounded-xl bg-white px-6 py-3 font-semibold text-primary">Đặt dịch vụ ngay</Link></div>
      </article>
      <section className="bg-surface-container-low px-6 py-14"><div className="mx-auto max-w-7xl"><div className="mb-7 flex items-center justify-between"><h2 className="text-3xl font-bold text-primary">Bài viết liên quan</h2><Link to="/tin-tuc" className="text-sm font-semibold text-primary">Xem tất cả</Link></div><div className="grid gap-5 md:grid-cols-3">{related.map((item) => <Link key={item.id} to={`/tin-tuc/${item.id}`} className="group overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-lg"><img src={item.image} alt={item.title} className="h-40 w-full object-cover transition group-hover:scale-105"/><h3 className="p-5 font-bold leading-6 group-hover:text-primary">{item.title}</h3></Link>)}</div></div></section>
    </PublicContentLayout>
  );
}
