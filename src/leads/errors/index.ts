// ─── Base ───
export class LeadsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ─── Lead errors ───
export class DuplicateLeadError extends LeadsError {
  constructor() {
    super('Lead with this email already exists', 'DUPLICATE_LEAD', 409);
  }
}

export class BlacklistedLeadError extends LeadsError {
  constructor() {
    super('Lead email or domain is blacklisted', 'BLACKLISTED_LEAD', 422);
  }
}

export class LeadNotFoundError extends LeadsError {
  constructor() {
    super('Lead not found', 'LEAD_NOT_FOUND', 404);
  }
}

export class InvalidLeadStatusError extends LeadsError {
  constructor(status: string) {
    super(`Invalid lead status: ${status}`, 'INVALID_STATUS', 400);
  }
}

// ─── List errors ───
export class ListNotFoundError extends LeadsError {
  constructor() {
    super('List not found', 'LIST_NOT_FOUND', 404);
  }
}

// ─── Blacklist errors ───
export class DuplicateBlacklistError extends LeadsError {
  constructor() {
    super('Entry already blacklisted', 'DUPLICATE_BLACKLIST', 409);
  }
}

// ─── Validation ───
export class ValidationError extends LeadsError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}
