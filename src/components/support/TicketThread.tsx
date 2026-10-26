"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, timeAgo } from "@/lib/utils";
import { SUPPORT_BADGE_KEY } from "@/hooks/useSupportBadge";
import { statusLabel, statusVariant, type TicketStatusValue, type ViewerMode } from "./ticketLabels";
import { Loader2, Send, CheckCircle2, RotateCcw, UserCheck, Server, TriangleAlert, Sparkles, Paperclip, X } from "lucide-react";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

interface ThreadMessage {
  id: string;
  senderType: "CUSTOMER" | "STAFF" | "SYSTEM";
  body: string;
  imageUrl: string | null;
  imageName: string | null;
  createdAt: string;
  sender: { name: string | null } | null;
}

interface ThreadTicket {
  id: string;
  subject: string;
  status: TicketStatusValue;
  createdAt: string;
  relatedInstance: {
    id: string;
    name: string;
    status?: string;
    ipv4Address?: string | null;
    plan?: { name: string };
    region?: { name: string };
  } | null;
  // Only present in the staff response:
  customer?: { id: string; name: string | null; email: string; createdAt: string };
  assignedTo?: { id: string; name: string | null } | null;
  messages: ThreadMessage[];
}

const MAX_LENGTH = 5000;

export function TicketThread({ ticketId, mode }: { ticketId: string; mode: ViewerMode }) {
  const apiBase = mode === "staff" ? "/api/admin/tickets" : "/api/tickets";
  const queryKey = ["ticket", mode, ticketId];
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Revoke the object URL when it's replaced or the component unmounts —
  // object URLs otherwise leak memory for as long as the tab stays open.
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          pickFile(file);
          // We don't preventDefault here so text can still be pasted if image is also present,
          // but usually, screenshot tools only put the image in the clipboard.
        }
      }
    }
  };

  const pickFile = (file: File | null) => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    if (!file) {
      setPendingFile(null);
      setPendingPreviewUrl(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Format tidak didukung. Gunakan PNG, JPG, GIF, atau WebP.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Ukuran gambar maksimal 5MB.");
      return;
    }
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  };

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${apiBase}/${ticketId}`);
      if (res.status === 404) throw new Error("not_found");
      if (!res.ok) throw new Error("Failed to load ticket");
      return (await res.json()) as { ticket: ThreadTicket };
    },
    // Short-poll while the conversation is live; slow down once it's closed.
    refetchInterval: (query) => (query.state.data?.ticket.status === "RESOLVED" ? 15_000 : 4_000),
    retry: false,
  });

  const ticket = data?.ticket;
  const messageCount = ticket?.messages.length ?? 0;

  // Keep the newest message in view when something arrives.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: SUPPORT_BADGE_KEY });
    qc.invalidateQueries({ queryKey: ["tickets-list"] });
  };

  const send = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`${apiBase}/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal mengirim pesan");
      return json;
    },
    onSuccess: () => {
      setDraft("");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadAttachment = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      const form = new FormData();
      form.set("file", file);
      form.set("caption", caption);
      const res = await fetch(`${apiBase}/${ticketId}/attachments`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal mengunggah gambar");
      return json;
    },
    onSuccess: () => {
      setDraft("");
      pickFile(null);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patch = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`${apiBase}/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal memperbarui tiket");
      return json;
    },
    onSuccess: refresh,
    onError: (err: Error) => toast.error(err.message),
  });

  const draftWithAi = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/tickets/${ticketId}/draft-reply`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal membuat draf AI");
      return json as { draft: string };
    },
    onSuccess: ({ draft }) => setDraft(draft),
    onError: (err: Error) => toast.error(err.message),
  });

  const sending = send.isPending || uploadAttachment.isPending;

  const submit = () => {
    if (sending) return;
    const body = draft.trim();

    if (pendingFile) {
      uploadAttachment.mutate({ file: pendingFile, caption: body });
      return;
    }
    if (!body) return;
    send.mutate(body);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Memuat percakapan...</p>;
  if (isError || !ticket) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Tiket tidak ditemukan.
        </CardContent>
      </Card>
    );
  }

  const resolved = ticket.status === "RESOLVED";
  const assignedToMe = !!session?.user?.id && ticket.assignedTo?.id === session.user.id;

  return (
    <div className={cn("grid gap-6", mode === "staff" && "lg:grid-cols-[1fr_280px]")}>
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words">{ticket.subject}</h1>
            <p className="text-xs text-muted-foreground mt-1">Dibuat {timeAgo(ticket.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(ticket.status)}>{statusLabel(ticket.status, mode)}</Badge>

            {mode === "customer" && !resolved && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={patch.isPending}
                onClick={() => patch.mutate({ status: "RESOLVED" })}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Tandai selesai
              </Button>
            )}

            {mode === "staff" && (
              <>
                {!assignedToMe && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={patch.isPending}
                    onClick={() => patch.mutate({ assignedTo: "me" })}
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Ambil tiket
                  </Button>
                )}
                {resolved ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={patch.isPending}
                    onClick={() => patch.mutate({ status: "OPEN" })}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Buka lagi
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={patch.isPending}
                    onClick={() => patch.mutate({ status: "RESOLVED" })}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Tandai selesai
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div ref={listRef} className="max-h-[55vh] min-h-[240px] overflow-y-auto p-4 space-y-3">
              {ticket.messages.map((m) => {
                if (m.senderType === "SYSTEM") {
                  return (
                    <p key={m.id} className="text-center text-xs text-muted-foreground">
                      {m.body} · {timeAgo(m.createdAt)}
                    </p>
                  );
                }
                // "Mine" = written from the side the viewer is on.
                const mine = (m.senderType === "CUSTOMER") === (mode === "customer");
                const author =
                  m.senderType === "CUSTOMER"
                    ? mode === "customer"
                      ? "Anda"
                      : m.sender?.name ?? ticket.customer?.name ?? "Pelanggan"
                    : m.sender?.name ?? "Tim Support";
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        mine ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      <p className={cn("text-xs mb-1", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {author} · {timeAgo(m.createdAt)}
                      </p>
                      {m.imageUrl && (
                        <a
                          href={`/api/tickets/attachments/${m.imageUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mb-1.5"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/tickets/attachments/${m.imageUrl}`}
                            alt={m.imageName ?? "Lampiran gambar"}
                            className="max-h-64 max-w-full rounded-md object-contain"
                          />
                        </a>
                      )}
                      {/* Plain text on purpose — never render message bodies as HTML. */}
                      {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t p-3 space-y-2">
              {mode === "customer" && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Jangan kirim password, private key, atau kode 2FA lewat chat. Tim kami tidak akan memintanya.
                </p>
              )}
              {mode === "staff" && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Draf AI mengisi kotak pesan di bawah — tetap baca &amp; edit sebelum dikirim.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    disabled={
                      draftWithAi.isPending ||
                      ticket.messages[ticket.messages.length - 1]?.senderType !== "CUSTOMER"
                    }
                    onClick={() => draftWithAi.mutate()}
                  >
                    {draftWithAi.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Draf dengan AI
                  </Button>
                </div>
              )}
              {pendingPreviewUrl && (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pendingPreviewUrl} alt="Pratinjau lampiran" className="h-20 w-20 rounded-md object-cover border" />
                  <button
                    type="button"
                    onClick={() => pickFile(null)}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                    aria-label="Batalkan lampiran"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <Textarea
                rows={3}
                value={draft}
                maxLength={MAX_LENGTH}
                placeholder={
                  pendingFile
                    ? "Tambahkan keterangan (opsional)..."
                    : resolved
                      ? "Tulis pesan untuk membuka kembali tiket ini..."
                      : "Tulis pesan..."
                }
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    submit();
                  }
                }}
                onPaste={handlePaste}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:inline">Ctrl + Enter untuk mengirim</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={sending}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Lampirkan gambar"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button size="sm" className="gap-1.5" disabled={(!draft.trim() && !pendingFile) || sending} onClick={submit}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Kirim
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {mode === "staff" && ticket.customer && (
        <aside className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-1 text-sm">
              <p className="text-xs font-semibold text-muted-foreground">Pelanggan</p>
              <p className="font-medium">{ticket.customer.name ?? "—"}</p>
              <p className="text-muted-foreground break-all">{ticket.customer.email}</p>
              <p className="text-xs text-muted-foreground">Bergabung {timeAgo(ticket.customer.createdAt)}</p>
              <p className="text-xs text-muted-foreground pt-2">
                Ditangani: {ticket.assignedTo ? ticket.assignedTo.name ?? "staff" : "belum ada"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1 text-sm">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" /> Instance terkait
              </p>
              {ticket.relatedInstance ? (
                <>
                  <p className="font-medium">{ticket.relatedInstance.name}</p>
                  <p className="text-muted-foreground">
                    {ticket.relatedInstance.status} · {ticket.relatedInstance.plan?.name} ·{" "}
                    {ticket.relatedInstance.region?.name}
                  </p>
                  {ticket.relatedInstance.ipv4Address && (
                    <p className="text-xs text-muted-foreground font-mono">{ticket.relatedInstance.ipv4Address}</p>
                  )}
                  <Link href="/admin/instances" className="text-xs text-primary hover:underline inline-block pt-1">
                    Buka daftar instance
                  </Link>
                </>
              ) : (
                <p className="text-muted-foreground">Tidak terkait instance.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      )}
    </div>
  );
}
