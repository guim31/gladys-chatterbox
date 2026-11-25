# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-25

### Added

- Chatterbox (Resemble AI) as the voice of Gladys (5.3.0 or later): the scene
  announcements are spoken by a Chatterbox-TTS-Server of your network.
- French, English, German and Spanish with the multilingual model, in the
  language of the user or a fixed one.
- A voice per language: a ready-made voice of the server, or one cloned from a
  recording of its `reference_audio` folder.
- Expressiveness and speed settings.
- **Test the voice** and **Show the voices** buttons.
- Status in Supervision (model, voices, model still loading) and scene triggers
  **Chatterbox server unavailable** / **Chatterbox server back**, the server
  being checked every 5 minutes.
- One announcement on several speakers asks the server once.
- Documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-chatterbox/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-chatterbox/releases/tag/v1.0.0
