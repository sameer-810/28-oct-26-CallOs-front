export interface CallComment {
  id: string;
  callId: string;
  /** Seconds into the recording; null for a note on the whole call. */
  atSec: number | null;
  text: string;
  author: { id: string; name: string; role: "owner" | "manager" | "rep" | null };
  mine: boolean;
  createdAt: string;
}
