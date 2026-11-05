import { useState, useEffect } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Modal } from "./ui/dialog";
import { send, invalidate } from "@/lib/api";
import { useQuery, useDebounced } from "@/lib/hooks";
import {
  type Kind,
  type CRMRecord,
  type Page,
  statuses,
  singular,
  recordName,
} from "@/lib/types";

type Values = Record<string, string>;
type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  max?: number;
};
const fields: Record<Kind, Field[]> = {
  clients: [
    { key: "full_name", label: "Full name", required: true },
    { key: "email", label: "Email address", type: "email" },
    { key: "phone", label: "Phone number", max: 40 },
    { key: "company", label: "Company", max: 200 },
    { key: "tags", label: "Tags", type: "tags" },
    {
      key: "last_interaction_at",
      label: "Last interaction",
      type: "datetime-local",
    },
    { key: "notes", label: "Notes", type: "textarea", max: 10000 },
  ],
  leads: [
    { key: "name", label: "Full name", required: true },
    { key: "email", label: "Email address", type: "email" },
    { key: "phone", label: "Phone number", max: 40 },
    { key: "company", label: "Company", max: 200 },
    { key: "source", label: "Source", max: 100 },
    { key: "estimated_value", label: "Estimated value (USD)", type: "number" },
    {
      key: "status",
      label: "Status",
      options: statuses.leads.filter((s) => s !== "Converted"),
    },
    { key: "notes", label: "Notes", type: "textarea", max: 10000 },
  ],
  deals: [
    { key: "title", label: "Deal title", required: true, max: 200 },
    { key: "client_id", label: "Associated client", type: "client" },
    { key: "value", label: "Value (USD)", type: "number" },
    { key: "status", label: "Status", options: statuses.deals },
    { key: "expected_close_date", label: "Expected close date", type: "date" },
    { key: "description", label: "Description", type: "textarea", max: 10000 },
  ],
  tasks: [
    { key: "title", label: "Task title", required: true, max: 200 },
    { key: "due_date", label: "Due date", type: "date" },
    { key: "priority", label: "Priority", options: ["Low", "Medium", "High"] },
    { key: "status", label: "Status", options: statuses.tasks },
    { key: "client_id", label: "Associated client", type: "client" },
    { key: "deal_id", label: "Associated deal", type: "deal" },
    { key: "description", label: "Description", type: "textarea", max: 10000 },
  ],
};
function RelationSelect({
  kind,
  value,
  label,
  onChange,
}: {
  kind: "clients" | "deals";
  value: string;
  label: string;
  onChange: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const query = useDebounced(search);
  const { data, error, loading } = useQuery<Page<CRMRecord>>(
    `/${kind}?page_size=100&q=${encodeURIComponent(query)}`,
  );
  const selected = useQuery<CRMRecord>(value ? `/${kind}/${value}` : null);
  const items = data?.items || [];
  return (
    <div className="relation-control">
      <div className="relation-search">
        <Search size={13} />
        <input
          aria-label={`Search ${kind} to associate`}
          placeholder={`Find a ${kind === "clients" ? "client" : "deal"}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <select
        className="field"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">No association</option>
        {value && !items.some((i) => i.id === value) && (
          <option value={value}>
            {selected.data ? recordName(selected.data) : "Current association"}
          </option>
        )}
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {recordName(i)}
          </option>
        ))}
      </select>
      {loading && <small>Loading choices…</small>}
      {error && <small className="error-text">{error}</small>}
      {data && data.total > 100 && (
        <small>Search to narrow {data.total} results.</small>
      )}
    </div>
  );
}
export function RecordForm({
  kind,
  record,
  open,
  onClose,
  defaults = {},
}: {
  kind: Kind;
  record?: CRMRecord | null;
  open: boolean;
  onClose: () => void;
  defaults?: Values;
}) {
  const [values, setValues] = useState<Values>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const initial: Values = {};
    for (const f of fields[kind]) {
      const val = record?.[f.key as keyof CRMRecord];
      initial[f.key] = Array.isArray(val)
        ? val.join(", ")
        : val !== undefined && val !== null
          ? String(val)
          : f.options?.[0] || "";
      if (f.type === "datetime-local" && val) {
        const d = new Date(String(val));
        initial[f.key] = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      }
    }
    if (!record) {
      if (kind === "tasks") initial.priority = "Medium";
      Object.assign(initial, defaults);
    }
    setValues(initial);
    setError("");
  }, [open, record, kind]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload: Record<string, unknown> = { ...values };
    for (const f of fields[kind]) {
      if (f.type === "number") payload[f.key] = values[f.key] || "0";
      if (
        ["email", "date", "client", "deal", "datetime-local"].includes(
          f.type || "",
        ) &&
        !values[f.key]
      )
        payload[f.key] = null;
      if (f.type === "datetime-local" && values[f.key])
        payload[f.key] = new Date(values[f.key]).toISOString();
      if (f.type === "tags")
        payload[f.key] = values[f.key]
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
    }
    try {
      await send(
        `/${kind}${record ? `/${record.id}` : ""}`,
        record ? "PUT" : "POST",
        payload,
      );
      invalidate();
      toast.success(
        `${singular[kind][0].toUpperCase() + singular[kind].slice(1)} ${record ? "updated" : "created"}`,
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title={`${record ? "Edit" : "New"} ${singular[kind]}`}
      description={`Keep the details that matter. ${kind === "deals" ? "All values are in USD." : "Fields marked * are required."}`}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {fields[kind].map((f) => (
            <label
              className={
                f.type === "textarea" || f.type === "tags" ? "span-2" : ""
              }
              key={f.key}
            >
              {f.label}
              {f.required && <span className="required"> *</span>}
              {f.type === "textarea" ? (
                <textarea
                  className="field"
                  rows={3}
                  value={values[f.key] || ""}
                  maxLength={f.max}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
              ) : f.options ? (
                <select
                  className="field"
                  value={values[f.key] || ""}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                >
                  {(record?.converted_at && f.key === "status"
                    ? ["Converted"]
                    : f.options
                  ).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === "client" || f.type === "deal" ? (
                <RelationSelect
                  kind={f.type === "client" ? "clients" : "deals"}
                  value={values[f.key] || ""}
                  label={f.label}
                  onChange={(v) => setValues({ ...values, [f.key]: v })}
                />
              ) : (
                <Input
                  type={f.type === "tags" ? "text" : f.type || "text"}
                  required={f.required}
                  value={values[f.key] || ""}
                  maxLength={f.max || (f.type === "email" ? 254 : 120)}
                  min={f.type === "number" ? 0 : undefined}
                  max={f.type === "number" ? 999999999999 : undefined}
                  step={f.type === "number" ? "0.01" : undefined}
                  placeholder={
                    f.type === "tags" ? "e.g. Design, Retainer, VIP" : undefined
                  }
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy
              ? "Saving…"
              : record
                ? "Save changes"
                : `Create ${singular[kind]}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
