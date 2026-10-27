import { ApiResource } from '../ApiResource';
import { ApiPath } from '../../Client/ApiPath';
import type { RequestOptions } from '../../Types/ClientOptions';
import type { VoiceAction, VoiceActionCreateParams, VoiceActionUpdateParams } from '../../Types/VoiceActions';

/**
 * Voice actions — `/v1/voice-action`.
 *
 * What a voice agent can do during a call: book a meeting, send an email or an SMS, transfer the
 * call, or POST to an endpoint. An agent points at one through `action_id`.
 *
 * Answers carry the action's credentials and `authorization_token` as stored: keep them out of logs.
 */
export class VoiceActionsResource extends ApiResource {
  /**
   * Lists the client's voice actions.
   *
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @returns {Promise<VoiceAction[]>} The actions, possibly none.
   */
  async list(options?: RequestOptions): Promise<VoiceAction[]> {
    return await this.http.request<VoiceAction[]>({
      method: 'GET',
      path: '/voice-action',
      auth: 'app',
      envelope: false,
      options,
    });
  }

  /**
   * Reads one voice action.
   *
   * @param {string} id - The action id.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadNotFoundError} When the action does not exist or belongs to another client.
   *
   * @returns {Promise<VoiceAction>} The action.
   */
  async get(
    id: string,
    options?: RequestOptions,
  ): Promise<VoiceAction> {
    return await this.http.request<VoiceAction>({
      method: 'GET',
      path: ApiPath.of('voice-action').id(
        id,
        'id',
      ).toString(),
      auth: 'app',
      envelope: false,
      options,
    });
  }

  /**
   * Creates a voice action. A client has at most 50.
   *
   * @param {VoiceActionCreateParams} params - Name, type, provider and the fields of that type.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadBadRequestError} When the client already has 50 actions.
   * @throws {LigueLeadValidationError} When the body is refused.
   *
   * @returns {Promise<VoiceAction>} The action.
   */
  async create(
    params: VoiceActionCreateParams,
    options?: RequestOptions,
  ): Promise<VoiceAction> {
    return await this.http.request<VoiceAction>({
      method: 'POST',
      path: '/voice-action',
      body: params,
      auth: 'app',
      envelope: false,
      options,
    });
  }

  /**
   * Changes some fields of a voice action. The fields sent replace the stored ones; `config`, in
   * particular, is replaced as a whole, so send it complete.
   *
   * @param {string} id - The action id.
   * @param {VoiceActionUpdateParams} params - The fields to change, at least one.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadNotFoundError} When the action does not exist or belongs to another client.
   * @throws {LigueLeadValidationError} When the body is refused.
   *
   * @returns {Promise<VoiceAction>} The action after the update.
   */
  async update(
    id: string,
    params: VoiceActionUpdateParams,
    options?: RequestOptions,
  ): Promise<VoiceAction> {
    return await this.http.request<VoiceAction>({
      method: 'PUT',
      path: ApiPath.of('voice-action').id(
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
   * Deletes a voice action.
   *
   * @param {string} id - The action id.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadNotFoundError} When the action does not exist or belongs to another client.
   *
   * @returns {Promise<void>} Resolves when the action is gone.
   */
  async delete(
    id: string,
    options?: RequestOptions,
  ): Promise<void> {
    await this.http.request<undefined>({
      method: 'DELETE',
      path: ApiPath.of('voice-action').id(
        id,
        'id',
      ).toString(),
      auth: 'app',
      envelope: false,
      options,
    });
  }
}
