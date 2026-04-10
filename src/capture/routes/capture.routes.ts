// MODULE 10.5 — Capture Routes

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { setSessionServiceForAuth, requireAuth } from '../../security/middleware/require-auth.js';
import { SecurityError } from '../../security/errors/index.js';
import { CaptureError } from '../errors/index.js';
import { LeadsError } from '../../leads/errors/index.js';
import type { FormsService } from '../forms.service.js';
import type { BadgeService } from '../badge.service.js';
import type { CsvService } from '../csv.service.js';
import type { LeadsService } from '../../leads/leads.service.js';
import { generateQrCode } from '../qr.service.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createFormSchema = z.object({
  name: z.string().min(1),
  fields: z.array(z.unknown()).default([]),
  qualificationConfig: z.record(z.unknown()).optional(),
  redirectUrl: z.string().url().optional(),
});

const updateFormSchema = z.object({
  name: z.string().min(1).optional(),
  fields: z.array(z.unknown()).optional(),
  qualificationConfig: z.record(z.unknown()).optional(),
  redirectUrl: z.string().url().optional(),
});

const submitFormSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
});

const createEventSchema = z.object({
  name: z.string().min(1),
  eventDate: z.string().optional(),
});

const attendeesSchema = z.object({
  attendees: z.array(
    z.object({
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function captureRoutes(app: FastifyInstance): Promise<void> {
  const formsService: FormsService = (app as any).formsService;
  const badgeService: BadgeService = (app as any).badgeService;
  const csvService: CsvService = (app as any).csvService;
  const leadsService: LeadsService = (app as any).leadsService;
  const sessionService = (app as any).sessionService;

  setSessionServiceForAuth(sessionService);

  // ---------------------------------------------------------------------------
  // Error handler
  // ---------------------------------------------------------------------------

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof SecurityError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error instanceof CaptureError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error instanceof LeadsError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error.name === 'ZodError' || (error as any).issues) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: error.message });
    }
    if (error.validation) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: error.message });
    }
    request.log.error({ err: error }, 'Unhandled capture route error');
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  // =========================================================================
  // Forms
  // =========================================================================

  app.post('/forms', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const body = createFormSchema.parse(request.body);
    const form = await formsService.createForm(userId, body);
    return reply.status(201).send(form);
  });

  app.get('/forms', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const status = (request.query as any).status as string | undefined;
    const forms = await formsService.listForms(userId, status);
    return reply.status(200).send(forms);
  });

  app.get('/forms/:formId', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { formId } = request.params as { formId: string };
    const form = await formsService.getForm(userId, formId);
    return reply.status(200).send(form);
  });

  app.patch('/forms/:formId', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { formId } = request.params as { formId: string };
    const body = updateFormSchema.parse(request.body);
    const form = await formsService.updateForm(userId, formId, body);
    return reply.status(200).send(form);
  });

  app.patch('/forms/:formId/publish', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { formId } = request.params as { formId: string };
    const form = await formsService.publishForm(userId, formId);
    return reply.status(200).send(form);
  });

  app.patch('/forms/:formId/archive', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { formId } = request.params as { formId: string };
    const form = await formsService.archiveForm(userId, formId);
    return reply.status(200).send(form);
  });

  app.delete('/forms/:formId', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { formId } = request.params as { formId: string };
    await formsService.deleteForm(userId, formId);
    return reply.status(204).send();
  });

  app.get('/forms/:formId/qr', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { formId } = request.params as { formId: string };
    // Verify ownership first
    await formsService.getForm(userId, formId);
    const baseUrl = (request.headers['x-base-url'] as string) ?? 'https://app.example.com';
    const qrCode = await generateQrCode(formId, baseUrl);
    return reply.status(200).send({ qrCode });
  });

  // Public endpoint — no auth
  app.post('/forms/:formId/submit', async (request, reply) => {
    const { formId } = request.params as { formId: string };
    const body = submitFormSchema.parse(request.body);
    const lead = await formsService.submitForm(formId, body);
    return reply.status(201).send(lead);
  });

  // =========================================================================
  // Badge Events
  // =========================================================================

  app.post('/badge-events', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const body = createEventSchema.parse(request.body);
    const event = await badgeService.createEvent(userId, body.name, body.eventDate);
    return reply.status(201).send(event);
  });

  app.get('/badge-events', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const events = await badgeService.listEvents(userId);
    return reply.status(200).send(events);
  });

  app.get('/badge-events/:eventId', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { eventId } = request.params as { eventId: string };
    const event = await badgeService.getEvent(userId, eventId);
    return reply.status(200).send(event);
  });

  app.delete('/badge-events/:eventId', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { eventId } = request.params as { eventId: string };
    await badgeService.deleteEvent(userId, eventId);
    return reply.status(204).send();
  });

  app.post(
    '/badge-events/:eventId/attendees',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const { eventId } = request.params as { eventId: string };
      const body = attendeesSchema.parse(request.body);
      const result = await badgeService.uploadAttendees(userId, eventId, body.attendees);
      return reply.status(201).send(result);
    },
  );

  app.get(
    '/badge-events/:eventId/attendees',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const { eventId } = request.params as { eventId: string };
      const attendees = await badgeService.getAttendees(userId, eventId);
      return reply.status(200).send(attendees);
    },
  );

  app.post(
    '/badge-events/:eventId/scan/:attendeeId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const { eventId, attendeeId } = request.params as { eventId: string; attendeeId: string };
      const result = await badgeService.scanBadge(userId, eventId, attendeeId);
      return reply.status(201).send(result);
    },
  );

  // =========================================================================
  // Leads CSV import / export
  // =========================================================================

  app.post('/leads/import', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;

    try {
      const data = await (request as any).file();
      if (!data) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'No file uploaded' });
      }
      const csvContent = await data.toBuffer().then((b: Buffer) => b.toString('utf-8'));
      const columnMapRaw = (request.query as any).columnMap;
      const dedupMode = ((request.query as any).dedupMode as 'skip' | 'overwrite' | 'merge') ?? 'skip';
      const columnMap = columnMapRaw ? JSON.parse(columnMapRaw) : { email: 'email' };

      const result = await csvService.importLeads(userId, csvContent, columnMap, dedupMode);
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err instanceof LeadsError || err instanceof CaptureError) throw err;
      return reply
        .status(400)
        .send({ error: 'IMPORT_ERROR', message: err.message ?? 'Import failed' });
    }
  });

  app.get('/leads/export', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const { leads: leadList } = await leadsService.listLeads(userId, {}, { limit: 10000, offset: 0 });
    const csv = await csvService.exportLeads(leadList);
    reply
      .status(200)
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="leads.csv"');
    return reply.send(csv);
  });
}
