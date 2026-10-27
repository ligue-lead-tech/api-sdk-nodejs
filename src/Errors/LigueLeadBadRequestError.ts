import { LigueLeadApiError } from './LigueLeadApiError';

/** 400 — the request is malformed (a non-UUID agent id, a malformed multipart body). */
export class LigueLeadBadRequestError extends LigueLeadApiError {}
