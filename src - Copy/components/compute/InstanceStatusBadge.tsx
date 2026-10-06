import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InstanceStatus } from "@prisma/client";

const STATUS_CONFIG: Record<InstanceStatus, { label: string; className: string }> = {
  PROVISIONING: { label: "Provisioning", className: "bg-warning/15 text-warning border-warning/30" },
  RUNNING: { label: "Running", className: "bg-success/15 text-success border-success/30" },
  STOPPED: { label: "Stopped", className: "bg-muted text-muted-foreground border-border" },
  REBOOTING: { label: "Rebooting", className: "bg-warning/15 text-warning border-warning/30" },
  TERMINATING: { label: "Terminating", className: "bg-destructive/15 text-destructive border-destructive/30" },
  TERMINATED: { label: "Terminated", className: "bg-muted text-muted-foreground border-border" },
  ERROR: { label: "Error", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function InstanceStatusBadge({ status }: { status: InstanceStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5", config.className)}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "RUNNING" && "bg-success animate-pulse",
          status === "PROVISIONING" || status === "REBOOTING" ? "bg-warning animate-pulse" : "",
          status === "STOPPED" || status === "TERMINATED" ? "bg-muted-foreground" : "",
          (status === "TERMINATING" || status === "ERROR") && "bg-destructive"
        )}
      />
      {config.label}
    </Badge>
  );
}
