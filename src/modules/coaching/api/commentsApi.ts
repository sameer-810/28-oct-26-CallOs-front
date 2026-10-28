import { apiClient } from "@api/apiClient";
import type { CallComment } from "../types";

export interface CommentBody {
  text: string;
  atSec: number | null;
}

export const commentsApi = Object.freeze({
  list: async (callId: string) => (await apiClient.get<{ data: CallComment[] }>(`/calls/${callId}/comments`)).data.data,
  add: async (callId: string, body: CommentBody) => (await apiClient.post<{ data: CallComment }>(`/calls/${callId}/comments`, body)).data.data,
  remove: async (callId: string, id: string) => {
    await apiClient.delete(`/calls/${callId}/comments/${id}`);
  },
});
