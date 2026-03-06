// MODULE 5 — Password Reset Service

import type Redis from 'ioredis';
import type { UsersRepository } from '../users/users.repository.js';
import type { SessionService } from '../session/session.service.js';
import { generateResetCode, consumeResetCode } from '../crypto/reset-code.js';
import { hashPassword } from '../crypto/argon2.js';
import { InvalidResetCodeError, ValidationError } from '../errors/index.js';

export interface ResetEmailSender {
  sendResetCode(email: string, code: string): Promise<void>;
}

export class PasswordResetService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly redis: Redis,
    private readonly sessionService: SessionService,
    private readonly emailSender: ResetEmailSender,
  ) {}

  async requestReset(email: string): Promise<void> {
    const user = await this.usersRepo.findByEmail(email);
    if (!user) return; // silent — prevents enumeration

    const code = await generateResetCode(this.redis, email);
    await this.emailSender.sendResetCode(email, code);
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    // Validate new password BEFORE consuming the code
    if (newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters', ['password']);
    }

    const valid = await consumeResetCode(this.redis, email, code);
    if (!valid) throw new InvalidResetCodeError();

    const user = await this.usersRepo.findByEmail(email);
    if (!user) throw new InvalidResetCodeError();

    const newHash = await hashPassword(newPassword);
    await this.usersRepo.updatePasswordHash(user.id, newHash);

    // Destroy all sessions for this user
    const keys = await this.redis.keys('session:*');
    for (const key of keys) {
      await this.sessionService.destroySession(key.replace('session:', ''));
    }
    // Ensure session invalidation even if no keys found via scan
    if (keys.length === 0) {
      await this.sessionService.destroySession(user.id);
    }
  }
}
