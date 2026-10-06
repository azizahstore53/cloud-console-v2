"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { timeAgo } from "@/lib/utils";
import { Plus, Loader2, Trash2, Bot, PencilLine, Eye, EyeOff } from "lucide-react";

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  status: "DRAFT" | "PUBLISHED";
  source: "MANUAL" | "AI_TELEGRAM";
  aiPrompt: string | null;
  createdAt: string;
  publishedAt: string | null;
}

const emptyForm = { title: "", excerpt: "", content: "", coverImageUrl: "" };

async function fetchNews() {
  const res = await fetch("/api/admin/news");
  if (!res.ok) throw new Error("Failed to load news");
  return res.json() as Promise<{ news: NewsArticle[] }>;
}

export default function AdminNewsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-news"], queryFn: fetchNews });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NewsArticle | null>(null);
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-news"] });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (article: NewsArticle) => {
    setEditing(article);
    setForm({
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      coverImageUrl: article.coverImageUrl ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(editing ? `/api/admin/news/${editing.id}` : "/api/admin/news", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save article");
      return json;
    },
    onSuccess: () => {
      toast.success(editing ? "Article updated" : "Article created as draft");
      setOpen(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const togglePublish = useMutation({
    mutationFn: async (article: NewsArticle) => {
      const res = await fetch(`/api/admin/news/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: article.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete article");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Article deleted");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const news = data?.news ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" /> New Article
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Edit Article" : "New Article"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Hosting vs VPS: Mana yang Cocok untuk Bisnis Anda?"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Excerpt (ringkasan singkat, tampil di daftar berita)</Label>
                <Textarea
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Content (Markdown didukung)</Label>
                <Textarea
                  rows={10}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cover image URL (opsional)</Label>
                <Input
                  value={form.coverImageUrl}
                  onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => save.mutate()}
                disabled={form.title.length < 4 || form.content.length < 20 || save.isPending}
                className="gap-2"
              >
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save Changes" : "Save as Draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && news.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No articles yet.</p>
          )}
          {news.map((article) => (
            <div key={article.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{article.title}</span>
                  {article.source === "AI_TELEGRAM" && (
                    <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-label="Generated via Telegram bot" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{article.excerpt}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {timeAgo(article.createdAt)}
              </span>
              <Badge
                variant={article.status === "PUBLISHED" ? "success" : "outline"}
                className="cursor-pointer gap-1"
                onClick={() => togglePublish.mutate(article)}
              >
                {article.status === "PUBLISHED" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {article.status === "PUBLISHED" ? "Published" : "Draft"}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => openEdit(article)}>
                <PencilLine className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(article.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
