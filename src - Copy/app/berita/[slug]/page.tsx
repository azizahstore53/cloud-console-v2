import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/utils";
import { Cloud, ArrowLeft } from "lucide-react";

export const revalidate = 60;

export default async function BeritaDetailPage({ params }: { params: { slug: string } }) {
  const article = await prisma.news.findUnique({ where: { slug: params.slug } });

  // A draft is not "not found" internally, but it must look exactly like a
  // 404 to an unauthenticated visitor — otherwise the URL alone would leak
  // unpublished/AI-drafted content before an admin has reviewed it.
  if (!article || article.status !== "PUBLISHED") notFound();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-2 px-6 h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Cloud className="h-4.5 w-4.5" />
            </div>
            <span className="font-semibold text-lg tracking-tight">CloudConsole</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/berita" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Semua Berita
        </Link>

        {article.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.coverImageUrl} alt="" className="w-full rounded-xl mb-6 max-h-96 object-cover" />
        )}

        <h1 className="text-3xl font-semibold tracking-tight">{article.title}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {article.publishedAt ? timeAgo(article.publishedAt) : ""}
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none mt-6">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>
      </main>
    </div>
  );
}
