#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BANNER = `
\x1b[38;2;56;189;248m   ____   ___                     __ ____         __        __ \x1b[0m
\x1b[38;2;0;113;227m  / / /  / _ \\ ___  ___  ___  ___/ // _  /___ _ / /_ ____ / / \x1b[0m
\x1b[38;2;0;113;227m /_  _/ / ___// _ \\/ _ \\/ _ \\/ _  // ___// _ \`// __// __// _ \\\x1b[0m
\x1b[38;2;56;189;248m  /_/  /_/    \\___/_//_/_//_/\\_,_//_/    \\_,_/ \\__/ \\__/ /_//_/\x1b[0m
\x1b[90m  Universal Visual Feedback Tool for AI Coding Assistants\x1b[0m
`;

function log(msg) {
  console.log(msg);
}

function success(msg) {
  console.log(`\x1b[32m✔\x1b[0m ${msg}`);
}

function info(msg) {
  console.log(`\x1b[36mℹ\x1b[0m ${msg}`);
}

function warn(msg) {
  console.log(`\x1b[33m⚠\x1b[0m ${msg}`);
}

function detectProject(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  let hasPkg = false;
  let pkg = {};

  if (fs.existsSync(pkgPath)) {
    hasPkg = true;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {}
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const isNext = Boolean(deps['next']);
  const isReact = Boolean(deps['react'] || deps['react-dom']);
  const isVite = Boolean(deps['vite']);
  const isVue = Boolean(deps['vue']);
  const isAstro = Boolean(deps['astro']);

  return {
    hasPkg,
    isNext,
    isReact,
    isVite,
    isVue,
    isAstro,
    hasSrc: fs.existsSync(path.join(cwd, 'src')),
    hasAppDir: fs.existsSync(path.join(cwd, 'app')) || fs.existsSync(path.join(cwd, 'src', 'app')),
    hasIndexHtml: fs.existsSync(path.join(cwd, 'index.html'))
  };
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function init() {
  log(BANNER);
  const cwd = process.cwd();
  const proj = detectProject(cwd);

  info(`Current Directory: \x1b[37m${cwd}\x1b[0m`);

  let framework = 'HTML / Vanilla JS';
  if (proj.isNext) framework = 'Next.js (React)';
  else if (proj.isVite && proj.isReact) framework = 'Vite + React';
  else if (proj.isReact) framework = 'React';
  else if (proj.isVue) framework = 'Vue';
  else if (proj.isAstro) framework = 'Astro';

  info(`Detected Environment: \x1b[1m\x1b[34m${framework}\x1b[0m\n`);

  // Source component template path
  const templatePath = path.join(__dirname, '..', 'examples', 'react', 'VisualPatchDev.jsx');
  const vanillaPath = path.join(__dirname, '..', 'content.js');

  if (proj.isReact || proj.isNext || proj.isVite) {
    // React Setup
    let targetDir = path.join(cwd, 'src', 'components');
    if (!proj.hasSrc) {
      targetDir = path.join(cwd, 'components');
    }

    const answer = await askQuestion(`\x1b[1mWhere would you like to install the VisualPatch React component?\x1b[0m\n[\x1b[36m1\x1b[0m] ${targetDir}/VisualPatchDev.jsx (Recommended)\n[\x1b[36m2\x1b[0m] Custom path\nSelect (1/2) [default: 1]: `);

    let finalFilePath = path.join(targetDir, 'VisualPatchDev.jsx');
    if (answer === '2') {
      const customPath = await askQuestion('Enter custom relative file path: ');
      if (customPath) {
        finalFilePath = path.resolve(cwd, customPath);
      }
    }

    const parentDir = path.dirname(finalFilePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    if (fs.existsSync(templatePath)) {
      const content = fs.readFileSync(templatePath, 'utf8');
      fs.writeFileSync(finalFilePath, content, 'utf8');
    } else {
      // Fallback read from package root
      const fallbackSrc = path.join(__dirname, '..', 'src', 'VisualPatch.jsx');
      if (fs.existsSync(fallbackSrc)) {
        fs.writeFileSync(finalFilePath, fs.readFileSync(fallbackSrc, 'utf8'), 'utf8');
      }
    }

    const relPath = path.relative(cwd, finalFilePath).replace(/\\/g, '/');
    success(`Created \x1b[1m${relPath}\x1b[0m\n`);

    log('\x1b[1m\x1b[32mInstallation complete! 🎉\x1b[0m\n');
    log('To activate VisualPatch during local development, import it in your root layout/App:');
    log('\x1b[90m---------------------------------------------------------\x1b[0m');
    if (proj.isNext) {
      log(`\x1b[35m// app/layout.jsx or pages/_app.jsx\x1b[0m
import VisualPatchDev from './${relPath.replace(/\.jsx?$/, '')}';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <VisualPatchDev />}
      </body>
    </html>
  );
}`);
    } else {
      log(`\x1b[35m// src/App.jsx\x1b[0m
import VisualPatchDev from './${relPath.replace(/^src\//, '').replace(/\.jsx?$/, '')}';

export default function App() {
  return (
    <>
      <YourAppContent />
      {import.meta.env.DEV && <VisualPatchDev />}
    </>
  );
}`);
    }
    log('\x1b[90m---------------------------------------------------------\x1b[0m');
    log('\nShortcuts: \x1b[1mEsc\x1b[0m (Toggle Inspect) · \x1b[1mCtrl+C\x1b[0m (Copy for AI) · \x1b[1mAlt+T\x1b[0m (Minimize)\n');
  } else {
    // Vanilla / HTML Setup
    const indexHtmlPath = path.join(cwd, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      const injectAns = await askQuestion(`\x1b[1mInject VisualPatch script into index.html automatically?\x1b[0m (y/n) [default: y]: `);
      if (injectAns.toLowerCase() !== 'n') {
        const destScriptPath = path.join(cwd, 'visualpatch.js');
        if (fs.existsSync(vanillaPath)) {
          fs.writeFileSync(destScriptPath, fs.readFileSync(vanillaPath, 'utf8'), 'utf8');
        }
        let html = fs.readFileSync(indexHtmlPath, 'utf8');
        if (!html.includes('visualpatch.js')) {
          html = html.replace('</body>', '  <!-- VisualPatch Dev Feedback Tool -->\n  <script src="/visualpatch.js"></script>\n</body>');
          fs.writeFileSync(indexHtmlPath, html, 'utf8');
          success(`Injected script tag into \x1b[1mindex.html\x1b[0m`);
          success(`Created \x1b[1mvisualpatch.js\x1b[0m in root`);
        } else {
          info(`Script already exists in index.html`);
        }
      }
    } else {
      const destScriptPath = path.join(cwd, 'visualpatch.js');
      if (fs.existsSync(vanillaPath)) {
        fs.writeFileSync(destScriptPath, fs.readFileSync(vanillaPath, 'utf8'), 'utf8');
      }
      success(`Created \x1b[1mvisualpatch.js\x1b[0m`);
      log(`Add \x1b[36m<script src="./visualpatch.js"></script>\x1b[0m to your HTML file.`);
    }

    log('\n\x1b[1m\x1b[32mInstallation complete! 🎉\x1b[0m');
    log('Shortcuts: \x1b[1mEsc\x1b[0m (Toggle Inspect) · \x1b[1mCtrl+C\x1b[0m (Copy for AI) · \x1b[1mAlt+T\x1b[0m (Minimize)\n');
  }
}

const args = process.argv.slice(2);
const command = args[0] || 'init';

switch (command) {
  case 'init':
  case 'add':
  case 'install':
    init().catch(console.error);
    break;
  case '-v':
  case '--version':
  case 'version': {
    const pkg = require('../package.json');
    log(`VisualPatch v${pkg.version}`);
    break;
  }
  case '-h':
  case '--help':
  case 'help':
    log(BANNER);
    log(`Usage:
  npx visualpatch            Initialize VisualPatch in the current project
  npx visualpatch init       Initialize VisualPatch in the current project
  npx visualpatch --version  Show current version
  npx visualpatch --help     Show this help message

Documentation & Repository:
  https://github.com/OpusTechnica/VisualPatch
`);
    break;
  default:
    init().catch(console.error);
    break;
}
