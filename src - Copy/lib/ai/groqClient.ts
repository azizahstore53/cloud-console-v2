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

const SYSTEM_PROMPT = `Kamu adalah penulis artikel untuk blog perusahaan cloud hosting Indonesia (CloudConsole).
Tulis artikel yang informatif, akurat, dan tidak berlebihan (hindari klaim yang tidak bisa dipertanggungjawabkan).
Gunakan Bahasa Indonesia yang jelas dan profesional, gaya penulisan seperti artikel blog teknis, bukan iklan.
Jangan menyebutkan harga atau spesifikasi produk spesifik kecuali diminta eksplisit di topik — biarkan itu diisi manual oleh editor.

Balas HANYA dengan JSON valid, tanpa markdown fence, tanpa teks lain, dengan bentuk persis:
{"title": "...", "excerpt": "1-2 kalimat ringkasan, maks 200 karakter", "content": "isi artikel lengkap dalam format Markdown, minimal 4 paragraf"}`;

export async function generateNewsArticle(topic: string): Promise<GeneratedArticle> {
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
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Topik artikel: ${topic}` },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API error: HTTP ${res.status} ${text}`);
  }

  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq API returned no content.");

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
