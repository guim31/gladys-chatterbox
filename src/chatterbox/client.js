// -----------------------------------------------------------------------------
// Client of Chatterbox-TTS-Server (devnen), the self-hosted server of the
// Chatterbox models of Resemble AI:
//
//   POST <base>/tts                   JSON {text, voice_mode, predefined_voice_id |
//                                     reference_audio_filename, language, exaggeration,
//                                     speed_factor, output_format, split_text} -> WAV
//   GET  <base>/api/model-info        {loaded, type, supported_languages…}
//   GET  <base>/get_predefined_voices [{display_name, filename}] (voices/)
//   GET  <base>/get_reference_files   [filename] (reference_audio/, voices to clone)
//
// Errors are FastAPI's `{detail}`. The text never reaches a log line or an
// error message (a 422 can echo it in `detail[].input`: only `msg` is read).
// -----------------------------------------------------------------------------

import { fitWav } from '../wav.js';

// Gladys waits 30 s for the clip: keep a margin for the relay.
export const SPEECH_TIMEOUT_MS = 25_000;
// The periodic check and the voice lists.
export const HEALTH_TIMEOUT_MS = 10_000;
// Longest server message kept in an error.
const MAX_DETAIL = 160;

export class SpeechError extends Error {
  /**
   * @param {'not_configured'|'unreachable'|'timeout'|'not_found'|'rejected'|'voice_not_found'|'not_loaded'|'server'|'invalid_response'|'too_long'} kind - What failed.
   * @param {string} message - Technical detail, for the logs.
   * @param {{status?: number, detail?: string, cause?: unknown}} [options]
   */
  constructor(kind, message, { status, detail, cause } = {}) {
    super(message, { cause });
    this.name = 'SpeechError';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

/**
 * The message of an error body: FastAPI's `{detail}` (a text, or a list of
 * `{msg}` whose `input` is never read).
 * @param {Buffer} body - The answer.
 * @returns {string} The message, shortened, or ''.
 */
export function errorDetail(body) {
  let json;
  try {
    json = JSON.parse(body.toString('utf8'));
  } catch {
    return '';
  }
  const detail = json?.detail;
  const found =
    typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail
            .map((item) => item?.msg)
            .filter((msg) => typeof msg === 'string')
            .join('; ')
        : '';
  const flat = found.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_DETAIL ? `${flat.slice(0, MAX_DETAIL - 1)}…` : flat;
}

/**
 * The model a server runs, from `/api/model-info`.
 * @param {unknown} json - The answer.
 * @returns {{loaded: boolean, type: string, languages: string[]}} `languages`: the codes it speaks.
 */
export function parseModelInfo(json) {
  const languages = json?.supported_languages;
  return {
    loaded: json?.loaded === true,
    type: typeof json?.type === 'string' ? json.type : 'unknown',
    languages:
      languages && typeof languages === 'object' && !Array.isArray(languages)
        ? Object.keys(languages).map((code) => code.toLowerCase())
        : ['en'],
  };
}

export class ChatterboxClient {
  /**
   * @param {object} [deps]
   * @param {typeof fetch} [deps.fetch] - Injectable for tests.
   * @param {number} [deps.speechTimeoutMs] - Bound of one synthesis.
   * @param {number} [deps.healthTimeoutMs] - Bound of a check.
   */
  constructor({
    fetch: fetchImpl = globalThis.fetch,
    speechTimeoutMs = SPEECH_TIMEOUT_MS,
    healthTimeoutMs = HEALTH_TIMEOUT_MS,
  } = {}) {
    this.fetch = fetchImpl;
    this.speechTimeoutMs = speechTimeoutMs;
    this.healthTimeoutMs = healthTimeoutMs;
  }

  /**
   * One request to the server.
   * @param {string|null} baseUrl - The server.
   * @param {string} path - The endpoint.
   * @param {{json?: object, timeoutMs: number}} options - The body (POST), the bound.
   * @returns {Promise<{response: Response, body: Buffer}>} A 2xx answer.
   * @throws {SpeechError} On any failure.
   */
  async request(baseUrl, path, { json, timeoutMs }) {
    if (!baseUrl) {
      throw new SpeechError('not_configured', 'no server address configured');
    }
    let response;
    let data;
    try {
      response = await this.fetch(`${baseUrl}${path}`, {
        method: json ? 'POST' : 'GET',
        headers: json
          ? { Accept: 'audio/wav, application/json', 'Content-Type': 'application/json' }
          : { Accept: 'application/json' },
        body: json ? JSON.stringify(json) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Inside the try: the timeout also covers a body that stalls.
      data = Buffer.from(await response.arrayBuffer());
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new SpeechError('timeout', `${path}: no answer within ${timeoutMs} ms`, {
          cause: err,
        });
      }
      const reason = err?.cause?.code ?? err?.message ?? String(err);
      throw new SpeechError('unreachable', `${path}: request failed (${reason})`, { cause: err });
    }
    if (!response.ok) {
      const { status } = response;
      const detail = errorDetail(data);
      // /tts answers 404 for a voice file it does not have, and 503 while
      // the model is not loaded; a 404 elsewhere is no Chatterbox server.
      const kind =
        status === 404
          ? path === '/tts' && /voice|audio file/i.test(detail)
            ? 'voice_not_found'
            : 'not_found'
          : status === 503 && path === '/tts'
            ? 'not_loaded'
            : status >= 500
              ? 'server'
              : 'rejected';
      const suffix = detail ? `: ${detail}` : '';
      throw new SpeechError(kind, `${path}: HTTP ${status}${suffix}`, { status, detail });
    }
    return { response, body: data };
  }

  /**
   * A JSON answer.
   * @param {string} baseUrl - The server.
   * @param {string} path - The endpoint.
   * @returns {Promise<unknown>} The parsed body.
   * @throws {SpeechError} When it is no JSON.
   */
  async getJson(baseUrl, path) {
    const { body } = await this.request(baseUrl, path, { timeoutMs: this.healthTimeoutMs });
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      throw new SpeechError('invalid_response', `${path}: not the answer of Chatterbox`);
    }
  }

  /**
   * Speak a text.
   * @param {{baseUrl: string|null, voice: {mode: 'predefined'|'clone', file: string}, language: string, exaggeration: number|null, speed: number|null}} request - Server, voice, settings (null: the server's).
   * @param {string} text - What to say.
   * @returns {Promise<{audio: Buffer, type: 'audio/wav', seconds: number, sampleRate: number, resampled: boolean}>} The clip.
   * @throws {SpeechError} On any failure.
   * @example
   * await client.speak({ baseUrl: 'http://192.0.2.10:8004', voice: { mode: 'predefined', file: 'Emily.wav' },
   *   language: 'fr', exaggeration: null, speed: null }, 'Bonjour.');
   */
  async speak({ baseUrl, voice, language, exaggeration, speed }, text) {
    const json = {
      text,
      voice_mode: voice.mode,
      [voice.mode === 'clone' ? 'reference_audio_filename' : 'predefined_voice_id']: voice.file,
      language,
      output_format: 'wav',
      split_text: true,
    };
    if (exaggeration !== null && exaggeration !== undefined) {
      json.exaggeration = exaggeration;
    }
    if (speed !== null && speed !== undefined) {
      json.speed_factor = speed;
    }
    const { response, body } = await this.request(baseUrl, '/tts', {
      json,
      timeoutMs: this.speechTimeoutMs,
    });
    let clip;
    try {
      clip = fitWav(body);
    } catch (err) {
      throw new SpeechError('too_long', `/tts: ${err.message}`, { cause: err });
    }
    if (!clip) {
      const announced = response.headers.get('content-type') ?? 'no content type';
      throw new SpeechError(
        'invalid_response',
        `/tts: expected a WAV with sound, got "${announced}" (${body.length} bytes)`,
      );
    }
    return { ...clip, type: 'audio/wav' };
  }

  /**
   * The model the server runs.
   * @param {string} baseUrl - The server.
   * @returns {Promise<{loaded: boolean, type: string, languages: string[]}>} The model.
   * @throws {SpeechError} When it does not answer, or not as Chatterbox.
   */
  async modelInfo(baseUrl) {
    const json = await this.getJson(baseUrl, '/api/model-info');
    if (typeof json?.loaded !== 'boolean') {
      throw new SpeechError('invalid_response', '/api/model-info: not the answer of Chatterbox');
    }
    return parseModelInfo(json);
  }

  /**
   * The voices of the server.
   * @param {string} baseUrl - The server.
   * @returns {Promise<{predefined: Array<{name: string, file: string}>, reference: string[]}>}
   *   `predefined`: the voices of `voices/`; `reference`: the files of `reference_audio/`, to clone.
   * @throws {SpeechError} When it does not answer, or not as Chatterbox.
   */
  async voices(baseUrl) {
    const [predefined, reference] = await Promise.all([
      this.getJson(baseUrl, '/get_predefined_voices'),
      this.getJson(baseUrl, '/get_reference_files'),
    ]);
    if (!Array.isArray(predefined) || !Array.isArray(reference)) {
      throw new SpeechError('invalid_response', 'voice lists: not the answer of Chatterbox');
    }
    return {
      predefined: predefined
        .filter((voice) => typeof voice?.filename === 'string')
        .map((voice) => ({
          name: typeof voice.display_name === 'string' ? voice.display_name : voice.filename,
          file: voice.filename,
        })),
      reference: reference.filter((file) => typeof file === 'string'),
    };
  }
}

/**
 * The voice file a typed name designates: a voice of `voices/` first, then a
 * file of `reference_audio/` (cloned). Case does not matter, nor the extension.
 * @param {string} typed - What the administrator typed ('' for the default voice).
 * @param {{predefined: Array<{name: string, file: string}>, reference: string[]}} voices - The server's lists.
 * @returns {{mode: 'predefined'|'clone', file: string}|null} The voice, null when the server has none by that name.
 * @example
 * resolveVoice('emily', { predefined: [{ name: 'Emily', file: 'Emily.wav' }], reference: [] });
 * // { mode: 'predefined', file: 'Emily.wav' }
 */
export function resolveVoice(typed, voices) {
  const wanted = typed.trim().toLowerCase();
  const stem = (file) => file.toLowerCase().replace(/\.(wav|mp3)$/, '');
  if (wanted === '') {
    const preferred =
      voices.predefined.find((voice) => stem(voice.file) === DEFAULT_VOICE) ?? voices.predefined[0];
    return preferred ? { mode: 'predefined', file: preferred.file } : null;
  }
  const matches = (file) => file.toLowerCase() === wanted || stem(file) === stem(wanted);
  const predefined = voices.predefined.find(
    (voice) => matches(voice.file) || voice.name.toLowerCase() === wanted,
  );
  if (predefined) {
    return { mode: 'predefined', file: predefined.file };
  }
  const reference = voices.reference.find(matches);
  return reference ? { mode: 'clone', file: reference } : null;
}

// The voice of the server's default config.yaml (`default_voice_id: Emily.wav`).
export const DEFAULT_VOICE = 'emily';
