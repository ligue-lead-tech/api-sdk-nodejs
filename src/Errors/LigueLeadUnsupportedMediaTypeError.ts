import { LigueLeadApiError } from './LigueLeadApiError';

/** 415 — the uploaded file is not of a type the API accepts. */
export class LigueLeadUnsupportedMediaTypeError extends LigueLeadApiError {}
