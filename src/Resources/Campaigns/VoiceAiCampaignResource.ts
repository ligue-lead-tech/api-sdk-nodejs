import { ApiResource } from '../ApiResource';
import type { RequestOptions } from '../../Types/ClientOptions';
import type { VoiceAiCampaignAccepted, VoiceAiSendParams } from '../../Types/Campaigns';

/** Voice campaigns run by an AI agent — `POST /v1/voice-agent/call`. */
export class VoiceAiCampaignResource extends ApiResource {
  /**
   * Calls up to 1000 phones with a voice agent. Each phone may carry its own `call_context`.
   *
   * Never retried: the API has no idempotency key. A failure with `outcomeUnknown: true` may have
   * been queued — check before sending again.
   *
   * @param {VoiceAiSendParams} params - Agent, phones and retry policy.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadNotFoundError} When the voice agent does not exist for this client.
   * @throws {LigueLeadValidationError} When the body is refused.
   *
   * @returns {Promise<VoiceAiCampaignAccepted>} The campaign id and how many phones were queued.
   */
  async send(
    params: VoiceAiSendParams,
    options?: RequestOptions,
  ): Promise<VoiceAiCampaignAccepted> {
    return await this.http.request<VoiceAiCampaignAccepted>({
      method: 'POST',
      path: '/voice-agent/call',
      body: params,
      auth: 'app',
      envelope: false,
      options,
    });
  }
}
