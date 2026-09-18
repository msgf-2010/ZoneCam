export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailService implements EmailService {
  async send(message: EmailMessage) {
    console.info(`[email] to=${message.to} subject=${message.subject}\n${message.text}`);
  }
}

export function createEmailService(): EmailService {
  return new ConsoleEmailService();
}
