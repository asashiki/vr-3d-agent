# Quest Device Validation Checklist

Status: **awaiting a connected Quest 3/3S device**. No device screenshot, recording or frame-rate claim was fabricated.

- [ ] Quest Browser loads the page over HTTPS.
- [ ] Enter MR starts `immersive-ar` with passthrough.
- [ ] AvatarSample_B loads; AvatarSample_A can be substituted for fallback comparison.
- [ ] World Tray starts in front of the user and remains movable/scalable.
- [ ] Controller grip moves at least one scene object and writes its transform back.
- [ ] Hand pinch selects and moves at least one object, or is truthfully documented as controller-only on the tested browser build.
- [ ] Text UI is readable at the default distance.
- [ ] Microphone denied: text input and Replay remain usable.
- [ ] Network disconnected: current scene and manual editing remain usable; planner shows fallback/error state.
- [ ] Provider timeout: no infinite spinner and no partial corrupt scene.
- [ ] Required three-turn garden demo completes.
- [ ] Refresh + Load restores the manually moved bench.
- [ ] Capture device screenshot and 90–120 second recording.
- [ ] Capture frame-time/performance evidence; if unstable, reduce object count, transparent materials, texture size and lights before architectural changes.

The attempted `metavr` CLI setup in the Linux build environment reported that its binary supports macOS/Windows but not `linux-x64`; therefore it could not supply device evidence here.
