// MODULE 10.2 — Badge Service

import type { BadgeEventsRepository, BadgeEvent, BadgeAttendee, AttendeeInput } from './badge-events.repository.js';
import type { LeadsService } from '../leads/leads.service.js';
import type { Lead } from '../leads/leads.repository.js';
import {
  EventNotFoundError,
  AttendeeNotFoundError,
  AlreadyScannedError,
} from './errors/index.js';

export class BadgeService {
  constructor(
    private readonly badgeRepo: BadgeEventsRepository,
    private readonly leadsService: LeadsService,
  ) {}

  async createEvent(userId: string, name: string, eventDate?: string): Promise<BadgeEvent> {
    return this.badgeRepo.createEvent({ userId, name, eventDate });
  }

  async getEvent(userId: string, eventId: string): Promise<BadgeEvent> {
    const event = await this.badgeRepo.findEventById(userId, eventId);
    if (!event) throw new EventNotFoundError();
    return event;
  }

  async listEvents(userId: string): Promise<BadgeEvent[]> {
    return this.badgeRepo.listEventsByUser(userId);
  }

  async uploadAttendees(
    userId: string,
    eventId: string,
    attendees: AttendeeInput[],
  ): Promise<{ inserted: number }> {
    const event = await this.badgeRepo.findEventById(userId, eventId);
    if (!event) throw new EventNotFoundError();
    const inserted = await this.badgeRepo.addAttendees(eventId, attendees);
    return { inserted };
  }

  async getAttendees(userId: string, eventId: string): Promise<BadgeAttendee[]> {
    const event = await this.badgeRepo.findEventById(userId, eventId);
    if (!event) throw new EventNotFoundError();
    return this.badgeRepo.getAttendees(eventId);
  }

  async scanBadge(
    userId: string,
    eventId: string,
    attendeeId: string,
  ): Promise<{ lead: Lead; attendee: BadgeAttendee }> {
    const event = await this.badgeRepo.findEventById(userId, eventId);
    if (!event) throw new EventNotFoundError();

    const attendee = await this.badgeRepo.findAttendeeById(eventId, attendeeId);
    if (!attendee) throw new AttendeeNotFoundError();
    if (attendee.scannedAt !== null) throw new AlreadyScannedError();

    const lead = await this.leadsService.captureLead({
      userId,
      email: attendee.email,
      firstName: attendee.firstName,
      lastName: attendee.lastName,
      company: attendee.company ?? undefined,
      jobTitle: attendee.jobTitle ?? undefined,
      captureMethod: 'badge_scan',
      captureSourceId: eventId,
    });

    await this.badgeRepo.scanAttendee(attendeeId, lead.id);
    return { lead, attendee };
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const deleted = await this.badgeRepo.deleteEvent(userId, eventId);
    if (!deleted) throw new EventNotFoundError();
  }
}
