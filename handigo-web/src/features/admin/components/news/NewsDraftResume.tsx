import { useState } from "react";
import { Link } from "react-router-dom";
import { FileEdit } from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { newsDraftKey, readNewsDraft } from "./newsDraft";

export function NewsDraftResume() {
  const user = useAuthStore(state => state.user);
  const userId = user?.id ?? user?._id;
  return userId ? <ResumeNotice key={userId} userId={userId} /> : null;
}

function ResumeNotice({ userId }: { userId: string }) {
  const [draft] = useState(() => {
    try { return readNewsDraft(localStorage, newsDraftKey(userId)); } catch { return null; }
  });
  if (!draft) return null;
  return <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
    <div className="flex items-center gap-3"><FileEdit size={22} className="shrink-0 text-primary" aria-hidden="true" /><div>
      <p className="font-semibold">Bạn có bài viết đang soạn dở</p>
      <p className="mt-1 text-sm text-on-surface-variant">{draft.form.title || "Bài viết chưa có tiêu đề"} · Lưu trên trình duyệt này</p>
    </div></div>
    <Link to="/admin/news/new" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-on-primary">Tiếp tục soạn</Link>
  </div>;
}
