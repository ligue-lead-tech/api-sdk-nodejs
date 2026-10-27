import { LigueLeadApiError } from './LigueLeadApiError';

/**
 * 422 — the request was refused by validation.
 *
 * `fieldErrors` lists each refused field when the schema refused it; a business rule (blocked
 * words, an agent that is not approved) comes as a single message with `fieldErrors` empty.
 */
export class LigueLeadValidationError extends LigueLeadApiError {}
