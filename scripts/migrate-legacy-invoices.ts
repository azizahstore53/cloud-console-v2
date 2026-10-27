import { prisma } from "../src/lib/prisma";
import { InvoiceStatus, TransactionType } from "@prisma/client";

async function migrateInvoices() {
  console.log("🚀 Starting Invoice Migration for legacy transactions...");

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        invoiceId: null, // Only process transactions without an invoice
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`Found ${transactions.length} transactions without invoices.`);

    let createdCount = 0;

    for (const tx of transactions) {
      try {
        // 1. Create a basic invoice for this transaction
        // We assume a simple 1-item invoice for legacy data
        const invoice = await prisma.invoice.create({
          data: {
            userId: tx.userId,
            invoiceNumber: `INV-LEGACY-${tx.id.slice(0, 8).toUpperCase()}`,
            status: tx.status === "SUCCESS" ? "PAID" : "PENDING",
            subtotal: Math.abs(tx.amount),
            tax: 0,
            total: Math.abs(tx.amount),
            currency: "IDR",
            dueDate: new Date(tx.createdAt),
            paidAt: tx.status === "SUCCESS" ? tx.createdAt : null,
            items: {
              create: [
                {
                  description: tx.description || `${tx.type} Transaction`,
                  quantity: 1,
                  unitPrice: Math.abs(tx.amount),
                  amount: Math.abs(tx.amount),
                },
              ],
            },
          },
        });

        // 2. Link the transaction to the new invoice
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { invoiceId: invoice.id },
        });

        createdCount++;
      } catch (err) {
        console.error(`Failed to migrate transaction ${tx.id}:`, err);
      }
    }

    console.log(`✅ Migration completed. Created ${createdCount} invoices.`);
  } catch (error) {
    console.error("Critical error during migration:", error);
  }
}

migrateInvoices()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
