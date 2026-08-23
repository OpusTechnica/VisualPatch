#!/usr/bin/env node

/**
 * VisualPatch Local Agent Loopback Bridge
 * Port: 127.0.0.1:44922
 * Purpose: Receives UI feedback from browser, writes local disk artifacts, and notifies AI agents.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 44922;
const HOST = '127.0.0.1';

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function handleInbox(body, res) {
  try {
    const data = JSON.parse(body);
    const cwd = process.cwd();
    const inboxDir = path.join(cwd, '.visualpatch');
    ensureDirectory(inboxDir);

    let savedImages = [];

    // Save Screenshots as binary PNG files on local disk (0 base64 text tokens!)
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item, index) => {
        if (item.screenshot && item.screenshot.startsWith('data:image/')) {
          const base64Data = item.screenshot.replace(/^data:image\/\w+;base64,/, '');
          const filename = `preview_${item.number || index + 1}.png`;
          const filePath = path.join(inboxDir, filename);
          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
          savedImages.push(filename);
          item.localImagePath = `.visualpatch/${filename}`;
        }
      });
    }

    // Generate Clean, Token-Efficient Markdown Payload
    let markdown = `# 📌 VisualPatch UI Task Queue\n`;
    markdown += `> **Source URL:** \`${data.url || 'http://localhost'}\`  \n`;
    markdown += `> **Timestamp:** ${new Date().toISOString()}  \n`;
    markdown += `> **Total Items:** ${data.items ? data.items.length : 0}\n\n`;

    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item, i) => {
        markdown += `### Item #${item.number || i + 1}: \`${item.selector || 'DOM Element'}\`\n`;
        if (item.component) {
          markdown += `- **React/Vue Component:** \`<${item.component}>\`\n`;
        }
        if (item.sourceFile) {
          const absPath = path.resolve(cwd, item.sourceFile).replace(/\\/g, '/');
          markdown += `- **Source File:** [\`${item.sourceFile}\`](file:///${absPath})\n`;
        }
        if (item.textSnippet) {
          markdown += `- **Rendered Text:** "${item.textSnippet}"\n`;
        }
        if (item.localImagePath) {
          const absImg = path.resolve(inboxDir, `preview_${item.number || i + 1}.png`).replace(/\\/g, '/');
          markdown += `- **Visual Proof:** ![Screenshot ${item.number || i + 1}](file:///${absImg})\n`;
        }
        markdown += `- **Requested Change:** ${item.note || 'Inspect and refine component styling/layout.'}\n\n`;
      });
    }

    const inboxMdPath = path.join(inboxDir, 'inbox.md');
    fs.writeFileSync(inboxMdPath, markdown, 'utf8');

    console.log(`\x1b[32m✔\x1b[0m \x1b[1m[VisualPatch Bridge]\x1b[0m Ingested \x1b[36m${data.items ? data.items.length : 0} items\x1b[0m → \x1b[33m.visualpatch/inbox.md\x1b[0m`);

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify({ success: true, inboxPath: inboxMdPath, images: savedImages }));
  } catch (err) {
    console.error(`\x1b[31m✖\x1b[0m [VisualPatch Bridge Error]:`, err);
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ status: 'OK', service: 'VisualPatch Agent Bridge', port: PORT }));
    return;
  }

  if (req.method === 'POST' && (req.url === '/api/inbox' || req.url === '/__visualpatch_inbox')) {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => handleInbox(body, res));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`\n\x1b[38;2;0;113;227m⚡ VisualPatch Local Agent Bridge active on \x1b[1mhttp://${HOST}:${PORT}\x1b[0m`);
  console.log(`\x1b[90mListening for in-browser "Send to Agent" (Ctrl+Enter) requests...\x1b[0m\n`);
});
