# Scene Tool Reference

The only executable tools are:

| Tool | Purpose | Main validation |
| --- | --- | --- |
| `list_assets` | Filter catalog | Catalog is immutable |
| `inspect_scene` | Return Scene Graph snapshot | No hidden state |
| `place_asset` | Add catalog object | Asset/ID/bounds/scale/overlap/capacity |
| `move_asset` | Move instance | ID/bounds/overlap |
| `rotate_asset` | Rotate instance | ID/finite vec3 |
| `scale_asset` | Scale instance | ID/0.05–2 per axis |
| `remove_asset` | Remove instance | Existing ID |
| `duplicate_asset` | Copy instance | Existing source/unique target ID |
| `set_color` | Override material color | Existing ID/`#RRGGBB` |
| `clear_scene` | Remove all objects | Undo snapshot retained |
| `undo` | Restore previous snapshot | Finite history |
| `save_scene` | Persist to local storage | Versioned Scene Graph |
| `load_scene` | Restore local save | Schema/version validation |
| `play_avatar_action` | Play one of six actions | Fixed enum |
| `speak` | Show/speak short response | Required text |

Stable errors include `UNKNOWN_TOOL`, `ASSET_NOT_FOUND`, `INSTANCE_NOT_FOUND`, `DUPLICATE_INSTANCE_ID`, `OUT_OF_BOUNDS`, `SCALE_OUT_OF_BOUNDS`, `SEVERE_OVERLAP`, `SCENE_CAPACITY`, `INVALID_ACTION`, `NO_SAVED_SCENE`, and `NOTHING_TO_UNDO`.
