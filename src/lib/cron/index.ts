import { checkVpnServersHeartbeat } from "./vpnHeartbeat";
import { generateMonthlyInvoices } from "./billing/usageInvoicing";
import { CronJob } from "cron";

/**
 * In a real production environment, this would be a separate worker process
 * or a managed cron service (like GitHub Actions, Vercel Cron, or a Linux systemd timer).
 */
export function initCronJobs() {
  console.log("[Cron] Initializing system cron jobs...");

  // Check VPN Health every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await checkVpnServersHeartbeat();
    } catch (error) {
      console.error("[Cron] Error running vpnHeartbeat:", error);
    }
  });

  // Generate Monthly Invoices on the 1st of every month at 00:00
  cron.schedule("0 0 1 * *", async () => {
    try {
      await generateMonthlyInvoices();
    } catch (error) {
      console.error("[Cron] Error running generateMonthlyInvoices:", error);
    }
  });
}
