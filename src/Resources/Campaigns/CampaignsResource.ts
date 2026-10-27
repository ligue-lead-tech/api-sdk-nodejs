import type { HttpClient } from '../../Client/HttpClient';
import { CampaignRecipientsResource } from './CampaignRecipientsResource';
import { RcsCampaignResource } from './RcsCampaignResource';
import { SmsCampaignResource } from './SmsCampaignResource';
import { VoiceCampaignResource } from './VoiceCampaignResource';
import { VoiceAiCampaignResource } from './VoiceAiCampaignResource';

/**
 * Campaigns: one sub-resource per channel to send, and the recipients of a sent campaign.
 *
 * The sub-resources are named after `campaign.type` in the webhooks: `sms`, `voice`, `rcs`,
 * `voice_ai`.
 */
export class CampaignsResource {
  /** SMS and SMS Flash — `POST /v1/sms`. */
  readonly sms: SmsCampaignResource;

  /** Voice with an uploaded audio — `POST /v1/voice`. */
  readonly voice: VoiceCampaignResource;

  /** RCS — `POST /v1/rcs`. */
  readonly rcs: RcsCampaignResource;

  /** Voice with an AI agent — `POST /v1/voice-agent/call`. */
  readonly voiceAi: VoiceAiCampaignResource;

  /** Delivery status per recipient — `GET /v1/campaigns/{id}/recipients`. */
  readonly recipients: CampaignRecipientsResource;

  /**
   * @param {HttpClient} http - Transport shared by the client's resources.
   */
  constructor(http: HttpClient) {
    this.sms = new SmsCampaignResource(http);
    this.voice = new VoiceCampaignResource(http);
    this.rcs = new RcsCampaignResource(http);
    this.voiceAi = new VoiceAiCampaignResource(http);
    this.recipients = new CampaignRecipientsResource(http);
  }
}
