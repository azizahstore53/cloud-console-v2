import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/telegramClient";
import { sendMail } from "@/lib/email/mailer";

/**
 * ticketNotifications
 * ---------------------------------------------------------------------------
 * Side effects only — no state changes, nothing the ticket flow depends on
 * to function. Called from the API routes right after ticketService does
 * the real write, and each function fails closed (catches its own errors)
 * so a broken SMTP/Telegram config never turns a successful reply into a
 * 500 for the user sending it.
 *
 * Both channels are optional and independently configured:
 *   - Telegram: TELEGRAM_SUPPORT_CHAT_ID (falls back to TELEGRAM_ADMIN_CHAT_ID
 *     so existing setups from the News bot don't need a second chat id just
 *     to get ticket alerts — split them later once ticket volume justifies
 *     a dedicated channel/group).
 *   - Email: reuses the same SMTP config as password-reset emails.
 * If neither is configured, both functions no-op silently — tickets still
 * work, staff just rely on the in-app badge instead.
 */

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

// Telegram's Markdown mode treats these as formatting characters — escape
// them so a ticket subject/message containing e.g. "_" or "*" (very likely
// in real support text: "cannot ssh_connect", "disk 100% full") doesn't
// silently mangle the notification's layout.
function escapeTelegramMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

// The subject is free-text from the customer and gets interpolated into an
// HTML email — escape it so it can't break the layout or, worse, execute
// as markup in an HTML-rendering mail client.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Called after a customer creates a ticket or adds a message to one. */
export async function notifyStaffOfCustomerMessage(ticketId: string): Promise<void> {
  const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID ?? process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) return;

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        subject: true,
        customer: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
      },
    });
    if (!ticket) return;

    const who = escapeTelegramMarkdown(ticket.customer.name ?? ticket.customer.email);
    const subject = escapeTelegramMarkdown(ticket.subject);
    const preview = escapeTelegramMarkdown((ticket.messages[0]?.body ?? "").slice(0, 300));

    await sendTelegramMessage(
      chatId,
      `🎫 *Tiket dari ${who}*\n${subject}\n\n${preview}\n\n${appUrl(`/admin/support/${ticketId}`)}`
    );
  } catch (err) {
    console.error("[ticketNotifications] Failed to notify staff via Telegram:", err);
  }
}

/** Called after a staff member replies to a ticket. */
export async function notifyCustomerOfStaffReply(ticketId: string): Promise<void> {
  if (!process.env.SMTP_HOST) return; // email not configured — skip quietly

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { subject: true, customer: { select: { email: true, name: true } } },
    });
    if (!ticket) return;

    const url = appUrl(`/support/${ticketId}`);
    const greeting = ticket.customer.name ? `Halo ${ticket.customer.name},` : "Halo,";

    await sendMail({
      to: ticket.customer.email,
      subject: `Balasan tiket: ${ticket.subject}`,
      text: `${greeting}\n\nTim support membalas tiket Anda "${ticket.subject}".\n\nBuka tiket: ${url}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="margin-bottom: 4px;">Ada balasan baru</h2>
          <p style="color: #555;">${greeting} Tim support membalas tiket Anda:</p>
          <p style="font-weight: 600;">${escapeHtml(ticket.subject)}</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${url}"
               style="background: #111827; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Lihat Balasan
            </a>
          </p>
          <p style="color: #aaa; font-size: 12px; word-break: break-all;">Atau salin link ini: ${url}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[ticketNotifications] Failed to email customer:", err);
  }
}
