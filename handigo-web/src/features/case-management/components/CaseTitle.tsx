export function CaseTitle({ title }: { title: string }) {
  const noShowTitle = /^(Khách không có mặt)\s*-\s*(.+)$/.exec(title);
  if (!noShowTitle) return <>{title}</>;

  return (
    <>
      <span className="block whitespace-nowrap">{noShowTitle[1]}</span>
      <span className="mt-1 block whitespace-nowrap text-sm font-medium text-on-surface-variant">{noShowTitle[2]}</span>
    </>
  );
}
