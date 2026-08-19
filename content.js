/**
 * VisualPatch — Universal In-Browser Visual Feedback Tool for AI Coding Assistants
 * Compatible with Claude, Cursor, ChatGPT, Windsurf, Copilot, Antigravity, v0, Devin, etc.
 * Features: Element Inspection, Area Screenshot Marquee Tool, Dynamic Anchors, Linear/Apple Glass UI
 */
(function () {
  const isLocal = ['localhost', '127.0.0.1', '0.0.0.0', '::1', ''].includes(window.location.hostname) || 
                  window.location.hostname.endsWith('.local') || 
                  window.location.hostname.endsWith('.internal') ||
                  window.location.hostname === 'localhost' ||
                  window.location.port !== '';
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

  // Load Saved Position
  try {
    const savedPos = localStorage.getItem('visualpatch_toolbar_pos');
    if (savedPos) currentPos = JSON.parse(savedPos);
  } catch (e) {}

  // Create Shadow Root Host
  const host = document.createElement('div');
  host.id = 'visualpatch-host';
  host.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 0; pointer-events: none; z-index: 2147483647;';
  
  function mountHost() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', mountHost);
      return;
    }
    document.body.appendChild(host);
  }
  mountHost();

  const shadow = host.attachShadow({ mode: 'open' });

  // Inject Shadow DOM Styles
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
    }

    /* Floating Toolbar (Linear Glass Dock) */
    .vp-toolbar {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      background: rgba(12, 14, 18, 0.92);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 9999px;
      box-shadow: 0 16px 40px -6px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 16px rgba(0, 113, 227, 0.18);
      color: #f7f8f8;
      pointer-events: auto;
      user-select: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      touch-action: none;
    }

    .vp-toolbar.vp-dragging {
      opacity: 0.92;
      box-shadow: 0 20px 48px rgba(0, 113, 227, 0.6);
      border-color: #0071e3;
      cursor: grabbing !important;
    }

    /* Drag Handle / Brand Badge */
    .vp-brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      cursor: grab;
      transition: background-color 0.15s ease;
    }

    .vp-brand-badge:hover {
      background-color: rgba(255, 255, 255, 0.09);
    }

    .vp-brand-badge:active {
      cursor: grabbing;
    }

    .vp-drag-dots {
      opacity: 0.65;
      display: flex;
      align-items: center;
    }

    .vp-brand-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #38bdf8;
      box-shadow: 0 0 8px #38bdf8;
      flex-shrink: 0;
    }

    .vp-btn-icon {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 1px solid transparent;
      background: rgba(255, 255, 255, 0.04);
      color: #cbd5e1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }

    .vp-btn-icon:hover {
      transform: scale(1.08);
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .vp-btn-icon:active {
      transform: scale(0.94);
    }

    .vp-btn-active {
      background: rgba(0, 113, 227, 0.28) !important;
      border-color: #0071e3 !important;
      color: #38bdf8 !important;
      box-shadow: 0 0 12px rgba(0, 113, 227, 0.45);
    }

    .vp-btn-copy-has-pins {
      background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%) !important;
      border-color: rgba(0, 113, 227, 0.5) !important;
      color: #ffffff !important;
      box-shadow: 0 2px 10px rgba(0, 113, 227, 0.4);
    }

    .vp-badge-count {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 9999px;
      background: #ffffff;
      color: #0071e3;
      font-size: 9.5px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
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
      background: rgba(12, 14, 18, 0.92);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(0, 113, 227, 0.45);
      border-radius: 9999px;
      color: #ffffff;
      font-size: 11.5px;
      font-weight: 700;
      cursor: grab;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7), 0 0 14px rgba(0, 113, 227, 0.3);
      pointer-events: auto;
      user-select: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .vp-collapsed-pill:hover {
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 113, 227, 0.5);
    }

    /* Precision Highlighter */
    .vp-highlighter {
      position: fixed;
      border: 2px solid #0071e3;
      background: transparent;
      box-shadow: 0 0 0 1px rgba(0, 113, 227, 0.45), inset 0 0 0 1px rgba(0, 113, 227, 0.25);
      border-radius: 6px;
      pointer-events: none;
      z-index: 2147483640;
      transition: all 0.05s ease;
      display: none;
    }

    .vp-tag-badge {
      position: absolute;
      top: -24px;
      left: -2px;
      background: rgba(15, 17, 21, 0.94);
      border: 1px solid rgba(0, 113, 227, 0.5);
      color: #38bdf8;
      font-size: 10.5px;
      font-weight: 600;
      font-family: monospace;
      padding: 2px 7px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      backdrop-filter: blur(8px);
    }

    /* Marquee Area Selection Layer (CleanShot X / macOS Studio Grade) */
    .vp-marquee-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
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
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6), 0 0 0 99999px rgba(0, 0, 0, 0.52), 0 12px 40px rgba(0, 113, 227, 0.25);
      border-radius: 2px;
      pointer-events: none;
      display: none;
    }

    .vp-marquee-dim {
      position: absolute;
      bottom: -34px;
      right: 0;
      background: rgba(10, 12, 16, 0.92);
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 9999px;
      color: #f8fafc;
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      padding: 3px 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    /* Pin Marker */
    .vp-pin {
      position: absolute;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 4px 16px rgba(0, 113, 227, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 4px rgba(0, 113, 227, 0.25);
      cursor: pointer;
      z-index: 2147483642;
      pointer-events: auto;
      transform: translate(-50%, -50%);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
    }

    .vp-pin.vp-pin-screenshot {
      background: linear-gradient(135deg, #38bdf8 0%, #0071e3 100%);
      box-shadow: 0 4px 16px rgba(56, 189, 248, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 4px rgba(56, 189, 248, 0.3);
    }

    .vp-pin:hover {
      transform: translate(-50%, -50%) scale(1.18);
    }

    /* Linear / Apple Glass Modal Card */
    .vp-card {
      position: fixed;
      width: 345px;
      background: rgba(14, 16, 20, 0.96);
      backdrop-filter: blur(28px) saturate(190%);
      -webkit-backdrop-filter: blur(28px) saturate(190%);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 16px;
      box-shadow: 0 28px 56px -10px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 24px rgba(0, 113, 227, 0.22);
      color: #f7f8f8;
      padding: 16px 18px;
      z-index: 2147483648;
      pointer-events: auto;
      user-select: none;
      animation: vp-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes vp-pop {
      from { transform: scale(0.96) translateY(6px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }

    .vp-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .vp-card-pin-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 9999px;
      background: rgba(0, 113, 227, 0.22);
      border: 1px solid rgba(0, 113, 227, 0.45);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 700;
      font-family: monospace;
      letter-spacing: 0.02em;
    }

    .vp-card-close {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      cursor: pointer;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .vp-card-close:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.12);
    }

    .vp-card-preview {
      font-size: 11.5px;
      color: #cbd5e1;
      margin-bottom: 10px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 7px 10px;
      border-radius: 8px;
      border-left: 3px solid #0071e3;
      font-family: monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .vp-thumbnail-box {
      position: relative;
      margin-bottom: 12px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(0, 113, 227, 0.4);
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
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
      top: 6px;
      right: 6px;
      display: flex;
      gap: 4px;
    }

    .vp-pill-action-btn {
      padding: 3px 7px;
      border-radius: 5px;
      background: rgba(12, 14, 18, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      backdrop-filter: blur(8px);
    }

    .vp-textarea {
      width: 100%;
      height: 76px;
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      color: #ffffff;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.45;
      resize: vertical;
      outline: none;
      margin-bottom: 14px;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.6);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .vp-textarea:focus {
      border-color: #0071e3;
      box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.45), inset 0 2px 4px rgba(0, 0, 0, 0.6);
    }

    .vp-card-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .vp-btn-delete {
      padding: 6px 11px;
      border-radius: 8px;
      border: 1px solid rgba(239, 68, 68, 0.25);
      background: rgba(239, 68, 68, 0.08);
      color: #f87171;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
    }

    .vp-btn-delete:hover {
      background: rgba(239, 68, 68, 0.18);
      border-color: rgba(239, 68, 68, 0.45);
    }

    .vp-btn-save {
      padding: 6px 14px;
      border-radius: 8px;
      border: none;
      background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%) !important;
      color: #ffffff !important;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 10px rgba(0, 113, 227, 0.45);
      transition: all 0.15s ease;
    }

    .vp-btn-save:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(0, 113, 227, 0.6);
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
      background: #0f1115;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 32px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(0, 113, 227, 0.3);
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
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-10px);
      background: rgba(12, 14, 18, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      padding: 7px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 113, 227, 0.3);
      z-index: 2147483647;
      pointer-events: none;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      opacity: 0;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
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
      <div class="vp-drag-dots">
        <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
          <circle cx="2" cy="2" r="1" fill="#ffffff" />
          <circle cx="6" cy="2" r="1" fill="#ffffff" />
          <circle cx="2" cy="6" r="1" fill="#ffffff" />
          <circle cx="6" cy="6" r="1" fill="#ffffff" />
          <circle cx="2" cy="10" r="1" fill="#ffffff" />
          <circle cx="6" cy="10" r="1" fill="#ffffff" />
        </svg>
      </div>
      <span class="vp-brand-dot"></span>
      <span style="font-weight: 800; font-size: 11px;">V</span>
    </div>
    <div style="width: 1px; height: 18px; background: rgba(255, 255, 255, 0.1); margin: 0 2px;"></div>
    <button class="vp-btn-icon" id="visualpatch-btn-inspect" title="Inspect & Drop Pin (Esc / Alt+D)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="22" y1="12" x2="18" y2="12" />
        <line x1="6" y1="12" x2="2" y2="12" />
        <line x1="12" y1="6" x2="12" y2="2" />
        <line x1="12" y1="22" x2="12" y2="18" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-screenshot" title="Take Area Screenshot (Press S)">
      <svg width="14.5" height="14.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-copy" title="Copy annotations for AI (Ctrl+C)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span class="vp-badge-count" id="visualpatch-count" style="display: none;">0</span>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-clear" title="Clear all pins on this page">
      <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
    <button class="vp-btn-icon" id="visualpatch-btn-minimize" title="Hide toolbar (Alt+T)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
    <span class="vp-brand-dot"></span>
    <span>V</span>
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
    const pillBadge = shadow.getElementById('visualpatch-pill-count');
    const copyBtn = shadow.getElementById('visualpatch-btn-copy');

    if (annotations.length > 0) {
      countBadge.textContent = annotations.length;
      countBadge.style.display = 'flex';
      pillBadge.textContent = annotations.length;
      pillBadge.style.display = 'inline-flex';
      copyBtn.classList.add('vp-btn-copy-has-pins');
    } else {
      countBadge.style.display = 'none';
      pillBadge.style.display = 'none';
      copyBtn.classList.remove('vp-btn-copy-has-pins');
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
      document.getElementById('dev-annotator-fixed-root'),
      document.getElementById('dev-annotator-pins-root')
    ].filter(Boolean);

    // Ensure elements are unhidden in at most 60ms even if extension message is pending
    const timer = setTimeout(() => {
      roots.forEach(r => r.style.visibility = 'visible');
    }, 60);

    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, (response) => {
            clearTimeout(timer);
            roots.forEach(r => r.style.visibility = 'visible');

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
          roots.forEach(r => r.style.visibility = 'visible');
          resolve(null);
        }
      } catch (err) {
        clearTimeout(timer);
        roots.forEach(r => r.style.visibility = 'visible');
        resolve(null);
      }
    });
  }

  // Open Linear-Style Note Card
  function openNoteCard(item, pinEl) {
    cardsContainer.innerHTML = '';

    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const cardX = Math.min(Math.max(item.x - scrollX + 16, 20), window.innerWidth - 360);
    const cardY = Math.min(Math.max(item.y - scrollY - 20, 20), window.innerHeight - 380);

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
          <span style="font-size: 11.5px; font-weight: 600; color: #94a3b8; font-family: monospace;">&lt;${item.tag}&gt;</span>
        </div>
        <button class="vp-card-close" id="visualpatch-card-close-btn" title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="vp-card-preview">
        ${item.textSnippet ? `"${item.textSnippet}"` : item.selector}
      </div>

      ${thumbnailHtml}

      <textarea class="vp-textarea" id="visualpatch-note-input" placeholder="What change would you like here?... (Enter to save, Shift+Enter for new line)">${item.note || ''}</textarea>

      <div class="vp-card-actions">
        <button class="vp-btn-delete" id="visualpatch-btn-del-pin" title="Delete this pin">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Delete</span>
        </button>

        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="vp-card-close" id="visualpatch-btn-cancel-pin" style="width: auto; height: auto; padding: 6px 11px; border-radius: 8px; font-size: 12px;">Cancel</button>
          <button class="vp-btn-save" id="visualpatch-btn-save-pin">
            <span>Save Pin</span>
            <span style="font-size: 10px; opacity: 0.8; font-family: monospace; background: rgba(255,255,255,0.2); padding: 1px 4px; border-radius: 4px;">↵</span>
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

  window.addEventListener('mouseup', (e) => {
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
    const textSnippet = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80) : '';

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const pinX = Math.round(x + scrollX + 16);
    const pinY = Math.round(y + scrollY + 16);

    const newId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newAnnotation = {
      id: newId,
      number: currentPinNumber++,
      tag: el.tagName ? el.tagName.toLowerCase() : 'area',
      selector: selector || `area[${w}x${h}]`,
      textSnippet: textSnippet,
      note: '',
      x: pinX,
      y: pinY,
      screenshot: 'pending',
      timestamp: new Date().toISOString()
    };

    // 1. Instant 0ms UI update
    annotations.push(newAnnotation);
    saveStorage();
    renderPins();

    setTimeout(() => {
      const pins = pinsContainer.querySelectorAll('.vp-pin');
      const lastPin = pins[pins.length - 1];
      if (lastPin) openNoteCard(newAnnotation, lastPin);
    }, 30);

    showToast(`📸 Area pinned (#${newAnnotation.number})`);

    // 2. Perform snapshot asynchronously without freezing the UI
    setTimeout(async () => {
      const screenshotDataUrl = await captureAreaNative(cropRect);
      if (screenshotDataUrl) {
        newAnnotation.screenshot = screenshotDataUrl;
        saveStorage();
        renderPins();

        // Update placeholder if card is currently open for this item
        const placeholder = cardsContainer.querySelector('#vp-thumb-placeholder');
        if (placeholder) {
          const thumbBox = document.createElement('div');
          thumbBox.className = 'vp-thumbnail-box';
          thumbBox.innerHTML = `
            <img class="vp-thumbnail-img" id="vp-thumb-img" src="${screenshotDataUrl}" alt="Captured Area" />
            <div class="vp-thumbnail-actions">
              <button class="vp-pill-action-btn" id="vp-btn-zoom">🔍 Zoom</button>
              <a class="vp-pill-action-btn" href="${screenshotDataUrl}" download="visualpatch-pin-${newAnnotation.number}.png" style="color: #38bdf8;">💾 PNG</a>
            </div>
          `;
          placeholder.replaceWith(thumbBox);
          thumbBox.querySelector('#vp-btn-zoom').addEventListener('click', () => openLightbox(screenshotDataUrl));
          thumbBox.querySelector('#vp-thumb-img').addEventListener('click', () => openLightbox(screenshotDataUrl));
        }
      }
    }, 20);
  });

  // Helper: Create a single auto-stitched composite image strip for multiple screenshots
  async function createCompositeScreenshotBlob(items) {
    const screenshotItems = items.filter(
      (item) => item.screenshot && item.screenshot.startsWith('data:image/')
    );
    if (!screenshotItems.length) return null;

    if (screenshotItems.length === 1) {
      try {
        return dataURLtoBlob(screenshotItems[0].screenshot);
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
    const textSnippet = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80) : '';

    const newAnnotation = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      number: currentPinNumber++,
      tag: el.tagName.toLowerCase(),
      selector: selector,
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

  // Initialize
  loadSaved();
  console.log('%c[VisualPatch] Ready! Shortcuts: Esc / Alt+D (Inspect) · Alt+S (Screenshot Area) · Ctrl+C (Copy) · Alt+T (Toolbar)', 'background: #0071e3; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
})();
