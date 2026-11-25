// -----------------------------------------------------------------------------
// Chatterbox: everything the SDK handlers of src/app.js call.
//
// - applyConfig(): takes the settings, then checks the server (its model and
//   voice lists, never a synthesis), shown as the status in Supervision.
//   Repeated every 5 minutes, so the scene triggers `server_offline` /
//   `server_online` follow the server. Never throws.
// - handleSynthesize(): turns a text Gladys wants spoken into a clip. Throwing
//   acks the command as failed: the scene action fails visibly.
// - testVoice(), listVoices(): the buttons of the configuration screen.
//
// A clip already made (same text and settings) is served from memory, and
// identical requests running at the same time (one announcement on several
// speakers) share one synthesis: on a processor, Chatterbox is slow.
// -----------------------------------------------------------------------------

import { logger as defaultLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES, normalizeConfig, requestLanguage, spokenLanguage } from './config.js';
import { ChatterboxClient, resolveVoice } from './chatterbox/client.js';

// Clips kept in memory (a WAV of 10 seconds makes about 480 KB).
export const CACHE_SIZE = 16;
// And at most this many bytes of them: the sandbox has 256 MB.
export const CACHE_BYTES = 20 * 1000 * 1000;
// Period of the check of the server, for the status and the scene triggers.
export const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// The failures a synthesis reports as the server being down. The others
// concern one request (a voice it lacks, a text too long for the time Gladys
// waits on a processor): the periodic check tells about the server.
const SPEECH_OFFLINE_ERRORS = ['unreachable', 'not_loaded'];

export const MESSAGES = {
  not_configured: {
    en: 'Enter the address of the Chatterbox server in the configuration, then save.',
    fr: "Saisissez l'adresse du serveur Chatterbox dans la configuration, puis enregistrez.",
    de: 'Gib die Adresse des Chatterbox-Servers in der Konfiguration ein und speichere.',
    es: 'Introduzca la dirección del servidor Chatterbox en la configuración y guarde.',
  },
  invalid_url: {
    en: 'The server address is not valid: http:// or https://, without user name or password.',
    fr: "L'adresse du serveur n'est pas valide : http:// ou https://, sans nom d'utilisateur ni mot de passe.",
    de: 'Die Serveradresse ist ungültig: http:// oder https://, ohne Benutzername und Passwort.',
    es: 'La dirección del servidor no es válida: http:// o https://, sin nombre de usuario ni contraseña.',
  },
  unreachable: {
    en: 'The Chatterbox server cannot be reached: check its address and that it is running.',
    fr: "Le serveur Chatterbox est injoignable : vérifiez son adresse et qu'il est démarré.",
    de: 'Der Chatterbox-Server ist nicht erreichbar: Prüfe seine Adresse und ob er läuft.',
    es: 'No se puede acceder al servidor Chatterbox: compruebe su dirección y que esté en marcha.',
  },
  timeout: {
    en: 'The Chatterbox server does not answer in time: keep announcements short (Gladys waits 30 seconds), or give it a graphics card.',
    fr: 'Le serveur Chatterbox ne répond pas à temps : gardez des annonces courtes (Gladys attend 30 secondes), ou donnez-lui une carte graphique.',
    de: 'Der Chatterbox-Server antwortet nicht rechtzeitig: Halte Durchsagen kurz (Gladys wartet 30 Sekunden) oder gib ihm eine Grafikkarte.',
    es: 'El servidor Chatterbox no responde a tiempo: mantenga los anuncios cortos (Gladys espera 30 segundos) o dele una tarjeta gráfica.',
  },
  health_timeout: {
    en: 'The Chatterbox server does not answer in time: check that it is not overloaded.',
    fr: "Le serveur Chatterbox ne répond pas à temps : vérifiez qu'il n'est pas surchargé.",
    de: 'Der Chatterbox-Server antwortet nicht rechtzeitig: Prüfe, ob er überlastet ist.',
    es: 'El servidor Chatterbox no responde a tiempo: compruebe que no esté sobrecargado.',
  },
  not_found: {
    en: 'No Chatterbox server at this address: check the port (8004 by default) and the path.',
    fr: 'Pas de serveur Chatterbox à cette adresse : vérifiez le port (8004 par défaut) et le chemin.',
    de: 'Kein Chatterbox-Server unter dieser Adresse: Prüfe den Port (standardmäßig 8004) und den Pfad.',
    es: 'No hay ningún servidor Chatterbox en esta dirección: compruebe el puerto (8004 por defecto) y la ruta.',
  },
  not_loaded: {
    en: 'The Chatterbox server has no model loaded yet: wait for the end of its start (the first one downloads the model), or check its logs.',
    fr: "Le serveur Chatterbox n'a pas encore de modèle chargé : attendez la fin de son démarrage (le premier télécharge le modèle), ou consultez ses journaux.",
    de: 'Der Chatterbox-Server hat noch kein Modell geladen: Warte das Ende seines Starts ab (der erste lädt das Modell herunter) oder sieh dir seine Logs an.',
    es: 'El servidor Chatterbox aún no tiene ningún modelo cargado: espere al final de su arranque (el primero descarga el modelo) o consulte sus registros.',
  },
  voice_not_found: {
    en: 'The Chatterbox server has no voice by this name: use "Show the voices", or put the file in its voices or reference_audio folder.',
    fr: "Le serveur Chatterbox n'a pas de voix de ce nom : utilisez « Afficher les voix », ou déposez le fichier dans son dossier voices ou reference_audio.",
    de: 'Der Chatterbox-Server hat keine Stimme mit diesem Namen: Nutze „Stimmen anzeigen“ oder lege die Datei in seinen Ordner voices oder reference_audio.',
    es: 'El servidor Chatterbox no tiene ninguna voz con este nombre: use «Mostrar las voces» o ponga el archivo en su carpeta voices o reference_audio.',
  },
  no_voice: {
    en: 'The Chatterbox server has no voice at all: put a WAV file in its voices folder.',
    fr: "Le serveur Chatterbox n'a aucune voix : déposez un fichier WAV dans son dossier voices.",
    de: 'Der Chatterbox-Server hat gar keine Stimme: Lege eine WAV-Datei in seinen Ordner voices.',
    es: 'El servidor Chatterbox no tiene ninguna voz: ponga un archivo WAV en su carpeta voices.',
  },
  language_unsupported: {
    en: 'The model of the Chatterbox server speaks only English: set "model: repo_id: chatterbox-multilingual" in its config.yaml for French, German or Spanish.',
    fr: "Le modèle du serveur Chatterbox ne parle que l'anglais : réglez « model: repo_id: chatterbox-multilingual » dans son config.yaml pour le français, l'allemand ou l'espagnol.",
    de: 'Das Modell des Chatterbox-Servers spricht nur Englisch: Stelle „model: repo_id: chatterbox-multilingual“ in seiner config.yaml ein, für Französisch, Deutsch oder Spanisch.',
    es: 'El modelo del servidor Chatterbox solo habla inglés: configure «model: repo_id: chatterbox-multilingual» en su config.yaml para el francés, el alemán o el español.',
  },
  rejected: {
    en: 'The Chatterbox server refuses the request. Check its logs.',
    fr: 'Le serveur Chatterbox refuse la requête. Consultez ses journaux.',
    de: 'Der Chatterbox-Server lehnt die Anfrage ab. Sieh dir seine Logs an.',
    es: 'El servidor Chatterbox rechaza la solicitud. Consulte sus registros.',
  },
  server: {
    en: 'The Chatterbox server is failing (server error). Check its logs.',
    fr: 'Le serveur Chatterbox est en panne (erreur serveur). Consultez ses journaux.',
    de: 'Der Chatterbox-Server hat eine Störung (Serverfehler). Sieh dir seine Logs an.',
    es: 'El servidor Chatterbox falla (error del servidor). Consulte sus registros.',
  },
  invalid_response: {
    en: 'The server at this address does not answer as Chatterbox-TTS-Server does.',
    fr: 'Le serveur à cette adresse ne répond pas comme Chatterbox-TTS-Server.',
    de: 'Der Server unter dieser Adresse antwortet nicht wie Chatterbox-TTS-Server.',
    es: 'El servidor en esta dirección no responde como Chatterbox-TTS-Server.',
  },
  too_long: {
    en: 'The clip is over the 5 MB Gladys accepts: split the announcement.',
    fr: 'Le clip dépasse les 5 Mo que Gladys accepte : découpez l’annonce.',
    de: 'Der Clip ist größer als die 5 MB, die Gladys annimmt: Teile die Durchsage auf.',
    es: 'El clip supera los 5 MB que acepta Gladys: divida el anuncio.',
  },
  no_config: {
    en: 'Gladys did not give the configuration of the integration: try again in a moment.',
    fr: "Gladys n'a pas transmis la configuration de l'intégration : réessayez dans un instant.",
    de: 'Gladys hat die Konfiguration der Integration nicht übermittelt: Versuche es gleich noch einmal.',
    es: 'Gladys no ha transmitido la configuración de la integración: vuelva a intentarlo en un momento.',
  },
  empty: {
    en: 'There is nothing to say in the text.',
    fr: "Il n'y a rien à dire dans le texte.",
    de: 'Im Text gibt es nichts zu sagen.',
    es: 'No hay nada que decir en el texto.',
  },
};

// Sentence of the "Test the voice" button, per language.
export const SAMPLES = {
  fr: 'Bonjour, ici Gladys. La porte du garage est ouverte.',
  en: 'Hello, this is Gladys. The garage door is open.',
  de: 'Hallo, hier ist Gladys. Das Garagentor ist offen.',
  es: 'Hola, soy Gladys. La puerta del garaje está abierta.',
};

const LANGUAGE_NAMES = {
  en: { fr: 'French', en: 'English', de: 'German', es: 'Spanish' },
  fr: { fr: 'français', en: 'anglais', de: 'allemand', es: 'espagnol' },
  de: { fr: 'Französisch', en: 'Englisch', de: 'Deutsch', es: 'Spanisch' },
  es: { fr: 'francés', en: 'inglés', de: 'alemán', es: 'español' },
};

// Longest list of voice names in the "Show the voices" message.
const MAX_LISTED = 40;

const localized = (build) => Object.fromEntries(LANGUAGES.map((l) => [l, build(l)]));
const decimal = (value, lang) => {
  const text = value.toFixed(1);
  return lang === 'en' ? text : text.replace('.', ',');
};
const stem = (file) => file.replace(/\.(wav|mp3)$/i, '');

/**
 * Status shown in Supervision once the server answered.
 * @param {{type: string, languages: string[]}} model - The model it runs.
 * @param {string} wanted - The language the settings speak (the fixed one, else the fallback).
 * @returns {{connected: boolean, message: {en: string, fr: string, de: string, es: string}}} The status.
 */
export function readyStatus(model, wanted) {
  if (!model.languages.includes(wanted)) {
    return { connected: true, message: MESSAGES.language_unsupported };
  }
  return {
    connected: true,
    message: {
      en: `The Chatterbox server answers (model ${model.type}).`,
      fr: `Le serveur Chatterbox répond (modèle ${model.type}).`,
      de: `Der Chatterbox-Server antwortet (Modell ${model.type}).`,
      es: `El servidor Chatterbox responde (modelo ${model.type}).`,
    },
  };
}

/**
 * Answer of the "Test the voice" button.
 * @param {{language: string, voice: string, seconds: number, ms: number}} test - What was spoken.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function testMessage({ language, voice, seconds, ms }) {
  const name = (lang) => LANGUAGE_NAMES[lang][language];
  return localized((lang) => {
    const audio = decimal(seconds, lang);
    const made = decimal(ms / 1000, lang);
    return {
      en: `Test sentence spoken in ${name('en')} with the voice "${voice}": ${audio} s of sound made in ${made} s. Select Chatterbox on the Artificial Intelligence page of Gladys.`,
      fr: `Phrase de test dite en ${name('fr')} avec la voix « ${voice} » : ${audio} s de son en ${made} s. Choisissez Chatterbox sur la page Intelligence Artificielle de Gladys.`,
      de: `Testsatz auf ${name('de')} mit der Stimme „${voice}“ gesprochen: ${audio} s Ton in ${made} s. Wähle Chatterbox auf der Seite Künstliche Intelligenz von Gladys.`,
      es: `Frase de prueba dicha en ${name('es')} con la voz «${voice}»: ${audio} s de sonido en ${made} s. Elija Chatterbox en la página Inteligencia artificial de Gladys.`,
    }[lang];
  });
}

/**
 * Answer of the "Show the voices" button.
 * @param {{predefined: Array<{name: string, file: string}>, reference: string[]}} voices - The server's lists.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function voicesMessage(voices) {
  const names = (list) => {
    const shown = list.slice(0, MAX_LISTED).join(', ');
    return list.length > MAX_LISTED ? `${shown}…` : shown;
  };
  const predefined = names(voices.predefined.map((voice) => stem(voice.file)));
  const reference = names(voices.reference.map(stem));
  return localized((lang) => {
    const ready = {
      en: `Ready-made voices (${voices.predefined.length}): ${predefined || 'none'}.`,
      fr: `Voix prêtes (${voices.predefined.length}) : ${predefined || 'aucune'}.`,
      de: `Fertige Stimmen (${voices.predefined.length}): ${predefined || 'keine'}.`,
      es: `Voces listas (${voices.predefined.length}): ${predefined || 'ninguna'}.`,
    }[lang];
    const cloned = {
      en: `Voices cloned from a recording (${voices.reference.length}): ${reference || 'none, put a WAV of 10 to 20 s in reference_audio'}.`,
      fr: `Voix clonées d'un enregistrement (${voices.reference.length}) : ${reference || 'aucune, déposez un WAV de 10 à 20 s dans reference_audio'}.`,
      de: `Aus einer Aufnahme geklonte Stimmen (${voices.reference.length}): ${reference || 'keine, lege eine WAV von 10 bis 20 s in reference_audio'}.`,
      es: `Voces clonadas de una grabación (${voices.reference.length}): ${reference || 'ninguna, ponga un WAV de 10 a 20 s en reference_audio'}.`,
    }[lang];
    return `${ready} ${cloned}`;
  });
}

/**
 * The message of a failure, for the administrator.
 * @param {unknown} err - Usually a SpeechError.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function describeError(err) {
  return MESSAGES[err?.kind] ?? MESSAGES.unreachable;
}

/**
 * Actions and synthesis fail with the actionable text in four languages:
 * Gladys shows `message` in the user's language, in red.
 */
export class ActionFailure extends Error {
  /**
   * @param {{en: string, fr: string, de: string, es: string}} text - The message.
   * @param {unknown} [cause] - The failure behind it.
   */
  constructor(text, cause) {
    super(text.en, { cause });
    this.message = text;
  }
}

/**
 * The error a failed command acks: the actionable text, and the technical
 * detail in brackets.
 * @param {Error & {kind?: string}} err - The failure.
 * @returns {ActionFailure} The error to throw.
 */
function failure(err) {
  const text = describeError(err);
  return new ActionFailure(
    localized((lang) => `${text[lang]} [${err.message}]`),
    err,
  );
}

class LocalError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

export class Chatterbox {
  /**
   * @param {object} gladys - The SDK instance (GladysIntegration).
   * @param {object} [deps]
   * @param {ChatterboxClient} [deps.client] - Injectable for tests.
   * @param {{info: Function, warn: Function, debug: Function}} [deps.logger] - Injectable for tests.
   * @param {() => number} [deps.now] - Clock, injectable for tests.
   * @param {boolean} [deps.timers] - Whether to check the server periodically.
   */
  constructor(
    gladys,
    { client = new ChatterboxClient(), logger = defaultLogger, now = Date.now, timers = true } = {},
  ) {
    this.gladys = gladys;
    this.client = client;
    this.logger = logger;
    this.now = now;
    this.timers = timers;
    this.timer = null;
    this.settings = normalizeConfig({});
    this.loaded = false;
    this.loading = null;
    // Bumped by every configuration: a clip made with older settings is not kept.
    this.generation = 0;
    this.cache = new Map();
    this.inFlight = new Map();
    this.status = null;
    // What the last check learned: the model and the voice lists, null before.
    this.model = null;
    this.voices = null;
    // Whether the server answered at the last contact: true, false, or
    // undefined before the first one (or without an address).
    this.online = undefined;
  }

  /**
   * Take the settings into account, then check the server.
   * @param {Record<string, unknown>} rawConfig - Configuration from the SDK.
   * @returns {Promise<void>} Never rejects.
   */
  async applyConfig(rawConfig) {
    this.useConfig(rawConfig);
    this.startTimer();
    await this.check();
  }

  /**
   * Take the settings into account, synchronously.
   * @param {Record<string, unknown>} rawConfig - Configuration from the SDK.
   * @returns {void}
   */
  useConfig(rawConfig) {
    this.settings = normalizeConfig(rawConfig);
    this.loaded = true;
    this.generation += 1;
    this.cache.clear();
    this.inFlight.clear();
    this.model = null;
    this.voices = null;
    const { baseUrl, language, exaggeration, speed } = this.settings;
    this.logger.info(
      `Settings: ${baseUrl ?? 'no server'}, language ${language ?? 'of the user'}, exaggeration ${exaggeration ?? 'of the server'}, speed ${speed ?? 'of the server'}`,
    );
  }

  /** Check the server every CHECK_INTERVAL_MS, once. */
  startTimer() {
    if (!this.timers || this.timer) {
      return;
    }
    this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  /** Stop the periodic check (shutdown, tests). */
  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Check the server (model and voices), shown as the status.
   * @returns {Promise<void>} Never rejects.
   */
  async check() {
    const { settings, generation } = this;
    if (settings.invalid || !settings.baseUrl) {
      this.online = undefined;
      await this.reportStatus(
        false,
        settings.invalid ? MESSAGES.invalid_url : MESSAGES.not_configured,
      );
      return;
    }
    let model;
    let voices;
    try {
      model = await this.client.modelInfo(settings.baseUrl);
      if (!model.loaded) {
        throw new LocalError('not_loaded', 'no model loaded');
      }
      voices = await this.client.voices(settings.baseUrl);
    } catch (err) {
      if (generation === this.generation) {
        // A check that runs out of time is no long text: its own message.
        const reason =
          err?.kind === 'timeout' ? Object.assign(err, { kind: 'health_timeout' }) : err;
        await this.markOffline(reason);
      }
      return;
    }
    if (generation !== this.generation) {
      return;
    }
    this.model = model;
    this.voices = voices;
    this.logger.debug(
      `Server checked: model ${model.type}, ${voices.predefined.length} voices, ${voices.reference.length} reference files`,
    );
    const { message } = readyStatus(model, spokenLanguage(settings, null));
    await this.markOnline(message);
  }

  /**
   * Read the configuration when a command arrives before the SDK
   * resynchronized it.
   * @returns {Promise<void>}
   */
  async load() {
    if (this.loaded) {
      return;
    }
    this.loading ??= this.gladys.getConfig().then(
      (config) => {
        if (this.loaded) {
          // onConfigUpdated came first: its configuration is the newer one.
          return;
        }
        this.useConfig(config);
        this.startTimer();
        // Not awaited: the request waiting has its own time budget.
        this.check();
      },
      (err) => {
        this.loading = null;
        throw err;
      },
    );
    await this.loading;
  }

  /**
   * load(), failing as the buttons do: in red, in four languages.
   * @returns {Promise<void>}
   * @throws {ActionFailure} When Gladys does not give the configuration.
   */
  async loadForAction() {
    try {
      await this.load();
    } catch (err) {
      throw new ActionFailure(
        localized((lang) => `${MESSAGES.no_config[lang]} [${err.message}]`),
        err,
      );
    }
  }

  /**
   * Synthesize a text Gladys wants spoken.
   * @param {string} text - The text (≤ 2,000 characters, capped by Gladys).
   * @param {string|null} language - Language of the requesting user, null when unknown.
   * @returns {Promise<string>} The clip, as `audio/wav;base64,…`.
   * @throws {Error} When no clip can be made.
   */
  async handleSynthesize(text, language) {
    try {
      await this.load();
      const { audio, type } = await this.speak(
        typeof text === 'string' ? text : '',
        spokenLanguage(this.settings, language),
      );
      return `${type};base64,${audio.toString('base64')}`;
    } catch (err) {
      // The failed ack only reaches the Gladys server log, as a text (the core
      // does not localize a synthesis error): say it here too, in English.
      const text = err.message?.en ?? err.message;
      this.logger.warn(`Speech not synthesized: ${text}`);
      throw new Error(text, { cause: err });
    }
  }

  /**
   * The "Test the voice" button: speaks a sentence with the saved settings.
   * @param {{language?: string}} [fields] - The language to test (the setting's, else French).
   * @returns {Promise<{en: string, fr: string, de: string, es: string}>} The message.
   * @throws {ActionFailure} When no clip can be made.
   */
  async testVoice(fields = {}) {
    await this.loadForAction();
    const language = fields?.language
      ? requestLanguage(fields.language)
      : spokenLanguage(this.settings, null);
    const start = this.now();
    // Never from memory: the button must really reach the server.
    const clip = await this.speak(SAMPLES[language], language, { fresh: true });
    const test = {
      language,
      voice: stem(clip.voice),
      seconds: clip.seconds,
      ms: this.now() - start,
    };
    this.logger.info(
      `Voice tested: ${test.voice} (${language}), ${test.seconds.toFixed(1)} s of sound in ${test.ms} ms`,
    );
    return testMessage(test);
  }

  /**
   * The "Show the voices" button: the voices of the server, read now.
   * @returns {Promise<{en: string, fr: string, de: string, es: string}>} The message.
   * @throws {ActionFailure} When the server does not answer.
   */
  async listVoices() {
    await this.loadForAction();
    const { settings, generation } = this;
    if (settings.invalid || !settings.baseUrl) {
      throw failure(
        new LocalError(
          settings.invalid ? 'invalid_url' : 'not_configured',
          'no valid server address',
        ),
      );
    }
    let voices;
    try {
      voices = await this.client.voices(settings.baseUrl);
    } catch (err) {
      throw failure(err);
    }
    if (generation === this.generation) {
      this.voices = voices;
    }
    this.logger.info(
      `Voices listed: ${voices.predefined.length} ready-made, ${voices.reference.length} to clone`,
    );
    return voicesMessage(voices);
  }

  /**
   * The voice file of a language: from the lists of the last check, read
   * again when the name is not in them (a file added since).
   * @param {string} language - A code of LANGUAGES.
   * @param {object} settings - The settings the synthesis runs with.
   * @param {number} generation - Their generation.
   * @returns {Promise<{mode: 'predefined'|'clone', file: string}>} The voice.
   * @throws {Error & {kind: string}} When the server has no such voice, or does not answer.
   */
  async voiceFor(language, settings, generation) {
    const typed = settings.voices[language] ?? '';
    let voice =
      this.voices && generation === this.generation ? resolveVoice(typed, this.voices) : null;
    if (!voice) {
      const voices = await this.client.voices(settings.baseUrl).catch((err) => {
        // A voice list that runs out of time is no long text: the check's message.
        throw err?.kind === 'timeout' ? Object.assign(err, { kind: 'health_timeout' }) : err;
      });
      if (generation === this.generation) {
        this.voices = voices;
      }
      voice = resolveVoice(typed, voices);
    }
    if (!voice) {
      throw typed
        ? new LocalError('voice_not_found', `no voice "${typed}" on the server`)
        : new LocalError('no_voice', 'the server has no voice');
    }
    return voice;
  }

  /**
   * The clip of a text: from memory, from a synthesis already running, or
   * from the server. Reports the server's state as the status.
   * @param {string} text - The text.
   * @param {string} language - A code of LANGUAGES.
   * @param {{fresh?: boolean}} [options] - `fresh`: ask the server even when the clip is known.
   * @returns {Promise<{audio: Buffer, type: string, seconds: number, voice: string}>} The clip.
   * @throws {ActionFailure} The actionable failure.
   */
  async speak(text, language, { fresh = false } = {}) {
    const { settings, generation } = this;
    const input = text.trim();
    if (!/[\p{L}\p{N}]/u.test(input)) {
      throw failure(new LocalError('empty', 'nothing to say in the text'));
    }
    if (settings.invalid || !settings.baseUrl) {
      const kind = settings.invalid ? 'invalid_url' : 'not_configured';
      throw failure(new LocalError(kind, 'no valid server address configured'));
    }
    // An English-only model reads any text with English sounds: refuse rather
    // than speak gibberish. Unknown model (no check yet): let the server try.
    if (this.model && !this.model.languages.includes(language)) {
      throw failure(
        new LocalError(
          'language_unsupported',
          `model ${this.model.type} does not speak ${language}`,
        ),
      );
    }

    let pending;
    let key;
    try {
      const started = this.now();
      const voice = await this.voiceFor(language, settings, generation);
      // Gladys waits 30 s in all: a voice list read now shortens the synthesis.
      const timeoutMs = Math.max(
        1000,
        this.client.speechTimeoutMs - Math.max(0, this.now() - started),
      );
      const request = {
        baseUrl: settings.baseUrl,
        voice,
        language,
        exaggeration: settings.exaggeration,
        speed: settings.speed,
      };
      key = JSON.stringify([voice, language, settings.exaggeration, settings.speed, input]);
      const cached = fresh ? null : this.cache.get(key);
      if (cached) {
        this.logger.debug(`Clip served from memory (${input.length} characters)`);
        return cached;
      }
      pending = fresh ? null : this.inFlight.get(key);
      if (!pending) {
        pending = this.client
          .speak(request, input, { timeoutMs })
          .then((clip) => ({ ...clip, voice: voice.file }));
        this.inFlight.set(key, pending);
        pending
          .finally(() => {
            if (this.inFlight.get(key) === pending) {
              this.inFlight.delete(key);
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      await this.speechFailed(err, generation);
      throw failure(err);
    }

    let clip;
    try {
      clip = await pending;
    } catch (err) {
      await this.speechFailed(err, generation);
      throw failure(err);
    }
    if (generation === this.generation && this.online === false) {
      // Back after an outage: the periodic check refines the message later.
      this.check();
    }
    if (generation === this.generation) {
      this.cache.set(key, clip);
      let bytes = [...this.cache.values()].reduce((sum, kept) => sum + kept.audio.length, 0);
      while (this.cache.size > CACHE_SIZE || (bytes > CACHE_BYTES && this.cache.size > 1)) {
        const oldest = this.cache.keys().next().value;
        bytes -= this.cache.get(oldest).audio.length;
        this.cache.delete(oldest);
      }
    }
    this.logger.debug(
      `Clip synthesized with "${clip.voice}" (${language}): ${input.length} characters, ${clip.seconds.toFixed(1)} s, ${clip.audio.length} bytes${clip.resampled ? ` resampled to ${clip.sampleRate} Hz` : ''}`,
    );
    return clip;
  }

  /**
   * A synthesis that runs out of time says nothing of the server: on a
   * processor, a long text just takes longer than Gladys waits. Nor does a
   * voice it lacks. Only "unreachable" and "no model" mark it offline.
   * @param {Error & {kind?: string}} err - The failure.
   * @param {number} generation - The settings the synthesis ran with.
   * @returns {Promise<void>}
   */
  async speechFailed(err, generation) {
    if (generation === this.generation && SPEECH_OFFLINE_ERRORS.includes(err?.kind)) {
      await this.markOffline(err);
    }
  }

  /**
   * The server answers: status, and the `server_online` trigger after an outage.
   * @param {{en: string, fr: string, de: string, es: string}} message - The status.
   * @returns {Promise<void>}
   */
  async markOnline(message) {
    const was = this.online;
    this.online = true;
    if (was === false) {
      this.logger.info('The Chatterbox server answers again');
      await this.fire('server_online');
    } else if (was === undefined) {
      this.logger.info('The Chatterbox server answers');
    }
    await this.reportStatus(true, message);
  }

  /**
   * The server fails: status, and the `server_offline` trigger once per outage.
   * @param {Error & {kind?: string}} err - The failure.
   * @returns {Promise<void>}
   */
  async markOffline(err) {
    const was = this.online;
    this.online = false;
    if (was !== false) {
      this.logger.warn(`The Chatterbox server is unavailable: ${err?.message}`);
      await this.fire('server_offline');
    }
    await this.reportStatus(false, describeError(err));
  }

  /**
   * Fire a scene trigger; a failure is logged, never thrown.
   * @param {string} key - The trigger key of the manifest.
   * @returns {Promise<void>}
   */
  async fire(key) {
    try {
      await this.gladys.publishSceneEvent(key);
    } catch (err) {
      this.logger.warn(`Could not fire the ${key} scene trigger: ${err.message}`);
    }
  }

  /**
   * Publish the status, only when it changes. A failure is logged, never thrown.
   * @param {boolean} connected - Whether the server answers.
   * @param {{en: string, fr: string, de: string, es: string}} message - Shown to the administrator.
   * @returns {Promise<void>}
   */
  async reportStatus(connected, message) {
    if (this.status?.connected === connected && this.status?.message.en === message.en) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(connected, message);
      // Only once published: a failed one is tried again at the next check.
      this.status = { connected, message };
    } catch (statusErr) {
      this.logger.warn(`Unable to publish the status: ${statusErr.message}`);
    }
  }
}
