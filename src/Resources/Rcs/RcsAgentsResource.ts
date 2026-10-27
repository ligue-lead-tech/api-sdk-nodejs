import { ApiResource } from '../ApiResource';
import { ApiPath } from '../../Client/ApiPath';
import type { RequestOptions } from '../../Types/ClientOptions';
import type { RcsAgent, RcsAgentCreateParams, RcsAgentUpdateParams } from '../../Types/RcsAgents';

/**
 * RCS agents — `/v1/rcs/agents`.
 *
 * An agent is the brand RCS messages go out as. It must be approved before `campaigns.rcs.send`
 * accepts it; the review result arrives as an `rcs.agent.status` event at the agent's own
 * `webhook_url`. Each app has at most one agent.
 */
export class RcsAgentsResource extends ApiResource {
  /**
   * Lists the client's agents — of every app of the client, not only the one in `app-id`.
   *
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @returns {Promise<RcsAgent[]>} The agents, possibly none.
   */
  async list(options?: RequestOptions): Promise<RcsAgent[]> {
    return await this.http.request<RcsAgent[]>({
      method: 'GET',
      path: '/rcs/agents',
      auth: 'app',
      envelope: false,
      options,
    });
  }

  /**
   * Reads one agent.
   *
   * @param {string} id - The agent id (UUID).
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadBadRequestError} When the id is not a UUID.
   * @throws {LigueLeadNotFoundError} When the agent does not exist or belongs to another client.
   *
   * @returns {Promise<RcsAgent>} The agent.
   */
  async get(
    id: string,
    options?: RequestOptions,
  ): Promise<RcsAgent> {
    return await this.http.request<RcsAgent>({
      method: 'GET',
      path: ApiPath.of(
        'rcs',
        'agents',
      ).id(
        id,
        'id',
      ).toString(),
      auth: 'app',
      envelope: false,
      options,
    });
  }

  /**
   * Registers the app's agent and submits it for review.
   *
   * @param {RcsAgentCreateParams} params - Use case and brand.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadConflictError} When the app already has an agent.
   *
   * @returns {Promise<RcsAgent>} The agent, `submitted`.
   */
  async create(
    params: RcsAgentCreateParams,
    options?: RequestOptions,
  ): Promise<RcsAgent> {
    return await this.http.request<RcsAgent>({
      method: 'POST',
      path: '/rcs/agents',
      body: params,
      auth: 'app',
      envelope: false,
      options,
    });
  }

  /**
   * Replaces the agent's brand and resubmits it. Every brand field is required; `webhook_url` and
   * `test_devices` left out are cleared; `use_case` left out is kept.
   *
   * Never retried: a repeated update is a second submission for review.
   *
   * @param {string} id - The agent id (UUID).
   * @param {RcsAgentUpdateParams} params - The whole brand.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadConflictError} When the agent is under review, or the update changes the
   *   `use_case` of an approved brand.
   *
   * @returns {Promise<RcsAgent>} The agent after the update.
   */
  async update(
    id: string,
    params: RcsAgentUpdateParams,
    options?: RequestOptions,
  ): Promise<RcsAgent> {
    return await this.http.request<RcsAgent>({
      method: 'PUT',
      path: ApiPath.of(
        'rcs',
        'agents',
      ).id(
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
   * Deletes an agent that is not approved.
   *
   * @param {string} id - The agent id (UUID).
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadConflictError} When the agent is approved: it carries the app's RCS sends.
   *
   * @returns {Promise<void>} Resolves when the agent is gone.
   */
  async delete(
    id: string,
    options?: RequestOptions,
  ): Promise<void> {
    await this.http.request<undefined>({
      method: 'DELETE',
      path: ApiPath.of(
        'rcs',
        'agents',
      ).id(
        id,
        'id',
      ).toString(),
      auth: 'app',
      envelope: false,
      options,
    });
  }
}
