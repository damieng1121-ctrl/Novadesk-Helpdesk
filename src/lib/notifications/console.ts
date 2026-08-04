import type { EmailMessage, NotificationProvider } from "./types";

/** Dev/demo default: just logs what would have been sent. */
export class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = "console" as const;

  async send(message: EmailMessage): Promise<void> {
    console.log(`[notifications] would email ${message.to}: "${message.subject}"\n${message.text}`);
  }
}
