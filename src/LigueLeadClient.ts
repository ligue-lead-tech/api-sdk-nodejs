import { HttpClient } from './Client/HttpClient';
import { ClientOptions } from './Config/ClientOptions';
import { SdkVersion } from './Config/SdkVersion';
import { AppsResource } from './Resources/AppsResource';
import { CampaignsResource } from './Resources/Campaigns/CampaignsResource';
import { RcsResource } from './Resources/Rcs/RcsResource';
import { VoiceActionsResource } from './Resources/Voice/VoiceActionsResource';
import { VoiceAgentsResource } from './Resources/Voice/VoiceAgentsResource';
import { VoiceResource } from './Resources/Voice/VoiceResource';
import type { LigueLeadClientOptions } from './Types/ClientOptions';

/**
 * Client of the LigueLead API.
 *
 * ```ts
 * const client = new LigueLeadClient({ apiToken, appId });
 * const { campaign_id } = await client.campaigns.sms.send({ message: 'Olá!', phones: ['11999999999'] });
 * ```
 *
 * What creates or reads a campaign lives under `campaigns`, one sub-resource per channel; the assets
 * campaigns reuse (audios, agents, templates, actions) live at the top, per channel. The token stays
 * in private fields: `util.inspect` and `JSON.stringify` of the client never show it.
 */
export class LigueLeadClient {
  /** Version of this SDK. */
  static readonly VERSION = SdkVersion.current;

  /** Sends per channel, and the recipients of a sent campaign. */
  readonly campaigns: CampaignsResource;

  /** Voice assets: uploaded audios. */
  readonly voice: VoiceResource;

  /** RCS assets: agents and templates. */
  readonly rcs: RcsResource;

  /** AI voice agents — `/v1/voice-agent`. */
  readonly voiceAgents: VoiceAgentsResource;

  /** What a voice agent can do during a call — `/v1/voice-action`. */
  readonly voiceActions: VoiceActionsResource;

  /** The client's apps — `/v1/apps`. Needs only the token. */
  readonly apps: AppsResource;

  readonly #options: ClientOptions;

  /**
   * @param {LigueLeadClientOptions | ClientOptions} options - Credentials, environment and transport
   *   options, or options already built.
   *
   * @throws {LigueLeadConfigurationError} When an option is missing or out of range.
   */
  constructor(options: LigueLeadClientOptions | ClientOptions) {
    this.#options = options instanceof ClientOptions
      ? options
      : new ClientOptions(options);

    const http = new HttpClient(this.#options);

    this.campaigns = new CampaignsResource(http);
    this.voice = new VoiceResource(http);
    this.rcs = new RcsResource(http);
    this.voiceAgents = new VoiceAgentsResource(http);
    this.voiceActions = new VoiceActionsResource(http);
    this.apps = new AppsResource(http);
  }

  /**
   * A client with some options replaced — another app of the same client, another `source`, a
   * shorter timeout. The original client is left unchanged.
   *
   * ```ts
   * const otherApp = client.withOptions({ appId: 'f3a1…' });
   * ```
   *
   * @param {Partial<LigueLeadClientOptions>} overrides - Options to replace.
   *
   * @throws {LigueLeadConfigurationError} When the resulting options are invalid.
   *
   * @returns {LigueLeadClient} A new client.
   */
  withOptions(overrides: Partial<LigueLeadClientOptions>): LigueLeadClient {
    return new LigueLeadClient(this.#options.withOverrides(overrides));
  }
}
