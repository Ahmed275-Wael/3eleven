// ─── Base ───
export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ─── Validation ───
export class ValidationError extends SecurityError {
  constructor(
    message: string,
    public readonly fields: string[] = [],
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

// ─── Auth ───
export class InvalidCredentialsError extends SecurityError {
  constructor() {
    super('Invalid credentials', 'INVALID_CREDENTIALS', 401);
  }
}

export class UnverifiedEmailError extends SecurityError {
  constructor() {
    super('Email not verified', 'EMAIL_NOT_VERIFIED', 403);
  }
}

export class UnauthenticatedError extends SecurityError {
  constructor() {
    super('Not authenticated', 'UNAUTHENTICATED', 401);
  }
}

// ─── Registration ───
export class DuplicateUsernameError extends SecurityError {
  constructor() {
    super('Username already taken', 'USERNAME_TAKEN', 409);
  }
}

export class DuplicateEmailError extends SecurityError {
  constructor() {
    super('Email already registered', 'EMAIL_TAKEN', 409);
  }
}

// ─── Email Verification ───
export class InvalidVerificationCodeError extends SecurityError {
  constructor() {
    super('Invalid verification code', 'INVALID_CODE', 400);
  }
}

export class ExpiredVerificationCodeError extends SecurityError {
  constructor() {
    super('Verification code expired', 'CODE_EXPIRED', 400);
  }
}

export class AlreadyVerifiedError extends SecurityError {
  constructor() {
    super('Account already verified', 'ALREADY_VERIFIED', 400);
  }
}

export class UserNotFoundError extends SecurityError {
  constructor() {
    super('User not found', 'USER_NOT_FOUND', 404);
  }
}

// ─── Password Reset ───
export class InvalidResetCodeError extends SecurityError {
  constructor() {
    super('Invalid or expired reset code', 'INVALID_CODE', 400);
  }
}

export class ResetRateLimitError extends SecurityError {
  constructor() {
    super('Too many reset requests', 'RATE_LIMITED', 429);
  }
}

// ─── Config ───
export class MissingPepperError extends SecurityError {
  constructor() {
    super('PEPPER env var is not set', 'MISSING_PEPPER', 500);
  }
}
