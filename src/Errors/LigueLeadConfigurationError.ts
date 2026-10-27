import { LigueLeadError } from './LigueLeadError';

/**
 * The client was built with options it cannot work with, or a call needs an option that was not
 * given (an `appId` for an app-scoped route). Thrown before any request is made.
 */
export class LigueLeadConfigurationError extends LigueLeadError {}
