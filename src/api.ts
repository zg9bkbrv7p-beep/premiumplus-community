import type { Plan } from "../shared/geometry";
import type { ProposalData } from "../shared/proposal";
let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
    },
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw Object.assign(Error(data.error || "Request failed"), {
      status: res.status,
    });
  if (data.csrf) csrf = data.csrf;
  return data;
}
export type Proposal = ProposalData & {
  id: string;
  projectId: string;
  revision: number;
  status: "draft" | "shared" | "accepted";
};
export type Agreement = {
  id: string;
  name: string;
  acceptedAt: string;
  sha256: string;
  total: number;
  snapshot: any;
};
export type Project = {
  id: string;
  name: string;
  address: string;
  description: string;
  revision: number;
  plan: Plan;
  image: string;
  previewPhoto?: {id:string;name:string;imageUrl:string}|null;
  createdAt: string;
  updatedAt: string;
  accepted?: boolean;
  archivedAt?: string|null;
  deletedAt?: string|null;
  canArchive?: boolean;
  status?: 'draft'|'active'|'completed';
  pendingHomeownerDecisions?: number;
  photoCount?: number;
  draftProposalCount?: number;
  latestProposalStatus?: 'draft'|'shared'|'accepted'|null;
  startDate?: string|null;
  adjustedEndDate?: string|null;
  proposalCount?: number;
  proposals?: Proposal[];
  agreements?: Agreement[];
  shares?: any[];
  comments?: any[];
  events?: any[];
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n / 100);
export const date = (s: string) =>
  new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
