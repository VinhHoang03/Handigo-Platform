import { useState } from "react";
import { Link } from "react-router-dom";
import { PublicContentLayout } from "../components/PublicContentLayout";
import { newsArticles, newsCategories } from "../data/content.data";

export default function NewsPage() {
  const [category, setCategory] = useState("Tất cả");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const visibleArticles = category === "Tất cả" ? newsArticles : newsArticles.filter((article) => article.category === category);

  return (
    <PublicContentLayout>
      <section className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
        <div className="grid overflow-hidden rounded-3xl bg-primary text-white shadow-xl lg:grid-cols-2">
          <div className="flex flex-col justify-center p-8 sm:p-12">
            <span className="w-fit rounded-full bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider">Nổi bật</span>
            <h1 className="mt-6 font-headline-xl text-3xl font-bold leading-tight sm:text-5xl">Cập nhật hệ thống Handigo v3.0: Trải nghiệm mượt mà hơn</h1>
            <p className="mt-5 leading-7 text-white/80">Theo dõi kỹ thuật viên theo thời gian thực, thanh toán một chạm và nhiều cải tiến mới dành cho bạn.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link to={`/tin-tuc/${newsArticles[0].id}`} className="rounded-xl bg-white px-5 py-3 font-semibold text-primary">Đọc chi tiết</Link><a href="#danh-sach" className="rounded-xl border border-white/40 px-5 py-3 font-semibold text-white hover:bg-white/10">Xem bài viết</a></div>
          </div>
          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNSD3sJjPDG33cX1UXkz312S6NixBf7UvcIm6ngsXMowwqApf2o1kPN1CFI86ohn5c-bZDiiMI82AFF5rtmVN5_oowL7FyiRKD7jC3PWBZSPgSxHn7MxEyHyoQlXZwBkS5l9ZvNJ3M_PKu5t--SFmhooK43aUWHCnuwVI_15nSvkOpMVqHt1t9wxrf9__zqrcduuwdKA9xrbamu6hMwXXcarsV6avCk_y3SaN32gPjUcGT2xRqXOPSybYQVOB-0eGns3Wx48Xz8mby" alt="Cập nhật ứng dụng Handigo" className="h-full min-h-72 w-full object-cover" />
        </div>
      </section>

      <section id="danh-sach" className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><p className="text-sm font-bold uppercase tracking-wider text-secondary">Góc Handigo</p><h2 className="mt-2 font-headline-lg text-3xl font-bold text-primary">Tin tức mới nhất</h2></div>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Lọc bài viết">{newsCategories.map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${category === item ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant hover:text-primary"}`}>{item}</button>)}</div>
        </div>
        {visibleArticles.length > 0 ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{visibleArticles.map((article) => <Link key={article.id} to={`/tin-tuc/${article.id}`} className="group overflow-hidden rounded-3xl border border-outline-variant/30 bg-white shadow-sm transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl"><div className="h-52 overflow-hidden"><img src={article.image} alt={article.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div><div className="p-6"><span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-primary">{article.category}</span><h3 className="mt-4 line-clamp-2 text-xl font-bold leading-7 text-on-surface group-hover:text-primary">{article.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-on-surface-variant">{article.excerpt}</p><div className="mt-5 flex items-center justify-between border-t border-outline-variant/20 pt-4 text-xs text-on-surface-variant"><span>{article.date}</span><span>{article.readTime}</span></div></div></Link>)}</div> : <div className="rounded-3xl bg-surface-container-low p-12 text-center text-on-surface-variant">Chưa có bài viết trong danh mục này.</div>}
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-surface-container p-8 text-center sm:p-12"><span className="material-symbols-outlined text-4xl text-primary">mail</span><h2 className="mt-3 text-3xl font-bold text-primary">Đăng ký nhận bản tin sớm nhất</h2><p className="mx-auto mt-3 max-w-2xl text-on-surface-variant">Nhận mẹo chăm sóc nhà cửa, ưu đãi và thông báo tính năng mới từ Handigo.</p>{subscribed ? <p className="mt-6 font-semibold text-secondary">Đăng ký nhận tin thành công.</p> : <form className="mx-auto mt-7 flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (email.trim()) setSubscribed(true); }}><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Địa chỉ email của bạn" className="min-h-12 flex-1 rounded-xl border border-outline-variant bg-white px-4"/><button className="rounded-xl bg-primary px-6 py-3 font-semibold text-white">Đăng ký ngay</button></form>}</div>
      </section>
    </PublicContentLayout>
  );
}
