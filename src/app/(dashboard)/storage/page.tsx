import { Card, CardContent } from "@/components/ui/card";

export default function StoragePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storage</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Block storage volumes and snapshots management is coming soon.
        </p>
      </div>
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          This module is scaffolded and ready to build out — hook it into the same
          CloudProviderAdapter pattern used by Compute.
        </CardContent>
      </Card>
    </div>
  );
}
