import { prisma } from "@/lib/prisma";
import { InvoiceStatus, TransactionType } from "@prisma/client";
import crypto from "crypto";

export async function generateMonthlyInvoices() {
  console.log("[Cron] Starting Monthly Usage Invoicing...");

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 1. Find all users who have USAGE_CHARGE transactions this month
  const usersWithUsage = await prisma.transaction.findMany({
    where: {
      type: TransactionType.USAGE_CHARGE,
      createdAt: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth,
      },
    },
    select: { userId: true },
  });

  const uniqueUserIds = [...new Set(usersWithUsage.map(t => t.userId))];
  let totalInvoicesCreated = 0;

  for (const userId of uniqueUserIds) {
    try {
      // 2. Aggregate usage for this user
      const usageTransactions = await prisma.transaction.findMany({
        where: {
          userId,
          type: TransactionType.USAGE_CHARGE,
          createdAt: {
            gte: firstDayOfMonth,
            lte: lastDayOfMonth,
          },
        },
      });

      const totalAmount = usageTransactions.reduce((sum, tx) => sum + tx.amount, 0);

      if (totalAmount === 0) continue;

      // 3. Create a formal Invoice
      const invoiceNumber = `INV-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      await prisma.invoice.create({
        data: {
          userId,
          invoiceNumber,
          status: InvoiceStatus.PENDING,
          subtotal: totalAmount,
          tax: 0, // Can be added if needed
          total: totalAmount,
          dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 5), // Due by 5th of next month
          items: {
            create: [
              {
                description: `Monthly VPN Usage Charge (${firstDayOfMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })})`,
                quantity: 1,
                unitPrice: totalAmount,
                amount: totalAmount,
              }
            ]
          }
        }
      });

      totalInvoicesCreated++;
    } catch (error) {
      console.error(`[Cron] Failed to generate invoice for user ${userId}:`, error);
    }
  }

  console.log(`[Cron] Monthly Invoicing completed. Created ${totalInvoicesCreated} invoices.`);
  return { success: true, count: totalInvoicesCreated };
}
