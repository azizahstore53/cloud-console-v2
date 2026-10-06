/**
 * groqClient
 * ---------------------------------------------------------------------------
 * Thin wrapper around Groq's OpenAI-compatible chat completions API
 * (https://console.groq.com/docs/api-reference#chat-create). Used to turn a
 * short topic ("VPS vs shared hosting") into a draft news article.
 *
 * Requires GROQ_API_KEY. Model is configurable via GROQ_MODEL (defaults to
 * a current Llama 3.3 model) — Groq periodically retires older models, so
 * if this starts returning a "model decommissioned" error, check
 * https://console.groq.com/docs/models for the current model ID and update
 * GROQ_MODEL rather than editing code.
 */

interface GeneratedArticle {
  title: string;
  excerpt: string;
  content: string;
}

const NEWS_SYSTEM_PROMPT = `Kamu adalah penulis artikel untuk blog perusahaan cloud hosting Indonesia (CloudConsole).
Tulis artikel yang informatif, akurat, dan tidak berlebihan (hindari klaim yang tidak bisa dipertanggungjawabkan).
Gunakan Bahasa Indonesia yang jelas dan profesional, gaya penulisan seperti artikel blog teknis, bukan iklan.
Jangan menyebutkan harga atau spesifikasi produk spesifik kecuali diminta eksplisit di topik — biarkan itu diisi manual oleh editor.

Balas HANYA dengan JSON valid, tanpa markdown fence, tanpa teks lain, dengan bentuk persis:
{"title": "...", "excerpt": "1-2 kalimat ringkasan, maks 200 karakter", "content": "isi artikel lengkap dalam format Markdown, minimal 4 paragraf"}`;

async function callGroq(
  messages: { role: "system" | "user"; content: string }[],
  options?: { jsonMode?: boolean; temperature?: number }
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      temperature: options?.temperature ?? 0.7,
      ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API error: HTTP ${res.status} ${text}`);
  }

  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq API returned no content.");
  return raw;
}

export async function generateNewsArticle(topic: string): Promise<GeneratedArticle> {
  const raw = await callGroq(
    [
      { role: "system", content: NEWS_SYSTEM_PROMPT },
      { role: "user", content: `Topik artikel: ${topic}` },
    ],
    { jsonMode: true }
  );

  let parsed: GeneratedArticle;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Groq API did not return valid JSON — got:\n" + raw.slice(0, 500));
  }

  if (!parsed.title || !parsed.excerpt || !parsed.content) {
    throw new Error("Groq API response is missing title/excerpt/content.");
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Support ticket reply drafting
// ---------------------------------------------------------------------------

const TICKET_DRAFT_SYSTEM_PROMPT = `Kamu membantu staf support CloudConsole (perusahaan cloud VPS/hosting Indonesia) menyusun DRAF balasan untuk tiket pelanggan.

Aturan ketat:
- Tulis dalam Bahasa Indonesia, nada ramah dan profesional, seperti staf support manusia — bukan seperti chatbot.
- Dasarkan balasan HANYA pada isi percakapan yang diberikan. JANGAN mengarang detail teknis (nama file, penyebab error, dsb) yang tidak disebutkan di percakapan.
- JANGAN berjanji atas nama perusahaan (refund, kompensasi, jadwal pasti perbaikan) — staf manusia yang memutuskan itu, bukan kamu.
- JANGAN mengklaim masalah sudah selesai kecuali staf sudah menyatakan begitu di percakapan.
- Kalau informasi di tiket belum cukup untuk menjawab, tulis draf yang isinya menanyakan detail tambahan yang relevan (bukan menebak-nebak jawaban).
- Ini DRAF — staf akan membaca, mengedit, dan memutuskan sendiri sebelum mengirim. Jangan tulis tanda tangan/nama staf.
- Balas hanya dengan isi pesannya saja, tanpa embel-embel seperti "Berikut draf balasannya:".`;

export async function generateTicketReplyDraft(input: {
  subject: string;
  relatedInstance?: { name: string; status: string; plan?: string; region?: string } | null;
  transcript: { author: "Pelanggan" | "Staff" | "Sistem"; body: string }[];
}): Promise<string> {
  const instanceLine = input.relatedInstance
    ? `Instance terkait: ${input.relatedInstance.name} (status ${input.relatedInstance.status}${
        input.relatedInstance.plan ? `, paket ${input.relatedInstance.plan}` : ""
      }${input.relatedInstance.region ? `, region ${input.relatedInstance.region}` : ""})`
    : "Tidak ada instance yang terkait dengan tiket ini.";

  const transcriptText = input.transcript.map((m) => `[${m.author}]: ${m.body}`).join("\n");

  const userContent = `Subjek tiket: ${input.subject}\n${instanceLine}\n\nPercakapan sejauh ini:\n${transcriptText}\n\nTulis draf balasan untuk pesan pelanggan yang paling akhir.`;

  const draft = await callGroq(
    [
      { role: "system", content: TICKET_DRAFT_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    { temperature: 0.5 }
  );

  return draft.trim();
}
