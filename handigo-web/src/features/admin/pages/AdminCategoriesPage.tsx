import { ReliableImage } from '@/components/common/ReliableImage';
import { useToast, useToastFeedback } from "@/components/common/Toast";
import { useMemo, useState, type FormEvent } from "react";
import { CircleAlert, Image as ImageIcon, ListPlus, Pencil, PlusCircle, Trash2, Wrench } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { DataTable } from "@/components/common/dashboard/DataTable";
import { TableSkeleton } from "@/components/common/dashboard/TableSkeleton";
import { CategoryFilterBar } from "../components/categories/CategoryFilterBar";
import { CategoryFormModal } from "../components/categories/CategoryFormModal";
import { ServiceFormModal } from "../components/services/ServiceFormModal";
import { OptionFormModal } from "../components/services/OptionFormModal";
import { OptionGroupsEditor } from "../components/services/OptionGroupsEditor";
import { emptyServiceForm, emptyOptionForm, getCategoryId, toOptionPayload, toServicePayload, type OptionForm, type ServiceForm } from "../components/services/service.helpers";
import { categoryServiceApi } from "../api/categoryService.api";
import { buildCategoryTableColumns } from "../components/categories/category-table-columns";
import { useAdminCategoriesController } from "../components/categories/use-admin-categories-controller";
import type { Service, ServiceOption } from "../types/categoryService.types";
import { isImageUrl, OPTION_TYPE_LABELS, serviceMoney } from "../components/services/service.helpers";

const serviceDateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function CategoryServicesDropdown({
  services,
  optionCounts,
  optionsLoading,
  onEditService,
  onDeleteService,
}: {
  services: Service[];
  optionCounts: Record<string, number>;
  optionsLoading: boolean;
  onEditService: (service: Service) => void;
  onDeleteService: (service: Service) => void;
}) {
  return (
    <div className="-mt-2 space-y-2">
      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant p-4 text-sm text-on-surface-variant">Danh mục chưa có dịch vụ.</p>
      ) : (
        <div className="space-y-3">
          {services.map((service) => {
            const price = service.fixedPrice ?? service.minOptionPrice ?? service.depositAmount;
            return (
              <div key={service._id} onClick={() => onEditService(service)} className="group relative mx-3 flex w-full min-w-[62rem] cursor-pointer items-center gap-5 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-3 shadow-sm transition-colors hover:border-primary/50 hover:bg-surface-container-high sm:mx-5">
                <div className="flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-variant text-on-surface-variant">
                  {(service.coverImage === undefined ? service.image : service.coverImage) && isImageUrl((service.coverImage === undefined ? service.image : service.coverImage)) ? <ReliableImage src={(service.coverImage === undefined ? service.image : service.coverImage) || undefined} alt="" aria-hidden="true" className="h-full w-full object-contain" /> : <Wrench aria-hidden="true" size={22} />}
                </div>
                <div className="w-64 min-w-0 shrink-0">
                  <span className="group/description relative inline-flex min-w-0 items-center gap-1">
                    <p className="truncate font-semibold text-on-surface">{service.name}</p>
                    <span className="shrink-0 rounded-full p-0.5 text-on-surface-variant" aria-label={`Xem mô tả dịch vụ ${service.name}`}>
                      <CircleAlert aria-hidden="true" size={16} />
                    </span>
                    <span className="pointer-events-none absolute bottom-full right-8 z-30 mb-2 hidden w-max whitespace-pre-wrap rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-950 shadow-lg group-hover/description:block">
                      {service.description || 'Chưa có mô tả'}
                    </span>
                  </span>
                </div>
                <div className="-ml-2 grid min-w-0 flex-1 grid-cols-[1.15fr_1fr_1fr_1.5fr_1fr] items-center gap-4 text-center text-sm text-on-surface-variant">
                    <span className="flex min-w-0 flex-col gap-0.5"><small className="text-[10px] uppercase tracking-wide">Loại giá</small><strong className="font-semibold text-on-surface">{service.serviceType === 'fixed_price' ? 'Giá cố định' : 'Giá linh hoạt'}</strong></span>
                    <span className="flex min-w-0 flex-col gap-0.5"><small className="text-[10px] uppercase tracking-wide">Giá</small><strong className="font-semibold text-on-surface">{price == null ? 'Chưa có giá' : serviceMoney.format(price)}</strong></span>
                    <span className="flex min-w-0 flex-col gap-0.5"><small className="text-[10px] uppercase tracking-wide">Tùy chọn</small><strong className="font-semibold text-on-surface">{optionsLoading ? 'Đang tải…' : optionCounts[service._id] ?? 0}</strong></span>
                    <span className="flex min-w-0 flex-col gap-0.5"><small className="text-[10px] uppercase tracking-wide">Slug</small><strong className="break-all whitespace-normal font-medium text-on-surface-variant">/{service.slug}</strong></span>
                    <span className="flex min-w-0 flex-col gap-0.5"><small className="text-[10px] uppercase tracking-wide">Cập nhật</small><strong className="font-medium text-on-surface-variant">{service.updatedAt ? serviceDateFormatter.format(new Date(service.updatedAt)) : '—'}</strong></span>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                  <StatusBadge value={service.isActive ? 'active' : 'hidden'} />
                  <button type="button" onClick={(event) => { event.stopPropagation(); onEditService(service); }} className="rounded-lg p-2 text-on-surface-variant hover:bg-primary/10 hover:text-primary" aria-label="Sửa dịch vụ">
                    <Pencil aria-hidden="true" size={20} />
                  </button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onDeleteService(service); }} className="rounded-lg p-2 text-on-surface-variant hover:bg-error/10 hover:text-error" aria-label="Xóa dịch vụ">
                    <Trash2 aria-hidden="true" size={20} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminCategoriesPage() {
  const c = useAdminCategoriesController();
  const { addToast } = useToast();
  const [serviceModal, setServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyServiceForm);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [optionModal, setOptionModal] = useState<'create' | 'edit' | null>(null);
  const [optionForm, setOptionForm] = useState<OptionForm>(emptyOptionForm);
  const [editingOption, setEditingOption] = useState<ServiceOption | null>(null);
  const [optionFormError, setOptionFormError] = useToastFeedback<string>('', "error");
  const [serviceDeleteTarget, setServiceDeleteTarget] = useState<Service | null>(null);
  const [serviceBusy, setServiceBusy] = useState(false);

  const openEditService = (service: Service) => {
    setEditingService(service);
    setServiceForm({
      categoryId: getCategoryId(service),
      name: service.name,
      slug: service.slug,
      coverImage: (service.coverImage === undefined ? service.image : service.coverImage) || '',
      galleryImages: [...(service.galleryImages ?? [])],
      description: service.description || '',
      processSteps: (service.processSteps ?? []).map((step) => ({ ...step })),
      serviceType: service.serviceType,
      fixedPrice: service.fixedPrice == null ? '' : String(service.fixedPrice),
      depositAmount: service.depositAmount == null ? '' : String(service.depositAmount),
      requiresOptionSelection: service.requiresOptionSelection ?? false,
      isActive: service.isActive,
    });
    setServiceOptions([]);
    void categoryServiceApi.listServiceOptions(service._id).then(setServiceOptions).catch(() => setServiceOptions([]));
    setServiceModal(true);
  };

  const openCreateService = (category: { _id: string }) => {
    setEditingService(null);
    setServiceOptions([]);
    setOptionModal(null);
    setServiceForm({ ...emptyServiceForm, categoryId: category._id });
    setServiceModal(true);
  };

  const saveService = async (event: FormEvent) => {
    event.preventDefault();
    setServiceBusy(true);
    try {
      if (editingService) {
        await categoryServiceApi.updateService(editingService._id, toServicePayload(serviceForm));
      } else {
        await categoryServiceApi.createService(toServicePayload(serviceForm));
      }
      setServiceModal(false);
      addToast(editingService ? 'Đã cập nhật dịch vụ.' : 'Đã thêm dịch vụ.', 'success');
      await c.reload();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Không thể cập nhật dịch vụ.', 'error');
    } finally {
      setServiceBusy(false);
    }
  };

  const openCreateOption = () => {
    setEditingOption(null);
    setOptionForm(emptyOptionForm);
    setOptionFormError('');
    setOptionModal('create');
  };

  const openEditOption = (option: ServiceOption) => {
    setEditingOption(option);
    setOptionForm({
      groupId: option.groupId ?? '',
      name: option.name,
      description: option.description || '',
      image: option.image || '',
      optionType: option.optionType,
      price: String(option.price),
      selectionGroup: option.selectionGroup || '',
      selectionMode: option.selectionMode ?? 'multiple',
      allowsQuantity: option.allowsQuantity ?? false,
      isActive: option.isActive,
    });
    setOptionFormError('');
    setOptionModal('edit');
  };

  const saveOption = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingService) return;
    setServiceBusy(true);
    try {
      if (editingOption) await categoryServiceApi.updateServiceOption(editingOption._id, toOptionPayload(optionForm));
      else await categoryServiceApi.createServiceOption(editingService._id, toOptionPayload(optionForm));
      setOptionModal(null);
      setOptionFormError('');
      setServiceOptions(await categoryServiceApi.listServiceOptions(editingService._id));
      addToast(editingOption ? 'Đã cập nhật tùy chọn.' : 'Đã thêm tùy chọn.', 'success');
    } catch (error) {
      setOptionFormError(error instanceof Error ? error.message : 'Không thể lưu tùy chọn.');
    } finally {
      setServiceBusy(false);
    }
  };

  const confirmDeleteService = async () => {
    if (!serviceDeleteTarget) return;
    const target = serviceDeleteTarget;
    setServiceDeleteTarget(null);
    setServiceBusy(true);
    try {
      await categoryServiceApi.deleteService(target._id);
      addToast('Đã xóa dịch vụ.', 'success');
      await c.reload();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Không thể xóa dịch vụ.', 'error');
    } finally {
      setServiceBusy(false);
    }
  };

  const sortedCategories = useMemo(
    () =>
      [...c.categories].sort((a, b) => {
        const aPinned = c.pinnedIds.includes(a._id);
        const bPinned = c.pinnedIds.includes(b._id);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        return c.sortOrder === "asc"
          ? a.name.localeCompare(b.name, "vi")
          : b.name.localeCompare(a.name, "vi");
      }),
    [c.categories, c.pinnedIds, c.sortOrder],
  );

  const columns = useMemo(
    () =>
      buildCategoryTableColumns({
        serviceCounts: c.serviceCounts,
        onEdit: c.openEdit,
        onDelete: c.setDeleteTarget,
        pinnedIds: c.pinnedIds,
        onTogglePin: c.togglePinned,
        onCreateService: openCreateService,
        expandedId: c.expandedId,
        onToggleExpand: c.toggleExpanded,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.serviceCounts, c.pinnedIds, c.expandedId],
  );

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
              Quản lý danh mục dịch vụ
            </h1>
          </div>
          <div className="text-left sm:text-right">
            <p className="flex items-center justify-start gap-2 text-sm font-semibold text-on-surface-variant sm:justify-end">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full bg-success"
              />
              Dịch vụ đang hoạt động
            </p>
            <p className="mt-1 text-xl font-bold text-on-surface">
              <span className="text-success">{c.serviceStats.active}</span>/
              {c.serviceStats.total}
            </p>
          </div>
        </header>


        <CategoryFilterBar
          search={c.search}
          onSearchChange={c.setSearch}
          statusFilter={c.statusFilter}
          onStatusFilterChange={c.setStatusFilter}
          sortOrder={c.sortOrder}
          onSortOrderChange={c.setSortOrder}
          onRefresh={() => void c.reload()}
          onCreate={c.openCreate}
        />

        <AsyncState
          loading={c.loading}
          skeleton={
            <TableSkeleton columns={columns.length} rowCount={c.LIMIT} />
          }
        >
          <DataTable
            columns={columns}
            rows={sortedCategories}
            rowKey={(category) => category._id}
            expandedRowKey={c.expandedId || undefined}
            onRowClick={(category) => void c.toggleExpanded(category._id)}
            renderExpandedRow={(category) => (
              <CategoryServicesDropdown
                services={c.servicesByCategory[category._id] || []}
                optionCounts={c.optionCounts}
                optionsLoading={c.optionsLoadingId === category._id}
                onEditService={openEditService}
                onDeleteService={setServiceDeleteTarget}
              />
            )}
            emptyState={
              <div className="p-10 text-center text-on-surface-variant">
                Chưa có danh mục phù hợp.
              </div>
            }
            minWidthClassName="min-w-[900px]"
          />
        </AsyncState>

        <div className="flex items-center justify-between text-label-md text-on-surface-variant">
          <span>
            Hiển thị {sortedCategories.length} / {c.total} danh mục
          </span>
        </div>
        <Pagination
          page={c.page}
          totalPages={c.totalPages}
          onChange={c.changePage}
        />
      </div>

      <CategoryFormModal
        open={Boolean(c.modal)}
        mode={c.modal || "create"}
        form={c.form}
        busy={c.busy}
        error={c.formError}
        colorLoading={c.colorLoading}
        colorError={c.colorError}
        unavailableIconColors={c.unavailableIconColors}
        onReloadColors={c.reloadIconColors}
        onChange={c.setForm}
        onClose={() => c.setModal(null)}
        onSubmit={c.save}
      />

      <ServiceFormModal
        open={serviceModal}
        mode={editingService ? "edit" : "create"}
        categories={c.categories}
        form={serviceForm}
        busy={serviceBusy}
        blockClose={serviceBusy || Boolean(optionModal)}
        onChange={setServiceForm}
        onClose={() => setServiceModal(false)}
        onSubmit={saveService}
      >
        {editingService && (
          <section className="space-y-3 rounded-xl border border-outline-variant/40 p-4">
            <OptionGroupsEditor service={editingService} onSaved={updated => { setEditingService(updated); void categoryServiceApi.listServiceOptions(updated._id).then(setServiceOptions); }} />
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-on-surface">Tùy chọn dịch vụ</h3>
                <p className="text-xs text-on-surface-variant">Thiết lập các gói, đơn vị tính và mức giá khách hàng có thể chọn.</p>
              </div>
              <button type="button" onClick={openCreateOption} className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5">
                <PlusCircle size={18} aria-hidden="true" /> Thêm tùy chọn
              </button>
            </div>
            {serviceOptions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant p-4 text-center text-sm text-on-surface-variant"><ListPlus className="mx-auto mb-2" size={24} />Chưa có tùy chọn nào.</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(
                  serviceOptions.reduce<Record<string, ServiceOption[]>>((groups, option) => {
                    const group = option.selectionGroup?.trim() || 'Chưa phân nhóm';
                    groups[group] = [...(groups[group] || []), option];
                    return groups;
                  }, {}),
                ).map(([group, options]) => (
                  <div key={group} className="space-y-2">
                    <h4 className="border-b border-outline-variant/40 pb-1 text-xs font-bold uppercase tracking-wide text-primary">{group}</h4>
                    {options.map((option) => (
                      <div key={option._id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-outline-variant/60 px-4 py-3 text-sm">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low text-on-surface-variant">
                          {option.image && isImageUrl(option.image) ? <ReliableImage src={option.image} alt="" aria-hidden="true" className="h-full w-full object-contain" /> : <ImageIcon aria-hidden="true" size={20} />}
                        </div>
                        <div className="group/option relative min-w-0">
                          <div className="flex min-w-0 items-center gap-1"><p className="truncate font-semibold">{option.name}</p><span className="rounded-full p-0.5 text-on-surface-variant" aria-label={`Mô tả tùy chọn ${option.name}`}><CircleAlert aria-hidden="true" size={15} /></span></div>
                          <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-auto whitespace-pre-wrap rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-950 shadow-lg group-hover/option:block">{option.description || 'Chưa có mô tả'}</span>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant"><span>{OPTION_TYPE_LABELS[option.optionType]}</span><span>Chọn nhiều: {option.selectionMode === 'multiple' ? 'Có' : 'Không'}</span><span>Cho phép số lượng: {option.allowsQuantity ? 'Có' : 'Không'}</span></div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant"><span className={`h-2.5 w-2.5 rounded-full ${option.isActive ? 'bg-success' : 'bg-outline'}`} aria-hidden="true" />{option.price.toLocaleString('vi-VN')} đ</span>
                          <button type="button" onClick={() => openEditOption(option)} className="rounded p-1 text-primary hover:bg-primary/10" aria-label={`Sửa tùy chọn ${option.name}`}><Pencil size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </ServiceFormModal>

      <OptionFormModal
        open={Boolean(optionModal)}
        mode={optionModal || 'create'}
        selectedService={editingService}
        form={optionForm}
        busy={serviceBusy}
        blockClose={serviceBusy}
        formError={optionFormError}
        onChange={setOptionForm}
        onClearError={() => setOptionFormError('')}
        onClose={() => setOptionModal(null)}
        onSubmit={saveOption}
      />

      <ConfirmDialog
        open={Boolean(serviceDeleteTarget)}
        title="Xóa dịch vụ"
        message={`Bạn chắc chắn muốn xóa dịch vụ "${serviceDeleteTarget?.name || ''}"?`}
        busy={serviceBusy}
        onCancel={() => setServiceDeleteTarget(null)}
        onConfirm={confirmDeleteService}
      />

      <ConfirmDialog
        open={Boolean(c.deleteTarget)}
        title="Xóa danh mục"
        message={`Bạn chắc chắn muốn xóa danh mục "${c.deleteTarget?.name}"? Hành động này không thể khôi phục.`}
        busy={c.busy}
        onCancel={() => c.setDeleteTarget(null)}
        onConfirm={c.confirmDelete}
      />
    </DashboardShell>
  );
}
