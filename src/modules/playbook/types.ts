export type EntryType = "script" | "whatsapp";
export type Industry = "real_estate" | "edtech" | "telecalling" | "services" | "general";

export interface BuiltInEntry {
  id: string;
  type: EntryType;
  category: string;
  title: string;
  body: string;
  industry: Industry;
}
export interface OwnEntry {
  id: string;
  type: EntryType;
  category: string;
  title: string;
  body: string;
  updatedAt: string;
}
export interface Playbook {
  own: OwnEntry[];
  builtIn: BuiltInEntry[];
  industry: Industry;
  companyIndustry: string;
  /** The library this company reads: a finance company reads the insurance & loans one. */
  companyLibrary: Industry;
  industries: Industry[];
}
export type EntryInput = Pick<OwnEntry, "type" | "category" | "title" | "body">;

export const CATEGORY_LABEL: Record<string, string> = {
  opening: "Opening",
  discovery: "Questions",
  objection: "Objections",
  closing: "Closing",
  follow_up: "Follow-up",
  after_call: "After the call",
  missed_call: "Missed call",
  confirm: "Confirmation",
  details: "Details",
};
export const CATEGORIES: Record<EntryType, string[]> = {
  script: ["opening", "discovery", "objection", "closing", "follow_up"],
  whatsapp: ["after_call", "missed_call", "follow_up", "confirm", "details"],
};
export const INDUSTRY_LABEL: Record<Industry, string> = {
  real_estate: "Real estate",
  edtech: "Education",
  telecalling: "Insurance & loans",
  services: "Services",
  general: "Any business",
};
