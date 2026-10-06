import { createRateLimiter } from "@/lib/rateLimit";

// Keyed by user id (these endpoints are behind login, so the id is a more
// reliable key than an IP header). Limits are generous for a real
// conversation and only exist to stop scripted flooding.
export const ticketCreateRateLimiter = createRateLimiter("ticket-create", 10, 60 * 60 * 1000); // 10 tickets / hour
export const ticketMessageRateLimiter = createRateLimiter("ticket-message", 20, 60 * 1000); // 20 messages / minute

// AI calls cost quota/money — capped independently from ordinary messages,
// generous enough for real use (a busy agent drafting for many tickets)
// without allowing a runaway loop to rack up Groq usage.
export const ticketAiDraftRateLimiter = createRateLimiter("ticket-ai-draft", 30, 60 * 60 * 1000); // 30 drafts / hour

// Separate from the text-message limiter since uploads are heavier
// (disk I/O, larger payloads) — capped tighter.
export const ticketAttachmentRateLimiter = createRateLimiter("ticket-attachment", 15, 60 * 1000); // 15 uploads / minute
