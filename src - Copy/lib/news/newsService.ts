import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import type { NewsSource } from "@prisma/client";

/**
 * Turns a title into a unique slug by appending -2, -3, ... on collision.
 * Shared by the admin "new article" form and the AI/Telegram bot so both
 * paths can't create two posts at the same URL.
 */
export async function uniqueSlugFor(title: string): Promise<string> {
  const base = slugify(title) || "artikel";
  let candidate = base;
  let suffix = 2;
  while (await prisma.news.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function createNewsDraft(input: {
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  source: NewsSource;
  aiPrompt?: string;
}) {
  const slug = await uniqueSlugFor(input.title);
  return prisma.news.create({
    data: {
      title: input.title,
      slug,
      excerpt: input.excerpt,
      content: input.content,
      coverImageUrl: input.coverImageUrl,
      source: input.source,
      aiPrompt: input.aiPrompt,
      status: "DRAFT",
    },
  });
}
