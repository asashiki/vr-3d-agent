# 想法池

把任何还没成型的想法先放在这里。可以很粗糙，只要能帮助大家看见方向。

## 想法模板

```md
### 标题

- 提出人：
- 方向：VR / 3D / Agent / 游戏 / Unity / WebXR / VibeGame / 其他
- 一句话描述：
- 最小 Demo 可以是什么：
- 需要的资源或技术：
- 参考链接：
```

## 待整理想法

### 桌面数据宠物 / 现实感知伴侣（来自 vibe-game 候选池讨论）

- 提出人：shiki
- 方向：Agent / MR / WebXR
- 一句话描述：活在真实桌角（MR 透视）或桌面上的二次元小伙伴，能感知外部世界数据——今天的天气、你 Bangumi 在追的番——并主动提起。
- 最小 Demo 可以是什么：MR 透视模式下一个跟随用户的简单模型，对话时能引用一条实时外部数据（天气/追番进度）。
- 需要的资源或技术：3D 角色模型（有大量免费公开资源）、LLM 对话、外部 API（天气 / Bangumi）、Quest 透视 + 手势追踪；PC 串流版（精致）与 Quest 独立版（便携）双形态。
- 参考链接：https://bangumi.github.io/api/

### Pixel Agent —— AI 自主玩家控制真实游戏角色

- 提出人：Chloe（qui）
- 方向：Agent / 游戏 / Mod 注入 / Web 监控
- 一句话描述：AI Agent 通过 SMAPI Mod 注入星露谷物语，像真人玩家一样自主控制角色移动、采集、建造、与 NPC 对话；Web 面板实时展示 Agent 的思考过程与行动轨迹。
- 最小 Demo 可以是什么：
  1. 一个 SMAPI Mod（C#）读取当前游戏状态（地图 tile、角色位置、背包物品、NPC 坐标）并序列化为 JSON
  2. Python 后端接收游戏状态，调用 LLM 生成下一步动作指令（move / gather / talk / build）
  3. SMAPI Mod 接收指令并通过游戏 API 执行角色操作
  4. 一个轻量 Web 监控面板（浏览器打开），实时显示 Agent 决策日志、当前目标、行动历史
  5. 中期目标：扩展到 Neuro-sama 风格的 3D/VR 环境聊天与模型控制；后期加入计算机视觉方案泛化到其他游戏
- 需要的资源或技术：
  - 游戏 Mod 框架：SMAPI（Stardew Modding API），C# 开发
  - Agent 后端：Python + FastAPI，负责 LLM 调用与决策逻辑
  - LLM 接口：OpenAI API 或其他替代（待确认）
  - Mod 与后端通信：WebSocket 或 HTTP 轮询
  - Web 监控面板：轻量前端（HTML/JS 或 React），只读展示
  - 游戏本体：Stardew Valley（Steam）
- 参考链接：
  - SMAPI 官方文档：https://stardewvalleywiki.com/Modding:Modder_Guide
  - SMAPI GitHub：https://github.com/Pathoschild/SMAPI
  - Neuro-sama（中期目标参考）：https://www.youtube.com/@Neurosama
  - Stardew Valley Modding 社区：https://forums.stardewvalley.net/

### 示例：给一个 3D 模型配上可对话 Agent

- 提出人：
- 方向：3D / Agent / 游戏
- 一句话描述：让一个 3D 角色或物体能够通过文本或语音进行交互。
- 最小 Demo 可以是什么：在简单场景里点击角色并对话，Agent 根据场景状态回答。
- 需要的资源或技术：3D 模型、对话模型、场景状态读取、Unity 或 Web 3D。
- 参考链接：
