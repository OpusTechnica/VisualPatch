/**
 * VisualPatch — Universal In-Browser Visual Feedback Tool for AI Coding Assistants
 * Compatible with Claude, Cursor, ChatGPT, Windsurf, Copilot, Antigravity, v0, Devin, etc.
 * Features: Element Inspection, Area Screenshot Marquee Tool, Dynamic Anchors, Linear/Apple Glass UI
 */
(function () {
  const hostname = window.location.hostname || '';
  const port = window.location.port || '';
  const protocol = window.location.protocol || '';

  // Comprehensive dev environment detection (all ports, localhost, loopback, private LAN IPs, dev domains, local files)
  const isLocal =
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
    hostname.includes('ngrok') ||
    hostname.includes('loca.lt') ||
    hostname.includes('trycloudflare.com') ||
    protocol === 'file:';

  if (!isLocal) return;

  if (window.__visualpatch_loaded || window.__visualpatch_in_app_active || document.getElementById('dev-annotator-fixed-root')) return;
  window.__visualpatch_loaded = true;

  // Global State
  let isInspectMode = false;
  let isScreenshotMode = false;
  let isVisible = true;
  let annotations = [];
  let currentPinNumber = 1;
  let hoveredElement = null;
  let currentPos = { x: null, y: null };
  let zoomImageUrl = null;

  // Dragging State
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let initialLeft = 0, initialTop = 0;

  // Marquee Drag State
  let isMarqueeDragging = false;
  let marqueeStartX = 0, marqueeStartY = 0;

  // Viewport Boundary Sanitizer (Prevents off-screen toolbar rendering)
  function sanitizePos(pos) {
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || isNaN(pos.x) || isNaN(pos.y)) {
      return { x: null, y: null };
    }
    const margin = 16;
    const dockWidth = 44;
    const dockHeight = 240;
    const maxX = Math.max(margin, window.innerWidth - dockWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - dockHeight - margin);

    if (pos.x < margin || pos.x > maxX || pos.y < margin || pos.y > maxY) {
      return { x: null, y: null };
    }
    return { x: pos.x, y: pos.y };
  }

  // Load Saved Position & Validate
  try {
    const savedPos = localStorage.getItem('visualpatch_toolbar_pos');
    if (savedPos) currentPos = sanitizePos(JSON.parse(savedPos));
  } catch (e) {
    currentPos = { x: null, y: null };
  }

  // Create Shadow Root Host
  const host = document.createElement('div');
  host.id = 'visualpatch-host';
  host.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 0; pointer-events: none; z-index: 2147483647;';
  
  function mountHost() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountHost, { once: true });
      }
      return;
    }
    if (!document.body.contains(host)) {
      document.body.appendChild(host);
    }
  }
  mountHost();

  // Re-verify mounting after window load & SPA framework hydration
  window.addEventListener('load', mountHost);
  setTimeout(mountHost, 500);
  setTimeout(mountHost, 1500);

  const shadow = host.attachShadow({ mode: 'open' });

  // Inject Shadow DOM Styles
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif;
      -webkit-tap-highlight-color: transparent;
    }

    /* Floating Toolbar (Vertical Obsidian Glass Dock) */
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
      background: rgba(14, 16, 20, 0.94);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 9999px;
      box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      pointer-events: auto;
      user-select: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      touch-action: none;
      width: 38px;
    }

    .vp-toolbar.vp-dragging {
      opacity: 0.94;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.12);
      border-color: #0071e3;
      cursor: grabbing !important;
    }

    /* Drag Handle / Brand Badge */
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

    /* Collapsed Dynamic Island Capsule */
    .vp-collapsed-pill {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 12px;
      background: rgba(14, 16, 20, 0.94);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 9999px;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      cursor: grab;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      pointer-events: auto;
      user-select: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
    }

    .vp-collapsed-pill:hover {
      background: rgba(22, 25, 33, 0.96);
      border-color: rgba(0, 113, 227, 0.4);
    }

    .vp-collapsed-pill:active {
      transform: scale(0.97);
    }

    /* Precision Highlighter */
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

    /* Marquee Area Selection Layer (CleanShot X / macOS Studio Grade) */
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

    /* Pin Marker */
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
    }

    .vp-pin:hover {
      transform: translate(-50%, -50%) scale(1.15);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
    }

    .vp-pin:active {
      transform: translate(-50%, -50%) scale(0.96);
    }

    /* Linear / Apple Glass Modal Card */
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
      height: 100px;
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
      height: 72px;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
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

    .vp-btn-agent-send:active {
      transform: translateY(0);
      box-shadow: 0 2px 10px rgba(0, 113, 227, 0.45);
    }

    /* Zoom Lightbox Modal */
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

    /* Toast */
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

  // Create UI Elements
  const highlighter = document.createElement('div');
  highlighter.className = 'vp-highlighter';
  const tagBadge = document.createElement('div');
  tagBadge.className = 'vp-tag-badge';
  highlighter.appendChild(tagBadge);
  shadow.appendChild(highlighter);

  // Marquee Area Selection Layer
  const marqueeBackdrop = document.createElement('div');
  marqueeBackdrop.className = 'vp-marquee-backdrop';
  const marqueeBox = document.createElement('div');
  marqueeBox.className = 'vp-marquee-box';
  marqueeBox.innerHTML = `
    <div style="position: absolute; top: -2px; left: -2px; width: 8px; height: 8px; border-top: 2.5px solid #0071e3; border-left: 2.5px solid #0071e3;"></div>
    <div style="position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; border-top: 2.5px solid #0071e3; border-right: 2.5px solid #0071e3;"></div>
    <div style="position: absolute; bottom: -2px; left: -2px; width: 8px; height: 8px; border-bottom: 2.5px solid #0071e3; border-left: 2.5px solid #0071e3;"></div>
    <div style="position: absolute; bottom: -2px; right: -2px; width: 8px; height: 8px; border-bottom: 2.5px solid #0071e3; border-right: 2.5px solid #0071e3;"></div>
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 12px; height: 12px; opacity: 0.6; pointer-events: none;">
      <div style="position: absolute; top: 5px; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.75); box-shadow: 0 0 2px rgba(0,0,0,0.8);"></div>
      <div style="position: absolute; left: 5px; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.75); box-shadow: 0 0 2px rgba(0,0,0,0.8);"></div>
    </div>
  `;
  const marqueeDim = document.createElement('div');
  marqueeDim.className = 'vp-marquee-dim';
  marqueeBox.appendChild(marqueeDim);
  marqueeBackdrop.appendChild(marqueeBox);
  shadow.appendChild(marqueeBackdrop);

  // Lightbox Zoom Modal
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

  // Pins Container (Mounted on document.body for true scrolling coordinates)
  let pinsContainer = document.getElementById('visualpatch-pins-layer');
  if (!pinsContainer) {
    pinsContainer = document.createElement('div');
    pinsContainer.id = 'visualpatch-pins-layer';
    pinsContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; z-index: 2147483640;';
    document.body.appendChild(pinsContainer);
  }

  const cardsContainer = document.createElement('div');
  shadow.appendChild(cardsContainer);

  const toast = document.createElement('div');
  toast.className = 'vp-toast';
  shadow.appendChild(toast);

  function showToast(msg) {
    toast.innerHTML = `<span style="width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8;"></span><span>${msg}</span>`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // Create Full Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'vp-toolbar';
  toolbar.id = 'visualpatch-main-toolbar';
  if (currentPos.x !== null && currentPos.y !== null) {
    toolbar.style.left = `${currentPos.x}px`;
    toolbar.style.top = `${currentPos.y}px`;
    toolbar.style.right = 'auto';
    toolbar.style.bottom = 'auto';
  }
  toolbar.innerHTML = `
    <div class="vp-brand-badge" id="visualpatch-brand-btn" title="Drag to move toolbar anywhere">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="display: block;">
        <path d="M3 9V3H9" stroke="#0071E3" stroke-width="2.8" stroke-linecap="square"/>
        <path d="M21 15V21H15" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="square"/>
        <path d="M7 8L12 17L17 8" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="12" y1="9.5" x2="12" y2="12.5" stroke="#0071E3" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="10.5" y1="11" x2="13.5" y2="11" stroke="#0071E3" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </div>
    <div style="width: 16px; height: 1px; background: rgba(255, 255, 255, 0.08); margin: 2px 0;"></div>
    <button class="vp-btn-icon" id="visualpatch-btn-inspect" title="Inspect & Drop Pin (Esc / Alt+D)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="22" y1="12" x2="18" y2="12" />
        <line x1="6" y1="12" x2="2" y2="12" />
        <line x1="12" y1="6" x2="12" y2="2" />
        <line x1="12" y1="22" x2="12" y2="18" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-screenshot" title="Take Area Screenshot (Press S)">
      <svg width="14.5" height="14.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-send-agent" title="⚡ Send to Agent Inbox (Ctrl+Enter)" style="color: #ffffff;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <span class="vp-badge-count" id="visualpatch-agent-count" style="display: none; background: #ffffff; color: #0071e3;">0</span>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-copy" title="Copy annotations for AI (Ctrl+C)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span class="vp-badge-count" id="visualpatch-count" style="display: none;">0</span>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-clear" title="Clear all pins on this page">
      <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-minimize" title="Hide toolbar (Alt+T)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  `;
  shadow.appendChild(toolbar);

  // Collapsed Dynamic Island Capsule
  const collapsedPill = document.createElement('div');
  collapsedPill.className = 'vp-collapsed-pill';
  collapsedPill.style.display = 'none';
  if (currentPos.x !== null && currentPos.y !== null) {
    collapsedPill.style.left = `${currentPos.x}px`;
    collapsedPill.style.top = `${currentPos.y}px`;
    collapsedPill.style.right = 'auto';
    collapsedPill.style.bottom = 'auto';
  }
  collapsedPill.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="display: block;">
      <path d="M3 9V3H9" stroke="#0071E3" stroke-width="2.8" stroke-linecap="square"/>
      <path d="M21 15V21H15" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="square"/>
      <path d="M7 8L12 17L17 8" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="12" y1="9.5" x2="12" y2="12.5" stroke="#0071E3" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="10.5" y1="11" x2="13.5" y2="11" stroke="#0071E3" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
    <span style="font-size: 11px; font-weight: 700; letter-spacing: -0.01em;">VisualPatch</span>
    <span class="vp-badge-count" id="visualpatch-pill-count" style="display: none; position: static; margin-left: 2px;">0</span>
  `;
  shadow.appendChild(collapsedPill);

  // Drag Handling for Toolbar
  const brandBtn = shadow.getElementById('visualpatch-brand-btn');

  function onMouseDown(e) {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = toolbar.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    toolbar.classList.add('vp-dragging');

    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp, { once: true });
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    const rect = toolbar.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;

    const newLeft = Math.max(8, Math.min(initialLeft + deltaX, maxX));
    const newTop = Math.max(8, Math.min(initialTop + deltaY, maxY));

    toolbar.style.left = `${newLeft}px`;
    toolbar.style.top = `${newTop}px`;
    toolbar.style.right = 'auto';
    toolbar.style.bottom = 'auto';

    collapsedPill.style.left = `${newLeft}px`;
    collapsedPill.style.top = `${newTop}px`;
    collapsedPill.style.right = 'auto';
    collapsedPill.style.bottom = 'auto';

    currentPos = { x: newLeft, y: newTop };
    try {
      localStorage.setItem('visualpatch_toolbar_pos', JSON.stringify(currentPos));
    } catch (err) {}
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    toolbar.classList.remove('vp-dragging');
    window.removeEventListener('mousemove', onMouseMove);
  }

  brandBtn.addEventListener('mousedown', onMouseDown);

  // Drag & Click for Collapsed Pill
  collapsedPill.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    let hasMoved = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = collapsedPill.getBoundingClientRect();
    const initX = rect.left;
    const initY = rect.top;

    const onPillMove = (moveEvt) => {
      const dist = Math.hypot(moveEvt.clientX - startX, moveEvt.clientY - startY);
      if (dist > 3) {
        hasMoved = true;
        const deltaX = moveEvt.clientX - startX;
        const deltaY = moveEvt.clientY - startY;
        const maxX = window.innerWidth - rect.width - 8;
        const maxY = window.innerHeight - rect.height - 8;
        const newX = Math.max(8, Math.min(initX + deltaX, maxX));
        const newY = Math.max(8, Math.min(initY + deltaY, maxY));

        collapsedPill.style.left = `${newX}px`;
        collapsedPill.style.top = `${newY}px`;
        collapsedPill.style.right = 'auto';
        collapsedPill.style.bottom = 'auto';

        toolbar.style.left = `${newX}px`;
        toolbar.style.top = `${newY}px`;
        toolbar.style.right = 'auto';
        toolbar.style.bottom = 'auto';

        currentPos = { x: newX, y: newY };
        try {
          localStorage.setItem('visualpatch_toolbar_pos', JSON.stringify(currentPos));
        } catch (err) {}
      }
    };

    const onPillUp = () => {
      window.removeEventListener('mousemove', onPillMove);
      window.removeEventListener('mouseup', onPillUp);
      if (!hasMoved) {
        toggleVisibility(true);
      }
    };

    window.addEventListener('mousemove', onPillMove);
    window.addEventListener('mouseup', onPillUp, { once: true });
    e.preventDefault();
  });

  // Toggle Visibility
  function toggleVisibility(force) {
    isVisible = typeof force === 'boolean' ? force : !isVisible;
    if (isVisible) {
      toolbar.style.display = 'inline-flex';
      collapsedPill.style.display = 'none';
      showToast('Toolbar Visible (Alt+T to toggle)');
    } else {
      toolbar.style.display = 'none';
      collapsedPill.style.display = 'inline-flex';
      showToast('Toolbar Collapsed (Alt+T to unhide)');
    }
  }

  shadow.getElementById('visualpatch-btn-minimize').addEventListener('click', () => toggleVisibility(false));

  // Helper: Get unique CSS selector
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
          const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('vp-')).slice(0, 2);
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

  // Helper: Resolve React/Vue Component Name & Source File (Zero-Token Precision Grounding)
  function getComponentSourceInfo(el) {
    if (!el || !(el instanceof Element)) return { component: null, sourceFile: null };

    let component = null;
    let sourceFile = null;

    if (el.getAttribute('data-source-file')) sourceFile = el.getAttribute('data-source-file');
    if (el.getAttribute('data-component')) component = el.getAttribute('data-component');

    try {
      const fiberKey = Object.keys(el).find(
        (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
      );
      if (fiberKey) {
        let fiber = el[fiberKey];
        while (fiber) {
          if (fiber._debugSource && !sourceFile) {
            const fn = fiber._debugSource.fileName || '';
            const line = fiber._debugSource.lineNumber;
            const cleanPath = fn.replace(/^.*[\\\/](src[\\\/].*)$/, '$1').replace(/\\/g, '/');
            sourceFile = line ? `${cleanPath}#L${line}` : cleanPath;
          }

          if (typeof fiber.type === 'function' && !component) {
            const name = fiber.type.displayName || fiber.type.name;
            if (name && !['Anonymous', 'Fragment', 'Consumer', 'Provider', 'Context'].includes(name)) {
              component = name;
            }
          } else if (typeof fiber.type === 'string' && !component && fiber._debugOwner) {
            const ownerName = fiber._debugOwner.type?.displayName || fiber._debugOwner.type?.name;
            if (ownerName) component = ownerName;
          }

          if (component && sourceFile) break;
          fiber = fiber.return;
        }
      }
    } catch (err) {}

    if ((!component || !sourceFile) && el.parentElement && el.parentElement !== document.body) {
      const parentInfo = getComponentSourceInfo(el.parentElement);
      if (!component) component = parentInfo.component;
      if (!sourceFile) sourceFile = parentInfo.sourceFile;
    }

    return { component, sourceFile };
  }

  // Load Saved Annotations from Storage
  function loadSaved() {
    const storageKey = `visualpatch_notes_${window.location.pathname}`;
    try {
      const data = localStorage.getItem(storageKey);
      if (data) {
        annotations = JSON.parse(data);
        currentPinNumber = annotations.length ? Math.max(...annotations.map(a => a.number)) + 1 : 1;
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
      countBadge.textContent = annotations.length;
      countBadge.style.display = 'flex';
      if (agentBadge) {
        agentBadge.textContent = annotations.length;
        agentBadge.style.display = 'flex';
      }
      pillBadge.textContent = annotations.length;
      pillBadge.style.display = 'inline-flex';
      copyBtn.classList.add('vp-btn-copy-has-pins');
      if (agentBtn) agentBtn.classList.add('vp-btn-copy-has-pins');
    } else {
      countBadge.style.display = 'none';
      if (agentBadge) agentBadge.style.display = 'none';
      pillBadge.style.display = 'none';
      copyBtn.classList.remove('vp-btn-copy-has-pins');
      if (agentBtn) agentBtn.classList.remove('vp-btn-copy-has-pins');
    }
  }

  // Render Pins in Document Layer
  function renderPins() {
    pinsContainer.innerHTML = '';
    annotations.forEach((item) => {
      const pin = document.createElement('div');
      pin.className = item.screenshot ? 'vp-pin vp-pin-screenshot' : 'vp-pin';
      pin.textContent = item.number;
      pin.style.left = `${item.x}px`;
      pin.style.top = `${item.y}px`;
      pin.title = `Pin #${item.number}${item.screenshot ? ' (📸 Screenshot Attached)' : ''}: ${item.note || 'Click to edit'}`;

      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        openNoteCard(item, pin);
      });

      pinsContainer.appendChild(pin);
    });
  }

  // Helper: Convert DataURL to Blob
  function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  // Native GPU Tab Capture: 0ms DOM lag, captures directly from Chromium C++ GPU frame buffer
  async function captureAreaNative(cropBox) {
    const roots = [
      host,
      pinsContainer,
      document.getElementById('visualpatch-host'),
      document.getElementById('visualpatch-pins-layer'),
      document.getElementById('dev-annotator-fixed-root'),
      document.getElementById('dev-annotator-pins-root')
    ].filter(Boolean);

    // Hide overlays BEFORE triggering the tab capture
    roots.forEach((r) => (r.style.visibility = 'hidden'));

    const restoreRoots = () => {
      roots.forEach((r) => (r.style.visibility = 'visible'));
    };

    // Safety timer: restore visibility in at most 80ms
    const timer = setTimeout(restoreRoots, 80);

    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, (response) => {
            clearTimeout(timer);
            restoreRoots();

            if (!response || !response.success || !response.dataUrl) {
              resolve(null);
              return;
            }

            const dpr = window.devicePixelRatio || 1;
            const img = new Image();
            img.onload = () => {
              const cropCanvas = document.createElement('canvas');
              cropCanvas.width = Math.max(1, Math.round(cropBox.width * dpr));
              cropCanvas.height = Math.max(1, Math.round(cropBox.height * dpr));
              const ctx = cropCanvas.getContext('2d', { alpha: false });

              ctx.drawImage(
                img,
                Math.round(cropBox.x * dpr), Math.round(cropBox.y * dpr),
                Math.round(cropBox.width * dpr), Math.round(cropBox.height * dpr),
                0, 0,
                cropCanvas.width, cropCanvas.height
              );

              resolve(cropCanvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = () => resolve(null);
            img.src = response.dataUrl;
          });
        } else {
          clearTimeout(timer);
          restoreRoots();
          resolve(null);
        }
      } catch (err) {
        clearTimeout(timer);
        restoreRoots();
        resolve(null);
      }
    });
  }

  // Open Linear-Style Note Card anchored naturally around the pin, constrained inside viewport
  function openNoteCard(item, pinEl) {
    cardsContainer.innerHTML = '';

    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const clientX = item.x - scrollX;
    const clientY = item.y - scrollY;
    const cardWidth = 380;
    const estimatedHeight = item.screenshot ? 340 : 220;
    const margin = 12;

    // 1. Horizontal: Place 14px to the right of pin; if it overflows right screen edge, flip to left of pin
    let targetX = clientX + 14;
    if (targetX + cardWidth > window.innerWidth - margin) {
      const leftX = clientX - cardWidth - 14;
      targetX = leftX >= margin ? leftX : Math.max(margin, window.innerWidth - cardWidth - margin);
    }
    const cardX = Math.max(margin, Math.min(targetX, window.innerWidth - cardWidth - margin));

    // 2. Vertical: Align top of card with pin (clientY - 10), then gently clamp to stay fully in viewport
    let targetY = clientY - 10;
    const maxAllowedY = Math.max(margin, window.innerHeight - estimatedHeight - margin);
    const cardY = Math.max(margin, Math.min(targetY, maxAllowedY));

    const card = document.createElement('div');
    card.className = 'vp-card';
    card.style.left = `${cardX}px`;
    card.style.top = `${cardY}px`;

    const pinNumStr = item.number < 10 ? `0${item.number}` : item.number;

    let thumbnailHtml = '';
    if (item.screenshot) {
      if (item.screenshot === 'pending') {
        thumbnailHtml = `
          <div id="vp-thumb-placeholder" style="margin-bottom: 12px; height: 75px; border-radius: 10px; background: rgba(0, 113, 227, 0.08); border: 1px dashed rgba(0, 113, 227, 0.35); display: flex; align-items: center; justify-content: center; gap: 8px; color: #38bdf8; font-size: 11.5px; font-weight: 600;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px #38bdf8;"></span>
            <span>Processing area snapshot...</span>
          </div>
        `;
      } else {
        thumbnailHtml = `
          <div class="vp-thumbnail-box">
            <img class="vp-thumbnail-img" id="vp-thumb-img" src="${item.screenshot}" alt="Captured Area" />
            <div class="vp-thumbnail-actions">
              <button class="vp-pill-action-btn" id="vp-btn-zoom">🔍 Zoom</button>
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
          ${item.component ? `
            <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); padding: 1px 6px; borderRadius: 4px; font-family: monospace;">
              &lt;${item.component} /&gt;
            </span>
          ` : `
            <span style="font-size: 11.5px; font-weight: 600; color: #94a3b8; font-family: monospace;">&lt;${item.tag}&gt;</span>
          `}
        </div>
        <button class="vp-card-close" id="visualpatch-card-close-btn" title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="vp-card-preview" style="font-size: 11px; font-family: monospace;">
        ${item.sourceFile ? `<span style="color: #38bdf8; margin-right: 6px;">📄 ${item.sourceFile}</span>` : ''}
        <span>${item.textSnippet ? `"${item.textSnippet}"` : item.selector}</span>
      </div>

      ${thumbnailHtml}

      <textarea class="vp-textarea" id="visualpatch-note-input" placeholder="What change would you like here?... (Enter to save, Shift+Enter for new line)">${item.note || ''}</textarea>

      <div class="vp-card-actions">
        <button class="vp-btn-delete" id="visualpatch-btn-del-pin" title="Delete this pin">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Delete</span>
        </button>

        <div class="vp-segmented-capsule">
          <button class="vp-btn-save-draft" id="visualpatch-btn-save-pin" title="Save draft locally (Enter)">
            <span>Save</span>
            <span style="font-size: 9.5px; opacity: 0.65; font-family: monospace;">↵</span>
          </button>
          <div class="vp-capsule-divider"></div>
          <button class="vp-btn-agent-send" id="visualpatch-btn-card-send-agent" title="Transmit to Agent Inbox (Ctrl+Enter)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="flex-shrink: 0;">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span>Send to Agent</span>
            <span style="font-size: 8.5px; opacity: 0.85; font-family: monospace; background: rgba(0, 0, 0, 0.25); padding: 1px 3.5px; border-radius: 3px; letter-spacing: 0.02em; flex-shrink: 0;">Ctrl+↵</span>
          </button>
        </div>
      </div>
    `;

    cardsContainer.appendChild(card);

    if (item.screenshot && item.screenshot !== 'pending') {
      card.querySelector('#vp-btn-zoom').addEventListener('click', () => openLightbox(item.screenshot));
      card.querySelector('#vp-thumb-img').addEventListener('click', () => openLightbox(item.screenshot));
    }

    const input = card.querySelector('#visualpatch-note-input');
    setTimeout(() => {
      input.focus();
      input.select();
    }, 40);

    const saveNote = () => {
      item.note = input.value.trim();
      saveStorage();
      renderPins();
      cardsContainer.innerHTML = '';
      showToast(`Saved Pin #${item.number}`);
    };

    const deleteNote = () => {
      annotations = annotations.filter(a => a.id !== item.id);
      saveStorage();
      renderPins();
      cardsContainer.innerHTML = '';
      showToast(`Deleted Pin #${item.number}`);
    };

    card.querySelector('#visualpatch-card-close-btn').addEventListener('click', () => cardsContainer.innerHTML = '');
    card.querySelector('#visualpatch-btn-cancel-pin').addEventListener('click', () => cardsContainer.innerHTML = '');
    card.querySelector('#visualpatch-btn-save-pin').addEventListener('click', saveNote);
    card.querySelector('#visualpatch-btn-del-pin').addEventListener('click', deleteNote);
    card.querySelector('#visualpatch-btn-card-send-agent').addEventListener('click', () => {
      item.note = input.value.trim();
      saveStorage();
      sendToAgent();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveNote();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cardsContainer.innerHTML = '';
      }
    });
  }

  // Toggle Inspect Mode
  function toggleInspect(force) {
    isInspectMode = typeof force === 'boolean' ? force : !isInspectMode;
    const btn = shadow.getElementById('visualpatch-btn-inspect');
    if (isInspectMode) {
      toggleScreenshot(false);
      btn.classList.add('vp-btn-active');
      document.body.style.cursor = 'crosshair';
      showToast('Inspect Mode Active · Click element to pin (Esc to exit)');
    } else {
      btn.classList.remove('vp-btn-active');
      highlighter.style.display = 'none';
      document.body.style.cursor = 'default';
    }
  }

  // Toggle Screenshot Marquee Mode (Option 2)
  function toggleScreenshot(force) {
    isScreenshotMode = typeof force === 'boolean' ? force : !isScreenshotMode;
    const btn = shadow.getElementById('visualpatch-btn-screenshot');
    if (isScreenshotMode) {
      toggleInspect(false);
      btn.classList.add('vp-btn-active');
      marqueeBackdrop.style.display = 'block';
      showToast('Area Screenshot Mode · Hold Right or Left mouse button to drag (Esc to cancel)');
    } else {
      btn.classList.remove('vp-btn-active');
      marqueeBackdrop.style.display = 'none';
      marqueeBox.style.display = 'none';
    }
  }

  // Marquee Drag Events (Right-Click or Left-Click Hold)
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

    marqueeDim.style.bottom = (y + h + 38 > window.innerHeight) ? '10px' : '-34px';
    marqueeDim.innerHTML = `<span style="width: 5px; height: 5px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8;"></span><span>${Math.round(w)} × ${Math.round(h)}</span><span style="font-size: 9px; opacity: 0.6; letter-spacing: 0.04em;">PX</span>`;
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

    // Detect underlying element (filtering out VisualPatch overlays)
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const elementsAtPoint = document.elementsFromPoint ? document.elementsFromPoint(centerX, centerY) : [];
    const el = elementsAtPoint.find((node) => {
      if (!node || node === document.body || node === document.documentElement) return false;
      if (
        node.id === 'vp-marquee-backdrop' ||
        node.id === 'visualpatch-host' ||
        node.id === 'visualpatch-pins-layer' ||
        node.id === 'dev-annotator-fixed-root' ||
        node.closest?.('#visualpatch-host') ||
        node.closest?.('#visualpatch-pins-layer') ||
        node.closest?.('#dev-annotator-fixed-root') ||
        node.closest?.('#dev-annotator-pins-root')
      ) return false;
      return true;
    }) || document.body;
    const selector = getCssSelector(el);
    const sourceInfo = getComponentSourceInfo(el);
    const textSnippet = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80) : '';

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const pinX = Math.round(x + scrollX + 16);
    const pinY = Math.round(y + scrollY + 16);

    // 1. Capture snapshot immediately while DOM is 100% clean (zero cards, zero popups)
    const screenshotDataUrl = await captureAreaNative(cropRect);

    const newId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newAnnotation = {
      id: newId,
      number: currentPinNumber++,
      tag: el.tagName ? el.tagName.toLowerCase() : 'area',
      selector: selector || `area[${w}x${h}]`,
      component: sourceInfo.component,
      sourceFile: sourceInfo.sourceFile,
      textSnippet: textSnippet,
      note: '',
      x: pinX,
      y: pinY,
      screenshot: screenshotDataUrl || null,
      timestamp: new Date().toISOString()
    };

    // 2. Register annotation and render pin
    annotations.push(newAnnotation);
    saveStorage();
    renderPins();

    // 3. Open note card with clean screenshot already attached and ready
    const pins = pinsContainer.querySelectorAll('.vp-pin');
    const lastPin = pins[pins.length - 1];
    if (lastPin) openNoteCard(newAnnotation, lastPin);

    showToast(`📸 Area pinned (#${newAnnotation.number})`);
  });

  // Helper: Create a single auto-stitched composite image strip for multiple screenshots
  // Helper: Convert any data URL to pure image/png Blob for Clipboard API
  function dataURLtoPngBlob(dataurl) {
    return new Promise((resolve) => {
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
    });
  }

  // Helper: Create a single auto-stitched composite image strip for multiple screenshots
  async function createCompositeScreenshotBlob(items) {
    const screenshotItems = items.filter(
      (item) => item.screenshot && item.screenshot.startsWith('data:image/')
    );
    if (!screenshotItems.length) return null;

    if (screenshotItems.length === 1) {
      try {
        const singlePng = await dataURLtoPngBlob(screenshotItems[0].screenshot);
        if (singlePng) return singlePng;
      } catch (e) {}
    }

    const loadedImages = await Promise.all(
      screenshotItems.map((item) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve({ item, img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
          img.onerror = () => resolve(null);
          img.src = item.screenshot;
        });
      })
    );

    const valid = loadedImages.filter(Boolean);
    if (!valid.length) return null;

    const padding = 20;
    const headerHeight = 34;
    const itemGap = 20;

    const maxImgWidth = Math.max(...valid.map((v) => v.width), 480);
    const canvasWidth = maxImgWidth + padding * 2;

    let totalHeight = padding;
    valid.forEach((v) => {
      totalHeight += headerHeight + 8 + v.height + itemGap;
    });
    totalHeight += padding - itemGap;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, canvasWidth, totalHeight);

    let currentY = padding;
    valid.forEach((v, index) => {
      const itemNum = v.item.number || index + 1;
      const selector = v.item.selector || 'Element';

      // Header Bar Background
      ctx.fillStyle = '#171922';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(padding, currentY, canvasWidth - padding * 2, headerHeight, 6);
      } else {
        ctx.rect(padding, currentY, canvasWidth - padding * 2, headerHeight);
      }
      ctx.fill();

      // Badge Pill (#1 / #2)
      ctx.fillStyle = '#0071e3';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(padding + 8, currentY + 6, 64, headerHeight - 12, 4);
      } else {
        ctx.rect(padding + 8, currentY + 6, 64, headerHeight - 12);
      }
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`PIN #${itemNum}`, padding + 15, currentY + 21);

      // Selector Monospace
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      const cleanSelector = selector.length > 55 ? selector.slice(0, 52) + '...' : selector;
      ctx.fillText(cleanSelector, padding + 82, currentY + 21);

      currentY += headerHeight + 8;

      // Draw Screenshot Image
      ctx.drawImage(v.img, padding, currentY, v.width, v.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, currentY, v.width, v.height);

      currentY += v.height + itemGap;
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  // Copy Formatted Markdown to Clipboard & auto-clear to avoid duplication
  async function copyForAI() {
    if (!annotations.length) {
      showToast('No annotations yet · Drop pins first');
      return;
    }

    const count = annotations.length;
    let payload = `### 📌 VisualPatch Feedback from Localhost Preview\n`;
    payload += `**URL:** \`${window.location.href}\`\n`;
    payload += `**Total Items:** ${count}\n\n`;

    annotations.forEach((item, index) => {
      payload += `#### ${index + 1}. Element: \`${item.selector}\`${item.screenshot ? ' 📸 [Area Screenshot Attached]' : ''}\n`;
      if (item.textSnippet) payload += `- **Current Content:** "${item.textSnippet}"\n`;
      payload += `- **Requested Change:** ${item.note || 'No specific note added'}\n\n`;
    });

    try {
      const compositeBlob = await createCompositeScreenshotBlob(annotations);
      if (compositeBlob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([payload], { type: 'text/plain' }),
            'image/png': compositeBlob
          })
        ]);
        annotations = [];
        currentPinNumber = 1;
        saveStorage();
        renderPins();
        cardsContainer.innerHTML = '';
        showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''} (+ screenshot strip)!`);
        return;
      }
    } catch (e) {}

    navigator.clipboard.writeText(payload).then(() => {
      annotations = [];
      currentPinNumber = 1;
      saveStorage();
      renderPins();
      cardsContainer.innerHTML = '';
      showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''}! Paste into AI chat.`);
    }).catch(() => {
      annotations = [];
      currentPinNumber = 1;
      saveStorage();
      renderPins();
      cardsContainer.innerHTML = '';
      showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''}!`);
    });
  }

  // Direct 0-Token AI Agent Bridge (Saves images to disk & populates agent inbox)
  async function sendToAgent() {
    const input = shadow.querySelector('#visualpatch-note-input');
    if (input && annotations.length) {
      const last = annotations[annotations.length - 1];
      if (last && !last.note) last.note = input.value.trim();
      saveStorage();
      cardsContainer.innerHTML = '';
    }

    if (!annotations.length) {
      showToast('No annotations yet · Drop pins or capture areas first');
      return;
    }

    const count = annotations.length;
    showToast(`⚡ Transmitting ${count} item${count > 1 ? 's' : ''} to Agent...`);

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

    // 1. Try sending to Local Loopback Agent Bridge (127.0.0.1:44922)
    try {
      const bridgeRes = await fetch('http://127.0.0.1:44922/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (bridgeRes.ok) sent = true;
    } catch (e) {}

    // 2. Try sending to Dev Server Middleware
    if (!sent) {
      try {
        const devRes = await fetch('/__visualpatch_inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (devRes.ok) sent = true;
      } catch (e) {}
    }

    // 3. Fallback: Copy clean Markdown + screenshot strip to clipboard
    let md = `### 📌 VisualPatch UI Task Queue\n`;
    md += `**Source URL:** \`${window.location.href}\`\n`;
    md += `**Total Items:** ${count}\n\n`;

    annotations.forEach((item, index) => {
      md += `#### ${index + 1}. Element: \`${item.selector}\`${item.screenshot ? ' 📸 [Area Screenshot Attached]' : ''}\n`;
      if (item.component) md += `- **React Component:** \`<${item.component}>\`\n`;
      if (item.sourceFile) md += `- **Source File:** \`${item.sourceFile}\`\n`;
      if (item.textSnippet) md += `- **Rendered Text:** "${item.textSnippet}"\n`;
      md += `- **Requested Change:** ${item.note || 'Inspect and refine component styling/layout.'}\n\n`;
    });

    try {
      const compositeBlob = await createCompositeScreenshotBlob(annotations);
      if (compositeBlob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([md], { type: 'text/plain' }),
            'image/png': compositeBlob
          })
        ]);
      } else {
        await navigator.clipboard.writeText(md);
      }
    } catch (e) {
      try { await navigator.clipboard.writeText(md); } catch (err) {}
    }

    annotations = [];
    currentPinNumber = 1;
    saveStorage();
    renderPins();
    cardsContainer.innerHTML = '';

    if (sent) {
      showToast(`⚡ Ingested into .visualpatch/inbox.md! Check agent.`);
    } else {
      showToast(`📋 Copied for AI (+ saved to clipboard)`);
    }
  }

  // DOM Event Listeners for Inspection & Pin Drop
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
    if (rect.width >= window.innerWidth * 0.96 && rect.height >= window.innerHeight * 0.96) {
      highlighter.style.display = 'none';
      return;
    }

    highlighter.style.display = 'block';
    highlighter.style.left = `${rect.left}px`;
    highlighter.style.top = `${rect.top}px`;
    highlighter.style.width = `${rect.width}px`;
    highlighter.style.height = `${rect.height}px`;

    tagBadge.textContent = `${el.tagName.toLowerCase()} [${Math.round(rect.width)}×${Math.round(rect.height)}]`;
  }, true);

  document.addEventListener('click', (e) => {
    if (!isInspectMode || isScreenshotMode) return;
    if (e.target.closest('#visualpatch-host') || e.target.closest('#visualpatch-pins-layer')) return;

    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    if (!el || el === document.body || el === document.documentElement || el.id === 'root') return;

    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const pinX = Math.round(e.pageX || rect.left + scrollX + 10);
    const pinY = Math.round(e.pageY || rect.top + scrollY + 10);

    const selector = getCssSelector(el);
    const sourceInfo = getComponentSourceInfo(el);
    const textSnippet = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80) : '';

    const newAnnotation = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      number: currentPinNumber++,
      tag: el.tagName.toLowerCase(),
      selector: selector,
      component: sourceInfo.component,
      sourceFile: sourceInfo.sourceFile,
      textSnippet: textSnippet,
      note: '',
      x: pinX,
      y: pinY,
      screenshot: null,
      timestamp: new Date().toISOString()
    };

    annotations.push(newAnnotation);
    saveStorage();
    renderPins();

    setTimeout(() => {
      const pins = pinsContainer.querySelectorAll('.vp-pin');
      const lastPin = pins[pins.length - 1];
      if (lastPin) openNoteCard(newAnnotation, lastPin);
    }, 40);
  }, true);

  // Global Keyboard Shortcuts (Capture Phase)
  window.addEventListener('keydown', (e) => {
    const isEsc = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape' || e.keyCode === 27;

    // Instant Escape Handling
    if (isEsc) {
      e.preventDefault();
      e.stopPropagation();

      if (lightboxModal.style.display === 'flex') {
        lightboxModal.style.display = 'none';
        return;
      }

      if (isScreenshotMode) {
        toggleScreenshot(false);
        showToast('Screenshot mode cancelled');
        return;
      }

      const card = shadow.querySelector('.vp-card');
      if (card) {
        cardsContainer.innerHTML = '';
        return;
      }

      toggleInspect();
      return;
    }

    // Ctrl + Enter / Cmd + Enter: Instant Send to Agent (Even while typing in note card!)
    const isEnterKey = e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13;
    if (isEnterKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      sendToAgent();
      return;
    }

    const activeEl = shadow.activeElement || document.activeElement;
    const isTyping = activeEl && (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
      activeEl.isContentEditable ||
      activeEl.getAttribute('contenteditable') === 'true' ||
      activeEl.getAttribute('role') === 'textbox'
    );

    // Ctrl + C / Cmd + C / Alt + C shortcut to copy feedback
    const isCopyKey = (e.key === 'c' || e.key === 'C' || e.code === 'KeyC') && (e.ctrlKey || e.metaKey || e.altKey);
    if (isCopyKey) {
      const hasSelection = window.getSelection() && window.getSelection().toString().trim().length > 0;
      if (!hasSelection && !isTyping) {
        e.preventDefault();
        copyForAI();
        return;
      }
    }

    if (isTyping) return;

    if ((e.altKey && e.code === 'KeyT') || (e.ctrlKey && e.shiftKey && e.code === 'KeyT') || e.key === 'F8') {
      e.preventDefault();
      toggleVisibility();
    }

    if ((e.altKey && e.code === 'KeyD') || (e.altKey && e.code === 'KeyA') || (e.ctrlKey && e.shiftKey && e.code === 'KeyD') || e.key === 'F9') {
      e.preventDefault();
      toggleInspect();
    }

    // Area Screenshot Mode Shortcut: Just "S" key (or Alt + S / F7)
    const isScreenshotKey =
      !e.ctrlKey &&
      !e.metaKey &&
      (
        e.key?.toLowerCase() === 's' ||
        e.code === 'KeyS' ||
        e.keyCode === 83 ||
        e.key === 'F7' ||
        (e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS'))
      );

    if (isScreenshotKey) {
      e.preventDefault();
      toggleScreenshot();
    }
  }, true);

  // Toolbar Button Click Handlers
  shadow.getElementById('visualpatch-btn-inspect').addEventListener('click', () => toggleInspect());
  shadow.getElementById('visualpatch-btn-screenshot').addEventListener('click', () => toggleScreenshot());
  shadow.getElementById('visualpatch-btn-send-agent').addEventListener('click', sendToAgent);
  shadow.getElementById('visualpatch-btn-copy').addEventListener('click', copyForAI);
  shadow.getElementById('visualpatch-btn-clear').addEventListener('click', () => {
    if (annotations.length) {
      annotations = [];
      currentPinNumber = 1;
      saveStorage();
      renderPins();
      cardsContainer.innerHTML = '';
      showToast('All pins cleared');
    }
  });

  // Dynamic Resize Boundary Check (Keep toolbar in viewport)
  window.addEventListener('resize', () => {
    if (currentPos.x !== null && currentPos.y !== null) {
      const safe = sanitizePos(currentPos);
      if (safe.x === null) {
        currentPos = { x: null, y: null };
        toolbar.style.left = 'auto';
        toolbar.style.top = 'auto';
        toolbar.style.right = '24px';
        toolbar.style.bottom = '24px';
        try { localStorage.removeItem('visualpatch_toolbar_pos'); } catch (e) {}
      } else {
        toolbar.style.left = `${safe.x}px`;
        toolbar.style.top = `${safe.y}px`;
      }
    }
  });

  // Direct Chrome Extension Message Listener
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (req.action === 'SHOW_TOOLBAR' || req.action === 'TOGGLE_TOOLBAR') {
        toggleVisibility(true);
        if (req.resetPosition || currentPos.x === null || currentPos.x > window.innerWidth || currentPos.y > window.innerHeight) {
          currentPos = { x: null, y: null };
          toolbar.style.left = 'auto';
          toolbar.style.top = 'auto';
          toolbar.style.right = '24px';
          toolbar.style.bottom = '24px';
          try { localStorage.removeItem('visualpatch_toolbar_pos'); } catch (e) {}
        }
        sendResponse({ success: true, isVisible: true });
      } else if (req.action === 'TOGGLE_INSPECT') {
        toggleInspect();
        sendResponse({ success: true, isInspectMode });
      } else if (req.action === 'TOGGLE_SCREENSHOT') {
        toggleScreenshot();
        sendResponse({ success: true, isScreenshotMode });
      } else if (req.action === 'SEND_TO_AGENT') {
        sendToAgent();
        sendResponse({ success: true });
      }
      return true;
    });
  }

  // Initialize
  loadSaved();
  console.log('%c[VisualPatch] Ready! Shortcuts: Esc / Alt+D (Inspect) · Alt+S (Screenshot Area) · Ctrl+C (Copy) · Alt+T (Toolbar)', 'background: #0071e3; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
})();
