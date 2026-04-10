// MODULE 11.1 — Lists Service

import type { ListsRepository, LeadList } from './lists.repository.js';
import type { LeadsRepository, Lead } from './leads.repository.js';
import { ListNotFoundError, ValidationError } from './errors/index.js';

export class ListsService {
  constructor(
    private readonly listsRepo: ListsRepository,
    private readonly leadsRepo: LeadsRepository,
  ) {}

  async createList(userId: string, name: string): Promise<LeadList> {
    const trimmed = name.trim();
    if (!trimmed) throw new ValidationError('List name cannot be empty');
    return this.listsRepo.createList(userId, trimmed);
  }

  async getList(userId: string, listId: string): Promise<LeadList> {
    const list = await this.listsRepo.findById(userId, listId);
    if (!list || list.userId !== userId) throw new ListNotFoundError();
    return list;
  }

  async renameList(userId: string, listId: string, name: string): Promise<LeadList> {
    await this.getList(userId, listId);
    const updated = await this.listsRepo.updateList(userId, listId, { name });
    if (!updated) throw new ListNotFoundError();
    return updated;
  }

  async deleteList(userId: string, listId: string): Promise<void> {
    await this.getList(userId, listId);
    await this.listsRepo.deleteList(userId, listId);
  }

  async addLeadsToList(
    userId: string,
    listId: string,
    leadIds: string[],
  ): Promise<void> {
    await this.getList(userId, listId);
    await this.listsRepo.addMembers(listId, leadIds);
  }

  async removeLeadsFromList(
    userId: string,
    listId: string,
    leadIds: string[],
  ): Promise<void> {
    await this.listsRepo.removeMembers(listId, leadIds);
  }

  async getListLeads(userId: string, listId: string): Promise<Lead[]> {
    await this.getList(userId, listId);
    return this.listsRepo.getListLeads(userId, listId);
  }

  async getUserLists(userId: string): Promise<LeadList[]> {
    return this.listsRepo.listsByUser(userId);
  }
}
