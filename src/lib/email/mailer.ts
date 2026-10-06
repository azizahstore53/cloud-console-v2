import nodemailer from "nodemailer";

/**
 * mailer
 * ---------------------------------------------------------------------------
 * Sends email through your own SMTP server (nodemailer works with any SMTP
 * provider — a self-hosted Postfix/Exim, cPanel/CyberPanel mailbox,
 * Zoho/Google Workspace, etc. — not tied to any specific email service).
 *
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Optional:
 *   SMTP_SECURE=true   — use implicit TLS (typically port 465).
 *                        Leave unset/false for STARTTLS (typically port 587),
 *                        which is what most mail servers expect and is the
 *                        default here.
 *
 * The transporter is created once and reused (not per-request) — creating a
 * new SMTP connection for every email is unnecessary overhead and some mail
 * servers rate-limit new connections per minute.
 */

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_TLS_SERVERNAME } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "Email is not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env"
    );
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Only needed if SMTP_HOST (e.g. "mail.example.com", a conventional MX
    // alias) doesn't match the name on the server's certificate (e.g.
    // "example.com"). Setting this tells Node which hostname to validate
    // the cert against — certificate verification stays ON, this just
    // corrects *which* name it checks, unlike rejectUnauthorized: false
    // which would turn verification off entirely.
    ...(SMTP_TLS_SERVERNAME ? { tls: { servername: SMTP_TLS_SERVERNAME } } : {}),
  });

  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string; text: string }) {
  const from = process.env.SMTP_FROM;
  if (!from) throw new Error("SMTP_FROM is not configured.");

  await getTransporter().sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await sendMail({
    to,
    subject: "Reset Password — CloudConsole",
    text: `Kami menerima permintaan reset password untuk akun ini.\n\nBuka link berikut untuk membuat password baru (berlaku 1 jam):\n${resetUrl}\n\nKalau kamu tidak meminta ini, abaikan saja email ini — password kamu tidak berubah.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin-bottom: 4px;">Reset Password</h2>
        <p style="color: #555;">Kami menerima permintaan reset password untuk akun ini.</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}"
             style="background: #111827; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Reset Password
          </a>
        </p>
        <p style="color: #888; font-size: 13px;">Link ini berlaku selama 1 jam. Kalau kamu tidak meminta reset password, abaikan email ini — password kamu tidak akan berubah.</p>
        <p style="color: #aaa; font-size: 12px; word-break: break-all;">Atau salin link ini: ${resetUrl}</p>
      </div>
    `,
  });
}
