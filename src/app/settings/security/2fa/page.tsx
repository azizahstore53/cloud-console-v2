"use client";

import React, { useState } from "react";
import { ShieldCheck, QrCode, Key, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type SetupStep = "INFO" | "SCAN" | "RECOVERY";

export default function TwoFactorSetupPage() {
  const [step, setStep] = useState<SetupStep>("INFO");
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function startSetup() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/two-factor/setup", { method: "POST" });
      if (!response.ok) throw new Error("Failed to initialize 2FA setup");

      const data = await response.json();
      setQrCodeUrl(data.qrCodeUrl);
      setSecret(data.secret);
      setStep("SCAN");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function enable2FA() {
    if (code.length !== 6) {
      toast.error("Please enter the 6-digit code from your app");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/two-factor/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, token: code }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Verification failed");
      }

      const data = await response.json();
      setRecoveryCodes(data.recoveryCodes);
      setStep("RECOVERY");
      toast.success("2FA successfully enabled!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">

        {/* Step 1: Info */}
        {step === "INFO" && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Secure Your Account
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                Enable Two-Factor Authentication (2FA) to add an extra layer of security to your cloud console.
              </p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-left text-sm space-y-3 text-slate-600 dark:text-slate-300">
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <span>Protects your account even if your password is leaked.</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <span>Uses industry-standard TOTP (Google Authenticator, Authy).</span>
              </div>
            </div>
            <Button
              onClick={startSetup}
              className="w-full h-12 text-lg"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Get Started"}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Scan & Verify */}
        {step === "SCAN" && (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Scan QR Code</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Scan this code with your authenticator app to link your account.
              </p>
            </div>

            <div className="flex justify-center p-4 bg-white rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
              <img src={qrCodeUrl} alt="2FA Setup QR Code" className="w-48 h-48" />
            </div>

            <div className="space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Verification Code
                </label>
                <Input
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <Button
                onClick={enable2FA}
                className="w-full h-12"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Verify & Enable"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Recovery Codes */}
        {step === "RECOVERY" && (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">2FA is Active!</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Your account is now secured. Save these recovery codes in a safe place.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-sm">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="p-2 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 text-center">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span>If you lose your device, these codes are the only way to access your account.</span>
            </div>

            <Button
              onClick={() => window.location.href = "/dashboard"}
              className="w-full h-12"
            >
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
