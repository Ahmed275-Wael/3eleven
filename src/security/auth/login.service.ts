// MODULE 4.3 — Login Service

import type { UsersRepository } from '../users/users.repository.js';
import type { SessionService } from '../session/session.service.js';
import { verifyPassword } from '../crypto/argon2.js';
import { InvalidCredentialsError, UnverifiedEmailError } from '../errors/index.js';

export interface LoginInput {
  username: string;
  password: string;
}

export class LoginService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly sessionService: SessionService,
  ) {}

  async login(input: LoginInput): Promise<string> {
    const normalized = input.username.toLowerCase();
    const user = await this.usersRepo.findByUsername(normalized);

    if (!user || user.deletedAt) throw new InvalidCredentialsError();
    if (!user.emailVerified) throw new UnverifiedEmailError();

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsError();

    const sessionId = await this.sessionService.createSession({
      userId: user.id,
      username: user.username,
      authMethod: 'password',
    });

    return sessionId;
  }
}
