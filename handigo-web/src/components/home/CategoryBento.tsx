import { Link } from "react-router-dom";
import { CategoryIcon } from "../common/CategoryIcon";
import { ReliableImage } from "../common/ReliableImage";
import type { CategoryShowcaseItem } from "@/features/home/hooks/useCategoryShowcase";

/**
 * Ô lớn: ảnh dịch vụ thật phủ kín, chữ nằm trên dải tối ở đáy.
 * Chỉ hai ô đầu được cỡ lớn nên lưới có nhịp, không phải hàng thẻ đều nhau.
 */
const FeatureTile = ({ item }: { item: CategoryShowcaseItem }) => (
  <Link
    to={`/customer/services?categoryId=${item.id}`}
    className="group relative col-span-2 row-span-2 overflow-hidden rounded-3xl bg-surface-container transition-shadow duration-300 hover:shadow-[0_20px_50px_-20px_rgba(19,27,46,0.35)]"
  >
    <ReliableImage
      src={item.image}
      alt=""
      className="h-full min-h-56 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
    />
    {/* Lớp phủ đáy ô. Chân dải để đặc hoàn toàn thay vì mờ 85%: đo pixel cho
        thấy điểm sáng của ảnh lọt qua lớp mờ chỉ còn tỉ lệ tương phản 4.06 với
        chữ trắng 18px, hụt ngưỡng AA. Đặc ở chân thì nền dưới chữ không còn phụ
        thuộc vào việc ảnh nào rơi vào ô nào. */}
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-on-surface via-on-surface/75 to-transparent p-6 pt-20">
      <h3 className="font-headline-md text-lg font-semibold text-surface">
        {item.name}
      </h3>
      <p className="mt-0.5 text-label-sm text-surface/90">
        {item.serviceCount} dịch vụ
      </p>
    </div>
  </Link>
);

/** Ô nhỏ: nền token, icon danh mục, không ảnh, để lưới còn chỗ thở. */
const CompactTile = ({
  item,
  spanClass = "",
}: {
  item: CategoryShowcaseItem;
  spanClass?: string;
}) => (
  <Link
    to={`/customer/services?categoryId=${item.id}`}
    className={`group flex flex-col justify-between gap-4 rounded-3xl border border-outline-variant/30 bg-surface-container-low p-5 transition-colors duration-300 hover:bg-surface-container-lowest ${spanClass}`}
  >
    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/8 text-primary">
      <CategoryIcon icon={item.icon} name={item.name} className="h-6 w-6" />
    </span>
    <span className="min-w-0">
      <span className="block font-headline-md text-base font-semibold text-on-surface">
        {item.name}
      </span>
      <span className="mt-0.5 block text-label-sm text-on-surface-variant">
        {item.serviceCount} dịch vụ
      </span>
    </span>
  </Link>
);

/**
 * Ô nhỏ cuối cùng giãn ra lấp nốt hàng dở dang, để lưới không kết thúc bằng một
 * ô lẻ trôi nổi giữa khoảng trống. Chuỗi class viết cứng để Tailwind quét thấy.
 */
const TAIL_SPAN_LG: Record<number, string> = {
  1: "lg:col-span-4",
  2: "lg:col-span-3",
  3: "lg:col-span-2",
};

const tailSpanClass = (count: number, index: number) => {
  if (index !== count - 1) return "";
  const mobile = count % 2 === 1 ? "col-span-2" : "";
  const desktop = TAIL_SPAN_LG[count % 4] ?? "";
  return `${mobile} ${desktop}`.trim();
};

/**
 * Lưới bento 4 cột. Số ô bằng đúng số danh mục có dịch vụ — không ô trống, không
 * ô độn. Hai danh mục nhiều dịch vụ nhất nhận ô lớn kèm ảnh.
 */
export const CategoryBento = ({ items }: { items: CategoryShowcaseItem[] }) => {
  const featured = items.filter((item) => item.image).slice(0, 2);
  const rest = items.filter((item) => !featured.includes(item));

  return (
    <div className="grid auto-rows-[minmax(140px,auto)] grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
      {featured.map((item) => (
        <FeatureTile key={item.id} item={item} />
      ))}
      {rest.map((item, index) => (
        <CompactTile
          key={item.id}
          item={item}
          spanClass={tailSpanClass(rest.length, index)}
        />
      ))}
    </div>
  );
};
