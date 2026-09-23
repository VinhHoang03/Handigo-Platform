import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { bankAccountApi } from '../api/bankAccount.api';
import type { BankAccount } from '../types/bankAccount.types';
import {
  buildPayload,
  emptyForm,
  getErrorMessage,
  vietnamBanks,
  type BankAccountForm,
} from './bankAccountConstants';

/**
 * Gom toàn bộ trạng thái + thao tác CRUD tài khoản ngân hàng của trang thợ.
 * Tách khỏi component trang để giữ file dưới 200 dòng — hành vi giữ nguyên
 * 100% so với bản gốc (bao gồm cách che số tài khoản, không đổi ở đây).
 */
export function useBankAccountManager() {
  const [items, setItems] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<BankAccountForm>(emptyForm);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [defaultTarget, setDefaultTarget] = useState<BankAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await bankAccountApi.list());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.status === 'active').length;
    const inactive = items.filter((item) => item.status === 'inactive').length;
    const defaultAccount = items.find((item) => item.isDefault);
    return { total: items.length, active, inactive, defaultAccount };
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, isDefault: items.length === 0 });
    setModalMode('create');
  };

  const openEdit = (account: BankAccount) => {
    const knownBank = vietnamBanks.some((bank) => bank.code === account.bankCode);
    setEditing(account);
    setForm({
      bankMode: knownBank ? 'list' : 'custom',
      bankName: account.bankName,
      bankCode: account.bankCode,
      accountNumber: account.accountNumber,
      accountHolderName: account.accountHolderName,
      isDefault: account.isDefault,
      status: account.status,
    });
    setModalMode('edit');
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = buildPayload(form);
      if (modalMode === 'edit' && editing) await bankAccountApi.update(editing._id, payload);
      else await bankAccountApi.create(payload);
      setModalMode(null);
      setEditing(null);
      setNotice(modalMode === 'edit' ? 'Đã cập nhật tài khoản ngân hàng.' : 'Đã thêm tài khoản ngân hàng.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmSetDefault = async () => {
    if (!defaultTarget) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await bankAccountApi.setDefault(defaultTarget._id);
      setNotice('Đã đặt tài khoản mặc định.');
      setDefaultTarget(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await bankAccountApi.delete(deleteTarget._id);
      setNotice('Đã xóa tài khoản ngân hàng.');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    items,
    loading,
    error,
    notice,
    busy,
    modalMode,
    form,
    defaultTarget,
    deleteTarget,
    stats,
    load,
    openCreate,
    openEdit,
    save,
    confirmSetDefault,
    confirmDelete,
    setForm,
    setModalMode,
    setDefaultTarget,
    setDeleteTarget,
  };
}
