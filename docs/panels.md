# The Board — visual panels

Sometimes speaking isn't enough — you want to *see* a report, a table, or a list
(Jira issues, Git metrics, a detailed summary). **The Board** is a floating panel
the agent can fill with Markdown, on top of its short spoken answer.

## How it works (all in the project layer)

1. The server staples an instruction onto every message it sends to the agent
   (`voicePreamble()` in `server.js`): *"when a table/list/report helps, put that
   Markdown inside a `<<<incarna:panel … >>>` block; keep the spoken part short and
   plain."* The agent needs **no** special config — talking to the same agent via
   webchat is unaffected.
2. The agent replies with a short spoken line **plus** the block:
   ```
   Fechamos o sprint em 62%, com 3 bloqueios. [action:sad]
   <<<incarna:panel
   # Sprint 42
   | Status | Qtd |
   | --- | --- |
   | Done | 18 |
   >>>
   ```
3. The client (`js/voice-chat.js`) extracts the block, renders the Markdown to the
   Board (`js/board.js` + `js/md.js`), and speaks only the plain lead line.

## Robust by design

Agents don't always follow the wrapper. So there's a **fallback**: if a reply has
no block but *looks* like a panel (a Markdown table, or headings + lists), the
client shows it on the Board anyway and speaks only the prose lines. Either way,
you never hear table pipes read aloud.

## The Board

- Shared, in-place visualization area (updates each time).
- **Draggable** (drag the header), **⤢ expand** to a larger view, **✕ close**.
- Reopen the last panel anytime with the **📋** button in the HUD.
- Remembers its position.

## Safety

Markdown is rendered by a small, dependency-free renderer (`js/md.js`) that
**HTML-escapes everything first** and only emits a known subset (headings,
bold/italic/code, lists, tables, blockquotes, links restricted to http(s)/mailto).
No raw HTML or scripts from the agent are ever injected.

## Supported Markdown

Headings, **bold**, *italic*, `inline code`, code fences, ordered/unordered lists,
GitHub-style tables, blockquotes, horizontal rules, and safe links. Charts are
intentionally out of scope for now — plain Markdown covers reports, tables and
metrics simply and reliably.
