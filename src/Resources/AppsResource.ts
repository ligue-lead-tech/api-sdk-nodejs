import { ApiResource } from './ApiResource';
import { ApiPath } from '../Client/ApiPath';
import type { RequestOptions } from '../Types/ClientOptions';
import type { App, AppCreateParams, AppDeleteResult } from '../Types/Apps';

/**
 * The client's apps — `/v1/apps`.
 *
 * These routes are authenticated by the token alone, so they work on a client without `appId`:
 * that is how the first app gets created.
 */
export class AppsResource extends ApiResource {
  /**
   * Lists the client's active apps.
   *
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @returns {Promise<App[]>} The apps, possibly none.
   */
  async list(options?: RequestOptions): Promise<App[]> {
    return await this.http.request<App[]>({
      method: 'GET',
      path: '/apps',
      auth: 'token',
      envelope: true,
      options,
    });
  }

  /**
   * Creates an app.
   *
   * @param {AppCreateParams} params - The app's name.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadConflictError} When the client already has an app with that name.
   *
   * @returns {Promise<App>} The new app, with the id to send as `app-id`.
   */
  async create(
    params: AppCreateParams,
    options?: RequestOptions,
  ): Promise<App> {
    return await this.http.request<App>({
      method: 'POST',
      path: '/apps',
      body: params,
      auth: 'token',
      envelope: true,
      options,
    });
  }

  /**
   * Deactivates an app. Its id stops authorizing calls; campaigns already sent under it are kept.
   *
   * @param {string} id - The app id.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadNotFoundError} When the app does not exist or belongs to another client.
   *
   * @returns {Promise<AppDeleteResult>} The id of the app that was deactivated.
   */
  async delete(
    id: string,
    options?: RequestOptions,
  ): Promise<AppDeleteResult> {
    return await this.http.request<AppDeleteResult>({
      method: 'DELETE',
      path: ApiPath.of('apps').id(
        id,
        'id',
      ).toString(),
      auth: 'token',
      envelope: true,
      options,
    });
  }
}
