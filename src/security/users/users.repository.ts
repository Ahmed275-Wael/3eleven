// MODULE 2.1 — User Repository

import { eq, and, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users } from '../db/schema.js';
import { DuplicateUsernameError, DuplicateEmailError } from '../errors/index.js';
import type * as schema from '../db/schema.js';

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class UsersRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async createUser(input: CreateUserInput): Promise<User> {
    const normalized = input.username.toLowerCase();
    try {
      const [row] = await this.db
        .insert(users)
        .values({
          username: normalized,
          email: input.email,
          passwordHash: input.passwordHash,
        })
        .returning();
      return this.toUser(row);
    } catch (err: any) {
      if (err.code === '23505') {
        if (err.constraint_name?.includes('username') || err.detail?.includes('username')) {
          throw new DuplicateUsernameError();
        }
        if (err.constraint_name?.includes('email') || err.detail?.includes('email')) {
          throw new DuplicateEmailError();
        }
      }
      throw err;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    const normalized = username.toLowerCase();
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.username, normalized), isNull(users.deletedAt)));
    return row ? this.toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));
    return row ? this.toUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    return row ? this.toUser(row) : null;
  }

  async setEmailVerified(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updatePasswordHash(userId: string, newHash: string): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async softDelete(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  private toUser(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      emailVerified: row.emailVerified,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }
}
