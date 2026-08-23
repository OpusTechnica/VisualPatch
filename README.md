# 🎯 VisualPatch v2.0

> **Universal In-Browser Visual Feedback & Autonomous UI Review Tool for AI Pair Programmers.**  
> Effortlessly guide **Claude, Cursor, ChatGPT, Windsurf, Copilot, Antigravity, and Devin** with pinpoint visual precision and zero window switching.  
> Crafted with an ultra-premium **CleanShot X + Apple Pro frosted glass aesthetic**.

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/OpusTechnica/VisualPatch/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/visualpatch.svg?color=cb3837)](https://www.npmjs.com/package/visualpatch)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Style: CleanShot X Glass](https://img.shields.io/badge/Design-CleanShot%20X%20%2B%20Apple%20Glass-0071e3.svg)](#features)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-emerald.svg)](#privacy--security)
[![Agents: AGENTS.md](https://img.shields.io/badge/AI%20Agents-AGENTS.md%20Ready-38bdf8.svg)](./AGENTS.md)

> [!TIP]
> ### 🤖 1-Prompt Autonomous Setup for AI Agents
> Want your AI assistant to install and configure VisualPatch automatically? Simply tell your agent:  
> **`"Install VisualPatch in this project according to AGENTS.md"`**  
> Any AI pair programmer (**Claude Code, Antigravity, Cursor, Windsurf, Devin**) will read [`AGENTS.md`](./AGENTS.md) and configure the component, dev server middleware, and live review loop in seconds with **zero manual effort**.

---

## ⚡ What Makes VisualPatch v2.0 Magical

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          ⚡ THE ZERO-WINDOW-SWITCHING LIVE LOOP                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. YOU (In Browser on localhost:3000):                                                      │
│    • Pin an element or crop an area (Press S).                                              │
│    • Type note: "Increase CTA padding and add cobalt glow" ──► Hit [Ctrl + Enter]          │
│                                                                                             │
│ 2. DEV SERVER / BRIDGE:                                                                     │
│    • Ingests exact component name (<HeroSection />) & source file (HeroSection.jsx#L42).    │
│    • Writes `.visualpatch/inbox.md` & saves screenshots to `.visualpatch/preview_1.png`.    │
│                                                                                             │
│ 3. `wait-for-inbox.js` (Background Daemon):                                                 │
│    • Detects file timestamp update ──► Triggers IDE Reactive Wakeup.                        │
│                                                                                             │
│ 4. AI AGENT (Antigravity / Cursor / Claude Code):                                           │
│    • Wakes up automatically with ZERO user prompting or copy-pasting.                       │
│    • Surgical edit applied at `HeroSection.jsx#L42` with ZERO exploratory turns.            │
│    • Runs build verification & re-arms watcher.                                             │
│                                                                                             │
│ 5. VITE HMR (Hot Module Replacement):                                                       │
│    • UI instantly re-renders in your browser window in ~50ms!                               │
│    • You NEVER have to switch windows or copy-paste a single prompt!                        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

- ⚡ **Autonomous Live Review Loop (`/vp-live`)**: Edit frontend UI live directly from your browser without ever switching windows back to the IDE.
- 🔍 **React Fiber & Component Source Inspector**: Automatically resolves the exact React/Vue component name (e.g. `<HeroSection />`) and source code file path + line number (`src/components/HeroSection.jsx#L42`).
- 💎 **CleanShot X + Apple Pro Frosted Glass UI**: Obsidian acrylic dock with multi-layer depth shadows, subtle hairline borders, and hardware-accelerated micro-interactions.
- 🎯 **Pixel-Perfect Element Inspector**: Hover over any DOM node with real-time bounding box highlighting and tag dimensions.
- 📸 **Spotlight Area Screenshot Marquee Tool**: Drag a spotlight box over any element or section with true-color subject fidelity and live acrylic dimension capsule (`953 × 393 PX`).
- 🖼️ **Auto-Stitched Multi-Screenshot Strip**: Capturing multiple screenshot pins automatically stitches them into **one consolidated image strip**, bypassing OS single-image clipboard limits.
- 💾 **Zero-Token Local Artifact Storage**: Saves high-res crops as `.visualpatch/preview_1.png` on local disk, keeping prompt tokens under ~80 tokens (0 base64 waste).
- ⌨️ **Intuitive Keyboard Flow**: Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to Send to Agent, <kbd>Enter</kbd> to save notes, <kbd>Esc</kbd> to toggle inspect mode, and <kbd>S</kbd> for area snapshots.
- 🖐️ **Draggable Anywhere**: Drag the toolbar or collapsed capsule to any corner of your screen—persists smoothly across page refreshes.
- 🛡️ **Zero Telemetry / 100% Local**: Runs strictly on local development domains (`localhost`, `127.0.0.1`, local ports). No external servers, no tracking, zero analytics.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **<kbd>Ctrl</kbd> + <kbd>Enter</kbd>** / **<kbd>⌘</kbd> + <kbd>Enter</kbd>** | **⚡ Send to Agent Inbox** (Ingests to `.visualpatch/inbox.md`) |
| **<kbd>S</kbd>** (or <kbd>Alt</kbd> + <kbd>S</kbd>) | **Toggle Area Screenshot Mode** (Drag to crop & pin) |
| **<kbd>Esc</kbd>** (or <kbd>Alt</kbd> + <kbd>D</kbd> / <kbd>F9</kbd>) | **Toggle Element Inspect Mode** / Exit |
| **<kbd>Ctrl</kbd> + <kbd>C</kbd>** / **<kbd>⌘</kbd> + <kbd>C</kbd>** | **Copy Annotations + Screenshot Strip for AI** |
| **<kbd>Alt</kbd> + <kbd>T</kbd>** or **<kbd>F8</kbd>** | **Toggle / Minimize Toolbar** |
| **<kbd>Enter</kbd>** | **Save Pin Note** (inside feedback card) |
| **<kbd>Shift</kbd> + <kbd>Enter</kbd>** | **New Line** (inside feedback card) |
| **<kbd>Esc</kbd>** | **Close Feedback Card / Cancel Screenshot** |

---

## 🤖 Ask Your AI Agent to Install It (Zero Effort)

You can literally just tell your AI coding assistant:

> **"Install VisualPatch in this project and enable live review mode."**

Your AI assistant will automatically read [`AGENTS.md`](./AGENTS.md) and set up the component, dev server middleware, and background watcher in 5 seconds.

---

## 🚀 Manual Installation Options

### Option 1: Instant Setup via `npx` (Fastest)

```bash
npx visualpatch init
```

The interactive CLI will automatically detect your framework (Vite, Next.js, React, Vue, Astro, HTML) and configure VisualPatch.

---

### Option 2: Install via `npm` / `pnpm` / `yarn`

```bash
npm install -D visualpatch
# or
pnpm add -D visualpatch
# or
yarn add -D visualpatch
```

#### React / Vite (`src/App.jsx`)
```jsx
import { VisualPatch } from 'visualpatch';

export default function App() {
  return (
    <>
      <YourAppContent />
      {import.meta.env.DEV && <VisualPatch />}
    </>
  );
}
```

#### Next.js App Router (`app/layout.jsx`)
```jsx
import { VisualPatch } from 'visualpatch';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <VisualPatch />}
      </body>
    </html>
  );
}
```

---

### Option 3: Download Chrome Extension (`.zip`)

1. **Download latest release**: [VisualPatch-v2.0.0.zip](https://github.com/OpusTechnica/VisualPatch/releases/download/v2.0.0/VisualPatch-v2.0.0.zip) (or clone the repo).
2. Unzip the package.
3. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
4. Enable **Developer mode** toggle.
5. Click **Load unpacked** and select the folder.
6. Open any `localhost` tab — the **`● V`** dock appears automatically!

---

### Option 4: Standalone CDN `<script>` Tag (Vanilla HTML)

```html
<script src="https://cdn.jsdelivr.net/npm/visualpatch@2.0.0/vanilla.js" defer></script>
```

---

## 📋 Generated Task Queue (`.visualpatch/inbox.md`)

When you hit **⚡ Send to Agent** (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>), VisualPatch produces a clean, token-efficient markdown task:

```markdown
# 📌 VisualPatch UI Task Queue
> **Source URL:** `http://localhost:3000/`  
> **Total Items:** 1

### Item #1: `section.hero > div.cta-wrap > button.cta-primary`
- **React Component:** `<HeroSection>`
- **Source File:** [`src/components/HeroSection.jsx#L42`](file:///.../src/components/HeroSection.jsx#L42)
- **Rendered Text:** "Get Started"
- **Visual Proof:** ![Screenshot 1](file:///.../.visualpatch/preview_1.png)
- **Requested Change:** Make button glow cobalt and increase horizontal padding to 24px
```

---

## 🔒 Privacy & Security

- **Strict Localhost Scope**: Only activates on `localhost`, `127.0.0.1`, `0.0.0.0`, `.local`, or explicit port numbers.
- **Zero Third-Party Network Requests**: All logic, state, and coordinates are handled entirely client-side.
- **Isolated Shadow DOM**: UI styles are completely encapsulated in Shadow DOM and will never bleed into or conflict with your project's stylesheets.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
