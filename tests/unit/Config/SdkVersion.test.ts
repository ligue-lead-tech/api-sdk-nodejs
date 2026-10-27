import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SdkVersion } from '../../../src/Config/SdkVersion';
import { LigueLeadClient } from '../../../src';

describe('SdkVersion', () => {
  it('matches package.json, which the release reads', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8')) as { version: string };

    expect(SdkVersion.current).toBe(manifest.version);
    expect(LigueLeadClient.VERSION).toBe(manifest.version);
  });
});
