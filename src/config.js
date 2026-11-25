// -----------------------------------------------------------------------------
// Configuration: defaults (mirrors the manifest), normalization, and the
// settings of one request (language, voice, expressiveness, speed).
//
// One Chatterbox server loads ONE model: `chatterbox-multilingual` speaks 23
// languages, `chatterbox-turbo` and `chatterbox` (the original) English only.
// -----------------------------------------------------------------------------

// Languages of the Gladys interface, the ones a voice can be set for.
export const LANGUAGES = ['fr', 'en', 'de', 'es'];

// Language spoken when Gladys gives none (an announcement on an instance
// without administrator): the default of Guilhem's integrations.
export const FALLBACK_LANGUAGE = 'fr';

// The choices of the manifest's `exaggeration` and `speed` selects, besides
// `server`, which keeps the server's own setting (its config.yaml).
export const EXAGGERATIONS = ['0.25', '0.5', '0.75', '1', '1.25', '1.5', '2'];
export const SPEEDS = ['0.8', '0.9', '1', '1.1', '1.2', '1.3'];

export const DEFAULT_CONFIG = Object.freeze({
  base_url: '',
  language: 'auto',
  voice_fr: '',
  voice_en: '',
  voice_de: '',
  voice_es: '',
  exaggeration: 'server',
  speed: 'server',
});

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * The address of a server, as `http(s)://host[:port][/path]` without a
 * trailing slash. A bare `host:port` gets `http://`.
 * @param {unknown} value - What the administrator typed.
 * @returns {string|null} The URL, null when empty or invalid.
 * @example
 * normalizeBaseUrl('192.0.2.10:8004/'); // 'http://192.0.2.10:8004'
 */
export function normalizeBaseUrl(value) {
  let raw = text(value);
  if (raw === '') {
    return null;
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    raw = `http://${raw}`;
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    return null;
  }
  // `/tts`, `/docs` or `/v1` pasted from the server's pages: the address is the server.
  const path = url.pathname.replace(/\/+$/, '').replace(/\/(tts|docs|v1)$/, '');
  return `${url.origin}${path}`;
}

/**
 * A number among the allowed choices, else null (the server's setting).
 * @param {unknown} value - The select's value.
 * @param {string[]} choices - The allowed ones.
 * @returns {number|null} The number.
 */
function choice(value, choices) {
  const raw = typeof value === 'number' ? String(value) : text(value).replace(',', '.');
  const found = choices.find((option) => Number(option) === Number(raw));
  return raw !== '' && found !== undefined ? Number(found) : null;
}

/**
 * Normalize the raw configuration sent by Gladys.
 * @param {Record<string, unknown>} [raw] - Values from the configuration form.
 * @returns {{baseUrl: string|null, invalid: boolean, language: string|null, voices: Record<string, string>, exaggeration: number|null, speed: number|null}}
 *   `invalid`: an address is typed but not usable; `language`: a fixed one, null to follow the user.
 * @example
 * normalizeConfig({ base_url: 'tts.lan:8004' }).baseUrl; // 'http://tts.lan:8004'
 */
export function normalizeConfig(raw = {}) {
  const value = raw ?? {};
  const baseUrl = normalizeBaseUrl(value.base_url);
  const fixed = text(value.language).toLowerCase();
  return {
    baseUrl,
    invalid: baseUrl === null && text(value.base_url) !== '',
    language: LANGUAGES.includes(fixed) ? fixed : null,
    voices: Object.fromEntries(LANGUAGES.map((lang) => [lang, text(value[`voice_${lang}`])])),
    exaggeration: choice(value.exaggeration, EXAGGERATIONS),
    speed: choice(value.speed, SPEEDS),
  };
}

/**
 * The language of a request, as one of LANGUAGES: `fr-FR`, `FR` and `fr_FR`
 * are `fr`; unknown or another language gives the fallback.
 * @param {unknown} language - Language Gladys sent, null when unknown.
 * @returns {string} A code of LANGUAGES.
 */
export function requestLanguage(language) {
  if (typeof language !== 'string') {
    return FALLBACK_LANGUAGE;
  }
  const base = language.trim().toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.includes(base) ? base : FALLBACK_LANGUAGE;
}

/**
 * The language a text is spoken in: the fixed one of the settings, else the
 * one of the request.
 * @param {{language: string|null}} settings - Normalized settings.
 * @param {unknown} language - Language Gladys sent, null when unknown.
 * @returns {string} A code of LANGUAGES.
 */
export function spokenLanguage(settings, language) {
  return settings.language ?? requestLanguage(language);
}
