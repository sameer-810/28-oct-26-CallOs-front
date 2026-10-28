import type { AuthUser } from "@modules/auth/types";

export type StatusFilter = "active" | "inactive" | "all";

export interface TeamQuery {
  search?: string;
  status?: StatusFilter;
}

/** A person as the Team list sees them: the account, plus their phone and last activity. */
export interface TeamMember extends AuthUser {
  registeredAt?: string;
  device?: { brand: string; model: string; appVersion: string } | null;
  lastCallAt?: string | null;
  lastRecordingAt?: string | null;
}

export interface TeamPage {
  items: TeamMember[];
  total: number;
}
