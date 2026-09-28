import { useCallback, useEffect, useRef, useState } from "react";
import { Gift, History, Info, LoaderCircle, Sparkles, Ticket, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/Toast";
import { getErrorMessage } from "@/utils/apiError";
import { rewardsApi, type RewardEntry, type RewardOffer, type RewardOverview, type RewardPage, type RewardVoucher } from "../api/rewards.api";
import { RewardVoucherCard } from "../components/RewardVoucherCard";
import { rewardNumber, rewardMoney, rewardDate } from "../rewardFormat";

const panel = "rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
const fetchRewardData = () => Promise.all([rewardsApi.overview(), rewardsApi.vouchers(), rewardsApi.history()]);

export default function CustomerRewardsPage() {
  const { addToast } = useToast();
  const [overview, setOverview] = useState<RewardOverview | null>(null);
  const [vouchers, setVouchers] = useState<RewardPage<RewardVoucher> | null>(null);
  const [history, setHistory] = useState<RewardPage<RewardEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [selected, setSelected] = useState<RewardOffer | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [paging, setPaging] = useState(false);
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const pending = useRef<{ offerId: string; requestId: string } | null>(null);
  const submitting = useRef(false);
  const load = useCallback(async () => {
    try {
      const [summary, mine, entries] = await fetchRewardData();
      setOverview(summary); setVouchers(mine); setHistory(entries);
      setError("");
    } catch (failure) { setError(getErrorMessage(failure, "Chưa tải được điểm thưởng. Vui lòng thử lại.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    fetchRewardData().then(([summary, mine, entries]) => {
      if (!active) return;
      setOverview(summary); setVouchers(mine); setHistory(entries);
    }).catch((failure: unknown) => {
      if (active) setError(getErrorMessage(failure, "Chưa tải được điểm thưởng. Vui lòng thử lại."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const redeem = async () => {
    if (!selected || submitting.current) return;
    submitting.current = true; setRedeeming(true); setRedeemError("");
    pending.current ??= { offerId: selected.id, requestId: crypto.randomUUID() };
    try {
      await rewardsApi.redeem(pending.current.offerId, pending.current.requestId);
      pending.current = null; setSelected(null);
      addToast("Đổi mã thành công! Mã đã được thêm vào ưu đãi của bạn.", "success");
      await load();
    } catch (failure) { setRedeemError(getErrorMessage(failure, "Chưa xác định được kết quả. Hãy thử lại cùng yêu cầu này.")); }
    finally { submitting.current = false; setRedeeming(false); }
  };
  const changePage = async (section: "vouchers" | "history", page: number) => {
    setPaging(true);
    try {
      if (section === "vouchers") setVouchers(await rewardsApi.vouchers(page));
      else setHistory(await rewardsApi.history(page));
    } catch (failure) { addToast(getErrorMessage(failure, "Chưa tải được trang. Vui lòng thử lại."), "error"); }
    finally { setPaging(false); }
  };
  const pagination = (section: "vouchers" | "history", data: RewardPage<unknown> | null) => data && data.totalPages > 1 && (
    <div className="mt-5 flex items-center justify-end gap-3">
      <button type="button" className={`${button} bg-surface-container-low`} disabled={paging || data.page <= 1} onClick={() => void changePage(section, data.page - 1)}>Trước</button>
      <span className="text-[13px] text-on-surface-variant">{data.page} / {data.totalPages}</span>
      <button type="button" className={`${button} bg-surface-container-low`} disabled={paging || data.page >= data.totalPages} onClick={() => void changePage(section, data.page + 1)}>Sau</button>
    </div>
  );
  const nextOffer = overview?.policy.offers.find((offer) => offer.points > overview.balance);
  const offers = overview?.policy.offers.filter((offer) => !onlyAffordable || offer.points <= overview.balance) ?? [];

  return (
    <DashboardShell role="CUSTOMER" hideSidebar>
      <div className="mx-auto max-w-7xl space-y-8 pb-10 text-[13px]">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Sparkles aria-hidden="true" size={16} />Ưu đãi dành riêng cho bạn</p>
            <h1 className="font-headline-lg text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Mã giảm giá & điểm thưởng</h1>
            <p className="mt-3 text-[13px] leading-6 text-on-surface-variant">Mỗi lần chăm sóc ngôi nhà, thêm một cơ hội tiết kiệm. Tích điểm từ đơn hoàn thành và đổi ưu đãi cho lần đặt tiếp theo.</p>
          </div>
          <button type="button" onClick={() => setRulesOpen(true)} className={`${button} bg-primary-fixed text-on-primary-fixed-variant hover:bg-primary-fixed-dim`}><Info aria-hidden="true" size={18} />Cách tích điểm</button>
        </header>

        {loading ? <div role="status" className={`${panel} flex min-h-64 items-center justify-center gap-3 text-on-surface-variant`}><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />Đang tải ưu đãi…</div> : error ? (
          <div role="alert" className={panel}><p className="text-error">{error}</p><button type="button" onClick={() => { setLoading(true); void load(); }} className={`${button} mt-4 bg-primary text-on-primary`}>Thử lại</button></div>
        ) : overview && <>
          <section aria-label="Điểm thưởng của bạn" className={`${panel} grid gap-8 sm:p-8 lg:grid-cols-2 lg:p-10`}>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-warning-container px-3 py-1.5 text-xs font-semibold text-on-warning-container"><Gift aria-hidden="true" size={15} />Điểm thưởng Handigo</span>
              <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Điểm khả dụng</p>
              <p className="mt-2 flex items-baseline gap-3"><span className="text-4xl font-bold tabular-nums tracking-tight text-primary sm:text-5xl">{rewardNumber(overview.balance)}</span><span className="text-on-surface-variant">điểm</span></p>
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-on-surface-variant"><p>Đã tích <strong className="text-on-surface">{rewardNumber(overview.totalEarned)}</strong> điểm</p><p>Đã đổi <strong className="text-on-surface">{rewardNumber(overview.totalRedeemed)}</strong> điểm</p></div>
            </div>
            <div className="flex flex-col justify-center rounded-2xl bg-surface-container-low p-6">
              <h2 className="text-base font-semibold text-on-surface">{nextOffer ? "Ưu đãi tiếp theo đang chờ bạn" : "Sẵn sàng đổi ưu đãi"}</h2>
              <p className="mt-2 text-[13px] leading-6 text-on-surface-variant">{nextOffer ? `Tích thêm ${rewardNumber(nextOffer.points - overview.balance)} điểm để đổi mã ${nextOffer.name.toLowerCase()}.` : "Chọn một mã bên dưới để dùng điểm cho lần đặt dịch vụ tiếp theo."}</p>
              {nextOffer && <><progress aria-label={`Tiến độ đổi mã ${nextOffer.name}`} className="mt-5 h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-outline-variant/40 [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" value={overview.balance} max={nextOffer.points} /><p className="mt-2 text-right text-xs text-on-surface-variant">{rewardNumber(overview.balance)} / {rewardNumber(nextOffer.points)} điểm</p></>}
              <a href="#reward-catalog" className="mt-5 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Khám phá ưu đãi<ArrowRight aria-hidden="true" size={16} /></a>
            </div>
          </section>

          <section aria-labelledby="my-vouchers-heading">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 id="my-vouchers-heading" className="text-lg font-bold text-on-surface">Mã giảm giá của tôi</h2><p className="mt-1 text-[13px] text-on-surface-variant">Mã đã đổi bằng điểm. Sao chép mã và áp dụng khi đặt dịch vụ.</p></div><span className="rounded-full bg-surface-container px-3 py-1 text-[13px] text-on-surface-variant">{vouchers?.total ?? 0} mã</span></div>
            {vouchers?.items.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{vouchers.items.map((voucher) => <RewardVoucherCard key={voucher._id} voucher={voucher} />)}</div> : <div className={`${panel} text-center`}><Ticket aria-hidden="true" size={32} className="mx-auto mb-3 text-primary" /><h3 className="font-semibold">Bạn chưa có mã giảm giá</h3><p className="mt-2 text-[13px] text-on-surface-variant">Tích điểm từ đơn hoàn thành và chọn ưu đãi bên dưới để đổi mã đầu tiên.</p></div>}
            {pagination("vouchers", vouchers)}
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
            <section id="reward-catalog" aria-labelledby="reward-catalog-heading" className="scroll-mt-28">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 id="reward-catalog-heading" className="text-lg font-bold text-on-surface">Đổi điểm lấy ưu đãi</h2><label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-on-surface-variant"><input type="checkbox" checked={onlyAffordable} onChange={(event) => setOnlyAffordable(event.target.checked)} className="accent-primary" />Đủ điểm để đổi</label></div>
              <div className="grid gap-5 sm:grid-cols-2">
                {offers.map((offer) => <article key={offer.id} className={`${panel} flex flex-col`}>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-fixed text-primary"><Ticket aria-hidden="true" size={26} /></div>
                  <h3 className="text-xl font-bold text-on-surface">{offer.name}</h3><p className="mt-2 text-[13px] leading-6 text-on-surface-variant">Đơn giá cố định từ {rewardMoney(offer.minOrderAmount)}. Hiệu lực {overview.policy.validityDays} ngày từ khi đổi.</p>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-outline-variant pt-4"><span className="font-bold text-primary">{rewardNumber(offer.points)} điểm</span><button type="button" disabled={overview.balance < offer.points} onClick={() => { setSelected(offer); setRedeemError(""); if (pending.current?.offerId !== offer.id) pending.current = null; }} className={`${button} bg-primary text-on-primary hover:bg-primary-hover`}>{overview.balance < offer.points ? "Chưa đủ điểm" : "Đổi ngay"}</button></div>
                </article>)}
              </div>
              {!offers.length && <p className={`${panel} text-[13px] text-on-surface-variant`}>Chưa có ưu đãi phù hợp với số điểm hiện tại. Bỏ chọn bộ lọc để xem tất cả.</p>}
            </section>
            <aside className="space-y-5">
              <section aria-labelledby="reward-history-heading" className={panel}>
                <h2 id="reward-history-heading" className="flex items-center gap-2 text-base font-semibold"><History aria-hidden="true" size={20} className="text-primary" />Lịch sử tích / đổi điểm</h2>
                {history?.items.length ? <ul className="mt-4 divide-y divide-outline-variant/40">{history.items.map((entry) => <li key={entry._id} className="flex items-start justify-between gap-3 py-4"><div className="min-w-0"><p className="text-[13px] font-medium leading-6">{entry.description}</p><p className="mt-1 text-xs text-on-surface-variant">{rewardDate(entry.createdAt)} · Số dư {rewardNumber(entry.balanceAfter)} điểm</p></div><span className={`shrink-0 text-[13px] font-bold ${entry.points > 0 ? "text-success" : "text-tertiary"}`}>{entry.points > 0 ? "+" : ""}{rewardNumber(entry.points)}</span></li>)}</ul> : <p className="mt-4 text-[13px] leading-6 text-on-surface-variant">Chưa có giao dịch điểm. Điểm sẽ xuất hiện khi đơn đủ điều kiện hoàn thành.</p>}
                {pagination("history", history)}
              </section>
              <div className="rounded-2xl bg-primary p-6 text-on-primary"><h2 className="text-base font-semibold">Chăm nhà hôm nay, tiết kiệm lần sau</h2><p className="mt-3 text-[13px] leading-6">Mỗi {rewardMoney(overview.policy.amountPerPoint)} thanh toán đủ điều kiện được tích 1 điểm. Điểm được tính sau giảm giá.</p><Link to="/customer/services" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-on-primary px-4 py-2 text-[13px] font-semibold text-primary hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary">Tìm dịch vụ<ArrowRight aria-hidden="true" size={16} /></Link></div>
              <Link to="/customer/support" className="block text-[13px] font-medium text-primary underline underline-offset-4">Cần hỗ trợ về điểm thưởng?</Link>
            </aside>
          </div>
        </>}
      </div>
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Cách tích và đổi điểm" size="sm">
        <ul className="list-disc space-y-3 pl-5 text-[13px] leading-6 text-on-surface-variant"><li>Điểm được cộng một lần khi đơn giá cố định hoàn thành và đã thanh toán đủ. Tiền mặt được tính sau khi hệ thống xác nhận thanh toán.</li><li>Mỗi {overview ? rewardMoney(overview.policy.amountPerPoint) : "mức chi tiêu theo chính sách"} sau giảm giá được 1 điểm; làm tròn xuống theo từng đơn.</li><li>Không tích điểm hồi tố đơn cũ, đơn hủy, đơn khảo sát hoặc khoản thanh toán ngoài nền tảng.</li><li>Mã đổi điểm chỉ dùng cho tài khoản sở hữu, một lần trên đơn giá cố định đạt giá trị tối thiểu. Hạn dùng {overview?.policy.validityDays ?? 30} ngày từ khi đổi.</li><li>Điểm đã đổi không được hoàn lại khi mã hết hạn hoặc không sử dụng. Điểm không quy đổi thành tiền mặt.</li></ul>
      </Modal>
      <Modal open={Boolean(selected)} onClose={() => { if (!redeeming) setSelected(null); }} title="Xác nhận đổi mã giảm giá" size="sm" closeOnEsc={!redeeming} closeOnOverlayClick={!redeeming}>
        {selected && <><p className="text-[13px] leading-7">Dùng <strong>{rewardNumber(selected.points)} điểm</strong> để nhận mã <strong>{selected.name.toLowerCase()}</strong> cho đơn từ {rewardMoney(selected.minOrderAmount)}.</p><p className="mt-3 text-[13px] text-on-surface-variant">Mã có hạn {overview?.policy.validityDays} ngày. Điểm đã đổi không được hoàn lại.</p>{redeemError && <p role="alert" className="mt-4 text-[13px] text-error">{redeemError}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" disabled={redeeming} onClick={() => setSelected(null)} className={`${button} bg-surface-container-low`}>Để sau</button><button type="button" disabled={redeeming} onClick={() => void redeem()} className={`${button} bg-primary text-on-primary hover:bg-primary-hover`}>{redeeming ? "Đang đổi…" : redeemError ? "Thử lại yêu cầu" : "Xác nhận đổi"}</button></div></>}
      </Modal>
    </DashboardShell>
  );
}
