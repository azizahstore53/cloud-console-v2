"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/billing/calculator";
import { useCreateInstance } from "@/hooks/useInstances";
import { toast } from "sonner";
import { ArrowLeft, Check, Cpu, MapPin, KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";

interface Region { id: string; code: string; name: string; country: string }
interface Plan { id: string; name: string; vcpu: number; ramMb: number; storageGb: number; pricePerHour: number; pricePerMonth: number }
interface Image { slug: string; label: string; family: string }
interface SshKeyItem { id: string; name: string; fingerprint: string }

export default function CreateInstancePage() {
  const router = useRouter();
  const createInstance = useCreateInstance();

  const { data: regionsData } = useQuery<{ regions: Region[] }>({
    queryKey: ["regions"],
    queryFn: () => fetch("/api/regions").then((r) => r.json()),
  });
  const { data: plansData } = useQuery<{ plans: Plan[] }>({
    queryKey: ["plans"],
    queryFn: () => fetch("/api/plans").then((r) => r.json()),
  });
  const { data: imagesData } = useQuery<{ images: Image[] }>({
    queryKey: ["images"],
    queryFn: () => fetch("/api/images").then((r) => r.json()),
  });
  const { data: sshKeysData } = useQuery<{ sshKeys: SshKeyItem[] }>({
    queryKey: ["ssh-keys"],
    queryFn: () => fetch("/api/ssh-keys").then((r) => r.json()),
  });

  const [name, setName] = useState("");
  const [imageSlug, setImageSlug] = useState<string>("");
  const [regionId, setRegionId] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");
  const [sshKeyId, setSshKeyId] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<"HOURLY" | "MONTHLY">("HOURLY");

  useEffect(() => {
    if (regionsData?.regions?.length && !regionId) setRegionId(regionsData.regions[0].id);
  }, [regionsData, regionId]);
  useEffect(() => {
    if (imagesData?.images?.length && !imageSlug) setImageSlug(imagesData.images[0].slug);
  }, [imagesData, imageSlug]);
  useEffect(() => {
    if (plansData?.plans?.length && !planId) setPlanId(plansData.plans[0].id);
  }, [plansData, planId]);

  const selectedPlan = plansData?.plans.find((p) => p.id === planId);
  const selectedImage = imagesData?.images.find((i) => i.slug === imageSlug);
  const estimatedMonthly = selectedPlan
    ? billingCycle === "MONTHLY"
      ? selectedPlan.pricePerMonth
      : selectedPlan.pricePerHour * 24 * 30
    : 0;

  const canSubmit = name.trim().length >= 3 && imageSlug && regionId && planId && !createInstance.isPending;

  async function handleSubmit() {
    if (!selectedImage || !canSubmit) return;
    const result = await createInstance.mutateAsync({
      name: name.trim(),
      imageSlug,
      imageLabel: selectedImage.label,
      regionId,
      planId,
      sshKeyId: sshKeyId || undefined,
      billingCycle,
    });

    if (result.oneTimeCredentials) {
      toast.success(
        `Initial login — username: ${result.oneTimeCredentials.username}, password: ${result.oneTimeCredentials.password}`,
        { description: result.oneTimeCredentials.note, duration: 30000 }
      );
    } else {
      toast.success("Instance is being provisioned");
    }

    router.push(`/compute/${result.instance.id}`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/compute">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create Cloud VPS</h1>
          <p className="text-muted-foreground text-sm">Configure and launch a new virtual server instance.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Image selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Choose an Image</CardTitle>
              <CardDescription>Select the operating system for your instance.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(imagesData?.images ?? []).map((img) => (
                <button
                  key={img.slug}
                  onClick={() => setImageSlug(img.slug)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                    imageSlug === img.slug ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"
                  )}
                >
                  <span className="text-sm font-medium">{img.family}</span>
                  <span className="text-xs text-muted-foreground">{img.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Plan selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CPU / RAM / Storage</CardTitle>
              <CardDescription>Choose a plan sized for your workload.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(plansData?.plans ?? []).map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setPlanId(plan.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                    planId === plan.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {plan.vcpu} vCPU · {plan.ramMb / 1024} GB RAM · {plan.storageGb} GB SSD
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">{formatCurrency(plan.pricePerMonth)}/mo</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(plan.pricePerHour)}/hr</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Region */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Region / Zone</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(regionsData?.regions ?? []).map((region) => (
                <button
                  key={region.id}
                  onClick={() => setRegionId(region.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                    regionId === region.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"
                  )}
                >
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{region.name}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* SSH Key + name */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Authentication &amp; Naming</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Instance Name</Label>
                <Input id="name" placeholder="my-app-server-01" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>SSH Key</Label>
                {(sshKeysData?.sshKeys?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No SSH keys yet.{" "}
                    <Link href="/ssh-keys" className="text-primary hover:underline">
                      Add one
                    </Link>{" "}
                    or continue without one (password-only access).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sshKeysData!.sshKeys.map((key) => (
                      <button
                        key={key.id}
                        onClick={() => setSshKeyId(sshKeyId === key.id ? "" : key.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border p-2.5 text-left text-sm transition-colors",
                          sshKeyId === key.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                          {key.name}
                        </span>
                        {sshKeyId === key.id && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SummaryRow label="Image" value={selectedImage?.label ?? "—"} />
              <SummaryRow label="Plan" value={selectedPlan?.name ?? "—"} />
              <SummaryRow
                label="Specs"
                value={selectedPlan ? `${selectedPlan.vcpu} vCPU / ${selectedPlan.ramMb / 1024}GB / ${selectedPlan.storageGb}GB` : "—"}
              />
              <SummaryRow label="Region" value={regionsData?.regions.find((r) => r.id === regionId)?.name ?? "—"} />

              <div className="flex gap-2 pt-2">
                {(["HOURLY", "MONTHLY"] as const).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={cn(
                      "flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors",
                      billingCycle === cycle ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                    )}
                  >
                    {cycle === "HOURLY" ? "Pay Hourly" : "Pay Monthly"}
                  </button>
                ))}
              </div>

              <div className="border-t pt-3 flex items-center justify-between">
                <span className="text-muted-foreground">Est. monthly cost</span>
                <span className="font-semibold">{formatCurrency(estimatedMonthly)}</span>
              </div>

              <Button className="w-full gap-2 mt-2" disabled={!canSubmit} onClick={handleSubmit}>
                {createInstance.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Launch Instance
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Charged from your prepaid wallet balance.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
