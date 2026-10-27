import { LigueLeadApiError } from './LigueLeadApiError';

/**
 * 401 — the token or the app id was refused.
 *
 * Never retried: the server blocks an invalid token for one hour, and every call in that hour gets
 * this same answer.
 */
export class LigueLeadAuthenticationError extends LigueLeadApiError {}
