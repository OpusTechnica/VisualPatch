# 🤖 AGENTS.md — VisualPatch Autonomous Agent Guide

This document provides exact, deterministic instructions for AI Pair Programmers (**Antigravity, Claude Code, Cursor, Windsurf, ChatGPT, GitHub Copilot, Devin**) on how to autonomously install, configure, and operate **VisualPatch** in any codebase.

---

## ⚡ Instant Autonomous Setup Instructions

When a user asks:
> *Install VisualPatch*  
> *Setup visual feedback in this project*  
> *Enable VisualPatch live review*  

Follow these exact steps:

---

### Step 1: Detect Project Framework & Mount Component

#### 🅰️ Vite + React (src/App.jsx or src/main.jsx)
1. Create or copy DevAnnotator.jsx / VisualPatchDev.jsx into src/components/dev/DevAnnotator.jsx (or run 
px visualpatch init).
2. Mount in src/App.jsx:
`jsx
import DevAnnotator from './components/dev/DevAnnotator';

export default function App() {
  return (
    <>
      <YourApp />
      {import.meta.env.DEV && <DevAnnotator />}
    </>
  );
}
`

#### 🅱️ Next.js App Router (pp/layout.jsx / pp/layout.tsx)
`jsx
import { VisualPatch } from 'visualpatch';

export default function RootLayout({ children }) {
  return (
    <html lang=en>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <VisualPatch />}
      </body>
    </html>
  );
}
`

#### 🅲 Vanilla HTML / Static Prototypes
Add before </body>:
`html
<script src=https://cdn.jsdelivr.net/npm/visualpatch@2.0.0/vanilla.js defer></script>
`

---

### Step 2: Configure Vite Dev-Server Middleware (ite.config.js)

Add the VisualPatch ingestion middleware into ite.config.js:

`javascript
import fs from 'fs';
import path from 'path';

function visualpatchPlugin() {
  return {
    name: 'vite-plugin-visualpatch',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method === 'POST' && (req.url === '/__visualpatch_inbox' || req.url === '/api/inbox')) {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const cwd = process.cwd();
              const inboxDir = path.join(cwd, '.visualpatch');
              if (!fs.existsSync(inboxDir)) fs.mkdirSync(inboxDir, { recursive: true });

              let savedImages = [];
              if (data.items && Array.isArray(data.items)) {
                data.items.forEach((item, index) => {
                  if (item.screenshot && item.screenshot.startsWith('data:image/')) {
                    const base64Data = item.screenshot.replace(/^data:image\/\w+;base64,/, '');
                    const filename = preview_.png;
                    const filePath = path.join(inboxDir, filename);
                    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                    savedImages.push(filename);
                    item.localImagePath = .visualpatch/;
                  }
                });
              }

              let markdown = # 📌 VisualPatch UI Task Queue\n;
              markdown += > **Source URL:** \${data.url || 'http://localhost'}\  \n;
              markdown += > **Timestamp:**   \n;
              markdown += > **Total Items:** \n\n;

              if (data.items && Array.isArray(data.items)) {
                data.items.forEach((item, i) => {
                  markdown += ### Item #: \${item.selector || 'DOM Element'}\\n;
                  if (item.component) {
                    markdown += - **React Component:** \<>\\n;
                  }
                  if (item.sourceFile) {
                    const absPath = path.resolve(cwd, item.sourceFile).replace(/\\/g, '/');
                    markdown += - **Source File:** [\${item.sourceFile}\](file:///)\n;
                  }
                  if (item.textSnippet) {
                    markdown += - **Rendered Text:** "\n;
 }
 if (item.localImagePath) {
 const absImg = path.resolve(inboxDir, preview_.png).replace(/\\/g, '/');
 markdown += - **Visual Proof:** ![Screenshot ](file:///)\n;
 }
 markdown += - **Requested Change:** \n\n;
 });
 }

 const inboxMdPath = path.join(inboxDir, 'inbox.md');
 fs.writeFileSync(inboxMdPath, markdown, 'utf8');

 console.log(\n\x1b[32m✔\x1b[0m \x1b[1m[VisualPatch]\x1b[0m Ingested \x1b[36m items\x1b[0m → \x1b[33m.visualpatch/inbox.md\x1b[0m);

 res.writeHead(200, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({ success: true, inboxPath: inboxMdPath, images: savedImages }));
 } catch (err) {
 console.error('[VisualPatch Plugin Error]:', err);
 res.writeHead(500, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({ success: false, error: err.message }));
 }
 });
 return;
 }
 next();
 });
 }
 };
}
`

---

### Step 3: Setup the Autonomous Live Review Loop (/vp-live)

1. Create scripts/wait-for-inbox.js:
`javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const inboxDir = path.join(projectRoot, '.visualpatch');
const inboxFile = path.join(inboxDir, 'inbox.md');

if (!fs.existsSync(inboxDir)) fs.mkdirSync(inboxDir, { recursive: true });

let initialMtime = 0;
if (fs.existsSync(inboxFile)) {
 try { initialMtime = fs.statSync(inboxFile).mtimeMs; } catch (e) {}
}

const intervalId = setInterval(() => {
 if (fs.existsSync(inboxFile)) {
 try {
 const currentMtime = fs.statSync(inboxFile).mtimeMs;
 if (currentMtime > initialMtime) {
 clearInterval(intervalId);
 console.log([VISUALPATCH_LIVE] New UI task detected in .visualpatch/inbox.md);
 process.exit(0);
 }
 } catch (e) {}
 }
}, 350);
`

2. When the user executes /vp-live:
 - Start 
ode scripts/wait-for-inbox.js as a background task.
 - When the watcher wakes up, read .visualpatch/inbox.md, open the exact sourceFile, apply surgical edits, test build (
pm run build), and re-arm the watcher.

---

## 🎯 Grounding & Zero-Token Rules for Agents

1. **Always Read .visualpatch/inbox.md**: Do not ask the user for clarification if .visualpatch/inbox.md contains the component and source file path.
2. **Never Dump Base64 in Chat**: VisualPatch saves screenshots directly as .visualpatch/preview_1.png. View the local file using tools instead of base64 data URLs.
3. **Follow DESIGN.md**: Adhere strictly to the workspace tokens, typography, and theme variables.
