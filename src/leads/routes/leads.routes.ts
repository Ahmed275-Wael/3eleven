// MODULE 16 — Leads Routes

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { setSessionServiceForAuth, requireAuth } from '../../security/middleware/require-auth.js';
import { SecurityError } from '../../security/errors/index.js';
import { LeadsError } from '../errors/index.js';
import type { LeadsService } from '../leads.service.js';
import type { ListsService } from '../lists.service.js';
import type { BlacklistService } from '../blacklist.service.js';

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'meeting_booked', 'won', 'lost'] as const;

// Request body schemas
const captureLeadSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  captureMethod: z.string().optional(),
  captureSourceId: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  qualificationScore: z.number().int().optional(),
  qualificationAnswers: z.record(z.unknown()).optional(),
});

const patchLeadSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  qualificationScore: z.number().int().optional(),
  qualificationAnswers: z.record(z.unknown()).optional(),
  status: z.enum(VALID_STATUSES).optional(),
});

const addTagSchema = z.object({
  tag: z.string().min(1),
});

const addNoteSchema = z.object({
  body: z.string().min(1),
});

const createListSchema = z.object({
  name: z.string().min(1),
});

const addMembersSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
});

const blacklistAddSchema = z.object({
  value: z.string().min(1),
  type: z.enum(['email', 'domain']),
});

export async function leadsRoutes(app: FastifyInstance): Promise<void> {
  const leadsService: LeadsService = (app as any).leadsService;
  const listsService: ListsService = (app as any).listsService;
  const blacklistService: BlacklistService = (app as any).blacklistService;
  const sessionService = (app as any).sessionService;

  setSessionServiceForAuth(sessionService);

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof SecurityError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }
    if (error instanceof LeadsError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }
    if (error.name === 'ZodError' || (error as any).issues) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
    request.log.error({ err: error }, 'Unhandled leads route error');
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  // ─── Blacklist routes (must be before /:id to avoid parameterized matching) ───

  app.post('/blacklist', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const body = blacklistAddSchema.parse(request.body);
    let entry;
    if (body.type === 'email') {
      entry = await blacklistService.addEmail(userId, body.value);
    } else {
      entry = await blacklistService.addDomain(userId, body.value);
    }
    return reply.status(201).send(entry);
  });

  app.get('/blacklist', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const entries = await blacklistService.listEntries(userId);
    return reply.status(200).send(entries);
  });

  app.delete('/blacklist/:value', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { value } = request.params as { value: string };
    await blacklistService.remove(userId, value);
    return reply.status(204).send();
  });

  // ─── List routes (before /:id to avoid parameterized matching) ───

  app.get('/lists', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const lists = await listsService.getUserLists(userId);
    return reply.status(200).send(lists);
  });

  app.post('/lists', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const body = createListSchema.parse(request.body);
    const list = await listsService.createList(userId, body.name);
    return reply.status(201).send(list);
  });

  app.post('/lists/:listId/members', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { listId } = request.params as { listId: string };
    const body = addMembersSchema.parse(request.body);
    await listsService.addLeadsToList(userId, listId, body.leadIds);
    return reply.status(200).send({ ok: true });
  });

  app.delete('/lists/:listId', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { listId } = request.params as { listId: string };
    await listsService.deleteList(userId, listId);
    return reply.status(204).send();
  });

  // ─── Lead CRUD routes ───

  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const query = request.query as Record<string, string>;
    const filters: Record<string, string> = {};
    if (query.status) filters.status = query.status;
    if (query.captureMethod) filters.captureMethod = query.captureMethod;
    const pagination = {
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };
    const result = await leadsService.listLeads(userId, filters, pagination);
    return reply.status(200).send(result);
  });

  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const body = captureLeadSchema.parse(request.body);
    const lead = await leadsService.captureLead({ ...body, userId });
    return reply.status(201).send(lead);
  });

  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const lead = await leadsService.getLead(userId, id);
    return reply.status(200).send(lead);
  });

  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const body = patchLeadSchema.parse(request.body);
    const lead = await leadsService.updateLead(userId, id, body);
    return reply.status(200).send(lead);
  });

  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    await leadsService.deleteLead(userId, id);
    return reply.status(204).send();
  });

  // ─── Tags routes ───

  app.post('/:id/tags', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const body = addTagSchema.parse(request.body);
    await leadsService.addTag(userId, id, body.tag);
    return reply.status(200).send({ ok: true });
  });

  app.delete('/:id/tags/:tag', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id, tag } = request.params as { id: string; tag: string };
    await leadsService.removeTag(userId, id, tag);
    return reply.status(204).send();
  });

  // ─── Notes routes ───

  app.get('/:id/notes', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const notes = await leadsService.getLeadNotes(userId, id);
    return reply.status(200).send(notes);
  });

  app.post('/:id/notes', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as { id: string };
    const body = addNoteSchema.parse(request.body);
    const note = await leadsService.addNote(userId, id, body.body);
    return reply.status(201).send(note);
  });
}
