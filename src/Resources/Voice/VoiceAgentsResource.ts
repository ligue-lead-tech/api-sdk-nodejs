import { ApiResource } from '../ApiResource';
import { ApiPath } from '../../Client/ApiPath';
import type { RequestOptions } from '../../Types/ClientOptions';
import type { VoiceAgent, VoiceAgentParams, VoiceAgentVoiceCatalog } from '../../Types/VoiceAgents';

/**
 * Voice agents — `/v1/voice-agent`.
 *
 * An agent holds the prompt, the engine and the voice of AI calls. Calling with one is
 * `campaigns.voiceAi.send`. The API has no route to delete an agent.
 */
export class VoiceAgentsResource extends ApiResource {
  /**
   * Lists the client's voice agents.
   *
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @returns {Promise<VoiceAgent[]>} The agents, possibly none.
   */
  async list(options?: RequestOptions): Promise<VoiceAgent[]> {
    return await this.http.request<VoiceAgent[]>({
      method: 'GET',
      path: '/voice-agent',
      auth: 'app',
      envelope: false,
      options,
    });
  }

  /**
   * Reads one voice agent.
   *
   * @param {string} id - The agent id (UUID).
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadNotFoundError} When the agent does not exist or belongs to another client.
   *
   * @returns {Promise<VoiceAgent>} The agent.
   */
  async get(
    id: string,
    options?: RequestOptions,
  ): Promise<VoiceAgent> {
    return await this.http.request<VoiceAgent>({
      method: 'GET',
      path: ApiPath.of('voice-agent').id(
        id,
        'id',
      ).toString(),
      auth: 'app',
      envelope: false,
      options,
    });
  }

  /**
   * Creates a voice agent.
   *
   * @param {VoiceAgentParams} params - Name, prompt, engine and voice.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadValidationError} When the body is refused — a voice that is not of the engine,
   *   a prompt over the engine's limit, a knob the engine does not take.
   *
   * @returns {Promise<VoiceAgent>} The agent.
   */
  async create(
    params: VoiceAgentParams,
    options?: RequestOptions,
  ): Promise<VoiceAgent> {
    return await this.http.request<VoiceAgent>({
      method: 'POST',
      path: '/voice-agent',
      body: params,
      auth: 'app',
      envelope: false,
      options,
    });
  }

  /**
   * Replaces a voice agent. A field left out is cleared, or set back to its default; changing the
   * engine is allowed.
   *
   * @param {string} id - The agent id (UUID).
   * @param {VoiceAgentParams} params - The whole agent.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadNotFoundError} When the agent does not exist or belongs to another client.
   * @throws {LigueLeadValidationError} When the body is refused.
   *
   * @returns {Promise<VoiceAgent>} The agent after the update.
   */
  async update(
    id: string,
    params: VoiceAgentParams,
    options?: RequestOptions,
  ): Promise<VoiceAgent> {
    return await this.http.request<VoiceAgent>({
      method: 'PUT',
      path: ApiPath.of('voice-agent').id(
        id,
        'id',
      ).toString(),
      body: params,
      auth: 'app',
      envelope: false,
      options,
    });
  }

  /**
   * Lists the voices of each engine — the valid values of `engine.voice_id`.
   *
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @returns {Promise<VoiceAgentVoiceCatalog>} The voices, grouped by engine.
   */
  async listVoices(options?: RequestOptions): Promise<VoiceAgentVoiceCatalog> {
    return await this.http.request<VoiceAgentVoiceCatalog>({
      method: 'GET',
      path: '/voice-agent/voices',
      auth: 'app',
      envelope: false,
      options,
    });
  }
}
