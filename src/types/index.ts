import type {
  Instance,
  InstancePlan,
  Region,
  SshKey,
  Deployment,
  Blueprint,
  Invoice,
  InvoiceItem,
  Transaction,
  ActivityLog,
  Role,
} from "@prisma/client";

export type InstanceWithRelations = Instance & {
  plan: InstancePlan;
  region: Region;
  sshKey: SshKey | null;
};

export type DeploymentWithRelations = Deployment & {
  blueprint: Blueprint;
  instance: Instance | null;
};

export type InvoiceWithItems = Invoice & {
  items: InvoiceItem[];
};

export interface DashboardStats {
  runningInstances: number;
  totalInstances: number;
  monthlySpend: number;
  activeDeployments: number;
  walletBalance: number;
}

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: Role;
  image?: string | null;
}

export type { Transaction, ActivityLog };
