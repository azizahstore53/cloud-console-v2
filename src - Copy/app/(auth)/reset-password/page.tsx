"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type TokenState = "checking" | "valid" | "invalid";

const INVALID_REASON_MESSAGE: Record<string, string> = {
  missing: "This reset link is missing its token.",
  not_found: "This reset link is invalid.",
  used: "This reset link has already been used.",
  expired: "This reset link has expired.",
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [tokenState, setTokenState] = useState<TokenState>("checking");
  const [invalidReason, setInvalidReason] = useState("This reset link is invalid.");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      setInvalidReason(INVALID_REASON_MESSAGE.missing);
      return;
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data: { valid: boolean; reason?: string }) => {
        if (data.valid) {
          setTokenState("valid");
        } else {
          setTokenState("invalid");
          setInvalidReason(INVALID_REASON_MESSAGE[data.reason ?? ""] ?? INVALID_REASON_MESSAGE.not_found);
        }
      })
      .catch(() => {
        setTokenState("invalid");
        setInvalidReason("Couldn't verify this reset link. Please try again.");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reset password");
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {tokenState === "checking" && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying reset link...
          </div>
        )}

        {tokenState === "invalid" && (
          <div className="text-center py-4 space-y-3">
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm">{invalidReason}</p>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline inline-block">
              Request a new reset link
            </Link>
          </div>
        )}

        {tokenState === "valid" && !done && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset password
            </Button>
          </form>
        )}

        {done && (
          <div className="text-center py-4 space-y-2">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <p className="text-sm">Your password has been reset. Redirecting to sign in...</p>
          </div>
        )}

        {tokenState !== "checking" && !done && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            <Link href="/login" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
