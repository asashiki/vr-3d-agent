# Quest Device Validation Checklist

Status: **awaiting a connected Quest 3/3S device**. No device screenshot, recording or frame-rate claim was fabricated.

- [ ] Quest Browser loads the page over HTTPS.
- [ ] Enter MR starts `immersive-ar` with passthrough.
- [ ] AvatarSample_B loads; AvatarSample_A can be substituted for fallback comparison.
- [ ] Initial MR view shows Mira without a tray intersecting her body.
- [ ] Controller laser + Grip moves Mira to a chosen clean area of the room and writes the transform back.
- [ ] B hides/shows the World Tray; Y returns Mira to 1.6 m in front of the current view.
- [ ] World Tray appears to Mira's left after scene generation and remains movable/scalable.
- [ ] Controller laser + Grip moves at least one scene object and writes its transform back.
- [ ] Hand pinch selects and moves at least one object, or is truthfully documented as controller-only on the tested browser build.
- [ ] Text UI is readable at the default distance.
- [ ] Hold A/X, speak, release: Quest MediaRecorder audio reaches server STT and the transcript reaches the planner.
- [ ] Microphone denied: text input and Replay remain usable, with a specific permission/configuration error.
- [ ] Network disconnected: current scene and manual editing remain usable; planner shows fallback/error state.
- [ ] Provider timeout: no infinite spinner and no partial corrupt scene.
- [ ] Voice command "你往前走一步" moves Mira toward the user without crossing the 0.78 m safety distance.
- [ ] Voice command "跳一下" plays the Jump VRMA.
- [ ] Required three-turn garden demo completes.
- [ ] Refresh + Load restores the manually moved bench.
- [ ] Capture device screenshot and 90–120 second recording.
- [ ] Capture frame-time/performance evidence; if unstable, reduce object count, transparent materials, texture size and lights before architectural changes.

The attempted `metavr` CLI setup in the Linux build environment reported that its binary supports macOS/Windows but not `linux-x64`; therefore it could not supply device evidence here.
