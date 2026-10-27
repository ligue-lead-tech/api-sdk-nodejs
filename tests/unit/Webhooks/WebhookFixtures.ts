/**
 * One body per event the API sends, shaped as the API's webhook dispatcher builds them.
 */
const envelope = { app_id: 'e3f1c2a4', occurred_at: '2026-10-07T12:00:15.400Z' };
const campaign = {
  id: '3b4f7c5e-7e2d-4157-b542-5eb2155455c5',
  source: 'api',
  phone: '+5511999999999',
  credits_required: 1,
  sent_at: '2026-10-07T09:00:00-03:00',
};

export const smsStatus = {
  ...envelope,
  event: 'campaign.status',
  campaign: { ...campaign, type: 'sms', message: 'Olá!', status: 'delivered' },
};

export const smsFlashStatus = {
  ...envelope,
  event: 'campaign.status',
  campaign: { ...campaign, type: 'sms_flash', message: 'Código 1234', status: 'delivered' },
};

export const rcsStatus = {
  ...envelope,
  event: 'campaign.status',
  campaign: { ...campaign, type: 'rcs_single', template_id: 'tmpl_2X8', template_title: 'Promo', status: 'read' },
};

export const voiceStatus = {
  ...envelope,
  event: 'campaign.status',
  campaign: {
    ...campaign,
    // A call's `sent_at` is UTC, unlike SMS and RCS.
    sent_at: '2026-10-07T12:00:00.000Z',
    type: 'voice',
    status: 'answer',
    audio_id: 436514,
    audio_title: 'Boas-vindas',
    audio_time: '00:00:12',
    duration_sec: 14,
    dtmf: '1',
  },
};

export const voiceAiStatus = {
  ...envelope,
  event: 'campaign.status',
  campaign: {
    ...campaign,
    sent_at: '2026-10-07T12:00:00.000Z',
    type: 'voice_ai',
    status: 'answer',
    duration_sec: 63,
    recording_url: 'https://files.test/rec.mp3',
    action_executed: 'schedule_event',
    transcript: [{ role: 'assistant', content: 'Olá!' }, { role: 'user', content: 'Oi' }],
  },
};

/** A call the balance did not cover: no action, transcript, recording or duration — it never happened. */
export const voiceAiRefusedStatus = {
  ...envelope,
  event: 'campaign.status',
  campaign: {
    ...campaign,
    sent_at: '2026-10-17T18:09:49.643Z',
    type: 'voice_ai',
    status: 'insufficient_credits',
  },
};

export const rcsPostback = {
  ...envelope,
  event: 'rcs.inbound.postback',
  campaign: {
    ...campaign,
    type: 'rcs_single',
    template_id: 'tmpl_2X8',
    template_title: 'Promo Card',
    inbound: { type: 'postback', postback_data: 'KNOW_MORE' },
  },
};

export const smsInbound = {
  ...envelope,
  event: 'sms.inbound',
  campaign: { id: campaign.id, phone: '+5511999999999', message: 'SIM' },
};

export const rcsAgentStatus = {
  ...envelope,
  event: 'rcs.agent.status',
  agent: { id: '7b3c1e90-4d2a-4f11-9c8e-2a5b6d0f3e47', status: 'approved', rejection_reason: null },
};

export const unknownEvent = { ...envelope, event: 'whatsapp.status', message: { id: 'w1' } };

export const unknownChannelStatus = {
  ...envelope,
  event: 'campaign.status',
  campaign: { ...campaign, type: 'whatsapp', status: 'delivered' },
};
