import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

/**
 * ticketAttachments
 * ---------------------------------------------------------------------------
 * Local-disk storage for chat image attachments, kept deliberately simple
 * (no S3/cloud storage dependency) since this runs on a persistent Node
 * server, not a serverless platform where the filesystem is ephemeral.
 *
 * Security properties, each load-bearing — don't relax these casually:
 *   - Stored OUTSIDE `public/`, so a file is only ever reachable through
 *     `/api/tickets/attachments/[filename]`, which checks the requester
 *     owns (or staffs) the ticket before streaming anything back. Putting
 *     this under `public/` would make every attachment world-readable by
 *     anyone who could guess or intercept a filename.
 *   - The file type is sniffed from its actual bytes (the magic-number
 *     header every image format starts with), never trusted from the
 *     browser's Content-Type or the original filename's extension — both
 *     are attacker-controlled and routinely spoofed.
 *   - The filename written to disk is always server-generated
 *     (crypto.randomUUID), never derived from the client's filename — this
 *     is what rules out path traversal ("../../etc/passwd") and one
 *     upload silently overwriting another.
 *   - The client's original filename is kept ONLY as display text
 *     (TicketMessage.imageName) — never interpolated into a filesystem
 *     path anywhere.
 */

const UPLOAD_DIR = process.env.TICKET_UPLOADS_DIR
  ? path.resolve(process.env.TICKET_UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads", "tickets");

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB

// Signature = the fixed leading bytes every file of that format starts
// with. This is the standard, dependency-free way to identify a file's
// real type without trusting anything the client claims about it.
const SIGNATURES: { ext: string; mime: string; check: (b: Buffer) => boolean }[] = [
  { ext: "png", mime: "image/png", check: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "jpg", mime: "image/jpeg", check: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  { ext: "gif", mime: "image/gif", check: (b) => b.subarray(0, 4).toString("ascii") === "GIF8" },
  { ext: "webp", mime: "image/webp", check: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

export function detectImageType(buffer: Buffer): { ext: string; mime: string } | null {
  const match = SIGNATURES.find((s) => buffer.length >= 12 && s.check(buffer));
  return match ? { ext: match.ext, mime: match.mime } : null;
}

export async function saveAttachment(buffer: Buffer): Promise<{ filename: string; mime: string }> {
  const type = detectImageType(buffer);
  if (!type) throw new Error("unsupported_type");
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) throw new Error("too_large");

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.${type.ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return { filename, mime: type.mime };
}

/**
 * Resolves a stored filename back to bytes + mime type for the serving
 * route. Rejects anything that isn't a bare filename this module itself
 * generated (defense in depth against path traversal, even though the
 * filename in the DB is never client-controlled in the first place).
 */
export async function readAttachment(filename: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!/^[a-f0-9-]+\.(png|jpg|gif|webp)$/i.test(filename)) return null;

  const type = SIGNATURES.find((s) => filename.endsWith(`.${s.ext}`));
  if (!type) return null;

  try {
    const buffer = await fs.readFile(path.join(UPLOAD_DIR, filename));
    return { buffer, mime: type.mime };
  } catch {
    return null;
  }
}
