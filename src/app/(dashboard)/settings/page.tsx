import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ArrowRight } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session!.user.id } });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile and account preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input defaultValue={user.name ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input defaultValue={user.email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input defaultValue={user.companyName ?? ""} placeholder="Optional" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="outline">{user.role}</Badge>
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>Change your account password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <Input type="password" />
          </div>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input type="password" />
          </div>
          <Button variant="outline">Update Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
          <CardDescription>
            {user.twoFactorEnabled
              ? "2FA is currently protecting your account."
              : "Add an extra layer of security with an authenticator app."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/security/2fa">
            <Button variant={user.twoFactorEnabled ? "outline" : "default"} className="gap-2">
              {user.twoFactorEnabled ? (
                <><ShieldCheck className="h-4 w-4" /> Manage 2FA</>
              ) : (
                <><ShieldAlert className="h-4 w-4" /> Set Up 2FA <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
