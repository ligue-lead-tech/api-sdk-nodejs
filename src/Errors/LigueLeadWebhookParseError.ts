import { LigueLeadError } from './LigueLeadError';

/** A webhook body is not JSON, or lacks the envelope every event has (`event`, `app_id`, `occurred_at`). */
export class LigueLeadWebhookParseError extends LigueLeadError {}
