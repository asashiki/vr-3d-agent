# Pocket World Agent

**把一个会听、会说、会行动的二次元 3D Agent 带进 Quest，让虚拟角色真正出现在你的房间里。**

<img src="https://github.com/user-attachments/assets/143c6080-87ff-44af-a18d-bba571245a66" alt="Pocket World Agent 在 Quest 中的演示画面" width="100%" />

https://github.com/user-attachments/assets/442ed6a8-e74d-42a1-8163-469294954848

Mira 不只是一个套着 3D 模型的聊天窗口。她可以理解文字和语音，用表情、动作与声音回应你，也能在 VR / MR 场景中搭建和修改一个小世界。你还可以直接用 Quest 手柄移动角色、托盘和场景物件。

## 可以怎么玩

- **MR 模式**：让 Mira 站在现实房间中，移动到合适的位置再开始对话
- **VR 模式**：进入完整虚拟场景，与角色和物件互动
- **桌面预览**：没有头显也能在浏览器中体验主要流程
- **自然语言造景**：例如“在我面前搭一个有树、长椅和灯的小花园”
- **继续修改**：再说“把左边的灯移到树旁边，树缩小一点”
- **保存与恢复**：场景可以保存，刷新页面后继续使用

Agent 会先读取当前场景，再从许可素材中选择物件并执行操作；如果结果不合理，会在有限次数内检查和修正。手动移动过的物件也会同步回场景数据，不会和 Agent 各做各的。

## 快速体验

需要 Node.js 18+：

```bash
git clone https://github.com/asashiki/vr-3d-agent.git
cd vr-3d-agent
npm start
```

然后打开 <http://localhost:8080>。默认 Replay 模式不需要 API Key，也可以完整体验花园演示。

连接实时模型时，先复制配置文件：

```powershell
Copy-Item .env.example .env
npm start
```

项目支持 OpenAI-compatible、OpenClaw 以及多种 TTS 服务，具体变量见 [Provider 设置](docs/PROVIDER_SETUP.md)。密钥只保存在服务端。

## Quest 操作

| 操作 | 手柄按键 |
| --- | --- |
| 指向并移动角色、托盘或物件 | 按住 Grip |
| 选择物件 | Trigger |
| 调整远近与旋转 | 摇杆 |
| 按住说话 | A / X |
| 显示或隐藏托盘 | B |
| 让 Mira 回到眼前 | Y |

## 测试

```bash
npm run test:all
```

## 更多资料

- [Quest 实机使用](docs/QUEST_DEVICE_GUIDE.md)
- [三分钟演示脚本](docs/DEMO_SCRIPT.md)
- [架构说明](ARCHITECTURE.md)
- [场景工具说明](docs/SCENE_TOOL_REFERENCE.md)
- [模型与素材许可](MODEL_LICENSE.md)

本项目基于 [Incarna](https://github.com/andrewsegas/incarna) 开发，代码遵循 MIT License。角色模型与场景素材的许可说明见 [第三方声明](THIRD_PARTY_NOTICES.md)。
