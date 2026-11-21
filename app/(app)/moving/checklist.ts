export type Step = { key: string; label: string; who: "OWNER" | "OFFICE" };
export const CHECKLIST: Record<string, Step[]> = {
  MOVE_IN: [
    { key: "request", label: "Send the move-in request", who: "OWNER" },
    { key: "ids", label: "Upload tenant IDs and lease contract (if leased)", who: "OWNER" },
    { key: "bond", label: "Pay the ₱5,000 refundable move bond", who: "OWNER" },
    { key: "approve", label: "Admin approves and reserves the service elevator", who: "OFFICE" },
    { key: "pass", label: "Gate pass sent for the movers", who: "OFFICE" },
    { key: "cards", label: "Get access cards and parking sticker at the admin office", who: "OWNER" },
  ],
  MOVE_OUT: [
    { key: "request", label: "Send the move-out request", who: "OWNER" },
    { key: "clear", label: "Settle dues and utilities (we check this for you)", who: "OFFICE" },
    { key: "approve", label: "Admin approves and reserves the service elevator", who: "OFFICE" },
    { key: "pass", label: "Gate pass sent for the movers", who: "OFFICE" },
    { key: "inspect", label: "Unit inspection with the engineer", who: "OFFICE" },
    { key: "return", label: "Return access cards; move bond refunded", who: "OWNER" },
  ],
  RENOVATION: [
    { key: "request", label: "Send the renovation request with scope of work", who: "OWNER" },
    { key: "plans", label: "Upload plans and contractor's details", who: "OWNER" },
    { key: "bond", label: "Pay the ₱20,000 refundable renovation bond", who: "OWNER" },
    { key: "approve", label: "Engineer reviews and approves", who: "OFFICE" },
    { key: "pass", label: "Worker passes issued (Mon-Sat, 8 AM-5 PM only)", who: "OFFICE" },
    { key: "inspect", label: "Final inspection; bond refunded", who: "OFFICE" },
  ],
};
export const KIND_LABEL: Record<string, string> = { MOVE_IN: "Move in", MOVE_OUT: "Move out", RENOVATION: "Renovation" };
