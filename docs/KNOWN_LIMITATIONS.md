# Known Limitations

- Quest device validation is pending real hardware and HTTPS hosting.
- Browser speech recognition availability varies; text input is always supported.
- The runtime uses procedural low-poly assets rather than text-to-3D.
- Scene persistence is browser-local; there is no account sync or multi-user mode.
- Hand tracking event support depends on the installed Quest Browser; controller grip is the primary P0 path.
- The first `npm start` needs network access to fetch large third-party runtime/model files that are intentionally not duplicated in Git.
- TTS audio is returned as one bounded response rather than progressively streamed. ElevenLabs timestamps drive visemes; providers without timestamps use an audio-time mouth-motion fallback.
- There is no room scan, plane semantics, persistent anchor, native APK or Meta Store package.
