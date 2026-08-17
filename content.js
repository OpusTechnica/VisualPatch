/**
 * Pinpoint AI — Universal In-Browser Visual Feedback Tool for AI Coding Assistants
 * Compatible with Claude, Cursor, ChatGPT, Antigravity, Copilot, Windsurf, v0, Devin, etc.
 * Designed with a Linear + Apple-Inspired Obsidian Glass Aesthetic
 */
(function () {
  const isLocal = ['localhost', '127.0.0.1', '0.0.0.0', '::1', ''].includes(window.location.hostname) || 
                  window.location.hostname.endsWith('.local') || 
                  window.location.hostname.endsWith('.internal') ||
                  window.location.hostname === 'localhost' ||
                  window.location.port !== '';
  if (!isLocal) return;

  if (window.__pinpoint_loaded || window.__pinpoint_in_app_active || document.getElementById('dev-annotator-fixed-root')) return;
  window.__pinpoint_loaded = true;

  // Global State
  let isInspectMode = false;
  let isVisible = true;
  let annotations = [];
  let currentPinNumber = 1;
  let hoveredElement = null;
  let currentPos = { x: null, y: null };

  // Dragging State
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let initialLeft = 0, initialTop = 0;

  // Load Saved Position
  try {
    const savedPos = localStorage.getItem('pinpoint_toolbar_pos');
    if (savedPos) currentPos = JSON.parse(savedPos);
  } catch (e) {}

  // Create Shadow Root Host
  const host = document.createElement('div');
  host.id = 'pinpoint-host';
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
    .pinpoint-toolbar {
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

    .pinpoint-toolbar.pinpoint-dragging {
      opacity: 0.92;
      box-shadow: 0 20px 48px rgba(0, 113, 227, 0.6);
      border-color: #0071e3;
      cursor: grabbing !important;
    }

    /* Drag Handle / Brand Badge */
    .pinpoint-brand-badge {
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

    .pinpoint-brand-badge:hover {
      background-color: rgba(255, 255, 255, 0.09);
    }

    .pinpoint-brand-badge:active {
      cursor: grabbing;
    }

    .pinpoint-drag-dots {
      opacity: 0.65;
      display: flex;
      align-items: center;
    }

    .pinpoint-brand-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #38bdf8;
      box-shadow: 0 0 8px #38bdf8;
      flex-shrink: 0;
    }

    .pinpoint-btn-icon {
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

    .pinpoint-btn-icon:hover {
      transform: scale(1.08);
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .pinpoint-btn-icon:active {
      transform: scale(0.94);
    }

    .pinpoint-btn-inspect-active {
      background: rgba(0, 113, 227, 0.28) !important;
      border-color: #0071e3 !important;
      color: #38bdf8 !important;
      box-shadow: 0 0 12px rgba(0, 113, 227, 0.45);
    }

    .pinpoint-btn-copy-has-pins {
      background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%) !important;
      border-color: rgba(0, 113, 227, 0.5) !important;
      color: #ffffff !important;
      box-shadow: 0 2px 10px rgba(0, 113, 227, 0.4);
    }

    .pinpoint-badge-count {
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
    .pinpoint-collapsed-pill {
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

    .pinpoint-collapsed-pill:hover {
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 113, 227, 0.5);
    }

    /* Precision Highlighter */
    .pinpoint-highlighter {
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

    .pinpoint-tag-badge {
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

    /* Pin Marker */
    .pinpoint-pin {
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

    .pinpoint-pin:hover {
      transform: translate(-50%, -50%) scale(1.15);
      box-shadow: 0 6px 20px rgba(0, 113, 227, 0.7), 0 0 0 2px #ffffff, 0 0 0 5px rgba(0, 113, 227, 0.4);
    }

    /* Linear / Apple Glass Modal Card */
    .pinpoint-card {
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
      animation: pinpoint-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes pinpoint-pop {
      from { transform: scale(0.96) translateY(6px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }

    .pinpoint-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .pinpoint-card-pin-pill {
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

    .pinpoint-card-close {
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

    .pinpoint-card-close:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.12);
    }

    .pinpoint-card-preview {
      font-size: 11.5px;
      color: #cbd5e1;
      margin-bottom: 12px;
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

    .pinpoint-textarea {
      width: 100%;
      height: 80px;
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

    .pinpoint-textarea:focus {
      border-color: #0071e3;
      box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.45), inset 0 2px 4px rgba(0, 0, 0, 0.6);
    }

    .pinpoint-card-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .pinpoint-btn-delete {
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

    .pinpoint-btn-delete:hover {
      background: rgba(239, 68, 68, 0.18);
      border-color: rgba(239, 68, 68, 0.45);
    }

    .pinpoint-btn-save {
      padding: 6px 14px;
      border-radius: 8px;
      border: none;
      background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 10px rgba(0, 113, 227, 0.45);
      transition: all 0.15s ease;
    }

    .pinpoint-btn-save:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(0, 113, 227, 0.6);
    }

    /* Toast */
    .pinpoint-toast {
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

    .pinpoint-toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  `;
  shadow.appendChild(styleEl);

  // Create UI Elements
  const highlighter = document.createElement('div');
  highlighter.className = 'pinpoint-highlighter';
  const tagBadge = document.createElement('div');
  tagBadge.className = 'pinpoint-tag-badge';
  highlighter.appendChild(tagBadge);
  shadow.appendChild(highlighter);

  // Pins Container (Mounted on document.body for true scrolling coordinates)
  let pinsContainer = document.getElementById('pinpoint-pins-layer');
  if (!pinsContainer) {
    pinsContainer = document.createElement('div');
    pinsContainer.id = 'pinpoint-pins-layer';
    pinsContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; z-index: 2147483640;';
    document.body.appendChild(pinsContainer);
  }

  const cardsContainer = document.createElement('div');
  shadow.appendChild(cardsContainer);

  const toast = document.createElement('div');
  toast.className = 'pinpoint-toast';
  shadow.appendChild(toast);

  function showToast(msg) {
    toast.innerHTML = `<span style="width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8;"></span><span>${msg}</span>`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // Create Full Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'pinpoint-toolbar';
  toolbar.id = 'pinpoint-main-toolbar';
  if (currentPos.x !== null && currentPos.y !== null) {
    toolbar.style.left = `${currentPos.x}px`;
    toolbar.style.top = `${currentPos.y}px`;
    toolbar.style.right = 'auto';
    toolbar.style.bottom = 'auto';
  }
  toolbar.innerHTML = `
    <div class="pinpoint-brand-badge" id="pinpoint-brand-btn" title="Drag to move toolbar anywhere">
      <div class="pinpoint-drag-dots">
        <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
          <circle cx="2" cy="2" r="1" fill="#ffffff" />
          <circle cx="6" cy="2" r="1" fill="#ffffff" />
          <circle cx="2" cy="6" r="1" fill="#ffffff" />
          <circle cx="6" cy="6" r="1" fill="#ffffff" />
          <circle cx="2" cy="10" r="1" fill="#ffffff" />
          <circle cx="6" cy="10" r="1" fill="#ffffff" />
        </svg>
      </div>
      <span class="pinpoint-brand-dot"></span>
      <span style="font-weight: 800; font-size: 11px;">P</span>
    </div>
    <div style="width: 1px; height: 18px; background: rgba(255, 255, 255, 0.1); margin: 0 2px;"></div>
    <button class="pinpoint-btn-icon" id="pinpoint-btn-inspect" title="Inspect & Drop Pin (Alt+D)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="22" y1="12" x2="18" y2="12" />
        <line x1="6" y1="12" x2="2" y2="12" />
        <line x1="12" y1="6" x2="12" y2="2" />
        <line x1="12" y1="22" x2="12" y2="18" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
    <button class="pinpoint-btn-icon" id="pinpoint-btn-copy" title="Copy annotations for AI">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span class="pinpoint-badge-count" id="pinpoint-count" style="display: none;">0</span>
    </button>
    <button class="pinpoint-btn-icon" id="pinpoint-btn-clear" title="Clear all pins on this page">
      <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
    <button class="pinpoint-btn-icon" id="pinpoint-btn-minimize" title="Hide toolbar (Alt+T)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  `;
  shadow.appendChild(toolbar);

  // Collapsed Dynamic Island Capsule
  const collapsedPill = document.createElement('div');
  collapsedPill.className = 'pinpoint-collapsed-pill';
  collapsedPill.style.display = 'none';
  if (currentPos.x !== null && currentPos.y !== null) {
    collapsedPill.style.left = `${currentPos.x}px`;
    collapsedPill.style.top = `${currentPos.y}px`;
    collapsedPill.style.right = 'auto';
    collapsedPill.style.bottom = 'auto';
  }
  collapsedPill.innerHTML = `
    <span class="pinpoint-brand-dot"></span>
    <span>P</span>
    <span class="pinpoint-badge-count" id="pinpoint-pill-count" style="display: none; position: static; margin-left: 2px;">0</span>
  `;
  shadow.appendChild(collapsedPill);

  // Drag Handling for Toolbar
  const brandBtn = shadow.getElementById('pinpoint-brand-btn');

  function onMouseDown(e) {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = toolbar.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    toolbar.classList.add('pinpoint-dragging');

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
      localStorage.setItem('pinpoint_toolbar_pos', JSON.stringify(currentPos));
    } catch (err) {}
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    toolbar.classList.remove('pinpoint-dragging');
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
          localStorage.setItem('pinpoint_toolbar_pos', JSON.stringify(currentPos));
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

  shadow.getElementById('pinpoint-btn-minimize').addEventListener('click', () => toggleVisibility(false));

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
          const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pinpoint-')).slice(0, 2);
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
    const storageKey = `pinpoint_notes_${window.location.pathname}`;
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
    const storageKey = `pinpoint_notes_${window.location.pathname}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(annotations));
    } catch (e) {}
    updateCount();
  }

  function updateCount() {
    const countBadge = shadow.getElementById('pinpoint-count');
    const pillBadge = shadow.getElementById('pinpoint-pill-count');
    const copyBtn = shadow.getElementById('pinpoint-btn-copy');

    if (annotations.length > 0) {
      countBadge.textContent = annotations.length;
      countBadge.style.display = 'flex';
      pillBadge.textContent = annotations.length;
      pillBadge.style.display = 'inline-flex';
      copyBtn.classList.add('pinpoint-btn-copy-has-pins');
    } else {
      countBadge.style.display = 'none';
      pillBadge.style.display = 'none';
      copyBtn.classList.remove('pinpoint-btn-copy-has-pins');
    }
  }

  // Render Pins in Document Layer
  function renderPins() {
    pinsContainer.innerHTML = '';
    annotations.forEach((item) => {
      const pin = document.createElement('div');
      pin.className = 'pinpoint-pin';
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

  // Open Linear-Style Note Card
  function openNoteCard(item, pinEl) {
    cardsContainer.innerHTML = '';

    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const cardX = Math.min(Math.max(item.x - scrollX + 16, 20), window.innerWidth - 360);
    const cardY = Math.min(Math.max(item.y - scrollY - 20, 20), window.innerHeight - 280);

    const card = document.createElement('div');
    card.className = 'pinpoint-card';
    card.style.left = `${cardX}px`;
    card.style.top = `${cardY}px`;

    const pinNumStr = item.number < 10 ? `0${item.number}` : item.number;

    card.innerHTML = `
      <div class="pinpoint-card-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="pinpoint-card-pin-pill">
            <span style="width: 5px; height: 5px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8;"></span>
            PIN ${pinNumStr}
          </span>
          <span style="font-size: 11.5px; font-weight: 600; color: #94a3b8; font-family: monospace;">&lt;${item.tag}&gt;</span>
        </div>
        <button class="pinpoint-card-close" id="pinpoint-card-close-btn" title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="pinpoint-card-preview">
        ${item.textSnippet ? `"${item.textSnippet}"` : item.selector}
      </div>

      <textarea class="pinpoint-textarea" id="pinpoint-note-input" placeholder="What change would you like here?...">${item.note || ''}</textarea>

      <div class="pinpoint-card-actions">
        <button class="pinpoint-btn-delete" id="pinpoint-btn-del-pin" title="Delete this pin">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Delete</span>
        </button>

        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="pinpoint-card-close" id="pinpoint-btn-cancel-pin" style="width: auto; height: auto; padding: 6px 11px; border-radius: 8px; font-size: 12px;">Cancel</button>
          <button class="pinpoint-btn-save" id="pinpoint-btn-save-pin">
            <span>Save Pin</span>
            <span style="font-size: 10px; opacity: 0.8; font-family: monospace; background: rgba(255,255,255,0.2); padding: 1px 4px; border-radius: 4px;">↵</span>
          </button>
        </div>
      </div>
    `;

    cardsContainer.appendChild(card);

    const input = card.querySelector('#pinpoint-note-input');
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

    card.querySelector('#pinpoint-card-close-btn').addEventListener('click', () => cardsContainer.innerHTML = '');
    card.querySelector('#pinpoint-btn-cancel-pin').addEventListener('click', () => cardsContainer.innerHTML = '');
    card.querySelector('#pinpoint-btn-save-pin').addEventListener('click', saveNote);
    card.querySelector('#pinpoint-btn-del-pin').addEventListener('click', deleteNote);

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
    const btn = shadow.getElementById('pinpoint-btn-inspect');
    if (isInspectMode) {
      btn.classList.add('pinpoint-btn-inspect-active');
      document.body.style.cursor = 'crosshair';
      showToast('Inspect Mode Active · Click element to pin');
    } else {
      btn.classList.remove('pinpoint-btn-inspect-active');
      highlighter.style.display = 'none';
      document.body.style.cursor = 'default';
    }
  }

  // Copy Formatted Markdown to Clipboard & auto-clear to avoid duplication
  function copyForAI() {
    if (!annotations.length) {
      showToast('No annotations yet · Drop pins first');
      return;
    }

    const count = annotations.length;
    let payload = `### 📌 Visual Feedback from Localhost Preview\n`;
    payload += `**URL:** \`${window.location.href}\`\n`;
    payload += `**Total Items:** ${count}\n\n`;

    annotations.forEach((item, index) => {
      payload += `#### ${index + 1}. Element: \`${item.selector}\`\n`;
      if (item.textSnippet) payload += `- **Current Content:** "${item.textSnippet}"\n`;
      payload += `- **Requested Change:** ${item.note || 'No specific note added'}\n\n`;
    });

    navigator.clipboard.writeText(payload).then(() => {
      annotations = [];
      currentPinNumber = 1;
      saveStorage();
      renderPins();
      cardsContainer.innerHTML = '';
      showToast(`📋 Copied & cleared ${count} annotation${count > 1 ? 's' : ''}! Paste into AI chat.`);
    }).catch(() => {
      annotations = [];
      currentPinNumber = 1;
      saveStorage();
      renderPins();
      cardsContainer.innerHTML = '';
      showToast(`📋 Copied & cleared ${count} annotation${count > 1 ? 's' : ''}!`);
    });
  }

  // DOM Event Listeners for Inspection & Pin Drop
  document.addEventListener('mousemove', (e) => {
    if (!isInspectMode) return;
    if (e.target.closest('#pinpoint-host') || e.target.closest('#pinpoint-pins-layer')) return;

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

    const selector = getCssSelector(el);
    tagBadge.textContent = `${el.tagName.toLowerCase()} [${Math.round(rect.width)}×${Math.round(rect.height)}]`;
  }, true);

  document.addEventListener('click', (e) => {
    if (!isInspectMode) return;
    if (e.target.closest('#pinpoint-host') || e.target.closest('#pinpoint-pins-layer')) return;

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
      timestamp: new Date().toISOString()
    };

    annotations.push(newAnnotation);
    saveStorage();
    renderPins();

    // Auto open note card for the new pin
    setTimeout(() => {
      const pins = pinsContainer.querySelectorAll('.pinpoint-pin');
      const lastPin = pins[pins.length - 1];
      if (lastPin) openNoteCard(newAnnotation, lastPin);
    }, 40);
  }, true);

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (isTyping) return;

    if ((e.altKey && e.code === 'KeyT') || (e.ctrlKey && e.shiftKey && e.code === 'KeyT') || e.key === 'F8') {
      e.preventDefault();
      toggleVisibility();
    }

    if ((e.altKey && e.code === 'KeyD') || (e.altKey && e.code === 'KeyA') || (e.ctrlKey && e.shiftKey && e.code === 'KeyD') || e.key === 'F9') {
      e.preventDefault();
      toggleInspect();
    }
  });

  // Toolbar Button Click Handlers
  shadow.getElementById('pinpoint-btn-inspect').addEventListener('click', () => toggleInspect());
  shadow.getElementById('pinpoint-btn-copy').addEventListener('click', copyForAI);
  shadow.getElementById('pinpoint-btn-clear').addEventListener('click', () => {
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
  console.log('%c[Pinpoint AI] Ready! Shortcuts: Alt+T (Toggle Toolbar) · Alt+D (Drop Pins)', 'background: #0071e3; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
})();
