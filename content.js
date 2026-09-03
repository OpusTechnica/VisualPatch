/**
 * VisualPatch v2.3.0 — Universal In-Browser Visual Feedback for AI Coding Assistants
 * Compatible with Claude, Cursor, Windsurf, Copilot, ChatGPT, Antigravity, Devin
 * Features: Native GPU Framebuffer Tab Capture, Main-World Stamped Token Framework Introspection,
 * High-DPI Retina Cropping, OS-Level Hotkeys, Isolated Shadow DOM Dock
 */

(function () {
  // Prevent duplicate instances
  if (window.__visualpatch_loaded) return;
  window.__visualpatch_loaded = true;

  // Environment & Staging Detection
  const hostname = window.location.hostname || '';
  const port = window.location.port || '';
  const protocol = window.location.protocol || '';

  const isLocalOrPreview =
    ['localhost', '127.0.0.1', '0.0.0.0', '::1', ''].includes(hostname) ||
    port !== '' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.test') ||
    hostname.endsWith('.dev') ||
    hostname.endsWith('.localhost') ||
    /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname) ||
    hostname.includes('.nip.io') ||
    hostname.includes('.sslip.io') ||
    hostname.includes('.vercel.app') ||
    hostname.includes('.netlify.app') ||
    hostname.includes('.pages.dev') ||
    hostname.includes('.railway.app') ||
    hostname.includes('.onrender.com') ||
    hostname.includes('.fly.dev') ||
    hostname.includes('.app.github.dev') ||
    hostname.includes('.gitpod.io') ||
    hostname.includes('.csb.app') ||
    hostname.includes('.webcontainer.io') ||
    hostname.includes('ngrok') ||
    hostname.includes('loca.lt') ||
    hostname.includes('trycloudflare.com') ||
    protocol === 'file:';

  // Global State
  let isMounted = false;
  let isInspectMode = false;
  let isScreenshotMode = false;
  let isVisible = true;
  let annotations = [];
  let currentPinNumber = 1;
  let hoveredElement = null;
  let currentPos = { x: null, y: null };


  // Marquee Drag State
  let isMarqueeDragging = false;
  let marqueeStartX = 0, marqueeStartY = 0;

  // Keepalive Port to maintain Background Service Worker responsiveness
  let keepalivePort = null;
  function ensureKeepalive() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.connect && !keepalivePort) {
      try {
        keepalivePort = chrome.runtime.connect({ name: 'visualpatch-keepalive' });
        keepalivePort.onDisconnect.addListener(() => {
          keepalivePort = null;
        });
      } catch (e) {}
    }
  }

  // Load Saved Position
  function sanitizePos(pos) {
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || isNaN(pos.x) || isNaN(pos.y)) {
      return { x: null, y: null };
    }
    const margin = 10;
    const isMobile = window.innerWidth <= 768;
    const dockWidth = isMobile ? 220 : 44;
    const dockHeight = isMobile ? 44 : 240;
    const maxX = Math.max(margin, window.innerWidth - dockWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - dockHeight - margin);
    return {
      x: Math.max(margin, Math.min(pos.x, maxX)),
      y: Math.max(margin, Math.min(pos.y, maxY))
    };
  }

  try {
    const savedPos = localStorage.getItem('visualpatch_toolbar_pos');
    if (savedPos) currentPos = sanitizePos(JSON.parse(savedPos));
  } catch (e) {
    currentPos = { x: null, y: null };
  }

  // Mount Shadow Root Host
  const host = document.createElement('div');
  host.id = 'visualpatch-host';
  host.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 0; pointer-events: none; z-index: 2147483647;';

  function mountHost() {
    if (isMounted) return;
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountHost, { once: true });
      }
      return;
    }
    if (!document.body.contains(host)) {
      document.body.appendChild(host);
    }
    isMounted = true;
    ensureKeepalive();
  }

  const shadow = host.attachShadow({ mode: 'open' });

  // Embedded Stylesheet (Apple Glass / Linear Design System)
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif;
      -webkit-tap-highlight-color: transparent;
    }

    .vp-toolbar {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      padding: 6px 4px;
      background: #0c0d12;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 9999px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.25);
      color: #f8fafc;
      pointer-events: auto;
      user-select: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
      touch-action: none;
      width: 38px;
      height: fit-content;
      max-height: calc(100vh - 16px);
      box-sizing: border-box;
    }

    .vp-toolbar.vp-dragging {
      opacity: 0.98;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55), 0 2px 4px rgba(0, 0, 0, 0.25) !important;
      border-color: #0071e3 !important;
      cursor: grabbing !important;
      transition: none !important;
      background: #0c0d12 !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    .vp-brand-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 5px 4px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      cursor: grab;
      transition: background-color 0.15s ease, transform 0.15s ease;
      width: 30px;
      height: 30px;
    }

    .vp-brand-badge:hover {
      background-color: rgba(255, 255, 255, 0.08);
    }

    .vp-brand-badge:active {
      cursor: grabbing;
      transform: scale(0.96);
    }

    .vp-btn-icon {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 1px solid transparent;
      background: rgba(255, 255, 255, 0.03);
      color: #94a3b8;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }

    .vp-btn-icon:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      transform: translateY(-1px);
    }

    .vp-btn-icon:active {
      transform: scale(0.95);
    }

    .vp-btn-active {
      background: #0071e3 !important;
      border-color: #0071e3 !important;
      color: #ffffff !important;
    }

    .vp-btn-copy-has-pins {
      background: #0071e3 !important;
      border-color: rgba(255, 255, 255, 0.15) !important;
      color: #ffffff !important;
    }

    .vp-badge-count {
      position: absolute;
      top: -3px;
      right: -3px;
      min-width: 15px;
      height: 15px;
      padding: 0 3.5px;
      border-radius: 9999px;
      background: #ffffff;
      color: #0071e3;
      font-size: 9px;
      font-weight: 800;
      font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
    }

    .vp-collapsed-pill {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 14px;
      background: #0c0d12;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 9999px;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      cursor: grab;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.2);
      pointer-events: auto;
      user-select: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
      height: fit-content;
      box-sizing: border-box;
      touch-action: none;
    }

    .vp-collapsed-pill:hover {
      background: #13161f;
      border-color: rgba(255, 255, 255, 0.32);
      transform: scale(1.02);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .vp-collapsed-pill.vp-dragging {
      cursor: grabbing !important;
      transition: none !important;
      border-color: #0071e3 !important;
      background: #0c0d12 !important;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55), 0 2px 4px rgba(0, 0, 0, 0.25) !important;
    }

    .vp-highlighter {
      position: fixed;
      border: 1.5px solid #0071e3;
      background: rgba(0, 113, 227, 0.04);
      border-radius: 4px;
      pointer-events: none;
      z-index: 2147483640;
      transition: all 0.05s ease;
      display: none;
    }

    .vp-tag-badge {
      position: absolute;
      top: -24px;
      left: -2px;
      background: rgba(14, 16, 20, 0.95);
      border: 1px solid rgba(0, 113, 227, 0.4);
      color: #0071e3;
      font-size: 10px;
      font-weight: 600;
      font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
      padding: 1.5px 6.5px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      backdrop-filter: blur(12px);
    }

    .vp-marquee-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(1.5px);
      -webkit-backdrop-filter: blur(1.5px);
      cursor: crosshair;
      pointer-events: auto;
      z-index: 2147483644;
      display: none;
    }

    .vp-marquee-box {
      position: fixed;
      border: 1.5px solid rgba(255, 255, 255, 0.95);
      background: transparent;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6), 0 0 0 99999px rgba(14, 16, 20, 0.52);
      border-radius: 2px;
      pointer-events: none;
      display: none;
    }

    .vp-marquee-dim {
      position: absolute;
      bottom: -34px;
      right: 0;
      background: rgba(14, 16, 20, 0.95);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      color: #f8fafc;
      font-size: 10.5px;
      font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
      font-weight: 600;
      padding: 2.5px 9px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .vp-pin {
      position: absolute;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #0071e3;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
      border: 2px solid #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      cursor: pointer;
      z-index: 2147483642;
      pointer-events: auto;
      transform: translate(-50%, -50%);
      transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease;
      user-select: none;
    }

    .vp-pin:hover {
      transform: translate(-50%, -50%) scale(1.15);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
    }

    .vp-card {
      position: fixed;
      width: 390px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      box-sizing: border-box;
      background: rgba(14, 16, 20, 0.96);
      backdrop-filter: blur(28px) saturate(190%);
      -webkit-backdrop-filter: blur(28px) saturate(190%);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 16px;
      box-shadow: 0 28px 56px -10px rgba(0, 0, 0, 0.88), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      padding: 16px 18px;
      z-index: 2147483648;
      pointer-events: auto;
      user-select: none;
      animation: vp-pop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes vp-pop {
      from { transform: scale(0.97) translateY(4px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }

    @media (max-width: 768px) {
      .vp-toolbar {
        flex-direction: row !important;
        width: auto !important;
        height: 44px !important;
        padding: 5px 8px !important;
        gap: 7px !important;
      }
      .vp-card {
        width: auto !important;
        left: 12px !important;
        right: 12px !important;
        bottom: 12px !important;
        top: auto !important;
        max-width: calc(100vw - 24px) !important;
        max-height: 82vh !important;
        padding: 14px 14px !important;
        border-radius: 16px !important;
      }
    }

    .vp-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 9px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }

    .vp-card-pin-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border-radius: 5px;
      background: rgba(0, 113, 227, 0.08);
      border: 1px solid rgba(0, 113, 227, 0.25);
      color: #0071e3;
      font-size: 10.5px;
      font-weight: 700;
      font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
      letter-spacing: 0.04em;
    }

    .vp-card-close {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.07);
      color: #94a3b8;
      cursor: pointer;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .vp-card-close:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    .vp-card-preview {
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 10px;
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.06);
      padding: 6px 9px;
      border-radius: 7px;
      border-left: 2.5px solid #0071e3;
      font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .vp-thumbnail-box {
      position: relative;
      margin-bottom: 10px;
      border-radius: 9px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
    }

    .vp-thumbnail-img {
      width: 100%;
      height: 110px;
      object-fit: cover;
      display: block;
      cursor: zoom-in;
    }

    .vp-thumbnail-actions {
      position: absolute;
      top: 5px;
      right: 5px;
      display: flex;
      gap: 4px;
    }

    .vp-pill-action-btn {
      padding: 2.5px 6.5px;
      border-radius: 5px;
      background: rgba(14, 16, 20, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.18);
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      backdrop-filter: blur(8px);
      transition: background 0.15s ease;
    }

    .vp-pill-action-btn:hover {
      background: rgba(26, 31, 42, 0.95);
    }

    .vp-textarea {
      width: 100%;
      height: 68px;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 9px;
      color: #f8fafc;
      padding: 8px 10px;
      font-size: 12.5px;
      line-height: 1.45;
      resize: vertical;
      outline: none;
      margin-bottom: 12px;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
      transition: border-color 0.15s ease;
    }

    .vp-textarea:focus {
      border-color: #0071e3;
    }

    .vp-card-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .vp-btn-delete {
      padding: 0 8px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid transparent;
      background: transparent;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }

    .vp-btn-delete:hover {
      background: rgba(239, 68, 68, 0.08);
      border-color: rgba(239, 68, 68, 0.25);
      color: #f87171;
    }

    .vp-btn-delete:active {
      transform: scale(0.96);
    }

    .vp-segmented-capsule {
      display: inline-flex;
      align-items: center;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(15, 18, 24, 0.85);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
      overflow: hidden;
      flex-shrink: 0;
    }

    .vp-btn-save-draft {
      padding: 0 9px;
      height: 28px;
      border: none;
      background: transparent;
      color: #cbd5e1;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .vp-btn-save-draft:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }

    .vp-capsule-divider {
      width: 1px;
      height: 16px;
      background: rgba(255, 255, 255, 0.12);
    }

    .vp-btn-agent-send {
      padding: 0 11px;
      height: 28px;
      border: none;
      background: #0071e3;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
      transition: all 0.15s ease;
    }

    .vp-btn-agent-send:hover {
      background: #007dfc;
    }

    .vp-lightbox-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      z-index: 2147483649;
      display: none;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      cursor: zoom-out;
      padding: 24px;
    }

    .vp-lightbox-content {
      position: relative;
      max-width: 92vw;
      max-height: 90vh;
      background: #0b0d11;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 32px 64px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      cursor: default;
    }

    .vp-lightbox-img {
      display: block;
      max-width: 100%;
      max-height: 80vh;
      object-fit: contain;
    }

    .vp-toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-10px);
      background: rgba(14, 16, 20, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #ffffff;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 600;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      z-index: 2147483647;
      pointer-events: none;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      opacity: 0;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .vp-toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  `;
  shadow.appendChild(styleEl);

  // Highlighting & Overlays
  const highlighter = document.createElement('div');
  highlighter.className = 'vp-highlighter';
  const tagBadge = document.createElement('div');
  tagBadge.className = 'vp-tag-badge';
  highlighter.appendChild(tagBadge);
  shadow.appendChild(highlighter);

  const marqueeBackdrop = document.createElement('div');
  marqueeBackdrop.className = 'vp-marquee-backdrop';
  const marqueeBox = document.createElement('div');
  marqueeBox.className = 'vp-marquee-box';
  marqueeBox.innerHTML = `
    <div style="position: absolute; top: -2px; left: -2px; width: 8px; height: 8px; border-top: 2.5px solid #0071e3; border-left: 2.5px solid #0071e3;"></div>
    <div style="position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; border-top: 2.5px solid #0071e3; border-right: 2.5px solid #0071e3;"></div>
    <div style="position: absolute; bottom: -2px; left: -2px; width: 8px; height: 8px; border-bottom: 2.5px solid #0071e3; border-left: 2.5px solid #0071e3;"></div>
    <div style="position: absolute; bottom: -2px; right: -2px; width: 8px; height: 8px; border-bottom: 2.5px solid #0071e3; border-right: 2.5px solid #0071e3;"></div>
  `;
  const marqueeDim = document.createElement('div');
  marqueeDim.className = 'vp-marquee-dim';
  marqueeBox.appendChild(marqueeDim);
  marqueeBackdrop.appendChild(marqueeBox);
  shadow.appendChild(marqueeBackdrop);

  // Lightbox Modal
  const lightboxModal = document.createElement('div');
  lightboxModal.className = 'vp-lightbox-modal';
  lightboxModal.innerHTML = `
    <div class="vp-lightbox-content" id="vp-lightbox-box">
      <img class="vp-lightbox-img" id="vp-lightbox-image" src="" alt="Area Screenshot" />
      <div style="padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255, 255, 255, 0.08); background: rgba(12, 14, 18, 0.95);">
        <span style="font-size: 11.5px; color: #94a3b8; font-family: monospace;">Area Screenshot Preview</span>
        <button class="vp-pill-action-btn" id="vp-lightbox-close">Close (Esc)</button>
      </div>
    </div>
  `;
  shadow.appendChild(lightboxModal);
  lightboxModal.addEventListener('click', () => lightboxModal.style.display = 'none');
  shadow.getElementById('vp-lightbox-box').addEventListener('click', (e) => e.stopPropagation());
  shadow.getElementById('vp-lightbox-close').addEventListener('click', () => lightboxModal.style.display = 'none');

  function openLightbox(src) {
    shadow.getElementById('vp-lightbox-image').src = src;
    lightboxModal.style.display = 'flex';
  }

  // Pins Layer (Document-anchored layer with strict scoped styles)
  let pinsContainer = document.getElementById('visualpatch-pins-layer');
  if (!pinsContainer) {
    pinsContainer = document.createElement('div');
    pinsContainer.id = 'visualpatch-pins-layer';
    pinsContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; z-index: 2147483640;';
    document.body?.appendChild(pinsContainer);
  }

  const cardsContainer = document.createElement('div');
  shadow.appendChild(cardsContainer);

  const toast = document.createElement('div');
  toast.className = 'vp-toast';
  shadow.appendChild(toast);

  let toastTimer = null;
  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.innerHTML = `<span style="width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8;"></span><span>${msg}</span>`;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // Toolbar Element
  const toolbar = document.createElement('div');
  toolbar.className = 'vp-toolbar';
  toolbar.id = 'visualpatch-main-toolbar';
  if (currentPos.x !== null && currentPos.y !== null) {
    toolbar.style.bottom = 'auto';
    toolbar.style.right = 'auto';
    toolbar.style.left = `${currentPos.x}px`;
    toolbar.style.top = `${currentPos.y}px`;
  }
  toolbar.innerHTML = `
    <div class="vp-brand-badge" id="visualpatch-brand-btn" title="Drag to reposition VisualPatch">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M3 9V3H9" stroke="#0071E3" stroke-width="2.8" stroke-linecap="square"/>
        <path d="M21 15V21H15" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="square"/>
        <path d="M7 8L12 17L17 8" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="12" y1="9.5" x2="12" y2="12.5" stroke="#0071E3" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="10.5" y1="11" x2="13.5" y2="11" stroke="#0071E3" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </div>
    <button class="vp-btn-icon" id="visualpatch-btn-inspect" title="Inspect & Pin Element (Alt+D)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" /><line x1="22" y1="12" x2="18" y2="12" /><line x1="6" y1="12" x2="2" y2="12" /><line x1="12" y1="6" x2="12" y2="2" /><line x1="12" y1="22" x2="12" y2="18" />
      </svg>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-screenshot" title="Capture Area Snapshot (Alt+S)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 2v4M2 6h4M18 2v4M22 6h-4M6 22v-4M2 18h4M18 22v-4M22 18h-4" />
      </svg>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-send-agent" title="Send All Pins Directly to Agent (Ctrl+Enter)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <span class="vp-badge-count" id="visualpatch-agent-count" style="display: none;">0</span>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-copy" title="Copy Feedback for AI (Ctrl+C)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span class="vp-badge-count" id="visualpatch-count" style="display: none;">0</span>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-clear" title="Clear all pins on this page">
      <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-minimize" title="Collapse Toolbar (Alt+T)">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20" />
        <polyline points="20 10 14 10 14 4" />
      </svg>
    </button>
  `;
  shadow.appendChild(toolbar);

  const collapsedPill = document.createElement('div');
  collapsedPill.className = 'vp-collapsed-pill';
  collapsedPill.style.display = 'none';
  if (currentPos.x !== null && currentPos.y !== null) {
    collapsedPill.style.bottom = 'auto';
    collapsedPill.style.right = 'auto';
    collapsedPill.style.left = `${currentPos.x}px`;
    collapsedPill.style.top = `${currentPos.y}px`;
  }
  collapsedPill.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M3 9V3H9" stroke="#0071E3" stroke-width="2.8" stroke-linecap="square"/>
      <path d="M21 15V21H15" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="square"/>
      <path d="M7 8L12 17L17 8" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span style="font-size: 11px; font-weight: 700;">VisualPatch</span>
    <span class="vp-badge-count" id="visualpatch-pill-count" style="display: none; position: static; margin-left: 2px;">0</span>
  `;
  shadow.appendChild(collapsedPill);

  // Dragging & Collapse Controller for Toolbar & Collapsed Pill
  const brandBtn = shadow.getElementById('visualpatch-brand-btn');
  let isDraggingToolbar = false;
  let isDraggingPill = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let currentTargetWidth = 38;
  let currentTargetHeight = 260;
  let dragDistance = 0;

  function onMouseDownToolbar(e) {
    if (e.button !== 0) return;
    isDraggingToolbar = true;
    dragDistance = 0;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = toolbar.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    currentTargetWidth = rect.width || 38;
    currentTargetHeight = rect.height || 260;

    toolbar.style.bottom = 'auto';
    toolbar.style.right = 'auto';
    collapsedPill.style.bottom = 'auto';
    collapsedPill.style.right = 'auto';

    toolbar.classList.add('vp-dragging');
    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp, { once: true });
    e.preventDefault();
  }

  function onMouseDownPill(e) {
    if (e.button !== 0) return;
    isDraggingPill = true;
    dragDistance = 0;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = collapsedPill.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    currentTargetWidth = rect.width || 110;
    currentTargetHeight = rect.height || 34;

    collapsedPill.style.bottom = 'auto';
    collapsedPill.style.right = 'auto';
    toolbar.style.bottom = 'auto';
    toolbar.style.right = 'auto';

    collapsedPill.classList.add('vp-dragging');
    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp, { once: true });
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDraggingToolbar && !isDraggingPill) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    dragDistance = Math.hypot(deltaX, deltaY);

    const maxX = window.innerWidth - currentTargetWidth - 8;
    const maxY = window.innerHeight - currentTargetHeight - 8;
    const newLeft = Math.max(8, Math.min(initialLeft + deltaX, maxX));
    const newTop = Math.max(8, Math.min(initialTop + deltaY, maxY));

    if (isDraggingToolbar) {
      toolbar.style.left = `${newLeft}px`;
      toolbar.style.top = `${newTop}px`;

      const safePillX = Math.max(8, Math.min(newLeft, window.innerWidth - 118));
      collapsedPill.style.left = `${safePillX}px`;
      collapsedPill.style.top = `${newTop}px`;
    } else if (isDraggingPill) {
      collapsedPill.style.left = `${newLeft}px`;
      collapsedPill.style.top = `${newTop}px`;

      const safeToolbarX = Math.max(8, Math.min(newLeft, window.innerWidth - 46));
      toolbar.style.left = `${safeToolbarX}px`;
      toolbar.style.top = `${newTop}px`;
    }

    currentPos = { x: newLeft, y: newTop };
    try { localStorage.setItem('visualpatch_toolbar_pos', JSON.stringify(currentPos)); } catch (err) {}
  }

  function onMouseUp() {
    isDraggingToolbar = false;
    isDraggingPill = false;
    toolbar.classList.remove('vp-dragging');
    collapsedPill.classList.remove('vp-dragging');
    window.removeEventListener('mousemove', onMouseMove);
  }

  brandBtn?.addEventListener('mousedown', onMouseDownToolbar);
  brandBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dragDistance <= 4) {
      toggleVisibility(false);
    }
  });

  collapsedPill.addEventListener('mousedown', onMouseDownPill);
  collapsedPill.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dragDistance <= 4) {
      toggleVisibility(true);
    }
  });

  function syncPillPosition() {
    if (currentPos.x !== null && currentPos.y !== null) {
      const pillWidth = 110;
      const pillHeight = 34;
      const safeX = Math.max(8, Math.min(currentPos.x, window.innerWidth - pillWidth - 8));
      const safeY = Math.max(8, Math.min(currentPos.y, window.innerHeight - pillHeight - 8));
      collapsedPill.style.bottom = 'auto';
      collapsedPill.style.right = 'auto';
      collapsedPill.style.left = `${safeX}px`;
      collapsedPill.style.top = `${safeY}px`;
    } else {
      collapsedPill.style.bottom = '24px';
      collapsedPill.style.right = '24px';
      collapsedPill.style.left = 'auto';
      collapsedPill.style.top = 'auto';
    }
  }

  function toggleVisibility(force) {
    mountHost();
    isVisible = typeof force === 'boolean' ? force : !isVisible;
    if (isVisible) {
      toolbar.style.display = 'inline-flex';
      collapsedPill.style.display = 'none';
      showToast('VisualPatch Expanded (Alt+T)');
    } else {
      syncPillPosition();
      toolbar.style.display = 'none';
      collapsedPill.style.display = 'inline-flex';
      showToast('VisualPatch Collapsed (Click pill to expand)');
    }
  }

  shadow.getElementById('visualpatch-btn-minimize')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleVisibility(false);
  });

  // CSS Selector Resolver
  function getCssSelector(el) {
    if (!(el instanceof Element)) return '';
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += `#${el.id}`;
        path.unshift(selector);
        break;
      } else {
        let sibling = el;
        let nth = 1;
        while ((sibling = sibling.previousElementSibling)) {
          if (sibling.nodeName.toLowerCase() === selector) nth++;
        }
        if (el.className && typeof el.className === 'string') {
          const classes = el.className
            .trim()
            .split(/\s+/)
            .filter((c) => c && !c.startsWith('vp-') && !c.startsWith('dev-annotator'))
            .slice(0, 2);
          if (classes.length) selector += `.${classes.join('.')}`;
        }
        if (nth !== 1) selector += `:nth-of-type(${nth})`;
      }
      path.unshift(selector);
      el = el.parentElement;
      if (path.length > 3) break;
    }
    return path.join(' > ');
  }

  // Framework Introspection Client (Stamped Token Protocol)
  // Stamping occurs strictly on Pin Click to avoid layout thrashing during hover
  async function resolveComponentSource(el) {
    if (!el || !(el instanceof Element)) return { component: null, sourceFile: null };

    // 1. Direct Attributes Check
    const directComp = el.getAttribute('data-component');
    const directFile = el.getAttribute('data-source-file');
    if (directComp || directFile) {
      return { component: directComp || null, sourceFile: directFile || null };
    }

    // 2. Dispatch Stamped Token Protocol to Main World (bridge-main.js)
    const token = `vp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    el.setAttribute('data-vp-token', token);

    return new Promise((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          document.removeEventListener('visualpatch:res-meta', handler);
          el.removeAttribute('data-vp-token');
          resolve({ component: null, sourceFile: null });
        }
      }, 150);

      function handler(e) {
        if (e.detail && e.detail.token === token) {
          resolved = true;
          clearTimeout(timeoutId);
          document.removeEventListener('visualpatch:res-meta', handler);
          el.removeAttribute('data-vp-token');
          const meta = e.detail.meta || {};
          resolve({
            component: meta.component || null,
            sourceFile: meta.sourceFile || null,
            framework: meta.framework || null
          });
        }
      }

      document.addEventListener('visualpatch:res-meta', handler);
      document.dispatchEvent(new CustomEvent('visualpatch:req-meta', { detail: { token } }));
    });
  }

  // Native Chromium GPU Tab Capture & Physical DPR Canvas Cropper
  // Clean Master Frame Buffer (CMFB) — In-Memory Clean Viewport Cache
  let masterFrameBuffer = null; // { dataUrl, img, scrollX, scrollY, innerWidth, innerHeight, timestamp }

  async function getOrCaptureCleanFrame() {
    const now = Date.now();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    // Use cached clean master buffer if un-scrolled and captured within 2500ms
    if (
      masterFrameBuffer &&
      masterFrameBuffer.img &&
      now - masterFrameBuffer.timestamp < 2500 &&
      masterFrameBuffer.scrollX === scrollX &&
      masterFrameBuffer.scrollY === scrollY &&
      masterFrameBuffer.innerWidth === window.innerWidth &&
      masterFrameBuffer.innerHeight === window.innerHeight
    ) {
      return masterFrameBuffer.img;
    }

    // 100% Ghost-Free Frame: Detach all open cards and hide all VisualPatch layers
    cardsContainer.innerHTML = '';
    host.style.visibility = 'hidden';
    if (pinsContainer) pinsContainer.style.visibility = 'hidden';
    if (highlighter) highlighter.style.visibility = 'hidden';
    if (marqueeBox) marqueeBox.style.visibility = 'hidden';

    // Wait 1 frame + macrotask for Blink style/layout and Viz compositor commit
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

    return new Promise((resolve) => {
      let resolved = false;

      // 1000ms Watchdog: UI will NEVER freeze or hang
      const watchdog = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          host.style.visibility = 'visible';
          if (pinsContainer) pinsContainer.style.visibility = 'visible';
          if (highlighter) highlighter.style.visibility = 'visible';
          if (marqueeBox) marqueeBox.style.visibility = 'visible';
          resolve(null);
        }
      }, 1000);

      chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, (response) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(watchdog);

        host.style.visibility = 'visible';
        if (pinsContainer) pinsContainer.style.visibility = 'visible';
        if (highlighter) highlighter.style.visibility = 'visible';
        if (marqueeBox) marqueeBox.style.visibility = 'visible';

        if (!response || !response.success || !response.dataUrl) {
          return resolve(null);
        }

        const img = new Image();
        img.onload = () => {
          masterFrameBuffer = {
            dataUrl: response.dataUrl,
            img: img,
            scrollX,
            scrollY,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            timestamp: Date.now()
          };
          resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = response.dataUrl;
      });
    });
  }

  // Crop element or box from clean frame buffer
  async function cropFromCleanFrame(cropBox) {
    if (!cropBox || typeof cropBox.width !== 'number' || cropBox.width <= 0) return null;

    try {
      const img = await getOrCaptureCleanFrame();
      if (!img) return null;

      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;

      // Scale factor between physical GPU pixels and CSS viewport pixels
      const scaleX = imgW / window.innerWidth;
      const scaleY = imgH / window.innerHeight;

      const pad = Math.round(6 * scaleX);
      const sx = Math.max(0, Math.floor(cropBox.x * scaleX) - pad);
      const sy = Math.max(0, Math.floor(cropBox.y * scaleY) - pad);
      const sw = Math.min(imgW - sx, Math.ceil(cropBox.width * scaleX) + pad * 2);
      const sh = Math.min(imgH - sy, Math.ceil(cropBox.height * scaleY) + pad * 2);

      if (sw <= 0 || sh <= 0) return null;

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      return canvas.toDataURL('image/png');
    } catch (e) {
      return null;
    }
  }

  // Backwards-compatible alias for element and marquee crops
  async function captureElementAutoSnap(targetElement, cropBox) {
    return await cropFromCleanFrame(cropBox);
  }

  // Convert base64 data URL to pure image/png Blob for Clipboard API
  function dataURLtoPngBlob(dataurl) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            c.toBlob((blob) => resolve(blob), 'image/png');
          } else {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = dataurl;
      } catch (e) {
        resolve(null);
      }
    });
  }

  // Stitch multiple pin screenshots into a single composite dark-mode image strip
  async function createCompositeScreenshotBlob(items) {
    const screenshotItems = items.filter(
      (item) => item.screenshot && item.screenshot.startsWith('data:image/')
    );
    if (!screenshotItems.length) return null;

    if (screenshotItems.length === 1) {
      return await dataURLtoPngBlob(screenshotItems[0].screenshot);
    }

    const loadedImages = await Promise.all(
      screenshotItems.map((item) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({
            item,
            img,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
          });
          img.onerror = () => resolve(null);
          img.src = item.screenshot;
        });
      })
    );

    const valid = loadedImages.filter(Boolean);
    if (!valid.length) return null;

    const padding = 16;
    const headerHeight = 32;
    const itemGap = 16;
    const MAX_ITEM_HEIGHT = 380;

    const maxImgWidth = Math.max(...valid.map((v) => v.width), 480);
    const canvasWidth = Math.min(maxImgWidth + padding * 2, 1200);

    let totalHeight = padding;
    valid.forEach((v) => {
      const scale = Math.min(1, (canvasWidth - padding * 2) / v.width, MAX_ITEM_HEIGHT / v.height);
      const scaledH = Math.round(v.height * scale);
      totalHeight += headerHeight + 6 + scaledH + itemGap;
    });
    totalHeight += padding - itemGap;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    // Hard ceiling at 8,192px to prevent exceeding Chromium Skia 16,384px texture limit
    canvas.height = Math.min(totalHeight, 8192);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#0b0d11';
    ctx.fillRect(0, 0, canvasWidth, canvas.height);

    let currentY = padding;
    valid.forEach((v, index) => {
      if (currentY + headerHeight >= canvas.height) return;
      const itemNum = v.item.number || index + 1;
      const label = v.item.component ? `<${v.item.component}>` : (v.item.selector || 'Element');

      // Header bar
      ctx.fillStyle = '#161922';
      ctx.fillRect(padding, currentY, canvasWidth - padding * 2, headerHeight);

      // Badge
      ctx.fillStyle = '#0071e3';
      ctx.fillRect(padding + 6, currentY + 5, 58, headerHeight - 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`PIN #${itemNum}`, padding + 12, currentY + 20);

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
      const cleanLabel = label.length > 60 ? label.slice(0, 57) + '...' : label;
      ctx.fillText(cleanLabel, padding + 72, currentY + 20);

      currentY += headerHeight + 6;

      // Scaled Image
      const scale = Math.min(1, (canvasWidth - padding * 2) / v.width, MAX_ITEM_HEIGHT / v.height);
      const drawW = Math.round(v.width * scale);
      const drawH = Math.round(v.height * scale);
      if (currentY + drawH <= canvas.height) {
        ctx.drawImage(v.img, padding, currentY, drawW, drawH);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(padding, currentY, drawW, drawH);
      }

      currentY += drawH + itemGap;
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  // Write multi-mime ClipboardItem (image/png + text/plain)
  async function copyToClipboardWithImage(md, items) {
    let imageBlob = null;
    try {
      imageBlob = await createCompositeScreenshotBlob(items);
    } catch (e) {}

    let copiedImage = false;

    if (imageBlob && navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([md], { type: 'text/plain' }),
            'image/png': imageBlob
          })
        ]);
        copiedImage = true;
      } catch (clipErr) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': imageBlob
            })
          ]);
          copiedImage = true;
        } catch (e2) {}
      }
    }

    if (!copiedImage) {
      try {
        await navigator.clipboard.writeText(md);
      } catch (e) {}
    }

    return copiedImage;
  }

  // Storage Handlers
  function loadSaved() {
    const storageKey = `visualpatch_notes_${window.location.pathname}`;
    try {
      const data = localStorage.getItem(storageKey);
      if (data) {
        annotations = JSON.parse(data);
        currentPinNumber = annotations.length ? Math.max(...annotations.map((a) => a.number || 1)) + 1 : 1;
        renderPins();
        updateCount();
      }
    } catch (e) {}
  }

  function saveStorage() {
    const storageKey = `visualpatch_notes_${window.location.pathname}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(annotations));
    } catch (e) {}
    updateCount();
  }

  function updateCount() {
    const countBadge = shadow.getElementById('visualpatch-count');
    const agentBadge = shadow.getElementById('visualpatch-agent-count');
    const pillBadge = shadow.getElementById('visualpatch-pill-count');
    const copyBtn = shadow.getElementById('visualpatch-btn-copy');
    const agentBtn = shadow.getElementById('visualpatch-btn-send-agent');

    if (annotations.length > 0) {
      if (countBadge) { countBadge.textContent = annotations.length; countBadge.style.display = 'flex'; }
      if (agentBadge) { agentBadge.textContent = annotations.length; agentBadge.style.display = 'flex'; }
      if (pillBadge) { pillBadge.textContent = annotations.length; pillBadge.style.display = 'inline-flex'; }
      if (copyBtn) copyBtn.classList.add('vp-btn-copy-has-pins');
      if (agentBtn) agentBtn.classList.add('vp-btn-copy-has-pins');
    } else {
      if (countBadge) countBadge.style.display = 'none';
      if (agentBadge) agentBadge.style.display = 'none';
      if (pillBadge) pillBadge.style.display = 'none';
      if (copyBtn) copyBtn.classList.remove('vp-btn-copy-has-pins');
      if (agentBtn) agentBtn.classList.remove('vp-btn-copy-has-pins');
    }
  }

  // Render Document Pin Markers
  function renderPins() {
    if (!pinsContainer || !document.body?.contains(pinsContainer)) {
      pinsContainer = document.getElementById('visualpatch-pins-layer');
      if (!pinsContainer) {
        pinsContainer = document.createElement('div');
        pinsContainer.id = 'visualpatch-pins-layer';
        pinsContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; z-index: 2147483640;';
        document.body?.appendChild(pinsContainer);
      }
    }

    pinsContainer.innerHTML = '';
    annotations.forEach((item) => {
      const pin = document.createElement('div');
      pin.className = 'vp-pin';
      pin.textContent = item.number;
      pin.style.left = `${item.x}px`;
      pin.style.top = `${item.y}px`;
      pin.title = `Pin #${item.number}: ${item.note || 'Click to edit'}`;

      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        openNoteCard(item, pin);
      });

      pinsContainer.appendChild(pin);
    });
  }

  // Open Feedback Note Card
  function openNoteCard(item, pinEl) {
    cardsContainer.innerHTML = '';

    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const clientX = item.x - scrollX;
    const clientY = item.y - scrollY;
    const cardWidth = 380;
    const estimatedHeight = item.screenshot ? 340 : 220;
    const margin = 12;

    let targetX = clientX + 14;
    if (targetX + cardWidth > window.innerWidth - margin) {
      const leftX = clientX - cardWidth - 14;
      targetX = leftX >= margin ? leftX : Math.max(margin, window.innerWidth - cardWidth - margin);
    }
    const cardX = Math.max(margin, Math.min(targetX, window.innerWidth - cardWidth - margin));

    let targetY = clientY - 10;
    const maxAllowedY = Math.max(margin, window.innerHeight - estimatedHeight - margin);
    const cardY = Math.max(margin, Math.min(targetY, maxAllowedY));

    const card = document.createElement('div');
    card.className = 'vp-card';
    card.style.left = `${cardX}px`;
    card.style.top = `${cardY}px`;

    const pinNumStr = item.number < 10 ? `0${item.number}` : item.number;
    const compLabel = item.component ? `&lt;${item.component}&gt;` : `&lt;${item.tag}&gt;`;

    let thumbnailHtml = '';
    if (item.screenshot) {
      if (item.screenshot === 'pending') {
        thumbnailHtml = `
          <div id="vp-thumb-placeholder" style="margin-bottom: 12px; height: 75px; border-radius: 10px; background: rgba(0, 113, 227, 0.08); border: 1px dashed rgba(0, 113, 227, 0.35); display: flex; align-items: center; justify-content: center; gap: 8px; color: #38bdf8; font-size: 11.5px; font-weight: 600;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px #38bdf8;"></span>
            <span>Capturing GPU frame snapshot...</span>
          </div>
        `;
      } else {
        thumbnailHtml = `
          <div class="vp-thumbnail-box">
            <img class="vp-thumbnail-img" id="vp-thumb-img" src="${item.screenshot}" alt="Captured Area" />
            <div class="vp-thumbnail-actions">
              <button class="vp-pill-action-btn" id="vp-btn-zoom">🔍 Zoom</button>
              <button class="vp-pill-action-btn" id="vp-btn-copy-thumb">📋 Copy Img</button>
              <a class="vp-pill-action-btn" href="${item.screenshot}" download="visualpatch-pin-${item.number}.png" style="color: #38bdf8;">💾 PNG</a>
            </div>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div class="vp-card-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="vp-card-pin-pill">
            <span style="width: 5px; height: 5px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8;"></span>
            PIN ${pinNumStr}
          </span>
          <span style="font-size: 11.5px; font-weight: 600; color: #94a3b8; font-family: monospace;">${compLabel}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button class="vp-pill-action-btn" id="vp-btn-resnap" title="Re-capture snapshot" style="font-size: 10.5px; padding: 2px 7px; height: 22px; display: inline-flex; align-items: center; gap: 4px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
            <span>Re-snap</span>
          </button>
          <button class="vp-card-close" id="visualpatch-card-close-btn" title="Close (Esc)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div class="vp-card-preview">
        <span>${item.sourceFile ? `📁 ${item.sourceFile}` : (item.textSnippet ? `"${item.textSnippet}"` : item.selector)}</span>
      </div>

      ${thumbnailHtml}

      <textarea class="vp-textarea" id="visualpatch-note-input" placeholder="Describe the change for AI agent... (Enter to save, Ctrl+Enter to send)">${item.note || ''}</textarea>

      <div class="vp-card-actions">
        <button class="vp-btn-delete" id="visualpatch-btn-del-pin" title="Delete this pin">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Delete</span>
        </button>

        <div class="vp-segmented-capsule">
          <button class="vp-btn-save-draft" id="visualpatch-btn-save-pin" title="Save draft (Enter)">
            <span>Save</span>
            <span style="font-size: 9.5px; opacity: 0.65; font-family: monospace;">↵</span>
          </button>
          <div class="vp-capsule-divider"></div>
          <button class="vp-btn-agent-send" id="visualpatch-btn-card-send-agent" title="Transmit to Agent (Ctrl+Enter)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span>Send to Agent</span>
            <span style="font-size: 8.5px; opacity: 0.85; font-family: monospace; background: rgba(0, 0, 0, 0.25); padding: 1px 3.5px; border-radius: 3px;">Ctrl+↵</span>
          </button>
        </div>
      </div>
    `;

    cardsContainer.appendChild(card);

    if (item.screenshot && item.screenshot !== 'pending') {
      card.querySelector('#vp-btn-zoom')?.addEventListener('click', () => openLightbox(item.screenshot));
      card.querySelector('#vp-thumb-img')?.addEventListener('click', () => openLightbox(item.screenshot));
      card.querySelector('#vp-btn-copy-thumb')?.addEventListener('click', async () => {
        const blob = await dataURLtoPngBlob(item.screenshot);
        if (blob && navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast(`📸 Pin #${item.number} screenshot copied!`);
            return;
          } catch (e) {}
        }
        showToast('Could not copy image');
      });
    }

    // Re-snap Action
    card.querySelector('#vp-btn-resnap')?.addEventListener('click', async () => {
      showToast('Re-capturing GPU frame...');
      const targetEl = item.selector ? document.querySelector(item.selector) : null;
      item.screenshot = 'pending';
      openNoteCard(item, pinEl);
      const snap = await captureElementAutoSnap(targetEl, item.cropBox);
      item.screenshot = snap || null;
      saveStorage();
      renderPins();
      openNoteCard(item, pinEl);
      if (snap) showToast('📸 Snapshot updated');
    });

    const input = card.querySelector('#visualpatch-note-input');
    setTimeout(() => {
      if (input) {
        input.focus();
        input.select();
      }
    }, 40);

    const saveNote = () => {
      if (input) item.note = input.value.trim();
      saveStorage();
      renderPins();
      cardsContainer.innerHTML = '';
      showToast(`Saved Pin #${item.number}`);
    };

    const deleteNote = () => {
      annotations = annotations.filter((a) => a.id !== item.id);
      saveStorage();
      renderPins();
      cardsContainer.innerHTML = '';
      showToast(`Deleted Pin #${item.number}`);
    };

    card.querySelector('#visualpatch-card-close-btn')?.addEventListener('click', () => cardsContainer.innerHTML = '');
    card.querySelector('#visualpatch-btn-save-pin')?.addEventListener('click', saveNote);
    card.querySelector('#visualpatch-btn-del-pin')?.addEventListener('click', deleteNote);
    card.querySelector('#visualpatch-btn-card-send-agent')?.addEventListener('click', () => {
      if (input) item.note = input.value.trim();
      saveStorage();
      sendToAgent();
    });

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          saveNote();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (input) item.note = input.value.trim();
          saveStorage();
          sendToAgent();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cardsContainer.innerHTML = '';
        }
      });
    }
  }

  function toggleInspect(force) {
    mountHost();
    isInspectMode = typeof force === 'boolean' ? force : !isInspectMode;
    const btn = shadow.getElementById('visualpatch-btn-inspect');
    if (isInspectMode) {
      toggleScreenshot(false);
      btn.classList.add('vp-btn-active');
      document.body.style.cursor = 'crosshair';
      if (highlighter) {
        highlighter.style.visibility = 'visible';
      }
      showToast('Inspect Mode Active (D / Alt+D) · Click element to pin');
    } else {
      btn.classList.remove('vp-btn-active');
      highlighter.style.display = 'none';
      document.body.style.cursor = 'default';
      hoveredElement = null;
    }
  }

  function toggleScreenshot(force) {
    mountHost();
    isScreenshotMode = typeof force === 'boolean' ? force : !isScreenshotMode;
    const btn = shadow.getElementById('visualpatch-btn-screenshot');
    if (isScreenshotMode) {
      toggleInspect(false);
      btn.classList.add('vp-btn-active');
      marqueeBackdrop.style.display = 'block';
      showToast('Screenshot Mode (S / Alt+S) · Drag marquee box');
    } else {
      btn.classList.remove('vp-btn-active');
      marqueeBackdrop.style.display = 'none';
      marqueeBox.style.display = 'none';
    }
  }

  // Marquee Area Drag
  marqueeBackdrop.addEventListener('contextmenu', (e) => e.preventDefault());
  marqueeBackdrop.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    isMarqueeDragging = true;
    marqueeStartX = e.clientX;
    marqueeStartY = e.clientY;
    marqueeBox.style.left = `${e.clientX}px`;
    marqueeBox.style.top = `${e.clientY}px`;
    marqueeBox.style.width = '0px';
    marqueeBox.style.height = '0px';
    marqueeBox.style.display = 'block';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isMarqueeDragging || !isScreenshotMode) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    const x = Math.min(marqueeStartX, currentX);
    const y = Math.min(marqueeStartY, currentY);
    const w = Math.abs(currentX - marqueeStartX);
    const h = Math.abs(currentY - marqueeStartY);

    marqueeBox.style.left = `${x}px`;
    marqueeBox.style.top = `${y}px`;
    marqueeBox.style.width = `${w}px`;
    marqueeBox.style.height = `${h}px`;
    marqueeDim.style.bottom = y + h + 38 > window.innerHeight ? '10px' : '-34px';
    marqueeDim.innerHTML = `<span style="width: 5px; height: 5px; border-radius: 50%; background: #38bdf8;"></span><span>${Math.round(w)} × ${Math.round(h)}</span>`;
  });

  window.addEventListener('mouseup', async (e) => {
    if (!isMarqueeDragging || !isScreenshotMode) return;
    isMarqueeDragging = false;
    const currentX = e.clientX;
    const currentY = e.clientY;
    const x = Math.min(marqueeStartX, currentX);
    const y = Math.min(marqueeStartY, currentY);
    const w = Math.abs(currentX - marqueeStartX);
    const h = Math.abs(currentY - marqueeStartY);

    if (w < 15 || h < 15) {
      marqueeBox.style.display = 'none';
      return;
    }

    const cropRect = { x, y, width: w, height: h };
    toggleScreenshot(false);

    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const elementsAtPoint = document.elementsFromPoint ? document.elementsFromPoint(centerX, centerY) : [];
    const el = elementsAtPoint.find((node) => {
      if (!node || node === document.body || node === document.documentElement) return false;
      if (node.id === 'vp-marquee-backdrop' || node.id === 'visualpatch-host' || node.id === 'visualpatch-pins-layer') return false;
      return true;
    }) || document.body;

    const selector = getCssSelector(el);
    const sourceInfo = await resolveComponentSource(el);
    const textSnippet = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80) : '';

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    // Direct GPU Framebuffer Crop for Marquee Box FIRST
    const snap = await cropFromCleanFrame(cropRect);

    const newAnnotation = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      number: currentPinNumber++,
      tag: el.tagName ? el.tagName.toLowerCase() : 'area',
      selector: selector || `area[${w}x${h}]`,
      component: sourceInfo.component,
      sourceFile: sourceInfo.sourceFile,
      textSnippet: textSnippet,
      note: '',
      x: Math.round(x + scrollX + 16),
      y: Math.round(y + scrollY + 16),
      screenshot: snap || null,
      cropBox: cropRect,
      timestamp: new Date().toISOString()
    };

    annotations.push(newAnnotation);
    saveStorage();
    renderPins();

    const pins = pinsContainer.querySelectorAll('.vp-pin');
    const lastPin = pins[pins.length - 1];
    if (lastPin) openNoteCard(newAnnotation, lastPin);
  });

  // Dual Transport AI Agent Bridge (Transmits to backend + copies to clipboard + clears pins)
  async function sendToAgent() {
    const input = shadow.querySelector('#visualpatch-note-input');
    if (input && annotations.length) {
      const last = annotations[annotations.length - 1];
      if (last && !last.note) last.note = input.value.trim();
      saveStorage();
      cardsContainer.innerHTML = '';
    }

    if (!annotations.length) {
      showToast('No annotations yet · Drop pins first');
      return;
    }

    const count = annotations.length;
    showToast(`⚡ Transmitting ${count} item${count > 1 ? 's' : ''} to Agent...`);

    // In-Flight Capture Drain Barrier (SME 2 Audit)
    const pendingItems = annotations.filter((a) => a.screenshot === 'pending');
    if (pendingItems.length > 0) {
      await new Promise((r) => setTimeout(r, 300));
    }

    const payload = {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      items: annotations.map((item) => ({
        number: item.number,
        tag: item.tag,
        selector: item.selector,
        component: item.component || null,
        sourceFile: item.sourceFile || null,
        textSnippet: item.textSnippet,
        note: item.note,
        screenshot: item.screenshot
      }))
    };

    let sent = false;

    // 1. Try local dev-server middleware endpoint (Vite / Next.js)
    try {
      const localRes = await fetch('/__visualpatch_inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (localRes.ok) sent = true;
    } catch (e) {}

    // 2. Try CLI Loopback Bridge (127.0.0.1:44922)
    if (!sent) {
      try {
        const bridgeRes = await fetch('http://127.0.0.1:44922/api/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (bridgeRes.ok) sent = true;
      } catch (e) {}
    }

    // 3. Generate Clean, Token-Efficient Markdown
    let md = `### 📌 VisualPatch UI Task Queue\n`;
    md += `**Source URL:** \`${window.location.href}\`\n`;
    md += `**Total Items:** ${count}\n\n`;

    annotations.forEach((item, index) => {
      const hasSnap = item.screenshot && item.screenshot.startsWith('data:image/');
      md += `#### ${index + 1}. Element: \`${item.selector}\`${hasSnap ? ' 📸 [Snapshot Attached]' : ''}\n`;
      if (item.component) md += `- **Component:** \`<${item.component}>\`\n`;
      if (item.sourceFile) md += `- **Source File:** \`${item.sourceFile}\`\n`;
      if (item.textSnippet) md += `- **Rendered Text:** "${item.textSnippet}"\n`;
      md += `- **Requested Change:** ${item.note || 'Inspect and refine component styling.'}\n\n`;
    });

    // 4. Always write clean Markdown + Image to System Clipboard
    const copiedImage = await copyToClipboardWithImage(md, annotations);

    // Clear annotations only after sending
    annotations = [];
    currentPinNumber = 1;
    masterFrameBuffer = null;
    saveStorage();
    renderPins();
    cardsContainer.innerHTML = '';
    updateCount();

    if (sent) {
      showToast(`⚡ Saved to .visualpatch/inbox.md & cleared!`);
    } else if (copiedImage) {
      showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''}! Paste into AI chat.`);
    } else {
      showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''}!`);
    }
  }

  // Copy Feedback + Images for AI & IMMEDIATELY DELETE PINS (Copy + Delete)
  async function copyForAI() {
    const input = shadow.querySelector('#visualpatch-note-input');
    if (input && annotations.length) {
      const last = annotations[annotations.length - 1];
      if (last && !last.note) last.note = input.value.trim();
      saveStorage();
    }

    if (!annotations.length) {
      showToast('No annotations yet · Drop pins first');
      return;
    }

    const count = annotations.length;
    showToast(`📋 Copying ${count} item${count > 1 ? 's' : ''} to clipboard...`);

    // In-Flight Capture Drain Barrier (SME 2 Audit)
    const pendingItems = annotations.filter((a) => a.screenshot === 'pending');
    if (pendingItems.length > 0) {
      await new Promise((r) => setTimeout(r, 300));
    }

    let md = `### 📌 VisualPatch UI Task Queue\n`;
    md += `**Source URL:** \`${window.location.href}\`\n`;
    md += `**Total Items:** ${count}\n\n`;

    annotations.forEach((item, index) => {
      const hasSnap = item.screenshot && item.screenshot.startsWith('data:image/');
      md += `#### ${index + 1}. Element: \`${item.selector}\`${hasSnap ? ' 📸 [Snapshot Attached]' : ''}\n`;
      if (item.component) md += `- **Component:** \`<${item.component}>\`\n`;
      if (item.sourceFile) md += `- **Source File:** \`${item.sourceFile}\`\n`;
      if (item.textSnippet) md += `- **Rendered Text:** "${item.textSnippet}"\n`;
      md += `- **Requested Change:** ${item.note || 'Inspect and refine component styling.'}\n\n`;
    });

    const copiedImage = await copyToClipboardWithImage(md, annotations);

    // COPY + DELETE: Immediately purge all annotations from memory & disk
    annotations = [];
    currentPinNumber = 1;
    masterFrameBuffer = null;
    saveStorage();
    renderPins();
    cardsContainer.innerHTML = '';
    updateCount();

    if (copiedImage) {
      showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''}! Paste into AI chat.`);
    } else {
      showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''}! Paste into AI chat.`);
    }
  }

  // Hover Outline (Bifurcated: DOM Tag & Dim inspection only, NO token stamping)
  document.addEventListener('mousemove', (e) => {
    if (!isInspectMode || isScreenshotMode) return;
    if (e.target.closest('#visualpatch-host') || e.target.closest('#visualpatch-pins-layer')) return;

    const el = e.target;
    if (!el || el === document.body || el === document.documentElement || el.id === 'root') {
      highlighter.style.display = 'none';
      return;
    }
    if (el === hoveredElement) return;
    hoveredElement = el;

    const rect = el.getBoundingClientRect();
    if (rect.width >= window.innerWidth * 0.98 && rect.height >= window.innerHeight * 0.98) {
      highlighter.style.display = 'none';
      return;
    }

    highlighter.style.visibility = 'visible';
    highlighter.style.display = 'block';
    highlighter.style.left = `${rect.left}px`;
    highlighter.style.top = `${rect.top}px`;
    highlighter.style.width = `${rect.width}px`;
    highlighter.style.height = `${rect.height}px`;
    tagBadge.textContent = `${el.tagName.toLowerCase()} [${Math.round(rect.width)}×${Math.round(rect.height)}]`;
  }, true);

  // Click to Drop Pin (Executes Stamped Token Protocol + GPU Snap)
  document.addEventListener('click', async (e) => {
    if (!isInspectMode || isScreenshotMode) return;
    if (e.target.closest('#visualpatch-host') || e.target.closest('#visualpatch-pins-layer')) return;

    e.preventDefault();
    e.stopPropagation();

    // Immediately hide hover outline so it does not linger or bleed
    highlighter.style.display = 'none';
    hoveredElement = null;

    const el = e.target;
    if (!el || el === document.body || el === document.documentElement || el.id === 'root') return;

    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const pinX = Math.round(e.pageX || rect.left + scrollX + 10);
    const pinY = Math.round(e.pageY || rect.top + scrollY + 10);

    const selector = getCssSelector(el);
    const textSnippet = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80) : '';

    const cropBox = {
      x: Math.max(0, rect.left),
      y: Math.max(0, rect.top),
      width: Math.max(16, rect.width),
      height: Math.max(16, rect.height)
    };

    // 1. Capture clean snapshot FIRST (guarantees cardsContainer.innerHTML = '' cleans old cards and NEVER wipes this card!)
    const snap = await cropFromCleanFrame(cropBox);

    const newAnnotation = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      number: currentPinNumber++,
      tag: el.tagName.toLowerCase(),
      selector: selector,
      component: null,
      sourceFile: null,
      textSnippet: textSnippet,
      note: '',
      x: pinX,
      y: pinY,
      screenshot: snap || null,
      cropBox: cropBox,
      timestamp: new Date().toISOString()
    };

    annotations.push(newAnnotation);
    saveStorage();
    renderPins();

    // 2. Open Note Card IMMEDIATELY on the 1st click with snapshot already attached
    const pins = pinsContainer.querySelectorAll('.vp-pin');
    const targetPinEl = pins[pins.length - 1];
    if (targetPinEl) openNoteCard(newAnnotation, targetPinEl);

    // 3. Resolve framework metadata asynchronously in background
    resolveComponentSource(el).then((info) => {
      if (!annotations.some((a) => a.id === newAnnotation.id)) return;
      newAnnotation.component = info.component || null;
      newAnnotation.sourceFile = info.sourceFile || null;
      saveStorage();
      if (cardsContainer.querySelector('.vp-card')) {
        const preview = cardsContainer.querySelector('.vp-card-preview');
        if (preview && info.sourceFile) {
          preview.innerHTML = `<span>📁 ${info.sourceFile}</span>`;
        }
      }
    });
  }, true);

  // Global Keydown Handler (Refined: Single key 'S', 'A', 'D', 'Esc' enter/exit, full typing shield)
  window.addEventListener('keydown', (e) => {
    const isEsc = e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27;

    if (isEsc) {
      if (lightboxModal.style.display === 'flex') {
        e.preventDefault();
        lightboxModal.style.display = 'none';
        return;
      }
      if (isScreenshotMode) {
        e.preventDefault();
        toggleScreenshot(false);
        showToast('Screenshot mode cancelled');
        return;
      }
      const card = shadow.querySelector('.vp-card');
      if (card) {
        e.preventDefault();
        cardsContainer.innerHTML = '';
        return;
      }
      if (isInspectMode) {
        e.preventDefault();
        toggleInspect(false);
        return;
      }

      // If user is currently typing in an external web input, let Esc blur it
      const activeEl = shadow.activeElement || document.activeElement;
      const isTyping =
        activeEl &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
          activeEl.isContentEditable ||
          activeEl.getAttribute('contenteditable') === 'true' ||
          activeEl.getAttribute('role') === 'textbox' ||
          activeEl.closest?.('.monaco-editor') ||
          activeEl.closest?.('.ace_editor') ||
          activeEl.closest?.('.cm-editor'));
      if (isTyping) return;

      // Esc ENTERS inspect mode when idle!
      e.preventDefault();
      toggleInspect(true);
      return;
    }

    // Ctrl + Enter to Send
    const isEnter = e.key === 'Enter' || e.code === 'Enter';
    if (isEnter && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      sendToAgent();
      return;
    }

    // Strict Typing Shield
    const activeEl = shadow.activeElement || document.activeElement;
    const isTyping =
      activeEl &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
        activeEl.isContentEditable ||
        activeEl.getAttribute('contenteditable') === 'true' ||
        activeEl.getAttribute('role') === 'textbox' ||
        activeEl.closest?.('.monaco-editor') ||
        activeEl.closest?.('.ace_editor') ||
        activeEl.closest?.('.cm-editor'));

    if (isTyping) return;

    // Ctrl + Shift + E: Send to Agent
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyE' || e.key === 'E' || e.key === 'e')) {
      e.preventDefault();
      sendToAgent();
      return;
    }

    // Ctrl + C: Copy Feedback for AI (if no text selected)
    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyC' || e.key === 'c') && !window.getSelection()?.toString().trim() && annotations.length > 0) {
      e.preventDefault();
      copyForAI();
      return;
    }

    // Alt + T: Toggle Dock
    if ((e.altKey && e.code === 'KeyT') || (e.ctrlKey && e.shiftKey && e.code === 'KeyT') || e.key === 'F8') {
      e.preventDefault();
      toggleVisibility();
      return;
    }

    // S key (alone) OR Alt + S: Toggle Screenshot
    const isS = e.code === 'KeyS' || e.key === 's' || e.key === 'S';
    if (!e.ctrlKey && !e.metaKey && (isS || (e.altKey && isS))) {
      e.preventDefault();
      toggleScreenshot();
      return;
    }

    // A key (alone): Send to AI (Send All Pins Directly to Agent)
    const isAKey = e.code === 'KeyA' || e.key === 'a' || e.key === 'A';
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && isAKey) {
      e.preventDefault();
      sendToAgent();
      return;
    }

    // D / I key (alone) OR Alt + D: Toggle Inspect
    const isD = e.code === 'KeyD' || e.key === 'd' || e.key === 'D';
    const isI = e.code === 'KeyI' || e.key === 'i' || e.key === 'I';
    if (!e.ctrlKey && !e.metaKey && (isD || isI || (e.altKey && isD))) {
      e.preventDefault();
      toggleInspect();
      return;
    }
  }, true);

  // Chrome Runtime Message Listener (Popup & Background Commands)
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      mountHost();

      if (request.action === 'PING') {
        sendResponse({ success: true, status: 'OK', version: '2.3.0' });
        return false;
      }
      if (request.action === 'TOGGLE_INSPECT') {
        toggleInspect();
        sendResponse({ success: true, isInspectMode });
        return false;
      }
      if (request.action === 'TOGGLE_SCREENSHOT') {
        toggleScreenshot();
        sendResponse({ success: true, isScreenshotMode });
        return false;
      }
      if (request.action === 'TOGGLE_TOOLBAR' || request.action === 'SHOW_TOOLBAR') {
        toggleVisibility(true);
        sendResponse({ success: true, isVisible });
        return false;
      }
      if (request.action === 'SEND_TO_AGENT') {
        sendToAgent();
        sendResponse({ success: true });
        return false;
      }
    });
  }

  // Toolbar Button Click Handlers
  shadow.getElementById('visualpatch-btn-inspect')?.addEventListener('click', () => toggleInspect());
  shadow.getElementById('visualpatch-btn-screenshot')?.addEventListener('click', () => toggleScreenshot());
  shadow.getElementById('visualpatch-btn-send-agent')?.addEventListener('click', sendToAgent);
  shadow.getElementById('visualpatch-btn-copy')?.addEventListener('click', copyForAI);
  shadow.getElementById('visualpatch-btn-clear')?.addEventListener('click', () => {
    annotations = [];
    currentPinNumber = 1;
    saveStorage();
    renderPins();
    cardsContainer.innerHTML = '';
    showToast('All pins cleared');
  });

  // Auto-mount on Local & Preview URLs, or await user trigger on production
  if (isLocalOrPreview) {
    mountHost();
    loadSaved();
  }

  console.log(
    '%c[VisualPatch v2.3.0] Ready! Native GPU Tab Snap, Main-World Introspector & OS-Level Hotkeys active.',
    'background: #0071e3; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;'
  );
})();
