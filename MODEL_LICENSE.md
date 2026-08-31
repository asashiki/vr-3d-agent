# VRM Model License

The project uses VRoid Studio official sample models at runtime:

| File | Role | Upstream | License boundary |
| --- | --- | --- | --- |
| `AvatarSample_B.vrm` | Default Mira avatar | `madjin/vrm-samples/vroid/stable` mirror of the official sample | VRoid Sample Model Terms |
| `AvatarSample_A.vrm` | Debug fallback | same source | VRoid Sample Model Terms |

The upstream files are fetched by `scripts/prepare-runtime.mjs` and are intentionally ignored by Git. They are not covered by this repository's MIT license.

VRoid states that AvatarSample_A/B/C may be used by individuals or companies, commercially or non-commercially, may be modified and redistributed subject to the sample-model conditions. Copyright is not waived. Terms checked on **2026-08-31**:

- <https://vroid.pixiv.help/hc/en-us/articles/4402614652569-Do-VRoid-Studio-s-sample-models-come-with-conditions-of-use>
- <https://vroid.pixiv.help/hc/en-us/articles/4402394424089>
- Mirror and hashes: <https://github.com/madjin/vrm-samples/tree/master/vroid/stable>

Do not substitute fan models or game-character models without explicit permission covering public display, modification and redistribution.
