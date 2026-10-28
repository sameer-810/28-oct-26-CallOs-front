import type { Industry } from "@modules/auth/types";

/**
 * The company record itself lives in auth/types: it arrives with the session
 * and every module reads it from there. This module only changes it.
 */
export interface CompanyUpdate {
  name?: string;
  industry?: Industry;
}
