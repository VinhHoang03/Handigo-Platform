import { Navigate, useLocation } from "react-router-dom";

/** Giữ liên kết cũ hoạt động sau khi gộp báo cáo vào Tổng quan. */
export default function AdminRevenuePage() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "/admin", search, hash: "#admin-revenue" }} replace />;
}
