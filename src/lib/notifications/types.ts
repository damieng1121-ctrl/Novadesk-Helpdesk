export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface NotificationProvider {
  readonly name: "smtp" | "console" | "disabled";
  send(message: EmailMessage): Promise<void>;
}
