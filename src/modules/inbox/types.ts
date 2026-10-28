export interface Notice {
  id: string;
  kind: "call_comment";
  callId: string | null;
  commentId: string | null;
  /** Where in the recording the comment is; opening it starts there. */
  atSec: number | null;
  actorName: string;
  subject: string;
  text: string;
  readAt: string | null;
  createdAt: string;
}
