# Quest 3 实机使用

## 最短启动

```powershell
git clone https://github.com/asashiki/vr-3d-agent.git
cd vr-3d-agent
Copy-Item .env.example .env
npm start
```

另开一个 PowerShell：

```powershell
cloudflared tunnel --url http://localhost:8080
```

在 Quest Browser 打开命令输出的 `https://...trycloudflare.com`，点击“进入 MR”。

## 手柄

| 操作 | 功能 |
|---|---|
| 手柄射线 + 按住 Grip | 抓取 Mira、World Tray 或场景物件 |
| 抓取时摇杆上/下 | 拉近/推远对象 |
| 抓取托盘/物件时摇杆左/右 | 旋转对象 |
| Trigger | 选中射线指向的对象 |
| A 或 X（按住） | 录音；松开后转写并发给 Mira |
| B | 显示/隐藏 World Tray |
| Y | 将 Mira 放回当前视线前方 1.6 米 |

手部追踪模式下，可以靠近后用 pinch 抓取。手柄是首要演示路径。

## 语音配置

Quest 需要服务端 STT，不使用浏览器 `SpeechRecognition`。在 `.env` 中配置：

```env
STT_PROVIDER=auto
STT_API_KEY=你的密钥
STT_BASE_URL=https://api.openai.com/v1
STT_MODEL=whisper-1
```

如果 `OPENAI_API_KEY` 指向的服务本身支持 `/audio/transcriptions`，可以不重复填写 `STT_API_KEY`。如果 LLM 是另一家 OpenAI-compatible 服务，建议为 STT 单独填写上面三项。修改 `.env` 后必须重启 `npm start`。

## 建议验收口令

- `你往前走一步。`
- `跳一下。`
- `在我面前搭一个治愈系小花园。`
- `把托盘隐藏起来。`

若 A/X 松开后显示 `STT_NOT_CONFIGURED`，表示 `.env` 没有可用的 `STT_API_KEY`/`OPENAI_API_KEY`，或配置的 Base URL 不支持语音转写。
