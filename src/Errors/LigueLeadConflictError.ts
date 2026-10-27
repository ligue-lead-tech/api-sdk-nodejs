import { LigueLeadApiError } from './LigueLeadApiError';

/** 409 — the request conflicts with the current state (a duplicate app name, an agent under review). */
export class LigueLeadConflictError extends LigueLeadApiError {}
