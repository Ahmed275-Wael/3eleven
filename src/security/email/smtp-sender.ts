// SMTP Email Sender — implements EmailSender & ResetEmailSender interfaces

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailSender } from '../auth/registration.service.js';
import type { ResetEmailSender } from '../auth/password-reset.service.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

function loadConfigFromEnv(): SmtpConfig {
  return {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.SMTP_FROM || 'noreply@leadgen.local',
  };
}

export class SmtpEmailSender implements EmailSender, ResetEmailSender {
  private transporter: Transporter;
  private from: string;

  constructor(config?: SmtpConfig) {
    const cfg = config ?? loadConfigFromEnv();
    this.from = cfg.from ?? 'noreply@leadgen.local';

    const auth = cfg.user && cfg.pass
      ? { user: cfg.user, pass: cfg.pass }
      : undefined;

    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure ?? false,
      auth,
      // Allow self-signed certs in dev
      tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Your Verification Code',
      text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.`,
      html: `
        <h2>Email Verification</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing: 6px; font-size: 36px; text-align: center;">${code}</h1>
        <p>This code expires in 15 minutes.</p>
      `,
    });
  }

  async sendResetCode(email: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${code}\n\nThis code expires in 1 hour.`,
      html: `
        <h2>Password Reset</h2>
        <p>Your password reset code is:</p>
        <h1 style="letter-spacing: 6px; font-size: 36px; text-align: center;">${code}</h1>
        <p>This code expires in 1 hour. If you did not request this, ignore this email.</p>
      `,
    });
  }

  /** Verify SMTP connection is reachable */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
