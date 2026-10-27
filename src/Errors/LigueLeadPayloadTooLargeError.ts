import { LigueLeadApiError } from './LigueLeadApiError';

/** 413 — the body or the uploaded file is larger than the API accepts. */
export class LigueLeadPayloadTooLargeError extends LigueLeadApiError {}
