# Gladys Chatterbox TTS

A text-to-speech provider for [Gladys Assistant](https://gladysassistant.com)
(5.3.0 or later) that speaks with
[**Chatterbox**](https://github.com/resemble-ai/chatterbox), the open
expressive text-to-speech model of [Resemble AI](https://www.resemble.ai),
served by
[Chatterbox-TTS-Server](https://github.com/devnen/Chatterbox-TTS-Server) on
your own network. Once selected as the voice of Gladys, the scene announcements
are spoken by your Chatterbox server on your speakers.

Developed without a graphics card: feedback welcome.

## Features

- French, English, German and Spanish with the `chatterbox-multilingual`
  model: the language of the Gladys user, or a fixed one.
- One voice per language: one of the ready-made voices of the server (Emily,
  Gabriel…) or a voice cloned from a recording of its `reference_audio` folder.
- Expressiveness (Chatterbox's exaggeration) and speed settings.
- **Test the voice** (with the time it took) and **Show the voices** buttons.
- Status in Supervision, checked every 5 minutes with the model information
  and the voice lists (never a synthesis), and scene triggers **Chatterbox
  server unavailable** / **Chatterbox server back**.
- An English-only model refuses other languages instead of reading them with
  English sounds, and Supervision says how to load the multilingual one.
- One announcement on several speakers asks the server once; the 16 latest
  clips are kept in memory. The texts are never written to the logs.

## Why not the OpenAI-compatible endpoint?

Chatterbox-TTS-Server also exposes `/v1/audio/speech`, which
[gladys-openai-tts](https://github.com/guim31/gladys-openai-tts) can reach.
That endpoint takes no expressiveness, and the language only as a field
OpenAI clients do not send: French is then read with the server's default
language. This integration uses the native `/tts` endpoint, which takes both,
and the voice lists of the server.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Chatterbox-TTS-Server reachable from Gladys (port 8004 by default), with
  `model: repo_id: chatterbox-multilingual` in its `config.yaml` for languages
  other than English.
- **A graphics card, in practice.** Gladys waits 30 seconds for a clip.
  Measured on a 4-core mini PC without graphics card, multilingual model: one
  to two minutes for a short sentence, so every announcement fails on a processor.
- On a processor, the current Chatterbox-TTS-Server fails to load the
  multilingual model (`Attempting to deserialize object on a CUDA device`): its
  bundled Chatterbox lacks a `map_location` that the official Chatterbox has.
  The real tests patched it locally.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-chatterbox`. Then fill the server address
(`http://<host>:8004`), the language and the voices, save, and choose
Chatterbox TTS in **Integrations → Artificial Intelligence → Voice**. The full
guide is in [`docs/en.md`](docs/en.md) (also in [French](docs/fr.md),
[German](docs/de.md) and [Spanish](docs/es.md)).

## Limits

- Without a graphics card, announcements run out of the 30 seconds Gladys
  waits (the integration gives up at 25 s).
- No authentication: Chatterbox-TTS-Server has none. Keep it on your network.
- WAV clips only (24 kHz); a clip over the 5 MB Gladys accepts is resampled.
- Every clip carries the inaudible Perth watermark of Resemble AI. Only clone
  voices you have the right to use.
- Tested for real against Chatterbox-TTS-Server (multilingual model, on a
  processor, in Docker); not tested with a graphics card, nor on a real Gladys
  instance with real speakers.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests never touch the network: `test/fixtures/chatterbox/` holds real
answers of Chatterbox-TTS-Server (WAV clips in French and English, model
information, voice lists, errors). See [`CLAUDE.md`](CLAUDE.md) for the project
rules.

## Credits

- [Chatterbox](https://github.com/resemble-ai/chatterbox) by Resemble AI (MIT
  license), and its Perth watermarker.
- [Chatterbox-TTS-Server](https://github.com/devnen/Chatterbox-TTS-Server) by
  devnen (MIT license), used for the real tests and the fixtures; its
  ready-made voices ship with it.
- Cover: the Chatterbox logo, from the official banner of the
  [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox)
  repository.
- Built on the official
  [JavaScript template](https://github.com/GladysAssistant/integration-template-js)
  and [SDK](https://github.com/GladysAssistant/integration-sdk-js) of Gladys,
  and on the shape of
  [gladys-pocket-tts](https://github.com/guim31/gladys-pocket-tts).

Not affiliated with Resemble AI nor with devnen. Chatterbox and Resemble AI are
names of Resemble AI.
