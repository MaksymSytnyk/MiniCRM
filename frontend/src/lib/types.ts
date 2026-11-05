export interface User {
  id: string;
  full_name: string;
  email: string;
  company: string;
  theme: "dark" | "light" | "system";
}
export type Kind = "clients" | "leads" | "deals" | "tasks";
export interface CRMRecord {
  id: string;
  created_at: string;
  updated_at: string;
  full_name?: string;
  name?: string;
  title?: string;
  email?: string | null;
  phone?: string;
  company?: string;
  notes?: string;
  tags?: string[];
  last_interaction_at?: string | null;
  source?: string;
  status?: string;
  estimated_value?: number;
  converted_client_id?: string | null;
  converted_at?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  value?: number;
  expected_close_date?: string | null;
  description?: string;
  due_date?: string | null;
  priority?: string;
  deal_id?: string | null;
  deal_title?: string | null;
  action?: string;
  entity_type?: string;
  entity_id?: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface Report {
  start: string;
  end: string;
  total_clients: number;
  new_clients: number;
  active_leads: number;
  total_deals: number;
  revenue: number;
  pipeline_value: number;
  pending_tasks: number;
  overdue_tasks: number;
  deal_conversion_rate: number;
  lead_conversion_rate: number;
  won_deals: number;
  converted_leads: number;
  total_leads: number;
  series: { month: string; label: string; revenue: number; clients: number }[];
  deals_by_status: { name: string; count: number; value: number }[];
}
export const statuses: Record<Kind, string[]> = {
  clients: [],
  leads: ["New", "Contacted", "Qualified", "Converted", "Lost"],
  deals: ["Open", "In Progress", "Won", "Lost"],
  tasks: ["Pending", "In Progress", "Completed"],
};
export const singular: Record<Kind, string> = {
  clients: "client",
  leads: "lead",
  deals: "deal",
  tasks: "task",
};
export const recordName = (r: CRMRecord) =>
  r.full_name || r.name || r.title || "Untitled";
