// A fetch that answers like Chatterbox-TTS-Server, from its real answers
// (test/fixtures/chatterbox, captured from the server on a processor), and
// records every request. `routes` overrides an endpoint: `(call) => Response`.

import { readFile } from 'node:fs/promises';

const fixture = (path) => readFile(new URL(`../fixtures/chatterbox/${path}`, import.meta.url));

export const CLIPS = {
  ouiFr: await fixture('oui-fr.wav'),
  yesEn: await fixture('yes-en.wav'),
};
export const ANSWERS = {
  modelInfo: await fixture('model-info-multilingual.json'),
  modelInfoTurbo: await fixture('model-info-turbo.json'),
  modelInfoNotLoaded: await fixture('model-info-not-loaded.json'),
  predefinedVoices: await fixture('predefined-voices.json'),
  referenceFiles: await fixture('reference-files.json'),
  voiceMissing: await fixture('voice-missing.json'),
  referenceMissing: await fixture('reference-missing.json'),
  emptyText: await fixture('empty-text.json'),
};

export const json = (body, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } });

export const wav = (body) =>
  new Response(body, { status: 200, headers: { 'content-type': 'audio/wav' } });

/**
 * @param {Record<string, (call: object) => Response|Promise<Response>>} [routes] - Answer per `origin + path`, or per path.
 * @returns {typeof fetch & {calls: object[], speech: () => object[]}} The fake.
 */
export function fakeServer(routes = {}) {
  const answers = {
    '/api/model-info': () => json(ANSWERS.modelInfo),
    '/get_predefined_voices': () => json(ANSWERS.predefinedVoices),
    '/get_reference_files': () => json(ANSWERS.referenceFiles),
    '/tts': () => wav(CLIPS.ouiFr),
    ...routes,
  };
  const calls = [];
  const fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    const call = {
      url: parsed,
      path: parsed.pathname,
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
      json: init.body ? JSON.parse(init.body) : null,
      signal: init.signal,
    };
    calls.push(call);
    const answer = answers[`${parsed.origin}${call.path}`] ?? answers[call.path];
    return answer ? answer(call) : json('{"detail":"Not Found"}', 404);
  };
  fetch.calls = calls;
  fetch.speech = () => calls.filter((call) => call.path.endsWith('/tts'));
  return fetch;
}

/** A logger that records, by level. */
export function recordingLogger() {
  const lines = { info: [], warn: [], debug: [], error: [] };
  const logger = Object.fromEntries(
    Object.keys(lines).map((level) => [level, (message) => lines[level].push(String(message))]),
  );
  return { logger, lines };
}
