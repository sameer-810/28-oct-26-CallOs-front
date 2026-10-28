export type Role = "owner" | "manager" | "rep";

export type Industry =
  | "real_estate"
  | "edtech"
  | "telecalling"
  | "services"
  | "technology"
  | "healthcare"
  | "finance"
  | "retail"
  | "manufacturing"
  | "telecommunications"
  | "other";

/** The order people scan the list in: the industries call-heavy sales teams are in, first. */
export const INDUSTRIES: Industry[] = [
  "real_estate",
  "edtech",
  "telecalling",
  "services",
  "technology",
  "healthcare",
  "finance",
  "retail",
  "manufacturing",
  "telecommunications",
  "other",
];

export interface AuthUser {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Disposition {
  key: string;
  label: string;
  tone: string;
  fixed: boolean;
}

export interface WorkingHours {
  start: string;
  end: string;
  breakMinutes: number;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
}

export interface Subscription {
  plan: "trial" | "starter" | "growth";
  /** trialing · active · past_due (ended, in the grace days) · expired */
  status: "trialing" | "active" | "past_due" | "expired";
  daysLeft: number;
  endsAt: string | null;
  seats: number | null;
  insights: boolean;
}

export interface Company {
  id: string;
  name: string;
  industry: Industry;
  /** Only owners and managers receive it. */
  code: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  timezone: string;
  workingHours: WorkingHours;
  dispositions: Disposition[];
  afterCallPopup: boolean;
  /** The company's Twilio number, for caller ID and inbound calls. */
  telephonyNumber: string | null;
  subscription: Subscription;
  // owner only
  teamSize?: string | null;
  website?: string;
  gstin?: string;
  address?: { line: string; city: string; state: string; country: string; pin: string };
  dailyReport?: { enabled: boolean; formats: ("pdf" | "xlsx")[]; recipients: string[]; days: number[] };
}

export interface SessionPayload {
  user: AuthUser;
  company: Company;
  accessToken: string;
  refreshToken: string;
}

export const INDUSTRY_LABEL: Record<Industry, string> = {
  real_estate: "Real estate",
  edtech: "Education",
  telecalling: "Insurance & loans",
  services: "Services",
  technology: "Technology",
  healthcare: "Healthcare",
  finance: "Finance",
  retail: "Retail",
  manufacturing: "Manufacturing",
  telecommunications: "Telecommunications",
  other: "Other",
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  rep: "Rep",
};
