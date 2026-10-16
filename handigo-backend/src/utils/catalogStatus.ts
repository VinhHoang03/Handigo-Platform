// Bản ghi xóa mềm cũ được quản lý như bản ghi ngừng hoạt động.
export const catalogStatusFilter = (isActive?: string) => {
  if (isActive === "true") return { isActive: true, isDeleted: false };
  if (isActive === "false") return { $or: [{ isActive: false }, { isDeleted: true }] };
  return {};
};

export const catalogStatus = <T extends { isActive: boolean; isDeleted?: boolean }>(item: T): T => ({
  ...item,
  isActive: item.isActive && !item.isDeleted,
});
