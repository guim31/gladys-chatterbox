import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { ChatterboxClient } from '../src/chatterbox/client.js';
import { CACHE_SIZE, Chatterbox, MESSAGES } from '../src/integration.js';
import { ANSWERS, CLIPS, fakeServer, json, recordingLogger, wav } from './helpers/fakeServer.js';

const BASE = 'http://192.0.2.10:8004';
const CHECK = ['/api/model-info', '/get_predefined_voices', '/get_reference_files'];

async function setup({ config = { base_url: BASE }, routes, now } = {}) {
  const gladys = createFakeGladys({ config });
  const fetch = fakeServer(routes);
  const { logger, lines } = recordingLogger();
  const tts = new Chatterbox(gladys, {
    client: new ChatterboxClient({ fetch }),
    logger,
    now,
    timers: false,
  });
  registerHandlers(gladys, tts, { logger });
  await gladys.connect();
  return { gladys, fetch, tts, lines };
}

const decoded = (ack) => {
  const [type, payload] = ack.data.audio.split(';base64,');
  return { type, audio: Buffer.from(payload, 'base64') };
};
const triggers = (gladys) => gladys.fake.sceneEvents.map((event) => event.key ?? event.type);
const refused = () => {
  throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
};

test('at startup, the model and the voices are read, without any synthesis', async () => {
  const { gladys, fetch, lines } = await setup();
  assert.deepEqual(
    fetch.calls.map((call) => call.path),
    CHECK,
  );
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.equal(status.message.fr, 'Le serveur Chatterbox répond (modèle multilingual).');
  assert.ok(lines.info.includes('The Chatterbox server answers'));
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('without an address, the status asks for one and nothing is requested', async () => {
  const { gladys, fetch } = await setup({ config: {} });
  assert.equal(fetch.calls.length, 0);
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: MESSAGES.not_configured,
  });
  const ack = await gladys.fake.ttsSynthesize('Bonjour.', 'fr');
  assert.equal(ack.success, false);
  assert.match(ack.error, /Enter the address/);
  const list = await gladys.fake.action('list_voices');
  assert.equal(list.success, false);
  assert.match(list.error.fr, /Saisissez l'adresse/);
});

test('an address that cannot be used is said so, not taken for an empty one', async () => {
  const { gladys, fetch } = await setup({ config: { base_url: 'http://user:pass@192.0.2.10' } });
  assert.equal(fetch.calls.length, 0);
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: MESSAGES.invalid_url,
  });
});

test('a text becomes a WAV with exact sizes, in the language of the user, with its voice', async () => {
  const { gladys, fetch } = await setup({
    config: { base_url: BASE, voice_fr: 'gianna', voice_en: 'Emily.wav', exaggeration: '0.5' },
    routes: { '/tts': (call) => wav(call.json.language === 'en' ? CLIPS.yesEn : CLIPS.ouiFr) },
  });
  const fr = await gladys.fake.ttsSynthesize('La porte est ouverte.', 'fr-FR');
  assert.equal(fr.success, true);
  const { type, audio } = decoded(fr);
  assert.equal(type, 'audio/wav');
  assert.equal(audio.length, CLIPS.ouiFr.length);
  assert.equal(audio.readUInt32LE(40), audio.length - 44);
  assert.deepEqual(fetch.speech().at(-1).json, {
    text: 'La porte est ouverte.',
    voice_mode: 'predefined',
    predefined_voice_id: 'Gianna.wav',
    language: 'fr',
    output_format: 'wav',
    split_text: true,
    exaggeration: 0.5,
  });

  const en = await gladys.fake.ttsSynthesize('The door is open.', 'en');
  assert.equal(decoded(en).audio.length, CLIPS.yesEn.length);
  assert.equal(fetch.speech().at(-1).json.predefined_voice_id, 'Emily.wav');
  // German has no voice: Emily, the default of the server.
  await gladys.fake.ttsSynthesize('Die Tür ist offen.', 'de');
  assert.equal(fetch.speech().at(-1).json.language, 'de');
  assert.equal(fetch.speech().at(-1).json.predefined_voice_id, 'Emily.wav');
  // Unknown language: French.
  await gladys.fake.ttsSynthesize('Annonce.', null);
  assert.equal(fetch.speech().at(-1).json.language, 'fr');
});

test('a fixed language overrides the one of the user', async () => {
  const { gladys, fetch } = await setup({
    config: { base_url: BASE, language: 'es', speed: '1.2' },
  });
  await gladys.fake.ttsSynthesize('Hola.', 'fr');
  assert.equal(fetch.speech().at(-1).json.language, 'es');
  assert.equal(fetch.speech().at(-1).json.speed_factor, 1.2);
});

test('a recording of reference_audio is cloned, and one added since is found', async () => {
  let reference = ANSWERS.referenceFiles;
  const { gladys, fetch } = await setup({
    config: { base_url: BASE, voice_fr: 'Robert', voice_en: 'nouvelle' },
    routes: { '/get_reference_files': () => json(reference) },
  });
  await gladys.fake.ttsSynthesize('Bonjour.', 'fr');
  assert.equal(fetch.speech().at(-1).json.voice_mode, 'clone');
  assert.equal(fetch.speech().at(-1).json.reference_audio_filename, 'Robert.wav');

  reference = JSON.stringify(['Robert.wav', 'Nouvelle.wav']);
  const ack = await gladys.fake.ttsSynthesize('Hello.', 'en');
  assert.equal(ack.success, true);
  assert.equal(fetch.speech().at(-1).json.reference_audio_filename, 'Nouvelle.wav');
});

test('an unknown voice fails that request only, and says how to find the voices', async () => {
  const { gladys, fetch } = await setup({ config: { base_url: BASE, voice_fr: 'Personne' } });
  const ack = await gladys.fake.ttsSynthesize('Bonjour.', 'fr');
  assert.equal(ack.success, false);
  assert.match(ack.error, /no voice by this name.*Show the voices/);
  assert.equal(fetch.speech().length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('a voice file removed from the server between two checks: the 404 of /tts', async () => {
  const { gladys } = await setup({
    routes: { '/tts': () => json(ANSWERS.voiceMissing, 404) },
  });
  const ack = await gladys.fake.action('test_voice', { language: 'fr' });
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /n'a pas de voix de ce nom.*Predefined voice file/);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('an English-only model refuses French, and the status says how to fix it', async () => {
  const { gladys, fetch } = await setup({
    routes: { '/api/model-info': () => json(ANSWERS.modelInfoTurbo) },
  });
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: true,
    message: MESSAGES.language_unsupported,
  });
  const fr = await gladys.fake.ttsSynthesize('Bonjour.', 'fr');
  assert.equal(fr.success, false);
  assert.match(fr.error, /speaks only English.*chatterbox-multilingual/);
  const en = await gladys.fake.ttsSynthesize('Hello.', 'en');
  assert.equal(en.success, true);
  assert.equal(fetch.speech().length, 1);

  await gladys.fake.configUpdated({ base_url: BASE, language: 'en' });
  assert.equal(
    gladys.fake.connectionStatus.message.en,
    'The Chatterbox server answers (model turbo).',
  );
});

test('the same announcement on several speakers is asked once, then served from memory', async () => {
  const { gladys, fetch, tts } = await setup();
  const acks = await Promise.all([
    gladys.fake.ttsSynthesize('Le linge est sec.', 'fr'),
    gladys.fake.ttsSynthesize('Le linge est sec.', 'fr'),
  ]);
  assert.ok(acks.every((ack) => ack.success));
  assert.equal(fetch.speech().length, 1);
  await gladys.fake.ttsSynthesize(' Le linge est sec. ', 'fr');
  assert.equal(fetch.speech().length, 1);

  for (let i = 0; i <= CACHE_SIZE; i += 1) {
    await gladys.fake.ttsSynthesize(`Texte ${i}.`, 'fr');
  }
  assert.equal(tts.cache.size, CACHE_SIZE);
  // New settings forget every clip.
  await gladys.fake.configUpdated({ base_url: BASE, voice_fr: 'Olivia' });
  assert.equal(tts.cache.size, 0);
  await gladys.fake.ttsSynthesize('Le linge est sec.', 'fr');
  assert.equal(fetch.speech().at(-1).json.predefined_voice_id, 'Olivia.wav');
});

test('a server that goes down fires server_offline once, and server_online on return', async () => {
  let down = false;
  const live = (answer) => (call) => (down ? refused() : answer(call));
  const { gladys, tts, lines } = await setup({
    routes: {
      '/api/model-info': live(() => json(ANSWERS.modelInfo)),
      '/tts': live(() => wav(CLIPS.ouiFr)),
    },
  });
  down = true;
  await tts.check();
  await tts.check();
  const ack = await gladys.fake.ttsSynthesize('Bonjour.', 'fr');
  assert.equal(ack.success, false);
  assert.match(ack.error, /cannot be reached/);
  assert.deepEqual(triggers(gladys), ['server_offline']);
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: MESSAGES.unreachable,
  });
  assert.equal(lines.warn.filter((line) => /unavailable/.test(line)).length, 1);

  down = false;
  await tts.check();
  assert.deepEqual(triggers(gladys), ['server_offline', 'server_online']);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('a server still loading its model is not online', async () => {
  const { gladys } = await setup({
    routes: {
      '/api/model-info': () => json(ANSWERS.modelInfoNotLoaded),
    },
  });
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: MESSAGES.not_loaded,
  });
});

test('something else at the address is said so', async () => {
  const { gladys } = await setup({ routes: { '/api/model-info': () => json('{"status":"ok"}') } });
  assert.deepEqual(gladys.fake.connectionStatus.message, MESSAGES.invalid_response);
});

test('a synthesis that runs out of time does not call the server offline', async () => {
  const { gladys } = await setup({
    routes: {
      '/tts': () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      },
    },
  });
  const ack = await gladys.fake.ttsSynthesize('Un long texte.', 'fr');
  assert.equal(ack.success, false);
  assert.match(ack.error, /does not answer in time: keep announcements short/);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('a voice list that runs out of time at synthesis is not blamed on the text', async () => {
  let slow = false;
  const { gladys, tts } = await setup({
    routes: {
      '/get_predefined_voices': () => {
        if (slow) {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        return json(ANSWERS.predefinedVoices);
      },
    },
  });
  slow = true;
  tts.voices = null;
  const ack = await gladys.fake.ttsSynthesize('Oui.', 'fr');
  assert.match(ack.error, /check that it is not overloaded/);
});

test('a check that runs out of time says so, without the advice about long texts', async () => {
  const { gladys } = await setup({
    routes: {
      '/api/model-info': () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      },
    },
  });
  assert.deepEqual(gladys.fake.connectionStatus.message, MESSAGES.health_timeout);
});

test('a text with nothing to say fails without a request', async () => {
  const { gladys, fetch } = await setup();
  const ack = await gladys.fake.ttsSynthesize(' *** ', 'fr');
  assert.equal(ack.success, false);
  assert.match(ack.error, /nothing to say/);
  assert.equal(fetch.speech().length, 0);
});

test('a normal synthesis writes nothing at info level, and never the text', async () => {
  const { gladys, tts, lines } = await setup();
  const before = lines.info.length;
  await gladys.fake.ttsSynthesize('Code du portail 1234.', 'fr');
  await gladys.fake.ttsSynthesize('Code du portail 1234.', 'fr');
  await tts.check();
  assert.equal(lines.info.length, before);
  assert.equal(lines.warn.length, 0);
  assert.doesNotMatch(Object.values(lines).flat().join('\n'), /portail/);
});

test('"Test the voice" really asks the server, in the language chosen', async () => {
  let clock = 0;
  const { gladys, fetch } = await setup({
    config: { base_url: BASE, voice_es: 'Elena' },
    now: () => clock,
    routes: {
      '/tts': () => {
        clock += 4500;
        return wav(CLIPS.ouiFr);
      },
    },
  });
  const ack = await gladys.fake.action('test_voice', { language: 'es' });
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /en espagnol avec la voix « Elena » : \d,\d s de son en 4,5 s/);
  assert.match(
    ack.data.message.en,
    /in Spanish with the voice "Elena": \d\.\d s of sound made in 4\.5 s/,
  );
  assert.equal(
    fetch.speech().at(-1).json.text,
    'Hola, soy Gladys. La puerta del garaje está abierta.',
  );
  // Without a language: French, Emily. A second press asks again.
  const fr = await gladys.fake.action('test_voice', {});
  assert.match(fr.data.message.fr, /en français avec la voix « Emily »/);
  await gladys.fake.action('test_voice');
  assert.equal(fetch.speech().length, 3);
});

test('"Test the voice" fails in red, in four languages, when the server is down', async () => {
  const { gladys } = await setup({ routes: { '/tts': refused } });
  const ack = await gladys.fake.action('test_voice', { language: 'fr' });
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /^Le serveur Chatterbox est injoignable.*ECONNREFUSED/);
  assert.match(ack.error.de, /nicht erreichbar/);
});

test('"Show the voices" reads the lists of the server now', async () => {
  const { gladys, fetch } = await setup();
  const calls = fetch.calls.length;
  const ack = await gladys.fake.action('list_voices');
  assert.equal(ack.success, true);
  assert.match(
    ack.data.message.fr,
    /^Voix prêtes \(\d+\) : Abigail, .*Emily.*\. Voix clonées d'un enregistrement \(2\) : Gianna, Robert\.$/,
  );
  assert.equal(fetch.calls.length, calls + 2);

  const down = await setup({ routes: { '/get_predefined_voices': refused } });
  const failed = await down.gladys.fake.action('list_voices');
  assert.equal(failed.success, false);
  assert.match(failed.error.es, /No se puede acceder/);
});

test('a request arriving before the configuration is read waits for it', async () => {
  const gladys = createFakeGladys({ config: { base_url: BASE, voice_fr: 'Thomas' } });
  const fetch = fakeServer();
  const tts = new Chatterbox(gladys, {
    client: new ChatterboxClient({ fetch }),
    logger: recordingLogger().logger,
    timers: false,
  });
  const clip = await tts.handleSynthesize('Salut.', 'fr');
  assert.match(clip, /^audio\/wav;base64,/);
  assert.equal(fetch.speech().at(-1).json.predefined_voice_id, 'Thomas.wav');
});

test('a status Gladys did not take is published again at the next check', async () => {
  const { gladys, tts } = await setup();
  let fail = true;
  const published = [];
  gladys.setConnectionStatus = async (connected) => {
    if (fail) {
      throw new Error('HTTP 500');
    }
    published.push(connected);
  };
  tts.status = null;
  await tts.check();
  fail = false;
  await tts.check();
  assert.deepEqual(published, [true]);
});

test('the clips kept in memory stay under 20 MB', async () => {
  const header = Buffer.from(CLIPS.ouiFr.subarray(0, 44));
  header.writeUInt32LE(24000 * 2 * 90, 40);
  const big = Buffer.concat([header, Buffer.alloc(24000 * 2 * 90)]);
  const { gladys, tts } = await setup({ routes: { '/tts': () => wav(big) } });
  for (let i = 0; i < 6; i += 1) {
    assert.equal((await gladys.fake.ttsSynthesize(`Texte ${i}.`, 'fr')).success, true);
  }
  const bytes = [...tts.cache.values()].reduce((sum, clip) => sum + clip.audio.length, 0);
  assert.ok(bytes <= 20_000_000, `${bytes} bytes`);
  assert.equal(tts.cache.size, 4);
});
