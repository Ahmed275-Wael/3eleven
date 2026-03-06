/**
 * Test helper — in-process fake SMTP server using smtp-server.
 * Captures all outbound emails for assertion in tests.
 *
 * Usage in tests:
 *   const { port, getEmails, clearEmails, teardown } = await setupTestSmtp();
 *   afterAll(() => teardown());
 *
 *   // ... trigger some action that sends email ...
 *   const emails = getEmails();
 *   expect(emails[0].to).toContain('john@example.com');
 *   expect(emails[0].data).toContain('Verification Code');
 */

import { SMTPServer } from 'smtp-server';

export interface CapturedEmail {
  from: string;
  to: string[];
  data: string;
}

export interface TestSmtp {
  port: number;
  getEmails: () => CapturedEmail[];
  clearEmails: () => void;
  teardown: () => Promise<void>;
}

export async function setupTestSmtp(): Promise<TestSmtp> {
  const emails: CapturedEmail[] = [];

  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH'],
    onData(stream, session, callback) {
      let data = '';
      stream.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      stream.on('end', () => {
        emails.push({
          from: session.envelope.mailFrom
            ? (session.envelope.mailFrom as any).address ?? ''
            : '',
          to: session.envelope.rcptTo.map((r: any) => r.address),
          data,
        });
        callback();
      });
    },
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.server.address();
      if (addr && typeof addr === 'object') {
        resolve(addr.port);
      } else {
        reject(new Error('Could not determine SMTP test port'));
      }
    });
    server.on('error', reject);
  });

  return {
    port,
    getEmails: () => [...emails],
    clearEmails: () => {
      emails.length = 0;
    },
    teardown: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
