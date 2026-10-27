import type { OpenEnum } from './Shared';

/** What the agent's messages are for. Fixed once the brand is approved. */
export type RcsUseCase = 'otp' | 'transactional' | 'promotional';

/**
 * Review status of an agent. Agents created through the API start as `submitted`; `draft` and
 * `edited` only come from the internal panel.
 */
export type RcsAgentStatus = OpenEnum<'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'edited'>;

/** The brand an RCS agent shows on the recipient's phone, and who answers for it. */
export interface RcsAgentBrand {
  /** Name shown as the sender, 1 to 100 characters. */
  sender_name: string;
  /** Description shown on the agent's page, 1 to 500 characters. */
  sender_description: string;
  /** `#RRGGBB`. */
  brand_color: string;
  logo_url: string;
  banner_url: string;
  contact_name: string;
  contact_email: string;
  company_name: string;
  legal_name: string;
  company_website: string;
  /** Up to 20 characters. */
  phone: string;
  public_email: string;
  public_website: string;
  privacy_policy_url: string;
  terms_url: string;
}

/** Body of `rcs.agents.create`. Every brand field is required. */
export interface RcsAgentCreateParams extends RcsAgentBrand {
  use_case: RcsUseCase;
  /** Where to POST `rcs.agent.status` events about this agent's review. */
  webhook_url?: string | null;
  /** Phones that receive test messages while the agent is under review, up to 20. */
  test_devices?: string[];
}

/**
 * Body of `rcs.agents.update`. A full replacement: every brand field is required, as on create;
 * `webhook_url` and `test_devices` left out are cleared; `use_case` left out is kept — and cannot
 * change after approval.
 */
export interface RcsAgentUpdateParams extends RcsAgentBrand {
  use_case?: RcsUseCase;
  webhook_url?: string | null;
  test_devices?: string[];
}

/** An RCS agent: the brand plus its review state. */
export interface RcsAgent extends RcsAgentBrand {
  /** The agent id (UUID), sent as `agent_id`. */
  id: string;
  app_id: string | null;
  status: RcsAgentStatus;
  /** Why the review rejected the agent, when it did. */
  rejection_reason: string | null;
  use_case: OpenEnum<RcsUseCase>;
  webhook_url: string | null;
  test_devices: string[];
}
