/**
 * VisualPatch — Main World Framework Introspection Bridge (bridge-main.js)
 * Executes in "world": "MAIN" to inspect runtime JS objects, React Fibers, Vue instances,
 * Svelte metadata, Astro islands, and Angular components directly in the page context.
 */

(function () {
  if (window.__visualpatch_bridge_loaded) return;
  window.__visualpatch_bridge_loaded = true;

  // Clean and normalize file paths across OS and build tools (Vite, Webpack, Turbopack)
  function cleanSourcePath(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') return null;
    let p = rawPath.replace(/\\/g, '/');

    // Strip URL schemes (http://localhost:5173/, webpack-internal:///, vite/@fs/)
    p = p.replace(/^https?:\/\/[^/]+\//, '');
    p = p.replace(/^webpack-internal:\/\/\/(?:\.\/)?/, '');
    p = p.replace(/^webpack:\/\/\/(?:\.\/)?/, '');
    p = p.replace(/^\/@fs\//, '');

    // Strip Next.js & Turbopack virtual prefixes
    p = p.replace(/^\[project\]\//, '');
    p = p.replace(/^\([^)]+\)\/(?:\.\/)?/, '');
    p = p.replace(/^_N_E\/(?:\.\/)?/, '');

    // Strip Vite cache bust query params & build metadata (?t=1234567, ?import, etc.)
    p = p.replace(/\?[^:]*/, '');
    p = p.replace(/\s+\[app-[^\]]+\](?:\s+\([^)]+\))?/, '');

    // Normalize relative paths
    p = p.replace(/^\.\//, '');

    return p;
  }

  // Parse React 19 _debugStack Error callsite
  function parseDebugStack(stack) {
    if (!stack || typeof stack !== 'string') return null;
    const lines = stack.split('\n');
    for (const line of lines) {
      // Matches: at Component (http://localhost:3000/src/App.tsx?t=123:24:12) or at src/App.tsx:24:12
      const match = line.match(/(?:at\s+(?:.*?\s+\()?(?:https?:\/\/[^/]+)?|at\s+)([^?#:]+)(?:\?[^:]*)?:(\d+):(\d+)\)?/);
      if (match) {
        const file = cleanSourcePath(match[1]);
        if (file && !file.includes('node_modules') && !file.includes('react-dom') && !file.includes('chunk-')) {
          return {
            fileName: file,
            lineNumber: parseInt(match[2], 10),
            columnNumber: parseInt(match[3], 10)
          };
        }
      }
    }
    return null;
  }

  // Extract React 16-19 component info
  function getReactInfo(el) {
    const key = Object.keys(el).find(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );
    if (!key) return null;

    let fiber = el[key];
    let component = null;
    let sourceFile = null;
    let lineNumber = null;
    let depth = 0;
    const maxDepth = 45;

    while (fiber && depth < maxDepth) {
      depth++;

      // React 16-18 _debugSource
      if (fiber._debugSource && !sourceFile) {
        const raw = fiber._debugSource.fileName || '';
        const cleaned = cleanSourcePath(raw);
        if (cleaned && !cleaned.includes('node_modules')) {
          sourceFile = cleaned;
          lineNumber = fiber._debugSource.lineNumber || null;
        }
      }

      // React 19 _debugStack Error object
      if (!sourceFile && fiber._debugStack && fiber._debugStack.stack) {
        const parsed = parseDebugStack(fiber._debugStack.stack);
        if (parsed) {
          sourceFile = parsed.fileName;
          lineNumber = parsed.lineNumber;
        }
      }

      // Extract Component Name
      if (!component && fiber.type) {
        let name = null;
        if (typeof fiber.type === 'function') {
          name = fiber.type.displayName || fiber.type.name;
        } else if (fiber.type && typeof fiber.type === 'object') {
          // ForwardRef or Memo wrappers
          name =
            fiber.type.displayName ||
            fiber.type.render?.displayName ||
            fiber.type.render?.name ||
            fiber.type.type?.displayName ||
            fiber.type.type?.name;
        }

        // Filter out framework internals
        if (
          name &&
          typeof name === 'string' &&
          name !== 'Anonymous' &&
          !name.startsWith('_') &&
          !['Fragment', 'Suspense', 'Provider', 'Consumer', 'Route', 'Switch', 'Offscreen'].includes(name)
        ) {
          component = name;
        }
      }

      // If we found both, stop climbing
      if (component && sourceFile) break;

      // Handle owner lookup for HostComponents (div, span, button)
      if (!component && fiber._debugOwner && typeof fiber._debugOwner.type === 'function') {
        const ownerName = fiber._debugOwner.type.displayName || fiber._debugOwner.type.name;
        if (ownerName && ownerName !== 'Anonymous') {
          component = ownerName;
        }
      }

      fiber = fiber.return;
    }

    if (component || sourceFile) {
      return {
        framework: 'React',
        component: component || null,
        sourceFile: sourceFile ? (lineNumber ? `${sourceFile}:${lineNumber}` : sourceFile) : null
      };
    }
    return null;
  }

  // Extract Vue 2 & Vue 3 info
  function getVueInfo(el) {
    // Vue 3
    if (el.__vueParentComponent) {
      const instance = el.__vueParentComponent;
      const type = instance.type || {};
      const component =
        type.__name ||
        type.name ||
        (type.__file ? type.__file.split('/').pop().replace(/\.vue$/, '') : null);
      const rawFile = type.__file || instance.vnode?.type?.__file || null;
      return {
        framework: 'Vue 3',
        component: component || 'VueComponent',
        sourceFile: cleanSourcePath(rawFile)
      };
    }

    // Vue 2
    if (el.__vue__) {
      const instance = el.__vue__;
      const options = instance.$options || {};
      const component = options.name || options._componentTag || null;
      const rawFile = options.__file || null;
      return {
        framework: 'Vue 2',
        component: component || 'VueComponent',
        sourceFile: cleanSourcePath(rawFile)
      };
    }

    return null;
  }

  // Extract Svelte 3, 4, 5 info
  function getSvelteInfo(el) {
    let curr = el;
    while (curr && curr !== document.documentElement) {
      if (curr.__svelte_meta && curr.__svelte_meta.loc) {
        const loc = curr.__svelte_meta.loc;
        const file = cleanSourcePath(loc.file);
        const name = file ? file.split('/').pop().replace(/\.svelte$/, '') : 'SvelteComponent';
        return {
          framework: 'Svelte',
          component: name,
          sourceFile: loc.line ? `${file}:${loc.line}` : file
        };
      }
      curr = curr.parentElement;
    }
    return null;
  }

  // Extract Astro Island info
  function getAstroInfo(el) {
    // Check nearest <astro-island>
    const island = el.closest('astro-island');
    if (island) {
      const compUrl = island.getAttribute('component-url') || '';
      const compExport = island.getAttribute('component-export') || '';
      const cleaned = cleanSourcePath(compUrl);
      const name = compExport || (cleaned ? cleaned.split('/').pop().replace(/\.[^.]+$/, '') : 'AstroIsland');
      return {
        framework: 'Astro',
        component: name,
        sourceFile: cleaned || null
      };
    }

    // Static Astro component source attributes in dev
    const sourceEl = el.closest('[data-astro-source-file]');
    if (sourceEl) {
      const file = cleanSourcePath(sourceEl.getAttribute('data-astro-source-file'));
      const loc = sourceEl.getAttribute('data-astro-source-loc');
      const name = file ? file.split('/').pop().replace(/\.astro$/, '') : 'AstroComponent';
      return {
        framework: 'Astro',
        component: name,
        sourceFile: loc ? `${file}:${loc}` : file
      };
    }

    return null;
  }

  // Extract Angular 14-19 info
  function getAngularInfo(el) {
    try {
      if (window.ng) {
        const comp = window.ng.getOwningComponent?.(el) || window.ng.getComponent?.(el);
        if (comp && comp.constructor) {
          return {
            framework: 'Angular',
            component: comp.constructor.name || 'AngularComponent',
            sourceFile: null
          };
        }
      }
    } catch (e) {}
    return null;
  }

  // Extract SolidJS info
  function getSolidInfo(el) {
    if (el._$owner) {
      const name = el._$owner.componentName || el._$owner.name;
      if (name) {
        return {
          framework: 'SolidJS',
          component: name,
          sourceFile: null
        };
      }
    }
    return null;
  }

  // Master Introspection Cascade
  function inspectElement(el) {
    if (!el || !(el instanceof Element)) return null;

    // Direct attributes fallback (if user instrumented data-component)
    const customComp = el.getAttribute('data-component');
    const customFile = el.getAttribute('data-source-file');
    if (customComp || customFile) {
      return {
        framework: 'Custom',
        component: customComp || null,
        sourceFile: customFile || null
      };
    }

    // 1. React (16, 17, 18, 19, Next.js client)
    const reactInfo = getReactInfo(el);
    if (reactInfo) return reactInfo;

    // 2. Vue (2 & 3)
    const vueInfo = getVueInfo(el);
    if (vueInfo) return vueInfo;

    // 3. Svelte (3, 4, 5)
    const svelteInfo = getSvelteInfo(el);
    if (svelteInfo) return svelteInfo;

    // 4. Astro
    const astroInfo = getAstroInfo(el);
    if (astroInfo) return astroInfo;

    // 5. Angular
    const angularInfo = getAngularInfo(el);
    if (angularInfo) return angularInfo;

    // 6. SolidJS
    const solidInfo = getSolidInfo(el);
    if (solidInfo) return solidInfo;

    return null;
  }

  // Stamped Token Protocol: Listen for requests from Isolated World content.js
  document.addEventListener('visualpatch:req-meta', function (e) {
    const token = e.detail && e.detail.token;
    if (!token) return;

    const targetEl = document.querySelector(`[data-vp-token="${token}"]`);
    let meta = null;
    if (targetEl) {
      targetEl.removeAttribute('data-vp-token');
      meta = inspectElement(targetEl);
    }

    // Send pure serializable JSON back to content.js
    document.dispatchEvent(
      new CustomEvent('visualpatch:res-meta', {
        detail: {
          token: token,
          meta: meta
        }
      })
    );
  });
})();
