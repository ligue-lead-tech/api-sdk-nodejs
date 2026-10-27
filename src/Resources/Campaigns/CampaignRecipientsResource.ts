import { ApiResource } from '../ApiResource';
import { ApiPath } from '../../Client/ApiPath';
import type { RequestOptions } from '../../Types/ClientOptions';
import type {
  CampaignRecipient,
  CampaignRecipientsIterateParams,
  CampaignRecipientsListParams,
  CampaignRecipientsPage,
} from '../../Types/Campaigns';

/**
 * Delivery status per recipient — `GET /v1/campaigns/{campaign_id}/recipients`.
 *
 * Available for SMS and SMS Flash campaigns, for 72 hours after the send. Right after a send the
 * campaign may not be written yet: a 404 in the first seconds means "not yet", not "never".
 */
export class CampaignRecipientsResource extends ApiResource {
  /**
   * Reads one page of recipients, or looks up one phone.
   *
   * @param {string} campaignId - The `campaign_id` of the send.
   * @param {CampaignRecipientsListParams} [params] - Page size and cursor, or a phone.
   * @param {RequestOptions} [options] - Per-call options.
   *
   * @throws {LigueLeadNotFoundError} When the campaign is unknown, another client's, expired, or
   *   not written yet.
   *
   * @returns {Promise<CampaignRecipientsPage>} The page, with `pagination.next_cursor` when there
   *   is another one.
   */
  async list(
    campaignId: string,
    params: CampaignRecipientsListParams = {},
    options?: RequestOptions,
  ): Promise<CampaignRecipientsPage> {
    return await this.http.request<CampaignRecipientsPage>({
      method: 'GET',
      path: ApiPath.of('campaigns').id(
        campaignId,
        'campaignId',
      ).segment('recipients').toString(),
      query: {
        limit: params.limit,
        cursor: params.cursor,
        phone: params.phone,
      },
      auth: 'app',
      envelope: true,
      options,
    });
  }

  /**
   * Walks every recipient of a campaign, page by page.
   *
   * ```ts
   * for await (const recipient of client.campaigns.recipients.iterate(campaignId)) {
   *   console.log(recipient.phone, recipient.status);
   * }
   * ```
   *
   * @param {string} campaignId - The `campaign_id` of the send.
   * @param {CampaignRecipientsIterateParams} [params] - Page size used under the hood.
   * @param {RequestOptions} [options] - Per-call options, applied to every page.
   *
   * @throws {LigueLeadNotFoundError} When the campaign is unknown, another client's, expired, or
   *   not written yet.
   *
   * @returns {AsyncGenerator<CampaignRecipient>} The recipients, in the API's order.
   */
  async *iterate(
    campaignId: string,
    params: CampaignRecipientsIterateParams = {},
    options?: RequestOptions,
  ): AsyncGenerator<CampaignRecipient, void, undefined> {
    let cursor: string | undefined;

    do {
      const page = await this.list(
        campaignId,
        cursor === undefined
          ? { limit: params.limit }
          : {
              limit: params.limit,
              cursor,
            },
        options,
      );

      yield* page.recipients;
      cursor = page.pagination.next_cursor;
    } while (cursor !== undefined);
  }
}
