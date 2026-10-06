import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateNewsArticle } from "@/lib/ai/groqClient";
import { createNewsDraft } from "@/lib/news/newsService";
import { sendTelegramMessage, answerCallbackQuery } from "@/lib/telegram/telegramClient";

/**
 * Telegram webhook for the news bot.
 *
 * Register this URL once with Telegram (replace with your real domain and a
 * secret you generate yourself, e.g. `openssl rand -hex 32`):
 *
 *   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
 *     -d "url=https://<your-domain>/api/telegram/webhook" \
 *     -d "secret_token=<same value as TELEGRAM_WEBHOOK_SECRET>"
 *
 * Security model — this endpoint is publicly reachable by definition (it's
 * how Telegram's servers reach it), so it does NOT rely on session auth.
 * Two independent checks instead:
 *   1. `X-Telegram-Bot-Api-Secret-Token` header must match
 *      TELEGRAM_WEBHOOK_SECRET — proves the request came from Telegram (or
 *      at least someone who knows this secret), not an arbitrary caller.
 *   2. The Telegram chat_id of whoever sent the message/button-press must
 *      match TELEGRAM_ADMIN_CHAT_ID — proves it's specifically *you*, not
 *      some other person who found your bot. Anyone else's messages are
 *      silently ignored (not even replied to, so the bot doesn't leak that
 *      it exists / what it does to strangers).
 *
 * Commands supported (typed directly in the Telegram chat with your bot):
 *   /berita <topik>   — generate a draft article about <topik> via Groq
 */

function isFromAdmin(chatId: number | string | undefined): boolean {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  return !!adminChatId && String(chatId) === adminChatId;
}

function verifySecret(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  // timingSafeEqual throws if lengths differ, rather than returning false —
  // guard that explicitly so a wrong-length header doesn't 500 the request.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    // Deliberately vague — don't tell a prober whether the path or the
    // secret was the part that failed.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await req.json();

  if (update.message?.text) {
    await handleMessage(update.message);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }

  // Telegram only cares that we return 200 quickly — it does not read the
  // body. Returning non-200 makes Telegram retry the same update later.
  return NextResponse.json({ ok: true });
}

async function handleMessage(message: { chat: { id: number }; text: string }) {
  const chatId = message.chat.id;
  if (!isFromAdmin(chatId)) return;

  const text = message.text.trim();
  if (!text.startsWith("/berita")) {
    if (text.startsWith("/")) {
      await sendTelegramMessage(chatId, "Perintah tidak dikenal. Coba: `/berita <topik artikel>`");
    }
    return;
  }

  const topic = text.replace(/^\/berita/, "").trim();
  if (!topic) {
    await sendTelegramMessage(chatId, "Sertakan topiknya, contoh:\n`/berita VPS vs Shared Hosting`");
    return;
  }

  await sendTelegramMessage(chatId, `⏳ Membuat draft artikel tentang: _${topic}_...`);

  try {
    const generated = await generateNewsArticle(topic);
    const article = await createNewsDraft({
      title: generated.title,
      excerpt: generated.excerpt,
      content: generated.content,
      source: "AI_TELEGRAM",
      aiPrompt: topic,
    });

    await sendTelegramMessage(
      chatId,
      `✅ *${article.title}*\n\n${article.excerpt}\n\nStatus: DRAFT — belum tampil publik sampai kamu publish.`,
      {
        buttons: [
          [
            { text: "✅ Publish", callback_data: `publish:${article.id}` },
            { text: "🗑️ Buang", callback_data: `discard:${article.id}` },
          ],
        ],
      }
    );
  } catch (err) {
    console.error("Failed to generate news article via Groq:", err);
    await sendTelegramMessage(
      chatId,
      `❌ Gagal membuat artikel: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }
}

async function handleCallbackQuery(callbackQuery: {
  id: string;
  data?: string;
  message?: { chat: { id: number } };
}) {
  const chatId = callbackQuery.message?.chat.id;
  if (!isFromAdmin(chatId)) {
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  const [action, articleId] = (callbackQuery.data ?? "").split(":");
  if (!articleId) {
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  const article = await prisma.news.findUnique({ where: { id: articleId } });
  if (!article) {
    await answerCallbackQuery(callbackQuery.id, "Artikel tidak ditemukan (mungkin sudah dihapus).");
    return;
  }

  if (action === "publish") {
    await prisma.news.update({
      where: { id: articleId },
      data: { status: "PUBLISHED", publishedAt: article.publishedAt ?? new Date() },
    });
    await answerCallbackQuery(callbackQuery.id, "Dipublish!");
    if (chatId) {
      await sendTelegramMessage(chatId, `🚀 Dipublish: *${article.title}*\n/berita/${article.slug}`);
    }
  } else if (action === "discard") {
    await prisma.news.delete({ where: { id: articleId } });
    await answerCallbackQuery(callbackQuery.id, "Draft dibuang.");
    if (chatId) {
      await sendTelegramMessage(chatId, `🗑️ Draft "${article.title}" dibuang.`);
    }
  } else {
    await answerCallbackQuery(callbackQuery.id);
  }
}
