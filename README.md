# 🎯 VisualPatch v2.0

> **Universal In-Browser Visual Feedback & Inspection Tool for AI Pair Programmers.**  
> Effortlessly guide **Claude, Cursor, ChatGPT, Windsurf, Copilot, Antigravity, and Devin** with pinpoint visual precision.  
> Crafted with an ultra-premium **CleanShot X + Apple Pro frosted glass aesthetic**.

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/OpusTechnica/VisualPatch/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/visualpatch.svg?color=cb3837)](https://www.npmjs.com/package/visualpatch)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Style: CleanShot X Glass](https://img.shields.io/badge/Design-CleanShot%20X%20%2B%20Apple%20Glass-0071e3.svg)](#features)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-emerald.svg)](#privacy--security)

---

## 🚀 What's New in v2.0

- 📷 **CleanShot X Studio Spotlight Viewfinder**: Crystal-clear crop window with infinite spotlight backdrop shading (`box-shadow: 0 0 0 99999px rgba(0, 0, 0, 0.52)`), dual-contrast boundary, 4 precision CAD L-brackets, center reticle, and floating acrylic dimension capsule (`953 × 393 PX`).
- 🖼️ **Auto-Stitched Multi-Screenshot Strip**: Capturing multiple screenshot pins automatically stitches them into **one consolidated image strip** with dark headers (`PIN #1: selector`, `PIN #2: selector`), bypassing the OS single-image clipboard limitation!
- ⚡ **0ms Lag-Free Micro-Container Snapshot Engine**: Localized container resolution cuts area snapshot execution from 1,500ms down to **~3ms** with zero UI thread freeze.
- 🎯 **Accurate Component Selector Engine**: Uses `document.elementsFromPoint` with deep overlay exclusion to capture exact underlying UI elements (`h1.hero-title`, `nav.header`, `button.cta`) rather than overlay backdrops.
- ⌨️ **Single-Key <kbd>S</kbd> Shortcut**: Press <kbd>S</kbd> to toggle Area Screenshot mode instantly, protected by smart input-safe typing guards.
- 📦 **Multi-Format Distribution**: Available via `npx`, `npm`, standalone CDN script, and ready-to-load ZIP extension package!

---

## 🌟 Why VisualPatch?

Explaining UI tweaks, alignment issues, and styling bugs to AI in chat is slow and frustrating:
- ❌ *"Make the second button in the middle a bit higher and change its color."* (Vague, AI guesses the wrong selector)
- ✅ **With VisualPatch**: Press **`S`** to crop an area or click any element, type your note, and press **Ctrl+C**.

VisualPatch automatically captures:
1. **Exact CSS Selectors**: `div.hero > div.cta-group > button.btn-primary:nth-of-type(1)`
2. **Text Content Previews**: `"Schedule Discovery Session"`
3. **Viewport & Document Coordinates**: Precise anchor points that scroll in sync with your page.
4. **Structured Markdown Prompt**: Lightweight, token-efficient prompt (0 base64 waste) ready to paste into any AI chat.
5. **Consolidated High-Res Screenshot Strip**: Automatically placed on your OS clipboard ready for instant visual paste.

---

## ⚡ Compatible with All AI Agents

VisualPatch produces standard, clean markdown prompts optimized for:
- 🤖 **Claude / Anthropic** (Claude Code, Artifacts, Web, Desktop)
- ⚡ **Cursor IDE**
- 💬 **ChatGPT / OpenAI** (GPT-4o, Canvas, Codex)
- 🌊 **Windsurf / Codeium**
- 🐙 **GitHub Copilot Workspace**
- 🪄 **Google Antigravity**
- 🚀 **Devin, v0, Bolt.new, Lovable**

---

## ✨ Key Features

- 💎 **CleanShot X + Apple Pro Frosted Glass UI**: Obsidian acrylic dock with multi-layer depth shadows, subtle hairline borders, and hardware-accelerated micro-interactions.
- 🎯 **Pixel-Perfect Element Inspector**: Hover over any DOM node with real-time bounding box highlighting and tag dimensions.
- 📸 **Spotlight Area Screenshot Marquee Tool**: Drag a spotlight box over any element or section with true-color subject fidelity and live acrylic dimension capsule.
- 🖼️ **In-Card Thumbnail & Lightbox**: View instant previews, click to zoom full-resolution, and download clean PNG files.
- 📍 **True-Document Pin Anchoring**: Dropped pins stay glued to their exact document position even during smooth scrolling.
- ⌨️ **Intuitive Keyboard Flow**: Press <kbd>Enter</kbd> to save notes, <kbd>Shift</kbd>+<kbd>Enter</kbd> for newlines, <kbd>Esc</kbd> to toggle inspect mode, and <kbd>S</kbd> for area snapshots.
- 📋 **1-Click AI Copy & Auto-Clear**: Generates clean, structured markdown + copies the stitched image strip directly to your clipboard.
- 🖐️ **Draggable Anywhere**: Drag the toolbar or the collapsed capsule to any corner of your screen—persists smoothly across page refreshes.
- 🛡️ **Zero Telemetry / 100% Local**: Runs strictly on local development domains (`localhost`, `127.0.0.1`, local ports). No external servers, no tracking, zero analytics.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **<kbd>S</kbd>** (or <kbd>Alt</kbd> + <kbd>S</kbd>) | **Toggle Area Screenshot Mode** (Drag to crop & pin) |
| **<kbd>Esc</kbd>** (or <kbd>Alt</kbd> + <kbd>D</kbd> / <kbd>F9</kbd>) | **Toggle Element Inspect Mode** / Exit |
| **<kbd>Ctrl</kbd> + <kbd>C</kbd>** / **<kbd>⌘</kbd> + <kbd>C</kbd>** | **Copy Feedbacks + Stitched Screenshot Strip for AI** |
| **<kbd>Alt</kbd> + <kbd>T</kbd>** or **<kbd>F8</kbd>** | **Toggle / Minimize Toolbar** |
| **<kbd>Enter</kbd>** | **Save Pin Note** (inside feedback card) |
| **<kbd>Shift</kbd> + <kbd>Enter</kbd>** | **New Line** (inside feedback card) |
| **<kbd>Esc</kbd>** | **Close Feedback Card / Cancel Screenshot** |

---

## 🚀 Installation & Download Options

Choose the installation method that fits your workflow:

### Option 1: Instant Setup via `npx` (Fastest for Projects)

Run this one-liner inside your project directory (supports Next.js, Vite, React, Vue, Astro, HTML):

```bash
npx visualpatch init
```

The interactive CLI will automatically detect your framework and configure VisualPatch in seconds.

---

### Option 2: Install via `npm` / `pnpm` / `yarn`

Install VisualPatch as a dev dependency:

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

### Option 3: Download Extension Package (`.zip`)

Download the standalone extension package for Chromium browsers (Chrome, Edge, Brave, Arc, Opera):

1. **Download the latest release zip**: [VisualPatch-v2.0.0.zip](https://github.com/OpusTechnica/VisualPatch/releases/download/v2.0.0/VisualPatch-v2.0.0.zip) (or clone the repo).
2. Unzip the downloaded folder.
3. Open your browser extensions page:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
4. Turn on **Developer mode** (top right toggle).
5. Click **Load unpacked** and select the unzipped directory.
6. Open any `localhost` tab — the **`● V`** dock appears automatically!

---

### Option 4: Standalone CDN `<script>` Tag (Vanilla HTML)

For static HTML prototypes, add this single line before the closing `</body>` tag:

```html
<script src="https://cdn.jsdelivr.net/npm/visualpatch@2.0.0/vanilla.js" defer></script>
```

---

## 📋 Example Generated AI Prompt

When you click **📋 Copy for AI** (or press **Ctrl+C**), your clipboard will contain structured markdown like this:

```markdown
### 📌 VisualPatch Feedback from Localhost Preview
**URL:** `http://localhost:3000/#`
**Total Items:** 2

#### 1. Element: `header.navbar > div.nav-right > button.cta-btn` 📸 [Area Screenshot Attached]
- **Current Content:** "Schedule Discovery"
- **Requested Change:** Add the dual-arrow diagonal pass-through hover animation matching the hero button.

#### 2. Element: `div.pricing-grid > div.card-pro:nth-of-type(2) > h3.price` 📸 [Area Screenshot Attached]
- **Current Content:** "$99/mo"
- **Requested Change:** Make the font 2px larger and apply high-contrast white with 800 weight.
```

*(Plus the auto-stitched multi-screenshot composite image strip ready on your system clipboard for instant paste into Claude / ChatGPT / Discord / GitHub).*

---

## 🔒 Privacy & Security

- **Strict Localhost Scope**: Only activates on `localhost`, `127.0.0.1`, `0.0.0.0`, `.local`, or explicit port numbers.
- **Zero Third-Party Network Requests**: All logic, state, and coordinates are handled entirely client-side.
- **Isolated Shadow DOM**: UI styles are completely encapsulated in Shadow DOM and will never bleed into or conflict with your project's stylesheets.

---

## 🤝 Contributing

Contributions, feedback, and feature suggestions are always welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
