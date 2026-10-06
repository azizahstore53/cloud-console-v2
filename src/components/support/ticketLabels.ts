export type TicketStatusValue = "OPEN" | "PENDING" | "RESOLVED";
export type ViewerMode = "customer" | "staff";

// OPEN = the ball is in staff's court, PENDING = it's in the customer's.
// The same status reads differently depending on who is looking.
export function statusLabel(status: TicketStatusValue, mode: ViewerMode): string {
  if (status === "RESOLVED") return "Selesai";
  if (mode === "staff") return status === "OPEN" ? "Perlu dibalas" : "Menunggu pelanggan";
  return status === "OPEN" ? "Menunggu balasan tim" : "Menunggu balasan Anda";
}

export function statusVariant(status: TicketStatusValue) {
  if (status === "OPEN") return "warning" as const;
  if (status === "PENDING") return "default" as const;
  return "success" as const;
}
