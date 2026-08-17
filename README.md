# 🎯 Antigravity Visual Annotator

> **Pinpoint in-browser visual feedback tool for modern web development and AI pair programming.**  
> Crafted with an ultra-premium **Linear + Apple-inspired frosted glass aesthetic**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Style: Linear Glass](https://img.shields.io/badge/Design-Linear%20%2B%20Apple%20Glass-0071e3.svg)](#features)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-emerald.svg)](#privacy--security)

---

## 🌟 Overview

**Antigravity Visual Annotator** eliminates the tedious back-and-forth of explaining UI bugs and styling tweaks to AI assistants (Google Antigravity, Claude, ChatGPT, Cursor, Copilot) or team members. 

Instead of writing vague prompts like *"fix the button on the right"*, simply click on any element in your browser, type what you want changed, and hit **Copy for AI**. The tool automatically captures:
- Exact CSS selectors (`div.header > button.btn-primary`)
- Text content snippets
- Viewport & document coordinates
- Formats everything into high-precision markdown ready to paste into any AI chat!

---

## ✨ Features

- 💎 **Linear + Apple Frosted Glass UI**: Obsidian acrylic dock with multi-layer depth shadows, subtle hairline borders, and hardware-accelerated micro-interactions.
- 🎯 **Pixel-Perfect Element Inspector**: Hover over any DOM node with real-time bounding box highlighting and tag dimensions.
- 📍 **True-Document Pin Anchoring**: Dropped pins stay glued to their exact document position even during smooth scrolling.
- 📋 **1-Click AI Copy & Auto-Clear**: Generates clean, structured markdown for your AI assistant and immediately resets pins so you never get duplicates.
- 🖐️ **Draggable Anywhere**: Drag the toolbar or the collapsed capsule to any corner of your screen—persists smoothly across page refreshes.
- ⚡ **Global Keyboard Shortcuts**: Control inspection and visibility without touching your mouse.
- 🛡️ **Zero Telemetry / 100% Local**: Runs strictly on local development domains (`localhost`, `127.0.0.1`, local ports). No external servers, no tracking, zero analytics.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>D</kbd> or <kbd>F9</kbd> | **Toggle Inspect Mode** (Drop pins on click) |
| <kbd>Alt</kbd> + <kbd>T</kbd> or <kbd>F8</kbd> | **Toggle / Minimize Toolbar** |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> / <kbd>⌘</kbd> + <kbd>Enter</kbd> | **Save Pin Note** (inside feedback card) |
| <kbd>Escape</kbd> | **Close Feedback Card** |

---

## 🚀 Quick Start & Installation

### Option 1: Chrome / Edge / Brave Extension (Recommended)

1. **Clone or Download** this repository:
   ```bash
   git clone https://github.com/OpusTechnica/antigravity-visual-annotator.git
   ```
2. Open your Chromium browser and go to the extensions management page:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the extension folder.
5. Open any local project running on `localhost` (e.g. `http://localhost:3000` or `http://localhost:5173`) — the sleek **`● A`** dock will appear automatically!

---

### Option 2: React / Vite In-App Dev Component

If you prefer an in-app zero-extension setup during development, drop `DevAnnotator.jsx` into your project:

```jsx
// App.jsx
import DevAnnotator from './components/dev/DevAnnotator';

export default function App() {
  return (
    <>
      <YourAppContent />
      {import.meta.env.DEV && <DevAnnotator />}
    </>
  );
}
```

---

## 📋 Example AI Output

When you click **📋 Copy for AI**, your clipboard will contain structured markdown like this:

```markdown
### 📌 Antigravity Visual Feedback from Localhost Preview
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
