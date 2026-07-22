const checklist = [
  "Tư vấn phạm vi công việc",
  "Provider đã được xác minh",
  "Có thể theo dõi trạng thái đơn",
  "Thanh toán an toàn",
  "Hỗ trợ sau dịch vụ",
  "Minh bạch chi phí",
];

/** Cam kết dịch vụ đi kèm mỗi đơn hàng. */
export function ServiceChecklistSection() {
  return (
    <section className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
      <h2 className="mb-5 text-2xl font-bold">Danh mục công việc</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {checklist.map((item) => (
          <div key={item} className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-container/10 text-primary">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
            <span className="font-semibold">{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
