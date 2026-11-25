# Chatterbox TTS

Gives Gladys an expressive voice with **Chatterbox**, the open (MIT license)
text-to-speech model of [Resemble AI](https://www.resemble.ai), served by
[Chatterbox-TTS-Server](https://github.com/devnen/Chatterbox-TTS-Server) on a
machine of your network: the texts stay at home. Scene announcements are spoken
by it on your speakers.

Developed without a graphics card: feedback welcome.

## What you get

- A **voice for Gladys** (Gladys 5.3.0 or later): once selected, the scene
  action **Speak on a speaker** speaks with Chatterbox on your speakers (Sonos,
  Google Cast, AirPlay…).
- **French, English, German and Spanish** with the multilingual model: each
  user hears their language, or a fixed language you choose.
- **One voice per language**: one of the 28 ready-made voices of the server
  (Emily, Gabriel, Olivia…), or a voice **cloned** from a recording of 10 to 20
  seconds put on the server.
- **Expressiveness** (from flat to dramatic) and **speed** settings.
- **Test the voice** (with the time it took) and **Show the voices** buttons in
  the configuration.
- Two scene triggers: **Chatterbox server unavailable** and **Chatterbox
  server back**.

## Before you start

- Install Chatterbox-TTS-Server (Docker or Python, see its README), port 8004
  by default.
- **A graphics card is needed in practice.** Gladys waits 30 seconds for the
  clip. Measured on a 4-core mini PC without graphics card, with the
  multilingual model: one to two minutes for a mere "Yes." or a short sentence,
  far too long for an announcement. With an NVIDIA or AMD graphics card, a sentence
  takes one to a few seconds.
- For French, German or Spanish, set in its `config.yaml`:
  `model: repo_id: chatterbox-multilingual` (about 3 GB downloaded at the first
  start). The default model, `chatterbox-turbo`, speaks English only.
- On a processor alone, the current version of Chatterbox-TTS-Server does not
  load the multilingual model (error `Attempting to deserialize object on a
CUDA device`): a defect of the server, fixed in the official Chatterbox of
  Resemble AI.
- Cloned voices: put a clean WAV or MP3 (one person, no music) in the
  `reference_audio` folder of the server. Only clone voices you have the right
  to use.
- Every clip carries an inaudible audio watermark (Perth) of Resemble AI,
  which marks a sound as AI-generated.
- Not affiliated with Resemble AI nor with the author of
  Chatterbox-TTS-Server.

## Configuration

1. Install the integration, then open its **Configuration** tab.
2. **Server address**: for example `http://<host>:8004`. A bare `host:port`
   gets `http://`.
3. **Language**: Automatic (the language of the Gladys user, French when
   unknown) or a fixed language.
4. **Voice for French / English / German / Spanish**: the name of a ready-made
   voice (`Emily`, `Gabriel`…) or of a recording of `reference_audio`
   (`My_voice`), with or without `.wav`. Empty: Emily.
5. **Expressiveness** and **Speed**: "Server setting" keeps the one of its
   `config.yaml`. 0.5 is a neutral voice; above, the voice is more emotional
   and faster. The Turbo model ignores the expressiveness.
6. Save, then press **Show the voices**, and **Test the voice** to check that a
   clip comes back (seconds of sound and time taken; the button does not play
   it).
7. Open **Integrations → Artificial Intelligence** and select Chatterbox TTS
   in the **Voice** card.

## Use in scenes

Add a **Speak on a speaker** action to a scene, choose a speaker and type the
text. Gladys asks this integration for the clip, then serves it to the speaker
on your local network.

The **Chatterbox server unavailable** and **Chatterbox server back** triggers
start a scene, for example to send you a message. The server is checked every
5 minutes.

The voice assistant of Gladys stays in text with a voice integration: its page
is served over HTTPS, and the clip over HTTP on the local network, which the
browser blocks. This is a limit of Gladys, the same for every voice
integration.

## Limits

- **Gladys waits 30 seconds** for the clip (the integration gives up at 25 s):
  without a graphics card, announcements fail. A text over the delay fails
  without marking the server unavailable.
- An English-only model (`chatterbox-turbo`, `chatterbox`) refuses French,
  German and Spanish rather than reading them with English sounds; Supervision
  says so.
- Clips are WAV (24 kHz). Gladys refuses clips over 5 MB (about 100 seconds): a
  longer clip is resampled lower.
- A clip already made (same text and settings) is kept in memory (the last
  16), and an announcement on several speakers asks the server once.
- No password: Chatterbox-TTS-Server asks for none. Do not expose it outside
  your network.

## Troubleshooting

- **Supervision** tells whether the server answers, with its model, or is
  still loading its model.
- A failed announcement is written in the integration **logs**, with the
  reason the server gave (voice not found, no answer in time…). The spoken text
  is never written.
- "No voice by this name": press **Show the voices** and copy a name from the
  list.
- "Cannot be reached": check the address, the port (8004 by default) and that
  the server listens on `0.0.0.0`.
- More detail in debug: set the log level of the integration to debug.
