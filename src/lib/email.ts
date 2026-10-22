import "server-only";
import { env } from "./env";

type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Email transport. Uses Resend when RESEND_API_KEY is set; otherwise prints to the
 * server console so verification and reset links are usable in local development.
 */
export async function sendEmail(mail: Mail) {
  if (!env.RESEND_API_KEY) {
    console.info(`\n[email:dev] to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
    return { delivered: false as const };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) {
    console.error("email send failed", res.status, await res.text().catch(() => ""));
    return { delivered: false as const };
  }
  return { delivered: true as const };
}

const wrap = (title: string, body: string, cta: { label: string; url: string }) => `
<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#1a1c17">
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  <p style="font-size:15px;line-height:1.6;color:#565b4d">${body}</p>
  <p style="margin:24px 0"><a href="${cta.url}" style="background:#a3e635;color:#14200a;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">${cta.label}</a></p>
  <p style="font-size:12px;color:#565b4d">If the button doesn't work, paste this link into your browser:<br>${cta.url}</p>
</div>`;

export function sendVerificationEmail(to: string, name: string, url: string) {
  return sendEmail({
    to,
    subject: "Verify your email address",
    text: `Hi ${name},\n\nConfirm your email to finish setting up Invoicely:\n${url}\n\nThis link expires in 24 hours.`,
    html: wrap("Verify your email", `Hi ${escapeHtml(name)}, confirm your email address to finish setting up your account. This link expires in 24 hours.`, { label: "Verify email", url }),
  });
}

export function sendPasswordResetEmail(to: string, name: string, url: string) {
  return sendEmail({
    to,
    subject: "Reset your password",
    text: `Hi ${name},\n\nReset your password using this link:\n${url}\n\nThis link expires in 1 hour. If you didn't ask for it, you can ignore this email.`,
    html: wrap("Reset your password", `Hi ${escapeHtml(name)}, use the button below to choose a new password. The link expires in 1 hour. If you didn't request this, you can ignore this email.`, { label: "Reset password", url }),
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
