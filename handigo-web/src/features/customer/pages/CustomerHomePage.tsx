import React from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import {
  CategoriesGrid,
  CustomerHomeFooter,
  HeroOffer,
  RecentOrders,
  TopProviders,
} from "../components/CustomerHomeComponents";
import type { Booking, Category, Pro } from "../types/customer.types";

const heroImageUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBsIKP1_Fy6o_EMzoFqhEtqOBvPjSb8sWjrVk0GTpbKqMiLk7kT5jhuYsjGU9pC5GsC6ea09Y1dw0J4KvYwwgVPA-kZIB0Z4zTuj1FTbXqggjT8hU-TsqUAiSU8Gs6zuFSp8J54mSn6zpqnePLsR3tcilXdg5KxNyAzG9_xPY3RovK2erHpgpPDJ0pEkK3LPE8u4MskH_XYLz23B_t5ibO5ELQIUY3xN0ZGCiFIC6g3I9NBgEJp95ZTKhVNaXRIBoffqynowhjtO2g";

const providerAvatarUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC1--RFwuMPWQUCUsJqFJtDg21-HdcfnLdSf1OjFhMQ0j9NST24FjBaSM7JOtzszWmIErKqMQXkdmnqxR_utEHb4TNZqahM9yrFFqESI_-xXht1pg77JxyVFam1MDuZphna3Zzdr7cgqcFhy5reOFD_N9RLOTsh0qCOMK0fLTu__c6jZwBY_lwO3VqXa-2B31covAs8bzABVOXq1Y2B3ziI6r3itdM--XjKZCx2Wu68KLuxv31UO4Xc5ad40bz8dGGl-KYcUt6HNrc";

const categories: Category[] = [
  {
    icon: "ac_unit",
    name: "Điện lạnh",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBceMJJI8IHQgE52oA0RxaLld12li12pnFBU_OYwDkKKGcpoFisSOQMWZl7g9npG-Hs4aGGYjPW5jdB_ktgaZN0vmvN7sBzcur9O7DZ7M-gKfgUETxj76o7GJK8BQ4WApMNMTztiEMBnS3JY6oj-SlQu5CGv3BBQGx6jJn0J8WyGiah9Bu97ypf1JX5qUcrVjdbcrcBA938U_Mpme9RMLlZ275rppfcynufQmWvkJkTCbuvkg-YRq5m47C2cUec0Pqs1s5amqsA2ec",
    imageAlt: "Thợ đang bảo dưỡng máy lạnh trong nhà",
  },
  {
    icon: "plumbing",
    name: "Điện nước",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBsu-32JdRxoSHkrKo_H4HM6kCmZRZ4440YUhaLa_0Hya62pmmo0rXNUCRtwqVvLfJAZIp84MhOp3JNrERclEF6jEAB0fNU3MdJZDjE4w5puPSV_jQUldg29bs3OQyXHcwf9VvM_QUg47xW4u56Z0u4ljQpH1-M4VV3ACfF_7ZFkwv-FYfPV6_q5xWwNzBVWWX0UAjgjfdET4O_cfIu_s7UDraqvqiiRvLPh3KrhBkp_CwbzXO49wcVr6Xf3Mo-sTt0R90EvgVwDw8",
    imageAlt: "Thợ lắp đặt vòi nước trong phòng tắm",
  },
  {
    icon: "cleaning_services",
    name: "Vệ sinh",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuALcFw4C6LkorICZDy462Zh-JZNdP_eRvA7aQJsFAm9w2nO3zyxVk9lqKaQTONlOTsXrvE2d_KGQBmistaMUNf8_ToL6COPCTMyYG_RZBNg1aarOHV-60OBjeGlybE04iTYqz8sHue3ErVziFJyvl-Gph_LCdOZVh1JbkKChgATiiwK2v_e6_VSZTTRUKwSO0UHw-XQV--Typ23K3doIp22OCqkJ9KPAEhz872E2o0P-tBazti4W1UxoFM3wXwPkkTU6CIlGMythp8",
    imageAlt: "Không gian giặt ủi sạch sẽ và ngăn nắp",
  },
  {
    icon: "home_repair_service",
    name: "Sửa nhà",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBSpmy0DLJkXOpU5pTbvIa2VeF4RmLnkYcV8sRN_rSag7sHqEg6_j20xV_J3KvF2AiPTWSdQWCNFR7MJgmdX9ph8YC8f_MhLJbG-L8HOeiihMRVz6Mt2GQJioaS9Zn5OOEBPVChdh9jf3Rb2KDuVkdRwPf8TNIoRglPKMr1vH7fV5cZoNMhpmVqT6KyttYIgeSF6j-m2uSOaTER_6winK8W08UWul3bzXGrk2_R1ng6BkQg_-vTcsSttttpiA4JsuKUGc2ro52zr94",
    imageAlt: "Vật liệu và bản vẽ cải tạo nhà",
  },
];

const currentBookings: Booking[] = [
  {
    id: "HG-9842",
    title: "Vệ sinh máy lạnh",
    providerName: "Trần Văn Nam",
    providerAvatarUrl,
    status: "Confirmed",
    statusLabel: "Đã xác nhận",
    statusTone: "confirmed",
    date: "Thứ 4, 15/05",
    time: "09:00",
    price: "250.000đ",
    icon: "ac_unit",
  },
  {
    id: "HG-9710",
    title: "Sửa ống nước",
    status: "Pending",
    statusLabel: "Đang chờ",
    statusTone: "pending",
    date: "Thứ 6, 17/05",
    time: "14:30",
    price: "180.000đ",
    icon: "plumbing",
  },
];

const topProviders: Pro[] = [
  {
    id: "1",
    name: "Sarah Jenkins",
    title: "Chuyên gia điện nước",
    rating: 4.9,
    reviewsCount: 124,
    distance: "1.2 km",
    isOnline: true,
    avatarUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDldzxeZoQT1iNnmlu8p-mZi0VA7EY2pT1j6JxYNOCKXrlUA31Bd-nyZduI90597S17VvVAtrp476ZhzTg7ttcRDSBLKLTWyNjGa0Hjm1Xpe8x-V8TSXlZQ8lqtcEIUyrvaEOJjh283oDslGcyXwV8oDyG4uEqeAr8mgh66Tv8aHx0NNsmA9S8a4g20WIqeN5ZFpOfQSYhy8QEc37djKTuJVrA_OJ7L68C7MlZiRMKb6BHv3iF9Nmp-cxVU_76M3U54BY5-Yi2UyT8",
  },
  {
    id: "2",
    name: "Mike Thompson",
    title: "Vệ sinh tổng quát",
    rating: 4.8,
    reviewsCount: 89,
    distance: "0.8 km",
    isOnline: false,
    avatarUrl: providerAvatarUrl,
  },
];

const CustomerHomePage: React.FC = () => {
  return (
    <DashboardShell role="CUSTOMER">
      <HeroOffer imageUrl={heroImageUrl} />
      <CategoriesGrid categories={categories} />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <RecentOrders bookings={currentBookings} />
        <TopProviders providers={topProviders} />
      </section>

      <CustomerHomeFooter />
    </DashboardShell>
  );
};

export default CustomerHomePage;
