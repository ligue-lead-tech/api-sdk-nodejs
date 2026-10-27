import { LigueLeadApiError } from './LigueLeadApiError';

/** 5xx — the API or the gateway failed. The API masks the reason as `Internal server error`. */
export class LigueLeadServerError extends LigueLeadApiError {}
