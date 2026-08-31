# Known Limitations

- The new Quest controller and voice paths still need a final regression pass on real hardware and an HTTPS deployment.
- Quest Browser does not provide the Web Speech Recognition API. Voice conversation therefore requires server STT credentials (`STT_API_KEY`, or an OpenAI key that supports transcription); text input remains available without STT.
- The runtime uses procedural low-poly assets rather than text-to-3D.
- Scene persistence is browser-local; there is no account sync or multi-user mode.
- Hand tracking event support depends on the installed Quest Browser; controller grip is the primary P0 path.
- `StepForward` and `StepBack` are short procedural character motions, not navmesh locomotion or collision-aware room navigation.
- The first `npm start` needs network access to fetch large third-party runtime/model files that are intentionally not duplicated in Git.
- TTS audio is returned as one bounded response rather than progressively streamed. ElevenLabs timestamps drive visemes; providers without timestamps use an audio-time mouth-motion fallback.
- There is no room scan, plane semantics, persistent anchor, native APK or Meta Store package.
