"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function TwoFactorPage() {
  const router = useRouter();
  const { update } = useSession();
  const [code, setCode] = useState<string[]>(new Array(6).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Handle focus movement between boxes
  const handleInputChange = (value: string, index: number) => {
    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only take the last character
    setCode(newCode);

    // Move to next input if value is entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Move to previous if backspaced and not at start
    if (!value && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = code.join("");

    if (finalCode.length !== 6) {
      toast.error("Please enter the full 6-digit code");
      return;
    }

    setIsLoading(true);
    console.log("Starting verification for code:", finalCode);

    try {
      console.log("Calling API /api/auth/two-factor/verify...");
      const response = await fetch("/api/auth/two-factor/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: finalCode }),
      });

      console.log("API Response status:", response.status);

      if (!response.ok) {
        const data = await response.json();
        console.error("API Error data:", data);
        throw new Error(data.error || "Invalid verification code");
      }

      console.log("API Success! Triggering session update...");
      toast.success("Identity verified successfully!");

      try {
        // We use a timeout for update() just in case it hangs
        await Promise.race([
          update(),
          new Promise((resolve) => setTimeout(resolve, 5000))
        ]);
        console.log("Session updated successfully");
      } catch (updateErr) {
        console.error("Session update failed:", updateErr);
      }

      console.log("Performing hard redirect to dashboard...");
      // Using window.location.href instead of router.push to force a full page reload
      // This ensures the middleware reads the most updated cookie from the server
      window.location.href = "/dashboard";
    } catch (error: any) {
      console.error("Verification catch block:", error);
      toast.error(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Two-Factor Authentication
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Enter the 6-digit code from your authenticator app to secure your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-between gap-2">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="w-12 h-12 text-center text-xl font-bold border rounded-lg bg-transparent focus:ring-2 focus:ring-primary outline-none transition-all dark:border-slate-700 dark:text-white"
                value={digit}
                onChange={(e) => handleInputChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                maxLength={1}
              />
            ))}
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-lg font-medium transition-all"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Identity"
            )}
          </Button>
        </form>

        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <AlertCircle className="w-4 h-4" />
          <span>Lost your device? Contact system administrator.</span>
        </div>
      </div>
    </div>
  );
}
