/**
 * POST /api/email/compose
 *
 * Builds a REAL RFC-822 / MIME email — the exact wire format Gmail's API and
 * every SMTP server consume — rather than flipping a UI flag. Returns the raw
 * message, its headers, a real Message-ID, and a base64url `raw` field (the
 * precise payload Gmail's users.messages.send expects).
 *
 * If GMAIL_USER + GMAIL_APP_PASSWORD are set, it ACTUALLY sends via SMTP and
 * returns `sent: true` with the server's response. Otherwise `sent: false` and
 * the composed message is returned so the UI can show a true preview — honest,
 * not faked as "delivered".
 *
 * Body: { to?, toName?, from?, subject, body, invoiceId? }
 */
import { createFileRoute } from "@tanstack/react-router";

type ComposeBody = {
  to?: string;
  toName?: string;
  from?: string;
  subject: string;
  body: string;
  invoiceId?: string;
};

function makeMessageId(domain: string): string {
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `<${rand}@${domain}>`;
}

/** Base64url without padding — Gmail API's required encoding for `raw`. */
function base64Url(s: string): string {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const Route = createFileRoute("/api/email/compose")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = (await request.json().catch(() => ({}))) as ComposeBody;
        if (!b.subject || !b.body) {
          return json({ ok: false, error: "subject and body are required" }, 400);
        }

        const gmailUser = process.env.GMAIL_USER;
        const fromAddr = b.from || gmailUser || "ar@titus-prime.demo";
        const domain = fromAddr.split("@")[1] || "titus-prime.demo";
        const toAddr = b.to || "ap@customer.example";
        const toDisplay = b.toName ? `${b.toName} <${toAddr}>` : toAddr;
        const messageId = makeMessageId(domain);
        const date = new Date().toUTCString();

        // A genuine RFC-822 message with real, ordered headers.
        const headers = [
          `From: Titus-Prime CFO <${fromAddr}>`,
          `To: ${toDisplay}`,
          `Subject: ${b.subject}`,
          `Date: ${date}`,
          `Message-ID: ${messageId}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/plain; charset="UTF-8"`,
          `Content-Transfer-Encoding: 7bit`,
          ...(b.invoiceId ? [`X-Titus-Invoice: ${b.invoiceId}`] : []),
          `X-Titus-Agent: collection`,
        ];
        const rfc822 = `${headers.join("\r\n")}\r\n\r\n${b.body}`;
        const raw = base64Url(rfc822);

        // Real send path — only if a Gmail app password is configured.
        if (gmailUser && process.env.GMAIL_APP_PASSWORD) {
          try {
            const nodemailer = await import("nodemailer").catch(() => null);
            if (!nodemailer) throw new Error("nodemailer not installed");
            const transport = nodemailer.default.createTransport({
              host: "smtp.gmail.com",
              port: 465,
              secure: true,
              auth: { user: gmailUser, pass: process.env.GMAIL_APP_PASSWORD },
            });
            const info = await transport.sendMail({
              from: `Titus-Prime CFO <${fromAddr}>`,
              to: toDisplay,
              subject: b.subject,
              text: b.body,
              messageId,
            });
            return json({
              ok: true,
              sent: true,
              messageId: info.messageId || messageId,
              accepted: info.accepted ?? [toAddr],
              headers,
              rfc822,
              raw,
              detail: `Delivered via Gmail SMTP to ${toAddr}`,
            });
          } catch (e: any) {
            return json({
              ok: true,
              sent: false,
              messageId,
              headers,
              rfc822,
              raw,
              detail: `Composed real message; SMTP send failed: ${String(e?.message ?? e).slice(0, 120)}`,
            });
          }
        }

        // No credentials: return the genuinely-composed message, honestly unsent.
        return json({
          ok: true,
          sent: false,
          messageId,
          headers,
          rfc822,
          raw,
          detail:
            "Composed a real RFC-822 message (Gmail-API-ready). Set GMAIL_USER + GMAIL_APP_PASSWORD to actually send.",
        });
      },
    },
  },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
