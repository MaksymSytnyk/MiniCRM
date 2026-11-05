import { useState } from "react";
import { Link } from "@/lib/router";
import {
  Users,
  Contact,
  BriefcaseBusiness,
  DollarSign,
  Plus,
  ArrowUpRight,
  Check,
  CheckSquare,
  ArrowRight,
  Clock3,
  Activity,
  Download,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/hooks";
import { type Report, type CRMRecord, type Page } from "@/lib/types";
import { money, dateLabel, today } from "@/lib/utils";
import { send, invalidate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Loading,
  ErrorState,
  Empty,
  Badge,
  SectionHeading,
  ViewAll,
} from "@/components/shared";
import { RevenueChart, ClientsChart, PipelineChart } from "@/components/charts";
import { DateRange, defaultRange } from "@/components/date-range";
import { RecordForm } from "@/components/record-form";
export function Dashboard({ analytics = false }: { analytics?: boolean }) {
  const { user } = useAuth();
  const [range, setRange] = useState(defaultRange);
  const [newTask, setNewTask] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const report = useQuery<Report>(
    `/analytics?start=${range.start}&end=${range.end}`,
  );
  const activity = useQuery<Page<CRMRecord>>("/activity?page_size=6");
  const tasks = useQuery<Page<CRMRecord>>(
    "/tasks?exclude_completed=true&sort=due_date&order=asc&page_size=6",
  );
  const pending =
    tasks.data?.items.filter((t) => t.status !== "Completed") || [];
  const d = report.data;
  async function complete(t: CRMRecord) {
    setCompleting(t.id);
    try {
      await send(`/tasks/${t.id}/status`, "PATCH", { status: "Completed" });
      invalidate();
      toast.success("Task completed. One less thing on your list.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCompleting(null);
    }
  }
  function exportData() {
    if (!d) return;
    const rows = [
      ["Month", "Revenue (USD)", "New clients"],
      ...d.series.map((r) => [r.month, r.revenue, r.clients]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folio-analytics-${range.start}-${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {analytics ? "THE BIG PICTURE" : "YOUR BUSINESS, IN FOCUS"}
          </div>
          <h1>
            {analytics
              ? "Analytics"
              : `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${user?.full_name.split(" ")[0] || "there"}`}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {analytics
              ? "Turn everyday progress into a clearer picture."
              : "Here’s what’s happening with your business today."}
          </p>
        </div>
        <div className="heading-actions">
          <DateRange value={range} onChange={setRange} />
          <Button
            onClick={analytics ? exportData : () => setNewTask(true)}
            disabled={analytics && !d}
          >
            {analytics ? <Download /> : <Plus />}
            {analytics ? "Export report" : "New task"}
          </Button>
        </div>
      </div>
      {report.error ? (
        <ErrorState message={report.error} retry={report.refetch} />
      ) : !d ? (
        <Loading />
      ) : (
        <>
          <div className="stats-grid">
            {(analytics
              ? [
                  {
                    label: "Total revenue",
                    value: money(d.revenue),
                    icon: DollarSign,
                    note: "Won deals closed in range",
                    color: "green",
                  },
                  {
                    label: "Deal win rate",
                    value: `${d.deal_conversion_rate}%`,
                    icon: BriefcaseBusiness,
                    note: `${d.won_deals} won · closed deals in cohort`,
                    color: "violet",
                  },
                  {
                    label: "Lead conversion",
                    value: `${d.lead_conversion_rate}%`,
                    icon: Contact,
                    note: `${d.converted_leads} converted · leads created in range`,
                    color: "blue",
                  },
                  {
                    label: "New clients",
                    value: d.new_clients,
                    icon: Users,
                    note: "Acquired in the selected range",
                    color: "amber",
                  },
                ]
              : [
                  {
                    label: "Total clients",
                    value: d.total_clients,
                    icon: Users,
                    note: `${d.new_clients} added in selected range`,
                    color: "violet",
                  },
                  {
                    label: "Active leads",
                    value: d.active_leads,
                    icon: Contact,
                    note: "New, contacted & qualified",
                    color: "blue",
                  },
                  {
                    label: "Total deals",
                    value: d.total_deals,
                    icon: BriefcaseBusiness,
                    note: "Created in selected range",
                    color: "amber",
                  },
                  {
                    label: "Total revenue",
                    value: money(d.revenue),
                    icon: DollarSign,
                    note: "Won deals closed in range",
                    color: "green",
                  },
                ]
            ).map((s) => (
              <article className="stat-card" key={s.label}>
                <div>
                  <span>{s.label}</span>
                  <span className={`stat-icon ${s.color}`}>
                    <s.icon size={17} />
                  </span>
                </div>
                <strong>{s.value}</strong>
                <small>
                  <span className={`tiny-dot ${s.color}`} />
                  {s.note}
                </small>
              </article>
            ))}
          </div>
          <div className="dashboard-charts">
            <section className="panel revenue-panel">
              <SectionHeading
                title="Revenue overview"
                description="A little perspective on your progress."
                action={
                  <span className="chart-key">
                    <i />
                    Revenue
                  </span>
                }
              />
              <div className="revenue-summary">
                <strong>{money(d.revenue)}</strong>
                <span>in the selected period</span>
              </div>
              <RevenueChart data={d.series} />
              <div className="panel-footnote">
                <span className="tiny-dot green" />
                Revenue is recognized when a deal is marked won.
              </div>
            </section>
            <section className="panel">
              <SectionHeading
                title="Deal pipeline"
                description="Every opportunity, at a glance."
                action={<ViewAll to="/deals" />}
              />
              <PipelineChart data={d.deals_by_status} />
              <div className="pipeline-total">
                <span>Active pipeline · all time</span>
                <strong>
                  {money(d.pipeline_value)}
                  <ArrowUpRight size={15} />
                </strong>
              </div>
            </section>
          </div>
          {analytics ? (
            <>
              <div className="analytics-bottom">
                <section className="panel">
                  <SectionHeading
                    title="Client acquisition"
                    description="New relationships, month by month."
                  />
                  <ClientsChart data={d.series} />
                </section>
                <section className="panel">
                  <SectionHeading
                    title="Deal performance"
                    description="Deals created in your selected date range."
                  />
                  <div className="performance-table">
                    <div>
                      <span>Status</span>
                      <span>Deals</span>
                      <span>Value</span>
                    </div>
                    {d.deals_by_status.map((s) => (
                      <div key={s.name}>
                        <Badge>{s.name}</Badge>
                        <strong>{s.count}</strong>
                        <strong>{money(s.value)}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <p className="metric-note">
                Win rate = won ÷ (won + lost). Lead conversion = converted ÷
                total leads. Both use records created in the selected range.
                Revenue uses each deal’s won date. All values are USD.
              </p>
            </>
          ) : (
            <>
              <div className="dashboard-bottom">
                <section className="panel activity-panel">
                  <SectionHeading
                    title="Recent activity"
                    description="The small steps that move things forward."
                    action={
                      <button
                        className="view-all"
                        onClick={activity.refetch}
                        aria-label="Refresh recent activity"
                      >
                        <RefreshCw size={14} />
                      </button>
                    }
                  />
                  {activity.loading && !activity.data ? (
                    <Loading />
                  ) : activity.error ? (
                    <ErrorState
                      message={activity.error}
                      retry={activity.refetch}
                    />
                  ) : !activity.data?.items.length ? (
                    <Empty
                      title="Your story starts here"
                      description="Add a client, a lead, or a deal. Your workspace activity will appear here."
                      action={
                        <Button asChild variant="outline" size="sm">
                          <Link to="/clients">
                            Add your first client
                            <ArrowRight />
                          </Link>
                        </Button>
                      }
                    />
                  ) : (
                    <div className="activity-list">
                      {activity.data.items.map((a) => (
                        <div key={a.id} className="activity-row">
                          <span
                            className={`activity-icon ${a.entity_type === "clients" ? "violet" : a.entity_type === "deals" ? "green" : a.entity_type === "tasks" ? "blue" : "amber"}`}
                          >
                            {a.entity_type === "clients" ? (
                              <UserPlus size={16} />
                            ) : a.entity_type === "deals" ? (
                              <BriefcaseBusiness size={16} />
                            ) : a.entity_type === "tasks" ? (
                              <CheckSquare size={16} />
                            ) : (
                              <Contact size={16} />
                            )}
                          </span>
                          <div>
                            <p>{a.description}</p>
                            <small>
                              {a.entity_type} · {dateLabel(a.created_at)}
                            </small>
                          </div>
                          <span className="activity-time">
                            {new Date(a.created_at).toLocaleTimeString(
                              "en-US",
                              { hour: "numeric", minute: "2-digit" },
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="panel tasks-panel">
                  <SectionHeading
                    title="Upcoming tasks"
                    description={`${d.pending_tasks} things to keep moving.`}
                    action={<ViewAll to="/tasks" />}
                  />
                  {tasks.loading && !tasks.data ? (
                    <Loading />
                  ) : tasks.error ? (
                    <ErrorState message={tasks.error} retry={tasks.refetch} />
                  ) : !pending.length ? (
                    <Empty
                      title="A little breathing room"
                      description="No upcoming tasks. Plan your next step whenever you’re ready."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNewTask(true)}
                        >
                          <Plus />
                          Add a task
                        </Button>
                      }
                    />
                  ) : (
                    <div className="upcoming-list">
                      {pending.slice(0, 4).map((t) => (
                        <div key={t.id} className="upcoming-row">
                          <button
                            className="task-checkbox"
                            aria-label={`Complete ${t.title}`}
                            onClick={() => complete(t)}
                            disabled={completing === t.id}
                          >
                            {completing === t.id && <Check size={12} />}
                          </button>
                          <Link
                            to={`/tasks?q=${encodeURIComponent(t.title || "")}`}
                          >
                            <strong>{t.title}</strong>
                            <span
                              className={
                                t.due_date && t.due_date < today()
                                  ? "overdue"
                                  : ""
                              }
                            >
                              <Clock3 size={12} />
                              {dateLabel(t.due_date)}
                              {t.client_name ? ` · ${t.client_name}` : ""}
                            </span>
                          </Link>
                          <Badge>{t.priority}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="task-summary">
                    <span>
                      <span className="tiny-dot yellow" />
                      {d.pending_tasks} pending
                    </span>
                    <Link
                      to="/tasks?overdue=true"
                      className={d.overdue_tasks ? "overdue" : ""}
                    >
                      {d.overdue_tasks} overdue
                      <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </section>
              </div>
              <section className="panel acquisition-strip">
                <div>
                  <span className="strip-icon">
                    <Users size={20} />
                  </span>
                  <h2>Good relationships. Steady growth.</h2>
                  <p>
                    {d.new_clients} new clients in the selected period. Keep
                    building what matters.
                  </p>
                </div>
                <ClientsChart data={d.series} />
                <ViewAll to="/analytics">Explore analytics</ViewAll>
              </section>
            </>
          )}
        </>
      )}
      <RecordForm
        kind="tasks"
        open={newTask}
        onClose={() => setNewTask(false)}
      />
    </>
  );
}
