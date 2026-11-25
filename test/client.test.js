import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ChatterboxClient,
  errorDetail,
  parseModelInfo,
  resolveVoice,
} from '../src/chatterbox/client.js';
import { ANSWERS, CLIPS, fakeServer, json, wav } from './helpers/fakeServer.js';

const BASE = 'http://192.0.2.10:8004';
const REQUEST = {
  baseUrl: BASE,
  voice: { mode: 'predefined', file: 'Emily.wav' },
  language: 'fr',
  exaggeration: null,
  speed: null,
};

test('a speech request is the JSON of the /tts endpoint, without the settings left to the server', async () => {
  const fetch = fakeServer();
  const clip = await new ChatterboxClient({ fetch }).speak(REQUEST, 'Oui.');
  assert.equal(clip.type, 'audio/wav');
  assert.equal(clip.audio.readUInt32LE(40), clip.audio.length - 44);
  const [call] = fetch.calls;
  assert.equal(call.method, 'POST');
  assert.equal(call.url.href, `${BASE}/tts`);
  assert.equal(call.headers['Content-Type'], 'application/json');
  assert.deepEqual(call.json, {
    text: 'Oui.',
    voice_mode: 'predefined',
    predefined_voice_id: 'Emily.wav',
    language: 'fr',
    output_format: 'wav',
    split_text: true,
  });
  assert.ok(call.signal instanceof AbortSignal);
});

test('a cloned voice, the expressiveness and the speed are sent', async () => {
  const fetch = fakeServer();
  await new ChatterboxClient({ fetch }).speak(
    { ...REQUEST, voice: { mode: 'clone', file: 'Gianna.wav' }, exaggeration: 0.5, speed: 1.1 },
    'Oui.',
  );
  const sent = fetch.calls[0].json;
  assert.equal(sent.voice_mode, 'clone');
  assert.equal(sent.reference_audio_filename, 'Gianna.wav');
  assert.equal(sent.predefined_voice_id, undefined);
  assert.equal(sent.exaggeration, 0.5);
  assert.equal(sent.speed_factor, 1.1);
});

test('the real errors of Chatterbox keep their message, never the text', async () => {
  const cases = [
    [json(ANSWERS.voiceMissing, 404), 'voice_not_found', /Predefined voice file/],
    [json(ANSWERS.referenceMissing, 404), 'voice_not_found', /Reference audio file/],
    [json(ANSWERS.emptyText, 422), 'rejected', /at least 1 character/],
    [json('{"detail":"Not Found"}', 404), 'not_found', /HTTP 404: Not Found$/],
    [
      json('{"detail":"TTS engine model is not currently loaded or available."}', 503),
      'not_loaded',
      /not currently loaded/,
    ],
    [new Response('Internal Server Error', { status: 500 }), 'server', /HTTP 500$/],
  ];
  for (const [response, kind, message] of cases) {
    const fetch = fakeServer({ '/tts': () => response });
    const err = await new ChatterboxClient({ fetch })
      .speak(REQUEST, 'Secret 1234.')
      .catch((e) => e);
    assert.equal(err.kind, kind, String(message));
    assert.match(err.message, message);
    assert.doesNotMatch(err.message, /Secret/);
  }
});

test('a 422 that echoes the text keeps only its message', () => {
  const body = Buffer.from(
    JSON.stringify({ detail: [{ msg: 'Field required', input: { text: 'Secret 1234' } }] }),
  );
  assert.equal(errorDetail(body), 'Field required');
  assert.equal(errorDetail(Buffer.from('<html>')), '');
});

test('an unreachable server, a timeout and an answer that is no WAV', async () => {
  const refused = async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
  };
  const err = await new ChatterboxClient({ fetch: refused }).speak(REQUEST, 'Oui.').catch((e) => e);
  assert.equal(err.kind, 'unreachable');
  assert.match(err.message, /ECONNREFUSED/);

  const slow = (url, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    });
  const late = await new ChatterboxClient({ fetch: slow, speechTimeoutMs: 20 })
    .speak(REQUEST, 'Oui.')
    .catch((e) => e);
  assert.equal(late.kind, 'timeout');

  const html = fakeServer({ '/tts': () => new Response('<html></html>', { status: 200 }) });
  const notWav = await new ChatterboxClient({ fetch: html }).speak(REQUEST, 'Oui.').catch((e) => e);
  assert.equal(notWav.kind, 'invalid_response');
});

test('a clip over 5 MB that cannot be resampled is too long', async () => {
  const header = Buffer.from(CLIPS.ouiFr.subarray(0, 44));
  header.writeUInt16LE(2, 22); // stereo: not resampled
  header.writeUInt32LE(6_000_000, 40);
  const huge = Buffer.concat([header, Buffer.alloc(6_000_000)]);
  const fetch = fakeServer({ '/tts': () => wav(huge) });
  const err = await new ChatterboxClient({ fetch }).speak(REQUEST, 'Oui.').catch((e) => e);
  assert.equal(err.kind, 'too_long');
});

test('the model info of the real server', async () => {
  const client = new ChatterboxClient({ fetch: fakeServer() });
  const model = await client.modelInfo(BASE);
  assert.equal(model.loaded, true);
  assert.equal(model.type, 'multilingual');
  for (const lang of ['fr', 'en', 'de', 'es']) {
    assert.ok(model.languages.includes(lang), lang);
  }
  const turbo = parseModelInfo(JSON.parse(ANSWERS.modelInfoTurbo));
  assert.deepEqual(turbo.languages, ['en']);
  const other = new ChatterboxClient({
    fetch: fakeServer({ '/api/model-info': () => json('{}') }),
  });
  assert.equal((await other.modelInfo(BASE).catch((e) => e)).kind, 'invalid_response');
});

test('the voice lists of the real server', async () => {
  const voices = await new ChatterboxClient({ fetch: fakeServer() }).voices(BASE);
  assert.ok(voices.predefined.length >= 20);
  assert.deepEqual(
    voices.predefined.find((voice) => voice.file === 'Emily.wav'),
    { name: 'Emily', file: 'Emily.wav' },
  );
  assert.ok(voices.reference.includes('Gianna.wav'));
});

test('a typed voice: ready-made first, then cloned; case and extension do not matter', () => {
  const voices = {
    predefined: [
      { name: 'Abigail', file: 'Abigail.wav' },
      { name: 'Emily', file: 'Emily.wav' },
      { name: 'Gianna', file: 'Gianna.wav' },
    ],
    reference: ['Gianna.wav', 'Ma_Voix.mp3'],
  };
  assert.deepEqual(resolveVoice('', voices), { mode: 'predefined', file: 'Emily.wav' });
  assert.deepEqual(resolveVoice('emily', voices), { mode: 'predefined', file: 'Emily.wav' });
  assert.deepEqual(resolveVoice('GIANNA.wav', voices), { mode: 'predefined', file: 'Gianna.wav' });
  assert.deepEqual(resolveVoice('ma_voix', voices), { mode: 'clone', file: 'Ma_Voix.mp3' });
  assert.equal(resolveVoice('Nobody', voices), null);
  assert.deepEqual(
    resolveVoice('', { predefined: [{ name: 'A', file: 'A.wav' }], reference: [] }),
    {
      mode: 'predefined',
      file: 'A.wav',
    },
  );
  assert.equal(resolveVoice('', { predefined: [], reference: ['x.wav'] }), null);
});
