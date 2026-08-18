# 🎯 VisualPatch

> **Universal In-Browser Visual Feedback & Inspection Tool for AI Pair Programmers.**  
> Effortlessly guide **Claude, Cursor, ChatGPT, Windsurf, Copilot, Antigravity, and Devin** with pinpoint visual precision.  
> Crafted with an ultra-premium **Linear + Apple-inspired frosted glass aesthetic**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Style: Linear Glass](https://img.shields.io/badge/Design-Linear%20%2B%20Apple%20Glass-0071e3.svg)](#features)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-emerald.svg)](#privacy--security)

---

## 🌟 Why VisualPatch?

Explaining UI tweaks, alignment issues, and styling bugs to AI in chat is slow and frustrating:
- ❌ *"Make the second button in the middle a bit higher and change its color."* (Vague, AI guesses the wrong selector)
- ✅ **With VisualPatch**: Click any element on your screen, type your request, and press **Enter** (or **Ctrl+C**).

VisualPatch automatically captures:
1. **Exact CSS Selectors**: `div.hero > div.cta-group > button.btn-primary:nth-of-type(1)`
2. **Text Content Previews**: `"Schedule Discovery Session"`
3. **Viewport & Document Coordinates**: Precise anchor points that scroll in sync with your page.
4. **Structured Markdown Prompt**: Ready to paste directly into any AI assistant, PR, or Issue!

---

## ⚡ Compatible with All AI Agents

VisualPatch produces standard, clean markdown prompts optimized for:
- 🤖 **Claude / Anthropic** (Claude Code, Artifacts, Web)
- ⚡ **Cursor IDE**
- 💬 **ChatGPT / OpenAI** (GPT-4o, Canvas, Codex)
- 🌊 **Windsurf / Codeium**
- 🐙 **GitHub Copilot Workspace**
- 🪄 **Google Antigravity**
- 🚀 **Devin, v0, Bolt.new, Lovable**

---

## ✨ Key Features

- 💎 **Linear + Apple Frosted Glass UI**: Obsidian acrylic dock with multi-layer depth shadows, subtle hairline borders, and hardware-accelerated micro-interactions.
- 🎯 **Pixel-Perfect Element Inspector**: Hover over any DOM node with real-time bounding box highlighting and tag dimensions.
- 📍 **True-Document Pin Anchoring**: Dropped pins stay glued to their exact document position even during smooth scrolling.
- ⌨️ **Intuitive Keyboard Flow**: Press <kbd>Enter</kbd> to save notes, <kbd>Shift</kbd>+<kbd>Enter</kbd> for newlines, and <kbd>Esc</kbd> to toggle inspect mode.
- 📋 **1-Click AI Copy & Auto-Clear**: Generates clean, structured markdown for your AI assistant and immediately resets pins so you never get duplicates.
- 🖐️ **Draggable Anywhere**: Drag the toolbar or the collapsed capsule to any corner of your screen—persists smoothly across page refreshes.
- 🛡️ **Zero Telemetry / 100% Local**: Runs strictly on local development domains (`localhost`, `127.0.0.1`, local ports). No external servers, no tracking, zero analytics.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Esc</kbd> or <kbd>Alt</kbd> + <kbd>D</kbd> / <kbd>F9</kbd> | **Toggle Inspect Mode** (Drop pins on click / Exit inspect) |
| <kbd>Ctrl</kbd> + <kbd>C</kbd> / <kbd>⌘</kbd> + <kbd>C</kbd> | **Copy All Feedbacks for AI** (when not selecting text) |
| <kbd>Alt</kbd> + <kbd>T</kbd> or <kbd>F8</kbd> | **Toggle / Minimize Toolbar** |
| <kbd>Enter</kbd> | **Save Pin Note** (inside feedback card) |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | **New Line** (inside feedback card) |
| <kbd>Esc</kbd> | **Close Feedback Card** (when typing note) |

---

## 🚀 Quick Start & Installation

### Option 1: Chrome / Edge / Brave Extension (Recommended)

1. **Clone or Download** this repository:
   ```bash
   git clone https://github.com/OpusTechnica/VisualPatch.git
   ```
2. Open your Chromium browser and go to the extensions management page:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the cloned folder.
5. Open any local project running on `localhost` (e.g. `http://localhost:3000` or `http://localhost:5173`) — the sleek **`● V`** dock will appear automatically!

---

### Option 2: React / Vite In-App Dev Component

If you prefer an in-app zero-extension setup during development, drop `VisualPatchDev.jsx` into your project:

```jsx
// App.jsx
import VisualPatchDev from './components/dev/VisualPatchDev';

export default function App() {
  return (
    <>
      <YourAppContent />
      {import.meta.env.DEV && <VisualPatchDev />}
    </>
  );
}
```

---

## 📋 Example Generated AI Prompt

When you click **📋 Copy for AI** (or press **Ctrl+C**), your clipboard will contain structured markdown like this:

```markdown
### 📌 VisualPatch Feedback from Localhost Preview
**URL:** `http://localhost:3000/#`
**Total Items:** 2

#### 1. Element: `header.navbar > div.nav-right > button.cta-btn`
- **Current Content:** "Schedule Discovery"
- **Requested Change:** Add the dual-arrow diagonal pass-through hover animation matching the hero button.

#### 2. Element: `div.pricing-grid > div.card-pro:nth-of-type(2) > h3.price`
- **Current Content:** "$99/mo"
- **Requested Change:** Make the font 2px larger and apply high-contrast white with 800 weight.
```

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
