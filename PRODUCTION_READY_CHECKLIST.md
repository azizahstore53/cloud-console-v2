# Production Ready Checklist - Cloud Console

This document serves as a technical roadmap to move the project from Beta to Production. Every item here is a critical requirement for security, stability, and scalability.

# Production Ready Checklist - Cloud Console

This document serves as a technical roadmap to move the project from Beta to Production. Every item here is a critical requirement for security, stability, and scalability.

## 🔴 PRIORITY 1: SECURITY (Immediate Action Required)
- [x] **SSH Private Key Encryption**: Implement AES-256 encryption for the `sshPrivateKey` field. (Completed ✅)
- [x] **API Access Hardening**: 
    - **Requirement**: Ensure all `/api/admin/*` and `/api/vpn/*` endpoints have strict role-based access control (RBAC) middleware. (Completed ✅)
- [x] **Webhook Security Audit**:
    - **Requirement**: Verify that `DOIT_WEBHOOK_SECRET` is active and strictly enforced in production. (Completed ✅)
- [ ] **Webhook Security Audit**:
    - **Requirement**: Verify that `DOIT_WEBHOOK_SECRET` is active and strictly enforced in production.

## 🟡 PRIORITY 2: INFRASTRUCTURE & RELIABILITY
- [ ] **Asynchronous Provisioning**:
    - **Problem**: `/api/vpn/settings/provision` is a synchronous request that can timeout.
    - **Requirement**: Implement a background job queue (e.g., BullMQ, Redis) to handle VPS installation.
    - **Workflow**: Request $\rightarrow$ Queue $\rightarrow$ Worker $\rightarrow$ Update DB Status $\rightarrow$ Notify User.
- [ ] **Provisioning State Machine**:
    - **Requirement**: Add detailed server states: `PENDING` $\rightarrow$ `PROVISIONING` $\rightarrow$ `ACTIVE` or `FAILED`.
- [ ] **Server Health Monitoring**:
    - **Requirement**: Implement a periodic heartbeat check for all active VPN servers to detect downtime automatically.

## 🟢 PRIORITY 3: BILLING & OPERATIONS
- [ ] **Usage Invoicing**:
    - **Requirement**: Implement a monthly cron job that aggregates all `USAGE_CHARGE` transactions into a formal monthly invoice for the user.
- [ ] **Payment Reconciliation**:
    - **Requirement**: Add a "Sync Payment Status" feature to manually trigger payment verification via the Doit.id API if a webhook is missed.
- [ ] **Observability**:
    - **Requirement**: Integrate Sentry for error tracking and a basic dashboard (e.g., Grafana) for server resource monitoring.

## 🛠️ Technical Stack Reference for AI Agents
- **Payment Gateway**: doit.id (implemented via Adapter Pattern).
- **VPN Protocol**: WireGuard.
- **Database**: PostgreSQL via Prisma.
- **Backend**: Next.js App Router.
- **Auth**: NextAuth.js with Role-based access.


## 🟡 PRIORITY 2: INFRASTRUCTURE & RELIABILITY
- [ ] **Asynchronous Provisioning**:
    - **Problem**: `/api/vpn/settings/provision` is a synchronous request that can timeout.
    - **Requirement**: Implement a background job queue (e.g., BullMQ, Redis) to handle VPS installation.
    - **Workflow**: Request $\rightarrow$ Queue $\rightarrow$ Worker $\rightarrow$ Update DB Status $\rightarrow$ Notify User.
- [ ] **Provisioning State Machine**:
    - **Requirement**: Add detailed server states: `PENDING` $\rightarrow$ `PROVISIONING` $\rightarrow$ `ACTIVE` or `FAILED`.
- [ ] **Server Health Monitoring**:
    - **Requirement**: Implement a periodic heartbeat check for all active VPN servers to detect downtime automatically.

## 🟢 PRIORITY 3: BILLING & OPERATIONS
- [x] **Usage Invoicing**:
    - **Requirement**: Implement a monthly cron job that aggregates all `USAGE_CHARGE` transactions into a formal monthly invoice for the user. (Completed ✅)
- [x] **Payment Reconciliation**:
    - **Requirement**: Add a "Sync Status" feature to manually trigger payment verification via the Doit.id API if a webhook is missed. (Completed ✅)
- [ ] **Observability**:
    - **Requirement**: Integrate Sentry for error tracking and a basic dashboard (e.g., Grafana) for server resource monitoring.

## 🛠️ Technical Stack Reference for AI Agents
- **Payment Gateway**: doit.id (implemented via Adapter Pattern).
- **VPN Protocol**: WireGuard.
- **Database**: PostgreSQL via Prisma.
- **Backend**: Next.js App Router.
- **Auth**: NextAuth.js with Role-based access.
