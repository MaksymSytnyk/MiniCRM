import { AlertCircle, ArrowUpRight, Inbox, Loader2 } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "./ui/button";
import { cn, initials } from "@/lib/utils";
import type { ReactNode } from "react";
export function Loading() {
  return (
    <div className="loading" role="status">
      <Loader2 className="animate-spin" size={22} />
      <span>Loading your workspace…</span>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="empty-state" role="alert">
      <AlertCircle />
      <h3>Something needs attention</h3>
      <p>{message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title = "A fresh start",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Inbox size={23} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const label = String(children);
  return (
    <span
      className={cn("badge", {
        "badge-green": ["Won", "Completed", "Converted", "Qualified"].includes(
          label,
        ),
        "badge-violet": ["In Progress", "Contacted"].includes(label),
        "badge-red": ["Lost", "High", "Overdue"].includes(label),
        "badge-yellow": ["Medium", "Pending"].includes(label),
      })}
    >
      <span />
      {children}
    </span>
  );
}
export function Avatar({
  name,
  size = "normal",
}: {
  name: string;
  size?: "normal" | "small" | "large";
}) {
  return <span className={cn("avatar", size)}>{initials(name)}</span>;
}
export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function ViewAll({
  to,
  children = "View all",
}: {
  to: string;
  children?: ReactNode;
}) {
  return (
    <Link className="view-all" to={to}>
      {children}
      <ArrowUpRight size={14} />
    </Link>
  );
}
