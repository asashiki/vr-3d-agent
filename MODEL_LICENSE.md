# VRM Model License

The project uses VRoid Studio official sample models at runtime:

| File | Role | Upstream | License boundary |
| --- | --- | --- | --- |
| `AvatarSample_B.vrm` | Default Mira avatar, VRM 1.0 | `pixiv/ChatVRM/public` official Pixiv repository | VRoid Sample Model Terms |
| `AvatarSample_A.vrm` | Debug fallback, legacy VRM 0.x | `madjin/vrm-samples/vroid/stable` mirror | VRoid Sample Model Terms |

The upstream files are fetched by `scripts/prepare-runtime.mjs` and are intentionally ignored by Git. They are not covered by this repository's MIT license.

VRoid states that AvatarSample_A/B/C may be used by individuals or companies, commercially or non-commercially, may be modified and redistributed subject to the sample-model conditions. Copyright is not waived. Terms checked on **2026-08-31**:

- <https://vroid.pixiv.help/hc/en-us/articles/4402614652569-Do-VRoid-Studio-s-sample-models-come-with-conditions-of-use>
- <https://vroid.pixiv.help/hc/en-us/articles/4402394424089>
- Default VRM 1.0 source: <https://github.com/pixiv/ChatVRM/blob/main/public/AvatarSample_B.vrm>
- Fallback mirror: <https://github.com/madjin/vrm-samples/tree/master/vroid/stable>

Pinned SHA-256 checksums are enforced by the installer:

- AvatarSample_B: `ffbd8c92a9e67c0a948f69c7a2eec91e5c282c9ae70e9184309fc164d74cbc27`
- AvatarSample_A: `b86b0b8a66d48911431d6f920a5211a974226f83aa672eca3f3dfade58ac346e`

Do not substitute fan models or game-character models without explicit permission covering public display, modification and redistribution.
