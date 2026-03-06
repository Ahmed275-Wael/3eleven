// MODULE 4.1 — Registration Service

import type Redis from 'ioredis';
import type { UsersRepository } from '../users/users.repository.js';
import { hashPassword } from '../crypto/argon2.js';
import { generateCode } from '../crypto/verification-code.js';
import { DuplicateUsernameError, DuplicateEmailError, ValidationError } from '../errors/index.js';

export interface EmailSender {
  sendVerificationCode(email: string, code: string): Promise<void>;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResult {
  userId: string;
  username: string;
  email: string;
}

const USERNAME_RE = /^[a-zA-Z0-9_-]+$/;

export class RegistrationService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly redis: Redis,
    private readonly emailSender: EmailSender,
  ) {}

  async register(input: RegisterInput): Promise<RegisterResult> {
    // Validate input
    if (input.username.length < 3 || input.username.length > 30) {
      throw new ValidationError('Username must be 3-30 characters', ['username']);
    }
    if (!USERNAME_RE.test(input.username)) {
      throw new ValidationError('Username may only contain letters, numbers, hyphens and underscores', ['username']);
    }
    if (input.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters', ['password']);
    }

    // Check uniqueness before expensive hashing
    const existingUsername = await this.usersRepo.findByUsername(input.username);
    if (existingUsername) throw new DuplicateUsernameError();

    const existingEmail = await this.usersRepo.findByEmail(input.email);
    if (existingEmail) throw new DuplicateEmailError();

    // Hash and insert
    const passwordHash = await hashPassword(input.password);
    const user = await this.usersRepo.createUser({
      username: input.username,
      email: input.email,
      passwordHash,
    });

    // Send verification email (best-effort)
    try {
      const code = await generateCode(this.redis, input.email);
      await this.emailSender.sendVerificationCode(input.email, code);
    } catch {
      // best-effort — user row already created
    }

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
    };
  }
}
