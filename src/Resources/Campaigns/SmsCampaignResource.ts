import { ApiResource } from '../ApiResource';
import type { RequestOptions } from '../../Types/ClientOptions';
import type { CampaignAccepted, SmsSendParams } from '../../Types/Campaigns';

/** SMS campaigns — `POST /v1/sms`. */
export class SmsCampaignResource extends ApiResource {
  /**
   * Sends an SMS (or SMS Flash, with `is_flash`) to up to 10000 phones.
   *
   * The API validates and queues; delivery is reported later, by webhook and by
   * `campaigns.recipients`. Credits are checked after the answer, so a client without credits still
   * gets `campaign_id`, and its recipients end as `insufficient_credits`.
   *
   * Never retried: the API has no idempotency key, and a second send is a second campaign, charged
   * again. A failure with `outcomeUnknown: true` may have been queued — check before sending again.
   *
   * @param {SmsSendParams} params - Message, phones and options.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadValidationError} When the body is refused, blocked words included.
   *
   * @returns {Promise<CampaignAccepted>} The campaign id and when it was accepted.
   */
  async send(
    params: SmsSendParams,
    options?: RequestOptions,
  ): Promise<CampaignAccepted> {
    return await this.http.request<CampaignAccepted>({
      method: 'POST',
      path: '/sms',
      body: params,
      auth: 'app',
      envelope: true,
      options,
    });
  }
}
