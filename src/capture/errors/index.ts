// MODULE 10 — Capture Module Errors

export class CaptureError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class FormNotFoundError extends CaptureError {
  constructor() {
    super('Form not found', 404);
  }
}

export class EventNotFoundError extends CaptureError {
  constructor() {
    super('Badge event not found', 404);
  }
}

export class AttendeeNotFoundError extends CaptureError {
  constructor() {
    super('Attendee not found', 404);
  }
}

export class AlreadyScannedError extends CaptureError {
  constructor() {
    super('Badge already scanned', 409);
  }
}

// Attempted an operation not valid for the form's current state
// e.g. deleting an active form
export class InvalidFormOperationError extends CaptureError {
  constructor(reason: string) {
    super(reason, 409);
  }
}

export class FormSubmissionError extends CaptureError {
  constructor(reason: string) {
    super(reason, 422);
  }
}
