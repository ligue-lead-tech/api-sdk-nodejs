import { DataUri } from '../../../src';

// The API's own check of a media data URI.
const DATA_URI_RE = /^data:(@?[a-z]+\/[a-z0-9.+-]+);(?:name=([^;]+);)?base64,(.+)$/i;

describe('DataUri', () => {
  it('encodes bytes in the format the API checks', () => {
    const uri = DataUri.fromBytes(Buffer.from('hello'), 'image/png');

    expect(uri.toString()).toBe('data:image/png;base64,aGVsbG8=');
    expect(uri.value).toBe(uri.toString());
    expect(DATA_URI_RE.test(uri.toString())).toBe(true);
  });

  it('carries an encoded file name', () => {
    const uri = DataUri.fromBytes(new Uint8Array([1, 2, 3]), 'image/jpeg', 'my banner;1.jpg').toString();

    expect(uri).toBe('data:image/jpeg;name=my%20banner%3B1.jpg;base64,AQID');
    expect(DATA_URI_RE.exec(uri)?.[2]).toBe('my%20banner%3B1.jpg');
  });

  it('serializes as its string inside a JSON body', () => {
    expect(JSON.stringify({ media_file: DataUri.fromBytes(Buffer.from('hello'), 'image/png') }))
      .toBe('{"media_file":"data:image/png;base64,aGVsbG8="}');
  });
});
