import type { HttpClient } from '../../Client/HttpClient';
import { RcsAgentsResource } from './RcsAgentsResource';
import { RcsTemplatesResource } from './RcsTemplatesResource';

/** RCS assets. Sending an RCS campaign is `campaigns.rcs.send`. */
export class RcsResource {
  /** The brands RCS messages go out as — `/v1/rcs/agents`. */
  readonly agents: RcsAgentsResource;

  /** Templates sent with `template_id` — `/v1/rcs/templates`. */
  readonly templates: RcsTemplatesResource;

  /**
   * @param {HttpClient} http - Transport shared by the client's resources.
   */
  constructor(http: HttpClient) {
    this.agents = new RcsAgentsResource(http);
    this.templates = new RcsTemplatesResource(http);
  }
}
