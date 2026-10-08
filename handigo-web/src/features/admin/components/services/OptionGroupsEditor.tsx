import { useState } from 'react';
import type { Service } from '../../types/categoryService.types';
import { categoryServiceApi } from '../../api/categoryService.api';

export function OptionGroupsEditor({ service, onSaved }: { service: Service; onSaved: (service: Service) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const groups = service.optionGroups ?? [];
  const save = async (next: Array<Omit<NonNullable<Service['optionGroups']>[number], '_id'> & { _id?: string }>) => {
    setBusy(true); setError('');
    try {
      const result = await categoryServiceApi.updateService(service._id, { optionGroups: next } as Parameters<typeof categoryServiceApi.updateService>[1]);
      onSaved(result); setName('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu nhóm tùy chọn.'); }
    finally { setBusy(false); }
  };
  return <fieldset disabled={busy} className="space-y-3 rounded-xl border border-outline-variant p-4">
    <legend className="px-2 font-bold">Nhóm tùy chọn</legend>
    <p className="text-xs text-on-surface-variant">Tạo nhóm, gán tùy chọn rồi bật bắt buộc chọn. Cấu hình này không đổi giá.</p>
    {groups.map(group => <div key={group._id} className="flex flex-wrap items-center gap-3">
      <input key={`${group._id}:${group.name}`} aria-label={`Tên nhóm ${group.name}`} defaultValue={group.name} onBlur={event => { const value = event.target.value.trim(); if (value && value !== group.name) void save(groups.map(item => item._id === group._id ? { ...item, name: value } : item)); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} className="min-w-32 flex-1 rounded-lg border p-2 font-semibold" />
      <select aria-label={`Cách chọn ${group.name}`} value={group.selectionMode} onChange={event => void save(groups.map(item => item._id === group._id ? { ...item, selectionMode: event.target.value as 'single' | 'multiple' } : item))} className="rounded-lg border p-2">
        <option value="single">Chọn một</option><option value="multiple">Chọn nhiều</option>
      </select>
      <label className="flex items-center gap-2"><input type="checkbox" checked={group.isRequired} onChange={event => void save(groups.map(item => item._id === group._id ? { ...item, isRequired: event.target.checked } : item))} />Bắt buộc</label>
      <button type="button" onClick={() => void save(groups.filter(item => item._id !== group._id))} className="p-2 text-error">Xóa nhóm</button>
    </div>)}
    <div className="flex gap-2"><input aria-label="Tên nhóm mới" value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Loại máy" className="min-w-0 flex-1 rounded-lg border p-2" />
      <button type="button" disabled={!name.trim()} onClick={() => void save([...groups, { name: name.trim(), selectionMode: 'single', isRequired: false, sortOrder: groups.length }])} className="rounded-lg bg-primary px-3 text-on-primary">Thêm nhóm</button></div>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
  </fieldset>;
}
