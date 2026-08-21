export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML alternative body — plain-text `text` is always sent too as a fallback. */
  html?: string;
}

export interface NotificationProvider {
  readonly name: "smtp" | "console" | "disabled";
  send(message: EmailMessage): Promise<void>;
}
