import { prisma } from "@/lib/prisma";
import type { TicketStatus } from "@prisma/client";

/**
 * ticketService
 * ---------------------------------------------------------------------------
 * All ticket state rules live here, not in the route handlers, so the
 * customer API, the staff API, and anything added later (Telegram alerts,
 * AI-drafted replies) go through the same transitions:
 *
 *   customer writes  -> OPEN     (staff needs to answer; reopens RESOLVED)
 *   staff writes     -> PENDING  (customer needs to answer) + customerUnread
 *   staff resolves   -> RESOLVED + customerUnread
 *   customer resolves-> RESOLVED
 *
 * Every customer-facing function takes the customer's id and filters on it,
 * so a customer can never read or write someone else's ticket by guessing an
 * id — a ticket that isn't theirs behaves exactly like one that doesn't exist.
 */

const messageSelect = {
  id: true,
  senderType: true,
  body: true,
  imageUrl: true,
  imageName: true,
  createdAt: true,
  // Only the display name — never the sender's email — is exposed to clients.
  sender: { select: { name: true } },
} as const;

// ---------------------------------------------------------------------------
// Customer side
// ---------------------------------------------------------------------------

export async function createTicket(input: {
  customerId: string;
  subject: string;
  body: string;
  relatedInstanceId?: string | null;
}) {
  if (input.relatedInstanceId) {
    // The instance id comes from the request body, so verify it really
    // belongs to this customer before linking it — otherwise staff-facing
    // ticket views would show another customer's instance details.
    const owned = await prisma.instance.findFirst({
      where: { id: input.relatedInstanceId, userId: input.customerId },
      select: { id: true },
    });
    if (!owned) return { error: "instance_not_found" as const };
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      subject: input.subject,
      customerId: input.customerId,
      relatedInstanceId: input.relatedInstanceId ?? null,
      messages: {
        create: { senderId: input.customerId, senderType: "CUSTOMER", body: input.body },
      },
    },
    select: { id: true },
  });

  return { ticket };
}

export async function listCustomerTickets(customerId: string) {
  return prisma.supportTicket.findMany({
    where: { customerId },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      subject: true,
      status: true,
      customerUnread: true,
      lastMessageAt: true,
      createdAt: true,
      relatedInstance: { select: { id: true, name: true } },
    },
  });
}

export async function getCustomerTicket(ticketId: string, customerId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId },
    select: {
      id: true,
      subject: true,
      status: true,
      customerUnread: true,
      createdAt: true,
      relatedInstance: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "asc" }, select: messageSelect },
    },
  });
  if (!ticket) return null;

  // Opening the ticket counts as reading it. The thread polls this endpoint
  // while it is on screen, so this also keeps the badge from lighting up for
  // a reply that arrives while the customer is already looking at the page.
  if (ticket.customerUnread) {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { customerUnread: false },
    });
  }

  return { ...ticket, customerUnread: false };
}

export async function addCustomerMessage(
  ticketId: string,
  customerId: string,
  body: string,
  image?: { imageUrl: string; imageName: string }
) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId },
    select: { id: true },
  });
  if (!ticket) return null;

  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId, senderId: customerId, senderType: "CUSTOMER", body, ...image },
      select: messageSelect,
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "OPEN", lastMessageAt: new Date(), customerUnread: false },
    }),
  ]);
  return message;
}

export async function customerResolveTicket(ticketId: string, customerId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId },
    select: { id: true, status: true },
  });
  if (!ticket) return null;
  if (ticket.status === "RESOLVED") return { status: "RESOLVED" as TicketStatus };

  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: customerId,
        senderType: "SYSTEM",
        body: "Pelanggan menandai tiket ini selesai.",
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "RESOLVED", lastMessageAt: new Date() },
    }),
  ]);
  return { status: "RESOLVED" as TicketStatus };
}

// ---------------------------------------------------------------------------
// Staff side (callers must have already passed requirePermission("tickets.manage"))
// ---------------------------------------------------------------------------

export type StaffTicketFilter = TicketStatus | "ALL";

export async function listStaffTickets(filter: StaffTicketFilter) {
  return prisma.supportTicket.findMany({
    where: filter === "ALL" ? {} : { status: filter },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    select: {
      id: true,
      subject: true,
      status: true,
      lastMessageAt: true,
      createdAt: true,
      customer: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, senderType: true },
      },
    },
  });
}

export async function getStaffTicket(ticketId: string) {
  return prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      customer: { select: { id: true, name: true, email: true, createdAt: true } },
      assignedTo: { select: { id: true, name: true } },
      // Deliberately no balance / billing fields: the Support role has no
      // billing permission, so this view must not leak wallet data.
      relatedInstance: {
        select: {
          id: true,
          name: true,
          status: true,
          ipv4Address: true,
          plan: { select: { name: true } },
          region: { select: { name: true } },
        },
      },
      messages: { orderBy: { createdAt: "asc" }, select: messageSelect },
    },
  });
}

export async function addStaffMessage(
  ticketId: string,
  staffId: string,
  body: string,
  image?: { imageUrl: string; imageName: string }
) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, assignedToId: true },
  });
  if (!ticket) return null;

  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId, senderId: staffId, senderType: "STAFF", body, ...image },
      select: messageSelect,
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "PENDING",
        customerUnread: true,
        lastMessageAt: new Date(),
        // First staff member to reply claims an unassigned ticket.
        assignedToId: ticket.assignedToId ?? staffId,
      },
    }),
  ]);
  return message;
}

export async function setStaffTicketStatus(
  ticketId: string,
  staffId: string,
  staffName: string,
  status: TicketStatus
) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });
  if (!ticket) return null;
  if (ticket.status === status) return { status };

  const note =
    status === "RESOLVED"
      ? `Tiket ditandai selesai oleh ${staffName}.`
      : `Tiket dibuka kembali oleh ${staffName}.`;

  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId, senderId: staffId, senderType: "SYSTEM", body: note },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status, customerUnread: true, lastMessageAt: new Date() },
    }),
  ]);
  return { status };
}

export async function assignTicket(ticketId: string, assigneeId: string | null) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) return null;
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { assignedToId: assigneeId } });
  return { assignedToId: assigneeId };
}

// ---------------------------------------------------------------------------
// Badge counts (sidebar + admin tab)
// ---------------------------------------------------------------------------

export async function getBadgeCounts(userId: string, isSupportStaff: boolean) {
  const [customerUnread, staffOpen] = await Promise.all([
    prisma.supportTicket.count({ where: { customerId: userId, customerUnread: true } }),
    isSupportStaff ? prisma.supportTicket.count({ where: { status: "OPEN" } }) : Promise.resolve(0),
  ]);
  return { customerUnread, staffOpen };
}
