import { ApiResource } from '../ApiResource';
import type { RequestOptions } from '../../Types/ClientOptions';
import type { CampaignAccepted, RcsSendParams } from '../../Types/Campaigns';

/** RCS campaigns — `POST /v1/rcs`. */
export class RcsCampaignResource extends ApiResource {
  /**
   * Sends an RCS message: free text through one of the app's approved agents, or a template.
   *
   * The agent (or the template's) is checked before anything is queued, so an agent that is not
   * approved, or belongs to another app, fails with a 422 and costs nothing. Undeliverable RCS falls
   * back to SMS with the message text (or the template's `fallback_message`).
   *
   * Never retried: the API has no idempotency key. A failure with `outcomeUnknown: true` may have
   * been queued — check before sending again.
   *
   * @param {RcsSendParams} params - Phones, and either `agent_id` + `message` or `template_id`.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadValidationError} When the body or the agent is refused.
   * @throws {LigueLeadNotFoundError} When the template does not exist for this app.
   *
   * @returns {Promise<CampaignAccepted>} The campaign id and when it was accepted.
   */
  async send(
    params: RcsSendParams,
    options?: RequestOptions,
  ): Promise<CampaignAccepted> {
    return await this.http.request<CampaignAccepted>({
      method: 'POST',
      path: '/rcs',
      body: params,
      auth: 'app',
      envelope: true,
      options,
    });
  }
}
