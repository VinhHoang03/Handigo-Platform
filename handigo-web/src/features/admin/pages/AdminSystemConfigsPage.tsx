import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { StatCard } from "../components/shared/StatCard";
import { systemConfigApi } from "../api/systemConfig.api";
import type {
  ConfigFormState,
  ConfigGroupKey,
  ConfigItem,
  PendingSave,
} from "../components/system-configs/config-definitions";
import { ConfigList } from "../components/system-configs/ConfigList";
import { ConfigModal } from "../components/system-configs/ConfigModal";
import { GroupSidebar } from "../components/system-configs/GroupSidebar";
import { SaveConfirmModal } from "../components/system-configs/SaveConfirmModal";
import {
  getErrorMessage,
  mergeConfigItems,
  parseValue,
  stringifyValue,
} from "../components/system-configs/system-config-format";
import type { SystemConfigPayload, SystemConfigQuery, UpdateSystemConfigPayload } from "../types/systemConfig.types";

export default function AdminSystemConfigsPage() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeGroup, setActiveGroup] = useState<ConfigGroupKey | "all">("all");
  const [editing, setEditing] = useState<ConfigItem | null>(null);
  const [form, setForm] = useState<ConfigFormState>({
    value: "",
    isPublic: false,
  });
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query: SystemConfigQuery = {};
      const configs = await systemConfigApi.list(query);
      setItems(mergeConfigItems(configs));
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

  const visibleItems = useMemo(
    () =>
      activeGroup === "all"
        ? items
        : items.filter((item) => item.group === activeGroup),
    [activeGroup, items],
  );

  const stats = useMemo(() => {
    const configuredCount = items.filter((item) => item.existing).length;
    const effectiveCount = items.filter((item) => item.isEffective).length;
    const publicCount = items.filter((item) => item.isPublic).length;
    return { configuredCount, effectiveCount, publicCount };
  }, [items]);

  const openEdit = (item: ConfigItem) => {
    setEditing(item);
    setForm({
      value: stringifyValue(item.currentValue, item.type),
      isPublic: item.existing ? item.existing.isPublic : item.isPublic,
    });
    setPendingSave(null);
    setError("");
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    setError("");
    setNotice("");
    try {
      const payload: SystemConfigPayload = {
        key: editing.key,
        value: parseValue(editing.type, form.value),
        type: editing.type,
        description: editing.description,
        isPublic: form.isPublic,
      };
      setPendingSave({ item: editing, payload });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const confirmSave = async () => {
    if (!pendingSave) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { item, payload } = pendingSave;
      if (item.existing) {
        const updatePayload: UpdateSystemConfigPayload = {
          value: payload.value,
          type: payload.type,
          description: payload.description,
          isPublic: payload.isPublic,
        };
        await systemConfigApi.update(item.key, updatePayload);
      } else {
        await systemConfigApi.create(payload);
      }

      setNotice(`Đã lưu cấu hình "${item.label}".`);
      setEditing(null);
      setPendingSave(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">
        <header className="flex flex-col gap-3">
          <h1 className="text-headline-lg font-bold text-on-background">
            Cấu hình hệ thống
          </h1>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon="settings" label="Đã thiết lập" value={stats.configuredCount} />
          <StatCard icon="bolt" label="Đã nối logic" value={stats.effectiveCount} />
          <StatCard icon="public" label="Công khai" value={stats.publicCount} />
        </div>

        {(notice || error) && (
          <div
            className={`rounded-xl px-4 py-3 ${error ? "bg-error/10 text-error" : "bg-emerald-100 text-emerald-700"}`}
          >
            {error || notice}
          </div>
        )}

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <AsyncState
            loading={loading}
            error={error}
            empty={false}
            onRetry={load}
          >
            <div className="grid min-w-0 gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
              <GroupSidebar
                activeGroup={activeGroup}
                items={items}
                onChange={setActiveGroup}
              />
              <ConfigList items={visibleItems} onEdit={openEdit} />
            </div>
          </AsyncState>
        </section>
      </div>

      <ConfigModal
        item={editing}
        form={form}
        busy={busy}
        onChange={setForm}
        onClose={() => {
          setEditing(null);
          setPendingSave(null);
        }}
        onSubmit={save}
      />

      <SaveConfirmModal
        pendingSave={pendingSave}
        busy={busy}
        onCancel={() => setPendingSave(null)}
        onConfirm={confirmSave}
      />
    </DashboardShell>
  );
}
