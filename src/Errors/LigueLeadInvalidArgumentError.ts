import { LigueLeadError } from './LigueLeadError';

/**
 * A method received an argument it cannot send: an empty id, a file that cannot be read, an upload
 * without a file name. Thrown before any request is made.
 */
export class LigueLeadInvalidArgumentError extends LigueLeadError {}
