import { apiClient } from "./apiClient";

/** Someone whose calls the viewer may filter by: a rep sees only themself. */
export interface Person {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

export const peopleApi = Object.freeze({
  list: async () => (await apiClient.get<{ data: Person[] }>("/calls/people")).data.data,
});
