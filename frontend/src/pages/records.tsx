import { useState } from "react";
import { Link, useSearchParams } from "@/lib/router";
import {
  Plus,
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  LayoutGrid,
  List,
  ArrowUpRight,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BriefcaseBusiness,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  Users,
  Contact,
  CheckSquare,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
  type Kind,
  type CRMRecord,
  type Page,
  statuses,
  singular,
  recordName,
} from "@/lib/types";
import { useQuery, useDebounced } from "@/lib/hooks";
import { send, invalidate } from "@/lib/api";
import { money, dateLabel, today } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RecordForm } from "@/components/record-form";
import { Confirm } from "@/components/ui/alert-dialog";
import { Modal } from "@/components/ui/dialog";
import { Avatar, Badge, Empty, ErrorState, Loading } from "@/components/shared";
const descriptions: Record<Kind, string> = {
  clients: "Good business starts with good relationships.",
  leads: "Turn first conversations into lasting connections.",
  deals: "A clear view of every opportunity ahead.",
  tasks: "A little structure. A lot of forward motion.",
};
const icons = {
  clients: Users,
  leads: Contact,
  deals: BriefcaseBusiness,
  tasks: CheckSquare,
};
const sorts: Record<Kind, [string, string][]> = {
  clients: [
    ["created_at", "Date added"],
    ["full_name", "Name"],
    ["company", "Company"],
    ["last_interaction_at", "Last interaction"],
  ],
  leads: [
    ["created_at", "Date added"],
    ["name", "Name"],
    ["estimated_value", "Value"],
    ["status", "Status"],
  ],
  deals: [
    ["created_at", "Date added"],
    ["title", "Title"],
    ["value", "Value"],
    ["expected_close_date", "Close date"],
  ],
  tasks: [
    ["created_at", "Date added"],
    ["title", "Title"],
    ["due_date", "Due date"],
    ["priority", "Priority"],
  ],
};
export function RecordsPage({ kind }: { kind: Kind }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") || "");
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [priority, setPriority] = useState("");
  const [tag, setTag] = useState("");
  const [overdue, setOverdue] = useState(params.get("overdue") === "true");
  const [view, setView] = useState<"table" | "board">("table");
  const [editing, setEditing] = useState<CRMRecord | null>(null);
  const [form, setForm] = useState(false);
  const [formDefaults, setFormDefaults] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<CRMRecord | null>(null);
  const [converting, setConverting] = useState<CRMRecord | null>(null);
  const [detail, setDetail] = useState<CRMRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState(false);
  const clientId = params.get("client_id");
  const qs = new URLSearchParams({
    q: debounced,
    sort,
    order,
    page: String(page),
    page_size: "10",
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(tag ? { tag } : {}),
    ...(overdue ? { overdue: "true" } : {}),
    ...(clientId ? { client_id: clientId } : {}),
  });
  const query = useQuery<Page<CRMRecord>>(`/${kind}?${qs}`);
  const tags = useQuery<{ name: string; id: string }[]>(
    kind === "clients" ? "/tags" : null,
  );
  const Icon = icons[kind];
  function edit(r: CRMRecord) {
    setEditing(r);
    setForm(true);
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await send(`/${kind}/${deleting.id}`, "DELETE");
      setDeleting(null);
      if (query.data?.items.length === 1 && page > 1) setPage(page - 1);
      invalidate();
      toast.success(`${singular[kind]} deleted`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function convert() {
    if (!converting) return;
    setBusy(true);
    try {
      const c = await send<CRMRecord>(
        `/leads/${converting.id}/convert`,
        "POST",
      );
      setConverting(null);
      invalidate();
      toast.success(`${c.full_name} is now a client`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function complete(r: CRMRecord) {
    try {
      await send(`/tasks/${r.id}/status`, "PATCH", {
        status: r.status === "Completed" ? "Pending" : "Completed",
      });
      invalidate();
      toast.success(
        r.status === "Completed" ? "Task reopened" : "Task completed",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {kind === "tasks"
              ? "MAKE ROOM FOR WHAT MATTERS"
              : "BUILD YOUR MOMENTUM"}
          </div>
          <h1>
            {kind[0].toUpperCase() + kind.slice(1)}
            <span className="heading-dot">.</span>
          </h1>
          <p>{descriptions[kind]}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormDefaults({});
            setForm(true);
          }}
        >
          <Plus />
          New {singular[kind]}
        </Button>
      </div>
      <div className="resource-summary">
        <div className="resource-summary-icon">
          <Icon size={21} />
        </div>
        <div>
          <strong>{query.data?.total ?? "—"}</strong>
          <span>
            {status || "All"} {kind}
            {debounced ? " matching your search" : ""}
          </span>
        </div>
        <p>
          {kind === "clients"
            ? "Your people. All in one place."
            : kind === "leads"
              ? "The next chapter starts with a conversation."
              : kind === "deals"
                ? "Keep your next win in sight."
                : "Progress, one checkmark at a time."}
        </p>
      </div>
      <section className="panel records-panel">
        <div className="records-toolbar">
          <div className="table-search">
            <Search size={16} />
            <input
              aria-label={`Search ${kind}`}
              placeholder={`Search ${kind}…`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="table-controls">
            {statuses[kind].length > 0 && (
              <select
                className="compact-select"
                aria-label="Filter by status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {statuses[kind].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
            <Button
              variant={filters ? "default" : "outline"}
              size="sm"
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal />
              Filters
            </Button>
            {kind === "deals" && (
              <div className="view-switch">
                <button
                  aria-label="Table view"
                  className={view === "table" ? "selected" : ""}
                  onClick={() => setView("table")}
                >
                  <List size={16} />
                </button>
                <button
                  aria-label="Kanban view"
                  className={view === "board" ? "selected" : ""}
                  onClick={() => setView("board")}
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
        {filters && (
          <div className="filter-bar">
            <label>
              Sort by
              <select
                className="compact-select"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                {sorts[kind].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="sort-order"
              onClick={() => {
                setOrder(order === "asc" ? "desc" : "asc");
                setPage(1);
              }}
            >
              <ArrowDownUp size={14} />
              {order === "asc" ? "Ascending" : "Descending"}
            </button>
            {kind === "clients" && (
              <label>
                Tag
                <select
                  className="compact-select"
                  value={tag}
                  onChange={(e) => {
                    setTag(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All tags</option>
                  {tags.data?.map((t) => (
                    <option key={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
            )}
            {kind === "tasks" && (
              <>
                <label>
                  Priority
                  <select
                    className="compact-select"
                    value={priority}
                    onChange={(e) => {
                      setPriority(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All priorities</option>
                    {["Low", "Medium", "High"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={overdue}
                    onChange={(e) => {
                      setOverdue(e.target.checked);
                      setPage(1);
                    }}
                  />
                  Overdue only
                </label>
              </>
            )}
            {clientId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  params.delete("client_id");
                  setParams(params);
                  setPage(1);
                }}
              >
                Clear client filter
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatus("");
                setTag("");
                setPriority("");
                setOverdue(false);
                setSort("created_at");
                setOrder("desc");
                setPage(1);
              }}
            >
              Reset filters
            </Button>
          </div>
        )}
        {view === "board" && kind === "deals" ? (
          <div className="kanban-board">
            {(status ? [status] : statuses.deals).map((s) => (
              <KanbanColumn
                key={`${s}:${debounced}:${clientId || ""}`}
                status={s}
                q={debounced}
                clientId={clientId}
                onEdit={edit}
                onNew={() => {
                  setEditing(null);
                  setFormDefaults({ status: s });
                  setForm(true);
                }}
              />
            ))}
          </div>
        ) : query.loading ? (
          <Loading />
        ) : query.error ? (
          <ErrorState message={query.error} retry={query.refetch} />
        ) : !query.data?.items.length ? (
          <Empty
            title={
              debounced || status || tag || priority || overdue
                ? "No matches this time"
                : `A home for your ${kind}`
            }
            description={
              debounced || status || tag || priority || overdue
                ? "Try another search or adjust your filters."
                : `Add your first ${singular[kind]} and start making things happen.`
            }
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormDefaults({});
                  setForm(true);
                }}
              >
                <Plus />
                New {singular[kind]}
              </Button>
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      {kind === "clients" || kind === "leads"
                        ? "Name"
                        : kind === "deals"
                          ? "Deal"
                          : "Task"}
                    </th>
                    {kind === "clients" ? (
                      <>
                        <th>Company</th>
                        <th>Tags</th>
                        <th>Last interaction</th>
                      </>
                    ) : kind === "leads" ? (
                      <>
                        <th>Source</th>
                        <th>Est. value</th>
                        <th>Status</th>
                      </>
                    ) : kind === "deals" ? (
                      <>
                        <th>Client</th>
                        <th>Value</th>
                        <th>Status</th>
                        <th>Expected close</th>
                      </>
                    ) : (
                      <>
                        <th>Related to</th>
                        <th>Due date</th>
                        <th>Priority</th>
                        <th>Status</th>
                      </>
                    )}
                    <th className="actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="record-name">
                          {kind === "clients" || kind === "leads" ? (
                            <Avatar name={recordName(r)} />
                          ) : kind === "tasks" ? (
                            <button
                              aria-label={`${r.status === "Completed" ? "Reopen" : "Complete"} ${r.title}`}
                              className={`task-checkbox ${r.status === "Completed" ? "checked" : ""}`}
                              onClick={() => complete(r)}
                            >
                              {r.status === "Completed" && (
                                <CheckCircle2 size={15} />
                              )}
                            </button>
                          ) : (
                            <span className="deal-table-icon">
                              <BriefcaseBusiness size={16} />
                            </span>
                          )}
                          <div>
                            {kind === "clients" ? (
                              <Link to={`/clients/${r.id}`}>
                                {recordName(r)}
                              </Link>
                            ) : (
                              <button
                                className="text-link"
                                onClick={() => setDetail(r)}
                              >
                                {recordName(r)}
                              </button>
                            )}
                            <small>
                              {r.email ||
                                (kind === "deals"
                                  ? r.description?.slice(0, 45)
                                  : kind === "tasks"
                                    ? r.description?.slice(0, 45)
                                    : r.company) ||
                                "No additional details"}
                            </small>
                          </div>
                        </div>
                      </td>
                      {kind === "clients" ? (
                        <>
                          <td>{r.company || "—"}</td>
                          <td>
                            <div className="tags">
                              {r.tags?.length
                                ? r.tags.map((t) => <span key={t}>{t}</span>)
                                : "—"}
                            </div>
                          </td>
                          <td>{dateLabel(r.last_interaction_at)}</td>
                        </>
                      ) : kind === "leads" ? (
                        <>
                          <td>{r.source || "—"}</td>
                          <td className="numeric">
                            {money(r.estimated_value)}
                          </td>
                          <td>
                            <Badge>{r.status}</Badge>
                          </td>
                        </>
                      ) : kind === "deals" ? (
                        <>
                          <td>{r.client_name || "Unassigned"}</td>
                          <td className="numeric">{money(r.value)}</td>
                          <td>
                            <Badge>{r.status}</Badge>
                          </td>
                          <td>{dateLabel(r.expected_close_date)}</td>
                        </>
                      ) : (
                        <>
                          <td>{r.client_name || r.deal_title || "—"}</td>
                          <td>
                            <span
                              className={
                                r.due_date &&
                                r.due_date < today() &&
                                r.status !== "Completed"
                                  ? "overdue"
                                  : ""
                              }
                            >
                              {dateLabel(r.due_date)}
                              {r.due_date &&
                                r.due_date < today() &&
                                r.status !== "Completed" && (
                                  <small className="overdue block">
                                    Overdue
                                  </small>
                                )}
                            </span>
                          </td>
                          <td>
                            <Badge>{r.priority}</Badge>
                          </td>
                          <td>
                            <Badge>{r.status}</Badge>
                          </td>
                        </>
                      )}
                      <td>
                        <div className="row-actions">
                          {kind === "leads" && !r.converted_at && (
                            <button
                              aria-label={`Convert ${recordName(r)} to client`}
                              title="Convert to client"
                              onClick={() => setConverting(r)}
                            >
                              <ArrowUpRight size={15} />
                            </button>
                          )}
                          <button
                            aria-label={`Edit ${recordName(r)}`}
                            title="Edit"
                            onClick={() => edit(r)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="delete-action"
                            aria-label={`Delete ${recordName(r)}`}
                            title="Delete"
                            onClick={() => setDeleting(r)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Showing {(page - 1) * 10 + 1}–
                {Math.min(page * 10, query.data.total)} of {query.data.total}{" "}
                {kind}
              </span>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <span>
                  Page {page} of {Math.max(1, Math.ceil(query.data.total / 10))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 10 >= query.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
      <p className="resource-note">
        <span className="status-dot" />
        Private to your account. Changes are saved securely to your workspace.
      </p>
      <RecordForm
        kind={kind}
        record={editing}
        open={form}
        onClose={() => setForm(false)}
        defaults={{
          ...formDefaults,
          ...(clientId ? { client_id: clientId } : {}),
        }}
      />
      <Confirm
        open={!!deleting}
        onOpenChange={(v) => {
          if (!v) setDeleting(null);
        }}
        title={`Delete this ${singular[kind]}?`}
        description={`“${deleting ? recordName(deleting) : ""}” will be permanently deleted.${kind === "clients" ? " Associated deals and tasks will be kept without a client." : ""} This cannot be undone.`}
        onConfirm={remove}
        busy={busy}
      />
      <Modal
        open={!!converting}
        onOpenChange={(v) => {
          if (!v && !busy) setConverting(null);
        }}
        title="A new relationship starts here"
        description={`Convert ${converting?.name} into a client. Contact details and notes will be carried over, and this lead will be marked converted.`}
      >
        <div className="modal-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setConverting(null)}
          >
            Cancel
          </Button>
          <Button disabled={busy} onClick={convert}>
            {busy ? "Converting…" : "Convert to client"}
            <ArrowRight />
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
        title={detail ? recordName(detail) : "Details"}
        description={`Created ${dateLabel(detail?.created_at)}`}
      >
        <dl className="detail-grid">
          {detail &&
            Object.entries(detail)
              .filter(
                ([k, v]) =>
                  !["id", "created_at", "updated_at", "closed_at"].includes(
                    k,
                  ) &&
                  !k.endsWith("_id") &&
                  v &&
                  typeof v !== "object",
              )
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k.replaceAll("_", " ")}</dt>
                  <dd>
                    {["value", "estimated_value"].includes(k)
                      ? money(Number(v))
                      : String(v)}
                  </dd>
                </div>
              ))}
        </dl>
        <div className="modal-actions">
          <Button
            variant="outline"
            onClick={() => {
              if (detail) edit(detail);
              setDetail(null);
            }}
          >
            <Pencil />
            Edit details
          </Button>
        </div>
      </Modal>
    </>
  );
}
function KanbanColumn({
  status,
  q,
  clientId,
  onEdit,
  onNew,
}: {
  status: string;
  q: string;
  clientId: string | null;
  onEdit: (r: CRMRecord) => void;
  onNew: () => void;
}) {
  const [page, setPage] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const query = useQuery<Page<CRMRecord>>(
    `/deals?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}&page=${page}&page_size=20${clientId ? `&client_id=${clientId}` : ""}`,
  );
  async function move(id: string, next: string) {
    setBusy(true);
    try {
      await send(`/deals/${id}/status`, "PATCH", { status: next });
      invalidate();
      toast.success(`Deal moved to ${next}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`kanban-column ${dragging ? "drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id && !busy) move(id, status);
      }}
    >
      <div className="kanban-heading">
        <span>
          <Badge>{status}</Badge>
          <small>{query.data?.total || 0}</small>
        </span>
        <button onClick={onNew} aria-label={`Add deal from ${status} column`}>
          <Plus size={16} />
        </button>
      </div>
      {busy && <p className="muted text-xs">Saving move…</p>}
      {query.loading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState message={query.error} retry={query.refetch} />
      ) : !query.data?.items.length ? (
        <div className="kanban-empty">
          Drop a deal here
          <br />
          <small>or create a new opportunity</small>
        </div>
      ) : (
        query.data.items.map((r) => (
          <article
            key={r.id}
            className="kanban-card"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
          >
            <button className="kanban-title" onClick={() => onEdit(r)}>
              {r.title}
              <ArrowUpRight size={13} />
            </button>
            <p>{r.client_name || "No client assigned"}</p>
            <strong>{money(r.value)}</strong>
            <div>
              <span>
                <CalendarDays size={12} />
                {dateLabel(r.expected_close_date)}
              </span>
            </div>
            <select
              aria-label={`Move ${r.title} to status`}
              className="kanban-status"
              value={r.status}
              disabled={busy}
              onChange={(e) => move(r.id, e.target.value)}
            >
              {statuses.deals.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </article>
        ))
      )}
      {query.data && query.data.total > 20 && (
        <div className="kanban-pagination">
          <Button
            size="sm"
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <small>
            {page} / {Math.ceil(query.data.total / 20)}
          </small>
          <Button
            size="sm"
            variant="ghost"
            disabled={page * 20 >= query.data.total}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
