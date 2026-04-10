// MODULE 11.2 — Blacklist Service

import type { BlacklistRepository, BlacklistEntry } from './blacklist.repository.js';
import { DuplicateBlacklistError } from './errors/index.js';

export class BlacklistService {
  constructor(private readonly repo: BlacklistRepository) {}

  async addEmail(userId: string, email: string): Promise<BlacklistEntry> {
    const normalised = email.toLowerCase();
    try {
      return await this.repo.add(userId, normalised, 'email');
    } catch (err: any) {
      if (err.code === '23505') throw new DuplicateBlacklistError();
      throw err;
    }
  }

  async addDomain(userId: string, domain: string): Promise<BlacklistEntry> {
    const normalised = domain.toLowerCase();
    try {
      return await this.repo.add(userId, normalised, 'domain');
    } catch (err: any) {
      if (err.code === '23505') throw new DuplicateBlacklistError();
      throw err;
    }
  }

  async remove(userId: string, value: string): Promise<boolean> {
    const normalised = value.toLowerCase();
    return this.repo.remove(userId, normalised);
  }

  async isBlacklisted(userId: string, email: string): Promise<boolean> {
    const normalised = email.toLowerCase();
    return this.repo.isBlacklisted(userId, normalised);
  }

  async listEntries(userId: string): Promise<BlacklistEntry[]> {
    return this.repo.listByUser(userId);
  }
}
