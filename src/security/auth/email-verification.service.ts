// MODULE 4.2 — Email Verification Service

import type Redis from 'ioredis';
import type { UsersRepository } from '../users/users.repository.js';
import type { SessionService } from '../session/session.service.js';
import { consumeCode, generateCode } from '../crypto/verification-code.js';
import {
  InvalidVerificationCodeError,
  AlreadyVerifiedError,
  UserNotFoundError,
} from '../errors/index.js';

export interface VerifyEmailInput {
  email: string;
  code: string;
}

export class EmailVerificationService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly redis: Redis,
    private readonly sessionService: SessionService,
  ) {}

  async verifyEmail(input: VerifyEmailInput): Promise<string> {
    const user = await this.usersRepo.findByEmail(input.email);
    if (!user) throw new UserNotFoundError();
    if (user.emailVerified) throw new AlreadyVerifiedError();

    const valid = await consumeCode(this.redis, input.email, input.code);
    if (!valid) throw new InvalidVerificationCodeError();

    await this.usersRepo.setEmailVerified(user.id);

    const sessionId = await this.sessionService.createSession({
      userId: user.id,
      username: user.username,
      authMethod: 'password',
    });

    return sessionId;
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.usersRepo.findByEmail(email);
    if (!user) throw new UserNotFoundError();
    if (user.emailVerified) throw new AlreadyVerifiedError();

    await generateCode(this.redis, email);
  }
}
