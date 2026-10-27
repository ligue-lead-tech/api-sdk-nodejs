import { LigueLeadConnectionError } from './LigueLeadConnectionError';

/** The request did not finish within `timeoutMs`. */
export class LigueLeadTimeoutError extends LigueLeadConnectionError {}
