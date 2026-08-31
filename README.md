## 核心演示

https://github.com/user-attachments/assets/76075243-30da-41de-9445-d91f76f6740d

# Pocket World Agent / 小世界共创 Agent

一个比赛可演示的 Quest WebXR 空间共创 Agent。Mira 出现在现实空间中，把自然语言转换成经过校验的场景工具调用，在可移动的 World Tray 上创建、修改、检查和保存 3D 小世界。

它不是把聊天机器人换成 3D 皮肤：Agent 会读取 Scene Graph、选择白名单素材、执行工具、检查结果并在有限预算内修复错误。用户还能用鼠标、Quest 手柄或手部捏合直接移动物件，手动变换会写回 Scene Graph。

## 一条命令启动

需要 Node.js 18+：

```bash
npm start
```

首次启动会下载许可明确的 VRoid Sample A/B 和 Incarna 使用的 A-Frame 运行时；之后打开 <http://localhost:8080>。不配置任何 API Key 也能运行完整 Replay Demo。

Windows PowerShell：

```powershell
Copy-Item .env.example .env
npm start
```

## 功能说明

1. 点击“进入 MR”或“桌面预览”。
2. 点击“搭建默认花园”，或输入：`在我面前搭一个治愈系小花园，有一棵树、一张长椅、两盏灯和一些花。`
3. 输入：`把左边的灯移到树旁边，树缩小一点，删掉右边的石头。`
4. Quest 中用手柄射线指向 Mira、托盘或物件，按住 Grip 移动，摇杆上下调整远近。
5. 输入：`保持长椅现在的位置，保存这个场景。`
6. 刷新页面，点击“恢复”。

## 已实现

- Incarna 的 A-Frame、three-vrm、VRMA 动作与 WebXR 基线；
- 单角色 Mira，AvatarSample_B 默认、AvatarSample_A 安装级 fallback；
- 30 个程序化生成的 CC0 低多边形 GLB 和统一 Asset Catalog；
- Mira、World Tray 和场景物件都可用 Quest 手柄射线 + Grip 摆放；手部追踪可用 pinch 近距离抓取；
- 托盘默认隐藏，场景生成时在角色左侧显示，可随时隐藏、归位和缩放；
- 版本化 Scene Graph、Inspector、Undo、Save/Load；
- 15 个白名单 Scene Tools，Schema、边界、重叠、ID、容量和稳定错误码校验；
- `Understand → Plan → Validate → Execute → Inspect → Repair → Speak` Agent Loop；
- 单轮最多 14 条命令，Repair 最多 2 次；
- OpenAI-compatible、OpenClaw 和 Replay Provider；所有密钥仅在服务端；
- Quest 按住 A/X 录音，经服务端 STT 转写；桌面浏览器仍可使用原生语音识别后备；
- AI 可调用表情/VRMA 动作，并能执行 `StepForward`、`StepBack` 和 `Jump`；
- Tool Timeline 和不依赖外部 API 的花园 Replay fixture。

## Provider 配置

复制 `.env.example` 为 `.env`。默认 `LLM_PROVIDER=replay`。实时模式支持：

- `LLM_PROVIDER=openai`：`OPENAI_API_KEY`、可选 `OPENAI_BASE_URL`；
- `LLM_PROVIDER=openclaw`：`OPENCLAW_URL`、可选 `OPENCLAW_TOKEN`；
- `STT_PROVIDER=auto`：Quest 录音走服务端 Whisper-compatible 转写；没有服务端 STT 时，桌面端才尝试浏览器语音识别；
- `TTS_PROVIDER=openai|elevenlabs|minimax`：服务端语音与口型；否则使用浏览器语音合成和有界嘴型 fallback。

任何超时、非法 JSON 或网络错误都会自动降级到 Replay，不会破坏当前 Scene。详见 [Provider 设置](docs/PROVIDER_SETUP.md)。

## 测试

```bash
npm run test:all
```

自动测试覆盖非法 Tool、缺失 Asset、重复 Instance、越界位置、极端缩放、严重重叠、Save/Load、Undo、非法模型 JSON、Repair 上限、静态服务和离线 Replay。

Quest 真机截图、录屏、帧率和 Passthrough 交互仍需要连接真实设备后人工验证；桌面通过不被表述为 Quest 通过。手柄映射：Grip 抓取、Trigger 选择、A/X 按住说话、B 显示/隐藏托盘、Y 将 Mira 放回眼前。详见 [Quest 实机使用](docs/QUEST_DEVICE_GUIDE.md)、[Quest 验证](docs/QUEST_VALIDATION.md) 和 [测试报告](docs/TEST_REPORT.md)。

## 文档

- [架构](ARCHITECTURE.md)
- [Scene Tool Reference](docs/SCENE_TOOL_REFERENCE.md)
- [Demo Script](docs/DEMO_SCRIPT.md)
- [Quest 实机使用](docs/QUEST_DEVICE_GUIDE.md)
- [Quest 验证清单](docs/QUEST_VALIDATION.md)
- [Known Limitations](docs/KNOWN_LIMITATIONS.md)
- [Prompt / Plan 验收对照](docs/REQUIREMENTS_AUDIT.md)
- [模型许可](MODEL_LICENSE.md)
- [第三方声明](THIRD_PARTY_NOTICES.md)
- [素材清单](ASSET_MANIFEST.json)

## License

代码基于 [andrewsegas/incarna](https://github.com/andrewsegas/incarna)，遵循 MIT License 并保留原作者 Attribution。VRM 模型和场景资产的许可边界见独立文件；不要将模型文件误认为项目 MIT 代码的一部分。
