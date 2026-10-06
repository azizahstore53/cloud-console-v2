/**
 * telegramClient
 * ---------------------------------------------------------------------------
 * Minimal wrapper around the Telegram Bot API (https://core.telegram.org/bots/api).
 * Intentionally small — just what the news bot needs (send a message,
 * optionally with inline buttons, and acknowledge a button press).
 */

const BASE_URL = "https://api.telegram.org";

function apiUrl(method: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  return `${BASE_URL}/bot${token}/${method}`;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: { buttons?: InlineButton[][] }
) {
  const res = await fetch(apiUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...(options?.buttons ? { reply_markup: { inline_keyboard: options.buttons } } : {}),
    }),
  });
  if (!res.ok) {
    // Don't throw here — a failed Telegram notification shouldn't roll back
    // work that already succeeded (e.g. the article was saved fine, we just
    // couldn't tell the admin about it). Log and move on.
    console.error("Failed to send Telegram message:", await res.text().catch(() => res.status));
  }
}

/** Dismisses the little loading spinner Telegram shows on a tapped button. */
export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(apiUrl("answerCallbackQuery"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {});
}
