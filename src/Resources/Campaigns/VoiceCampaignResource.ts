import { ApiResource } from '../ApiResource';
import type { RequestOptions } from '../../Types/ClientOptions';
import type { CampaignAccepted, VoiceSendParams } from '../../Types/Campaigns';

/** Voice campaigns with an uploaded audio — `POST /v1/voice`. */
export class VoiceCampaignResource extends ApiResource {
  /**
   * Calls up to 10000 phones and plays an audio uploaded with `voice.uploads.create`.
   *
   * Never retried, for the same reason as every send: the API has no idempotency key. A failure with
   * `outcomeUnknown: true` may have been queued — check before sending again.
   *
   * @param {VoiceSendParams} params - Audio, phones and retry policy.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadValidationError} When the body is refused.
   *
   * @returns {Promise<CampaignAccepted>} The campaign id and when it was accepted.
   */
  async send(
    params: VoiceSendParams,
    options?: RequestOptions,
  ): Promise<CampaignAccepted> {
    return await this.http.request<CampaignAccepted>({
      method: 'POST',
      path: '/voice',
      body: params,
      auth: 'app',
      envelope: true,
      options,
    });
  }
}
