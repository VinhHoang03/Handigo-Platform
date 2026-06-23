import { useMemo, useState, type FormEvent } from "react";
import { PublicContentLayout } from "../components/PublicContentLayout";

const supportCategories = [
  ["manage_accounts", "Tài khoản", "Bảo mật, thông tin cá nhân và cài đặt ứng dụng."],
  ["payments", "Thanh toán", "Hóa đơn, hoàn tiền và phương thức thanh toán."],
  ["home_repair_service", "Dịch vụ", "Chất lượng dịch vụ, lịch hẹn và phản hồi thợ."],
  ["bug_report", "Lỗi kỹ thuật", "Sự cố ứng dụng hoặc lỗi trong quá trình đặt lịch."],
];

const faqs = [
  ["Làm thế nào để thay đổi lịch hẹn?", "Mở chi tiết đơn dịch vụ và chọn thay đổi lịch nếu đơn chưa được nhà cung cấp bắt đầu."],
  ["Khi nào tôi nhận được tiền hoàn?", "Tiền hoàn được xử lý theo phương thức ban đầu, dự kiến từ 3 đến 7 ngày làm việc."],
  ["Tôi có thể liên hệ nhà cung cấp ở đâu?", "Mở cuộc trò chuyện từ biểu tượng tin nhắn sau khi đơn hàng được xác nhận."],
];

export default function SupportPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const filteredFaqs = useMemo(() => faqs.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(query.toLowerCase())), [query]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    event.currentTarget.reset();
  };

  return (
    <PublicContentLayout>
      <section className="bg-gradient-to-b from-primary-fixed to-background px-6 py-16 text-center sm:py-24">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-secondary">Trung tâm trợ giúp</p>
        <h1 className="mt-4 font-headline-xl text-4xl font-bold text-primary sm:text-5xl">Chúng tôi có thể giúp gì cho bạn?</h1>
        <div className="relative mx-auto mt-8 max-w-2xl"><span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-14 w-full rounded-full border border-outline-variant/40 bg-white py-4 pl-14 pr-5 shadow-lg" placeholder="Tìm kiếm câu hỏi thường gặp..." aria-label="Tìm kiếm hỗ trợ" /></div>
        {query && <div className="mx-auto mt-3 max-w-2xl overflow-hidden rounded-2xl border border-outline-variant/30 bg-white text-left shadow-lg">{filteredFaqs.length ? filteredFaqs.map(([question, answer]) => <div key={question} className="border-b border-outline-variant/20 p-4 last:border-0"><p className="font-semibold text-on-surface">{question}</p><p className="mt-1 text-sm text-on-surface-variant">{answer}</p></div>) : <p className="p-5 text-center text-on-surface-variant">Không tìm thấy câu trả lời phù hợp.</p>}</div>}
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14"><h2 className="mb-7 text-3xl font-bold text-primary">Danh mục hỗ trợ</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{supportCategories.map(([icon, title, text]) => <article key={title} className="rounded-3xl border border-outline-variant/30 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"><span className="material-symbols-outlined grid h-12 w-12 place-items-center rounded-xl bg-primary-fixed text-primary">{icon}</span><h3 className="mt-5 text-xl font-bold text-on-surface">{title}</h3><p className="mt-2 text-sm leading-6 text-on-surface-variant">{text}</p></article>)}</div></section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-outline-variant/30 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-3xl font-bold text-primary">Gửi yêu cầu hỗ trợ</h2><p className="mt-2 text-on-surface-variant">Nếu chưa tìm thấy câu trả lời, hãy gửi thông tin để chúng tôi hỗ trợ.</p>{submitted && <div role="status" className="mt-5 rounded-xl bg-secondary/10 px-4 py-3 font-medium text-secondary">Yêu cầu đã được ghi nhận. Bộ phận hỗ trợ sẽ sớm liên hệ với bạn.</div>}<form onSubmit={handleSubmit} className="mt-7 grid gap-5 sm:grid-cols-2"><label className="block text-sm font-semibold text-on-surface">Chủ đề<input required className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 font-normal" placeholder="Tóm tắt yêu cầu" /></label><label className="block text-sm font-semibold text-on-surface">Danh mục<select required className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 font-normal"><option value="">Chọn danh mục</option><option>Tài khoản</option><option>Thanh toán</option><option>Dịch vụ</option><option>Lỗi kỹ thuật</option></select></label><label className="block text-sm font-semibold text-on-surface sm:col-span-2">Mã đơn hàng (nếu có)<input className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 font-normal" placeholder="Ví dụ: #HG-12345" /></label><label className="block text-sm font-semibold text-on-surface sm:col-span-2">Mô tả chi tiết<textarea required rows={5} className="mt-2 w-full resize-y rounded-xl border border-outline-variant bg-surface-container-low p-4 font-normal" placeholder="Mô tả vấn đề bạn đang gặp phải" /></label><label className="block text-sm font-semibold text-on-surface sm:col-span-2">Đính kèm hình ảnh<input type="file" multiple accept="image/*" className="mt-2 block w-full rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm font-normal" /><span className="mt-2 block text-xs font-normal text-on-surface-variant">Tối đa 3 ảnh, mỗi ảnh nhỏ hơn 5 MB.</span></label><div className="sm:col-span-2"><button type="submit" className="rounded-xl bg-primary px-7 py-3 font-semibold text-white shadow-lg hover:bg-primary/90">Gửi yêu cầu</button></div></form></div>
        <aside className="space-y-6"><div className="rounded-3xl bg-surface-container p-6"><h2 className="text-xl font-bold text-primary">Yêu cầu của tôi</h2><div className="mt-5 space-y-4">{[["Hoàn tiền đơn hàng #HG-8821", "Đang xử lý"], ["Không thể thay đổi địa chỉ", "Đã phản hồi"], ["Vấn đề về đăng nhập", "Hoàn tất"]].map(([title, status]) => <div key={title} className="rounded-2xl bg-white p-4"><p className="font-semibold">{title}</p><p className="mt-2 text-xs font-bold text-secondary">{status}</p></div>)}</div></div><div className="rounded-3xl bg-primary p-6 text-white"><span className="material-symbols-outlined text-3xl">support_agent</span><h3 className="mt-3 text-xl font-bold">Hỗ trợ khẩn cấp?</h3><p className="mt-2 text-sm leading-6 text-white/75">Gọi cho chúng tôi nếu bạn gặp sự cố cần giải quyết tức thì.</p><a href="tel:19001234" className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-primary">1900 1234</a></div></aside>
      </section>
    </PublicContentLayout>
  );
}
