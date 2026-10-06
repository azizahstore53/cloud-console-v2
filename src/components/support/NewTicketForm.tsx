"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SUPPORT_BADGE_KEY } from "@/hooks/useSupportBadge";
import { Loader2 } from "lucide-react";

// Radix Select can't use an empty string as an item value, so "no instance"
// gets an explicit sentinel that is mapped back to null on submit.
const NO_INSTANCE = "none";

export function NewTicketForm({
  instances,
  defaultInstanceId,
}: {
  instances: { id: string; name: string }[];
  defaultInstanceId?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [instanceId, setInstanceId] = useState(defaultInstanceId ?? NO_INSTANCE);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          relatedInstanceId: instanceId === NO_INSTANCE ? null : instanceId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal membuat tiket");
      return json as { ticket: { id: string } };
    },
    onSuccess: ({ ticket }) => {
      qc.invalidateQueries({ queryKey: ["tickets-list"] });
      qc.invalidateQueries({ queryKey: SUPPORT_BADGE_KEY });
      router.push(`/support/${ticket.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const valid = subject.trim().length >= 4 && body.trim().length > 0;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Subjek</Label>
          <Input
            value={subject}
            maxLength={120}
            placeholder="Contoh: VPS tidak bisa diakses lewat SSH"
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Instance terkait (opsional)</Label>
          <Select value={instanceId} onValueChange={setInstanceId}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih instance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_INSTANCE}>Tidak terkait instance</SelectItem>
              {instances.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Memilih instance membantu tim melihat status dan spesifikasinya tanpa bertanya ulang.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Pesan</Label>
          <Textarea
            rows={7}
            value={body}
            maxLength={5000}
            placeholder="Jelaskan masalahnya: apa yang terjadi, kapan mulai, dan apa yang sudah Anda coba."
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Jangan sertakan password, private key, atau kode 2FA.
          </p>
        </div>

        <div className="flex justify-end">
          <Button className="gap-2" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Kirim Tiket
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
