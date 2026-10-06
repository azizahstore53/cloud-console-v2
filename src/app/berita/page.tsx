import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";
import { Cloud } from "lucide-react";

export const metadata = {
  title: "Berita — CloudConsole",
  description: "Artikel dan panduan seputar VPS, hosting, dan layanan cloud lainnya.",
};

// Re-render at most once a minute — articles don't change second-to-second,
// and this keeps the public page fast without needing a manual cache-bust
// every time an admin (or the bot) publishes something new.
export const revalidate = 60;

export default async function BeritaListPage() {
  const articles = await prisma.news.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto flex items-center gap-2 px-6 h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Cloud className="h-4.5 w-4.5" />
            </div>
            <span className="font-semibold text-lg tracking-tight">CloudConsole</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Berita &amp; Artikel</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Panduan dan pembaruan seputar VPS, hosting, dan layanan cloud kami.
          </p>
        </div>

        {articles.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada artikel yang diterbitkan.</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/berita/${article.slug}`}
              className="group rounded-xl border overflow-hidden hover:border-primary transition-colors"
            >
              {article.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={article.coverImageUrl} alt="" className="h-40 w-full object-cover" />
              )}
              <div className="p-4 space-y-1.5">
                <h2 className="font-medium leading-snug group-hover:text-primary transition-colors">
                  {article.title}
                </h2>
                <p className="text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
                <p className="text-xs text-muted-foreground pt-1">
                  {article.publishedAt ? timeAgo(article.publishedAt) : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
