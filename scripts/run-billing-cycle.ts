/**
 * Run the hourly usage billing cycle directly against the database.
 *
 * Intended for a system crontab entry on the VPS running this app, e.g.:
 *
 *   0 * * * * cd /path/to/cloud-console && /usr/bin/npm run billing:run >> /var/log/cloud-console-billing.log 2>&1
 *
 * This avoids exposing an HTTP endpoint at all for the common case of a
 * single long-running deployment. Use the `/api/cron/billing` route instead
 * only if your hosting setup can't run local cron (e.g. serverless).
 */
import { prisma } from "../src/lib/prisma";
import { runHourlyBillingCycle } from "../src/lib/billing/usageBillingJob";

async function main() {
  const startedAt = new Date();
  console.log(`[billing] Starting hourly billing cycle at ${startedAt.toISOString()}`);

  const summary = await runHourlyBillingCycle();

  console.log(`[billing] Processed ${summary.processed} instance(s), charged ${summary.totalCharged} total.`);
  if (summary.autoStopped.length > 0) {
    console.log(
      `[billing] Auto-stopped ${summary.autoStopped.length} instance(s) due to insufficient balance:`,
      summary.autoStopped.map((i) => `${i.name} (${i.instanceId})`).join(", ")
    );
  }
  if (summary.errors.length > 0) {
    console.error(`[billing] ${summary.errors.length} error(s) occurred:`, summary.errors);
  }

  console.log(`[billing] Done in ${Date.now() - startedAt.getTime()}ms.`);
}

main()
  .catch((err) => {
    console.error("[billing] Fatal error running billing cycle:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
