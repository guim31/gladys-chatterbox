import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  normalizeBaseUrl,
  normalizeConfig,
  requestLanguage,
  spokenLanguage,
} from '../src/config.js';

test('the server address gets a scheme when missing, and loses a trailing slash and /tts', () => {
  assert.equal(normalizeBaseUrl('192.0.2.10:8004/'), 'http://192.0.2.10:8004');
  assert.equal(normalizeBaseUrl(' https://tts.example/tts '), 'https://tts.example');
  assert.equal(normalizeBaseUrl('http://192.0.2.10:8004/docs'), 'http://192.0.2.10:8004');
  assert.equal(normalizeBaseUrl('http://192.0.2.10/chatterbox/'), 'http://192.0.2.10/chatterbox');
});

test('an empty, invalid or credential-bearing address is no address', () => {
  assert.equal(normalizeBaseUrl(''), null);
  assert.equal(normalizeBaseUrl(42), null);
  assert.equal(normalizeBaseUrl('ftp://192.0.2.10'), null);
  assert.equal(normalizeBaseUrl('http://user:pass@192.0.2.10'), null);
  assert.equal(normalizeConfig({ base_url: 'http://user:pass@192.0.2.10' }).invalid, true);
  assert.equal(normalizeConfig({ base_url: '' }).invalid, false);
});

test('defaults: no server, the language of the user, the settings of the server', () => {
  const settings = normalizeConfig(DEFAULT_CONFIG);
  assert.deepEqual(settings, {
    baseUrl: null,
    invalid: false,
    language: null,
    voices: { fr: '', en: '', de: '', es: '' },
    exaggeration: null,
    speed: null,
  });
  assert.deepEqual(normalizeConfig(null), settings);
});

test('expressiveness and speed: only the choices of the form, a comma accepted', () => {
  assert.equal(normalizeConfig({ exaggeration: '0,5' }).exaggeration, 0.5);
  assert.equal(normalizeConfig({ exaggeration: 2 }).exaggeration, 2);
  assert.equal(normalizeConfig({ exaggeration: '7' }).exaggeration, null);
  assert.equal(normalizeConfig({ speed: '1.30' }).speed, 1.3);
  assert.equal(normalizeConfig({ speed: 'server' }).speed, null);
});

test('the language of a request is one of the four of Gladys, French otherwise', () => {
  assert.equal(requestLanguage('fr-FR'), 'fr');
  assert.equal(requestLanguage('EN_us'), 'en');
  assert.equal(requestLanguage('it'), 'fr');
  assert.equal(requestLanguage(null), 'fr');
  assert.equal(spokenLanguage(normalizeConfig({ language: 'de' }), 'en'), 'de');
  assert.equal(spokenLanguage(normalizeConfig({ language: 'auto' }), 'en'), 'en');
  assert.equal(spokenLanguage(normalizeConfig({ language: 'xx' }), null), 'fr');
});
