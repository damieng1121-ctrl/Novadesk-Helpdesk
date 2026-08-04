import type { EmailMessage, NotificationProvider } from "./types";
import { ConsoleNotificationProvider } from "./console";
import { SmtpNotificationProvider } from "./smtp";

export type { NotificationProvider } from "./types";

/** Wraps any provider so a flaky/misconfigured mail server never breaks the ticket flow it's notifying about. */
class SafeNotificationProvider implements NotificationProvider {
  constructor(private inner: NotificationProvider) {}
  get name() {
    return this.inner.name;
  }
  async send(message: EmailMessage): Promise<void> {
    try {
      await this.inner.send(message);
    } catch (err) {
      console.error(`[notifications:${this.inner.name}] send failed`, err);
    }
  }
}

class DisabledNotificationProvider implements NotificationProvider {
  readonly name = "disabled" as const;
  async send(): Promise<void> {}
}

let cached: NotificationProvider | null = null;

/**
 * Notification sending is platform-wide (one SMTP relay), unlike the AI
 * provider which is per-tenant — schools don't bring their own mail server.
 */
export function getNotificationProvider(): NotificationProvider {
  if (cached) return cached;

  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    cached = new SafeNotificationProvider(
      new SmtpNotificationProvider({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM ?? "Novadesk Helpdesk <no-reply@novadesk.app>",
      }),
    );
  } else if (process.env.NODE_ENV === "development") {
    cached = new SafeNotificationProvider(new ConsoleNotificationProvider());
  } else {
    cached = new DisabledNotificationProvider();
  }

  return cached;
}
