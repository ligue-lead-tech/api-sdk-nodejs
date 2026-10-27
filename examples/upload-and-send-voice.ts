/**
 * Uploads an audio and calls a phone with it.
 *
 *   LIGUELEAD_API_TOKEN=... LIGUELEAD_APP_ID=... npx tsx examples/upload-and-send-voice.ts ./message.mp3 11999999999
 *
 * Costs credits: it places a real call. And the audio stays in the app: the API has no route to
 * delete an upload, so each run adds one.
 */
import { LigueLeadClient } from '@liguelead/api-sdk';

async function main(): Promise<void> {
  const client = new LigueLeadClient({
    apiToken: process.env.LIGUELEAD_API_TOKEN ?? '',
    appId: process.env.LIGUELEAD_APP_ID,
    environment: 'staging',
  });
  const [path, phone] = process.argv.slice(2);

  // Checked before the upload: an audio uploaded for a call that then fails stays in the app.
  if (path === undefined || phone === undefined) {
    console.error('usage: npx tsx examples/upload-and-send-voice.ts <audio.mp3|audio.wav> <phone>');
    process.exitCode = 1;
    return;
  }

  const audio = await client.voice.uploads.create({ title: 'SDK example', file: path });

  console.log(`uploaded ${String(audio.id)}: ${audio.url}`);

  const { campaign_id } = await client.campaigns.voice.send({
    title: 'SDK example',
    voice_upload_id: audio.id,
    phones: [phone],
    retry_attempts: 1,
    retry_interval_min: 5,
  });

  console.log(`accepted: ${campaign_id}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
