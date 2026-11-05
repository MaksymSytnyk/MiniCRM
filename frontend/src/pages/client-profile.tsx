import { useState } from "react";
import { useParams, Link } from "@/lib/router";
import {
  ArrowLeft,
  Pencil,
  Mail,
  Phone,
  Building2,
  CalendarDays,
  Plus,
  BriefcaseBusiness,
  CheckSquare,
  ArrowUpRight,
} from "lucide-react";
import { useQuery } from "@/lib/hooks";
import type { CRMRecord, Page, Kind } from "@/lib/types";
import { money, dateLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RecordForm } from "@/components/record-form";
import {
  Loading,
  ErrorState,
  Avatar,
  Badge,
  SectionHeading,
  Empty,
  ViewAll,
} from "@/components/shared";
export function ClientProfile() {
  const { id } = useParams();
  const query = useQuery<CRMRecord>(`/clients/${id}`);
  const deals = useQuery<Page<CRMRecord>>(`/deals?client_id=${id}&page_size=5`);
  const tasks = useQuery<Page<CRMRecord>>(`/tasks?client_id=${id}&page_size=5`);
  const [form, setForm] = useState<Kind | null>(null);
  if (query.loading) return <Loading />;
  if (query.error)
    return <ErrorState message={query.error} retry={query.refetch} />;
  const c = query.data!;
  return (
    <>
      <Link to="/clients" className="back-link">
        <ArrowLeft size={15} />
        Back to clients
      </Link>
      <div className="profile-heading">
        <Avatar name={c.full_name || ""} size="large" />
        <div>
          <h1>{c.full_name}</h1>
          <p>{c.company || "Independent client"}</p>
          <div className="tags">
            {c.tags?.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <Button variant="outline" onClick={() => setForm("clients")}>
          <Pencil />
          Edit client
        </Button>
      </div>
      <div className="client-profile-grid">
        <section className="panel contact-panel">
          <SectionHeading title="Client details" />
          <div className="contact-item">
            <Mail size={16} />
            <span>
              <small>Email address</small>
              {c.email ? (
                <a href={`mailto:${c.email}`}>{c.email}</a>
              ) : (
                "Not provided"
              )}
            </span>
          </div>
          <div className="contact-item">
            <Phone size={16} />
            <span>
              <small>Phone number</small>
              {c.phone ? (
                <a href={`tel:${c.phone}`}>{c.phone}</a>
              ) : (
                "Not provided"
              )}
            </span>
          </div>
          <div className="contact-item">
            <Building2 size={16} />
            <span>
              <small>Company</small>
              {c.company || "Not provided"}
            </span>
          </div>
          <div className="contact-item">
            <CalendarDays size={16} />
            <span>
              <small>Client since</small>
              {dateLabel(c.created_at)}
            </span>
          </div>
          <div className="contact-item">
            <CalendarDays size={16} />
            <span>
              <small>Last interaction</small>
              {dateLabel(c.last_interaction_at)}
            </span>
          </div>
          <div className="client-notes">
            <h3>Notes</h3>
            <p>
              {c.notes ||
                "A little context goes a long way. Add notes to remember what matters."}
            </p>
          </div>
        </section>
        <div className="client-relations">
          <section className="panel">
            <SectionHeading
              title={`Deals${deals.data ? ` · ${deals.data.total}` : ""}`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setForm("deals")}
                >
                  <Plus />
                  Add deal
                </Button>
              }
            />
            {deals.error ? (
              <ErrorState message={deals.error} retry={deals.refetch} />
            ) : deals.loading ? (
              <Loading />
            ) : !deals.data?.items.length ? (
              <Empty
                title="Room for opportunity"
                description="Create a deal to start tracking work with this client."
              />
            ) : (
              <div className="related-list">
                {deals.data.items.map((d) => (
                  <Link
                    to={`/deals?q=${encodeURIComponent(d.title || "")}`}
                    key={d.id}
                  >
                    <span className="related-icon">
                      <BriefcaseBusiness size={18} />
                    </span>
                    <span>
                      <strong>{d.title}</strong>
                      <small>{money(d.value)}</small>
                    </span>
                    <Badge>{d.status}</Badge>
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            )}
            <ViewAll to={`/deals?client_id=${id}`}>View all deals</ViewAll>
          </section>
          <section className="panel">
            <SectionHeading
              title={`Tasks${tasks.data ? ` · ${tasks.data.total}` : ""}`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setForm("tasks")}
                >
                  <Plus />
                  Add task
                </Button>
              }
            />
            {tasks.error ? (
              <ErrorState message={tasks.error} retry={tasks.refetch} />
            ) : tasks.loading ? (
              <Loading />
            ) : !tasks.data?.items.length ? (
              <Empty
                title="Nothing on the list yet"
                description="Add a follow-up or a next step for this client."
              />
            ) : (
              <div className="related-list">
                {tasks.data.items.map((t) => (
                  <Link
                    to={`/tasks?q=${encodeURIComponent(t.title || "")}`}
                    key={t.id}
                  >
                    <span className="related-icon">
                      <CheckSquare size={18} />
                    </span>
                    <span>
                      <strong>{t.title}</strong>
                      <small>{dateLabel(t.due_date)}</small>
                    </span>
                    <Badge>{t.status}</Badge>
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            )}
            <ViewAll to={`/tasks?client_id=${id}`}>View all tasks</ViewAll>
          </section>
        </div>
      </div>
      {form && (
        <RecordForm
          kind={form}
          record={form === "clients" ? c : null}
          defaults={{ client_id: c.id }}
          open={!!form}
          onClose={() => setForm(null)}
        />
      )}
    </>
  );
}
