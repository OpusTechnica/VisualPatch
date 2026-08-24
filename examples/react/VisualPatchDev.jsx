import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as htmlToImage from 'html-to-image';

/**
 * VisualPatch - Ultra-Premium Linear + Apple Inspired Visual Inspector & Annotation Tool
 * Active only during local development (Vite dev server)
 */
export default function DevAnnotator() {
  const [isVisible, setIsVisible] = useState(true);
  const [isInspectMode, setIsInspectMode] = useState(false);
  const [isScreenshotMode, setIsScreenshotMode] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const [annotations, setAnnotations] = useState([]);
  const [activeCard, setActiveCard] = useState(null);
  const [cardText, setCardText] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [position, setPosition] = useState({ x: null, y: null });

  const textareaRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });
  const toolbarRef = useRef(null);
  const highlighterRef = useRef(null);
  const hoveredElRef = useRef(null);
  const isMarqueeDraggingRef = useRef(false);
  const marqueeStartRef = useRef({ x: 0, y: 0 });

  // Mark in-app annotator active & remove any duplicate extension toolbar host
  useEffect(() => {
    window.__visualpatch_in_app_active = true;
    const extHost = document.getElementById('visualpatch-host');
    if (extHost) extHost.remove();
    return () => {
      window.__visualpatch_in_app_active = false;
    };
  }, []);

  // Show temporary toast
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2800);
  };

  // Viewport Boundary Sanitizer
  const sanitizePos = (pos) => {
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
  };

  // Load annotations from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`visualpatch_notes_${window.location.pathname}`);
      if (saved) setAnnotations(JSON.parse(saved));
      const savedPos = localStorage.getItem('visualpatch_toolbar_pos');
      if (savedPos) setPosition(sanitizePos(JSON.parse(savedPos)));
    } catch (e) {}

    const handleResize = () => {
      setPosition((prev) => {
        if (prev.x === null || prev.y === null) return prev;
        const safe = sanitizePos(prev);
        if (safe.x === null) {
          try { localStorage.removeItem('visualpatch_toolbar_pos'); } catch (err) {}
        }
        return safe;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const saveAnnotations = (newAnnotations) => {
    setAnnotations(newAnnotations);
    try {
      localStorage.setItem(`visualpatch_notes_${window.location.pathname}`, JSON.stringify(newAnnotations));
    } catch (e) {}
  };

  // When activeCard changes, sync cardText and auto-focus
  useEffect(() => {
    if (activeCard) {
      setCardText(activeCard.note || '');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 50);
    }
  }, [activeCard]);

  const copyForAIRef = useRef(null);
  const sendToAgentRef = useRef(null);

  // Global Keyboard Shortcuts (Capture Phase for Guaranteed Responsiveness)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isEsc = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape' || e.keyCode === 27;

      // Instant Escape handling
      if (isEsc) {
        e.preventDefault();
        e.stopPropagation();

        if (zoomImage) {
          setZoomImage(null);
          return;
        }

        if (isScreenshotMode) {
          setIsScreenshotMode(false);
          setMarqueeBox(null);
          showToast('Screenshot mode cancelled');
          return;
        }

        // 1. If note card is open, dismiss the card
        if (activeCard) {
          setActiveCard(null);
          return;
        }

        // 2. Toggle Inspect Mode ON/OFF
        setIsInspectMode((prev) => !prev);
        return;
      }

      // Ctrl + Enter / Cmd + Enter: Instant Send to Agent (Even when typing in note card!)
      const isEnterKey = e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13;
      if (isEnterKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        if (sendToAgentRef.current) sendToAgentRef.current();
        return;
      }

      const activeEl = document.activeElement;
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
          if (copyForAIRef.current) copyForAIRef.current();
          return;
        }
      }

      if (isTyping) return;

      if ((e.altKey && e.code === 'KeyT') || e.key === 'F8') {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      }
      if ((e.altKey && e.code === 'KeyD') || (e.altKey && e.code === 'KeyA') || e.key === 'F9') {
        e.preventDefault();
        setIsScreenshotMode(false);
        setIsInspectMode((prev) => !prev);
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
        setIsInspectMode(false);
        setIsScreenshotMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeCard, isScreenshotMode, zoomImage]);

  // Inspect Mode Hover & Click Handlers
  useEffect(() => {
    if (!isInspectMode) {
      if (highlighterRef.current) highlighterRef.current.style.display = 'none';
      document.body.style.cursor = 'default';
      return;
    }

    document.body.style.cursor = 'crosshair';
    showToast('Inspect Mode Active · Click any element to drop a pin (Esc to exit)');

    const handleMouseMove = (e) => {
      if (e.target.closest('#dev-annotator-fixed-root') || e.target.closest('#dev-annotator-pins-root')) return;

      const el = e.target;
      if (!el || el === document.body || el === document.documentElement || el.id === 'root') {
        if (highlighterRef.current) highlighterRef.current.style.display = 'none';
        return;
      }
      if (el === hoveredElRef.current) return;
      hoveredElRef.current = el;

      const rect = el.getBoundingClientRect();
      if (rect.width >= window.innerWidth * 0.96 && rect.height >= window.innerHeight * 0.96) {
        if (highlighterRef.current) highlighterRef.current.style.display = 'none';
        return;
      }

      if (highlighterRef.current) {
        highlighterRef.current.style.display = 'block';
        highlighterRef.current.style.left = `${rect.left}px`;
        highlighterRef.current.style.top = `${rect.top}px`;
        highlighterRef.current.style.width = `${rect.width}px`;
        highlighterRef.current.style.height = `${rect.height}px`;

        const badge = highlighterRef.current.querySelector('.highlighter-badge');
        if (badge) {
          badge.textContent = `${el.tagName.toLowerCase()} [${Math.round(rect.width)}×${Math.round(rect.height)}]`;
        }
      }
    };

    const handleClick = (e) => {
      if (e.target.closest('#dev-annotator-fixed-root') || e.target.closest('#dev-annotator-pins-root')) return;

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

      const nextNum = annotations.length > 0 ? Math.max(...annotations.map((a) => a.number || 1)) + 1 : 1;
      const newAnnotation = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        number: nextNum,
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

      const updated = [...annotations, newAnnotation];
      saveAnnotations(updated);
      setActiveCard(newAnnotation);
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.body.style.cursor = 'default';
      if (highlighterRef.current) highlighterRef.current.style.display = 'none';
    };
  }, [isInspectMode, annotations]);

  // Fast, lag-free screenshot capture
  const captureAreaSnapshot = async (cropBox) => {
    // Hide annotator UI roots before taking snapshot
    const roots = [
      document.getElementById('dev-annotator-fixed-root'),
      document.getElementById('dev-annotator-pins-root'),
      document.getElementById('visualpatch-host'),
      document.getElementById('visualpatch-pins-layer')
    ].filter(Boolean);
    roots.forEach((r) => (r.style.visibility = 'hidden'));

    const restoreRoots = () => {
      roots.forEach((r) => (r.style.visibility = 'visible'));
    };

    // 1. Try Native GPU Tab Capture if running inside Chrome/Edge Extension context
    const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
    if (isExtension && chrome.runtime?.sendMessage) {
      try {
        const res = await Promise.race([
          new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, (response) => {
              restoreRoots();
              if (chrome.runtime.lastError) resolve(null);
              else resolve(response);
            });
          }),
          new Promise((resolve) => setTimeout(() => { restoreRoots(); resolve(null); }, 120))
        ]);

        if (res && res.success && res.dataUrl) {
          const dpr = window.devicePixelRatio || 1;
          const img = new Image();
          const cropped = await new Promise((resolve) => {
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
            img.onerror = () => { restoreRoots(); resolve(null); };
            img.src = res.dataUrl;
          });
          if (cropped) return cropped;
        }
      } catch (e) {
        restoreRoots();
      }
    }

    // 2. Standalone Fast Async Viewport Capture (Micro-Container Targeting: only snapshots 5-10 nodes, 0ms lag!)
    try {
      const el = document.elementFromPoint(cropBox.x + cropBox.width / 2, cropBox.y + cropBox.height / 2) || document.body;
      let targetNode = el;

      // Find the smallest container that encloses the cropBox (avoids scanning the entire page)
      while (targetNode && targetNode.parentElement && targetNode !== document.body && targetNode !== document.documentElement) {
        const r = targetNode.getBoundingClientRect();
        if (r.left <= cropBox.x && r.top <= cropBox.y && r.right >= cropBox.x + cropBox.width && r.bottom >= cropBox.y + cropBox.height) {
          break;
        }
        targetNode = targetNode.parentElement;
      }

      if (!targetNode) targetNode = document.body;

      const targetRect = targetNode.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);

      const canvas = await htmlToImage.toCanvas(targetNode, {
        pixelRatio: dpr,
        cacheBust: false,
        skipFonts: true,
        filter: (node) => {
          if (node.id && (node.id.includes('annotator') || node.id.includes('visualpatch') || node.id.includes('vp-'))) return false;
          return true;
        }
      });
      restoreRoots();

      const sourceX = (cropBox.x - targetRect.left) * dpr;
      const sourceY = (cropBox.y - targetRect.top) * dpr;
      const sourceW = cropBox.width * dpr;
      const sourceH = cropBox.height * dpr;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(1, Math.round(cropBox.width * dpr));
      cropCanvas.height = Math.max(1, Math.round(cropBox.height * dpr));
      const cropCtx = cropCanvas.getContext('2d', { alpha: false });

      cropCtx.drawImage(
        canvas,
        sourceX, sourceY, sourceW, sourceH,
        0, 0, cropCanvas.width, cropCanvas.height
      );

      return cropCanvas.toDataURL('image/jpeg', 0.88);
    } catch (err) {
      restoreRoots();
      console.error('[VisualPatch] Screenshot capture error:', err);
      return null;
    }
  };

  // Area Screenshot Marquee Mode Handlers (Supports Right-Click or Left-Click Hold)
  useEffect(() => {
    if (!isScreenshotMode) {
      setMarqueeBox(null);
      isMarqueeDraggingRef.current = false;
      return;
    }

    showToast('Area Screenshot Mode · Hold Right or Left mouse button to drag (Esc to cancel)');

    const handleContextMenu = (e) => {
      if (isScreenshotMode) {
        e.preventDefault();
      }
    };

    const handleMouseDown = (e) => {
      if (e.target.closest('#dev-annotator-main-toolbar')) return;
      // Support Right Mouse Button (2) or Left Mouse Button (0)
      if (e.button !== 0 && e.button !== 2) return;

      isMarqueeDraggingRef.current = true;
      marqueeStartRef.current = { x: e.clientX, y: e.clientY };
      setMarqueeBox({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        width: 0,
        height: 0
      });
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isMarqueeDraggingRef.current) return;

      const startX = marqueeStartRef.current.x;
      const startY = marqueeStartRef.current.y;
      const currentX = e.clientX;
      const currentY = e.clientY;

      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      setMarqueeBox({ startX, startY, currentX, currentY, x, y, width, height });
    };

    const handleMouseUp = async (e) => {
      if (!isMarqueeDraggingRef.current) return;
      isMarqueeDraggingRef.current = false;

      const startX = marqueeStartRef.current.x;
      const startY = marqueeStartRef.current.y;
      const currentX = e.clientX;
      const currentY = e.clientY;

      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      if (width < 15 || height < 15) {
        setMarqueeBox(null);
        return;
      }

      const cropRect = { x, y, width, height };
      setMarqueeBox(null);
      setIsScreenshotMode(false);

      // Detect underlying element (filtering out VisualPatch overlays)
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const elementsAtPoint = document.elementsFromPoint ? document.elementsFromPoint(centerX, centerY) : [];
      const el = elementsAtPoint.find((node) => {
        if (!node || node === document.body || node === document.documentElement) return false;
        if (
          node.id === 'vp-marquee-backdrop' ||
          node.id === 'dev-annotator-fixed-root' ||
          node.id === 'visualpatch-host' ||
          node.closest?.('#dev-annotator-fixed-root') ||
          node.closest?.('#dev-annotator-pins-root') ||
          node.closest?.('#visualpatch-host') ||
          node.closest?.('#visualpatch-pins-layer')
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

      // 1. Capture clean screenshot immediately while DOM is clean (zero cards, zero popups)
      const screenshotDataUrl = await captureAreaSnapshot(cropRect);

      const newId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      const nextNum = annotations.length > 0 ? Math.max(...annotations.map((a) => a.number || 1)) + 1 : 1;
      const newAnnotation = {
        id: newId,
        number: nextNum,
        tag: el.tagName ? el.tagName.toLowerCase() : 'area',
        selector: selector || `area[${width}x${height}]`,
        component: sourceInfo.component,
        sourceFile: sourceInfo.sourceFile,
        textSnippet: textSnippet,
        note: '',
        x: pinX,
        y: pinY,
        screenshot: screenshotDataUrl || null,
        timestamp: new Date().toISOString()
      };

      // 2. Register annotation and open card with clean screenshot already ready
      const updated = [...annotations, newAnnotation];
      saveAnnotations(updated);
      setActiveCard(newAnnotation);
      showToast(`📸 Area pinned (#${nextNum})`);
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScreenshotMode, annotations]);

  // Helper: Get unique CSS selector
  const getCssSelector = (el) => {
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
            .filter((c) => c && !c.startsWith('dev-annotator') && !c.startsWith('vp-'))
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
  };

  // Helper: Resolve React/Vue Component Name & Source File (Zero-Token Precision Grounding)
  const getComponentSourceInfo = (el) => {
    if (!el || !(el instanceof Element)) return { component: null, sourceFile: null };

    let component = null;
    let sourceFile = null;

    // 1. Direct explicit attributes (Astro, Svelte, Vite data hooks)
    if (el.getAttribute('data-source-file')) sourceFile = el.getAttribute('data-source-file');
    if (el.getAttribute('data-component')) component = el.getAttribute('data-component');

    // 2. React Internal Fiber Tree Inspection
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

    // 3. Bubble up to parent if leaf element doesn't have direct fiber
    if ((!component || !sourceFile) && el.parentElement && el.parentElement !== document.body) {
      const parentInfo = getComponentSourceInfo(el.parentElement);
      if (!component) component = parentInfo.component;
      if (!sourceFile) sourceFile = parentInfo.sourceFile;
    }

    return { component, sourceFile };
  };

  // Helper: Convert any data URL to pure image/png Blob for Clipboard API
  const dataURLtoPngBlob = (dataurl) => {
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
  };

  // Dragging Toolbar Handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    const rect = toolbarRef.current.getBoundingClientRect();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: rect.left,
      initialY: rect.top
    };

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.x;
      const deltaY = moveEvent.clientY - dragStartRef.current.y;

      const rectEl = toolbarRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rectEl.width - 8;
      const maxY = window.innerHeight - rectEl.height - 8;

      const newX = Math.max(8, Math.min(dragStartRef.current.initialX + deltaX, maxX));
      const newY = Math.max(8, Math.min(dragStartRef.current.initialY + deltaY, maxY));

      setPosition({ x: newX, y: newY });
      try {
        localStorage.setItem('visualpatch_toolbar_pos', JSON.stringify({ x: newX, y: newY }));
      } catch (err) {}
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    e.preventDefault();
  };

  // Dragging Collapsed Pill Handler
  const pillRef = useRef(null);
  const handlePillMouseDown = (e) => {
    if (e.button !== 0) return;
    let hasMoved = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = pillRef.current.getBoundingClientRect();
    const initX = rect.left;
    const initY = rect.top;

    const handleMouseMove = (moveEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (dist > 3) {
        hasMoved = true;
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        const maxX = window.innerWidth - rect.width - 8;
        const maxY = window.innerHeight - rect.height - 8;

        const newX = Math.max(8, Math.min(initX + deltaX, maxX));
        const newY = Math.max(8, Math.min(initY + deltaY, maxY));

        setPosition({ x: newX, y: newY });
        try {
          localStorage.setItem('visualpatch_toolbar_pos', JSON.stringify({ x: newX, y: newY }));
        } catch (err) {}
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (!hasMoved) {
        setIsVisible(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    e.preventDefault();
  };

  // Helper: Create a single auto-stitched composite image strip for multiple screenshots
  const createCompositeScreenshotBlob = async (items) => {
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
  };

  // Copy structured markdown & attached screenshot for AI & auto-clear
  const copyForAI = async () => {
    if (!annotations.length) {
      showToast('No annotations yet · Drop pins or capture areas first');
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
        saveAnnotations([]);
        setActiveCard(null);
        showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''} (+ screenshot strip)!`);
        return;
      }
    } catch (err) {
      // Fallback to text copy
    }

    navigator.clipboard
      .writeText(payload)
      .then(() => {
        saveAnnotations([]);
        setActiveCard(null);
        showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''}! Paste into AI chat.`);
      })
      .catch(() => {
        saveAnnotations([]);
        setActiveCard(null);
        showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''}!`);
      });
  };
  copyForAIRef.current = copyForAI;

  // Direct 0-Token AI Agent Bridge (Saves images to disk & populates agent inbox)
  const sendToAgent = async () => {
    let currentAnnotations = annotations;
    if (activeCard) {
      currentAnnotations = annotations.map((item) =>
        item.id === activeCard.id ? { ...item, note: cardText.trim() } : item
      );
      saveAnnotations(currentAnnotations);
      setActiveCard(null);
    }

    if (!currentAnnotations.length) {
      showToast('No annotations yet · Drop pins or capture areas first');
      return;
    }

    const count = currentAnnotations.length;
    showToast(`⚡ Transmitting ${count} item${count > 1 ? 's' : ''} to Agent...`);

    const payload = {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      items: currentAnnotations.map((item) => ({
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

    // 3. Always copy clean 0-base64 Markdown text + screenshot to clipboard as immediate fallback
    let md = `### 📌 VisualPatch UI Task Queue\n`;
    md += `**Source URL:** \`${window.location.href}\`\n`;
    md += `**Total Items:** ${count}\n\n`;

    currentAnnotations.forEach((item, index) => {
      md += `#### ${index + 1}. Element: \`${item.selector}\`${item.screenshot ? ' 📸 [Area Screenshot Attached]' : ''}\n`;
      if (item.component) md += `- **React Component:** \`<${item.component}>\`\n`;
      if (item.sourceFile) md += `- **Source File:** \`${item.sourceFile}\`\n`;
      if (item.textSnippet) md += `- **Rendered Text:** "${item.textSnippet}"\n`;
      md += `- **Requested Change:** ${item.note || 'Inspect and refine component styling/layout.'}\n\n`;
    });

    try {
      const compositeBlob = await createCompositeScreenshotBlob(currentAnnotations);
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
    } catch (clipErr) {
      try { await navigator.clipboard.writeText(md); } catch (e) {}
    }

    saveAnnotations([]);
    setActiveCard(null);

    if (sent) {
      showToast(`⚡ Saved to .visualpatch/inbox.md! (Type 'vp' in chat)`);
    } else {
      showToast(`📋 Copied for AI (+ saved to clipboard)`);
    }
  };
  sendToAgentRef.current = sendToAgent;

  // Immediate 1-click clear
  const clearAll = () => {
    if (annotations.length) {
      saveAnnotations([]);
      setActiveCard(null);
      showToast('All pins cleared');
    }
  };

  if (typeof document === 'undefined') return null;

  // Calculate card position on screen with intelligent viewport boundary detection & edge-flipping
  let cardX = 16;
  let cardY = 16;
  if (activeCard) {
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const clientX = activeCard.x - scrollX;
    const clientY = activeCard.y - scrollY;
    const cardWidth = 390;
    const cardHeight = 440;
    const margin = 16;

    // Horizontal placement: if pin is near right screen edge, place card to the left of the pin
    if (clientX + 16 + cardWidth > window.innerWidth - margin) {
      cardX = clientX - cardWidth - 16;
    } else {
      cardX = clientX + 16;
    }
    // Hard clamp to ensure card is always 100% within the viewport horizontally
    cardX = Math.max(margin, Math.min(cardX, Math.max(margin, window.innerWidth - cardWidth - margin)));

    // Vertical placement: if pin is near bottom screen edge, place card above the pin
    if (clientY + cardHeight > window.innerHeight - margin) {
      cardY = clientY - cardHeight + 40;
    } else {
      cardY = clientY - 20;
    }
    // Hard clamp to ensure card is always 100% within the viewport vertically
    cardY = Math.max(margin, Math.min(cardY, Math.max(margin, window.innerHeight - cardHeight - margin)));
  }

  return (
    <>
      {/* 1. Global Document Pin Anchors (True Absolute Scroll Tracking) */}
      {createPortal(
        <div
          id="dev-annotator-pins-root"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            pointerEvents: 'none',
            zIndex: 2147483640
          }}
        >
          {annotations.map((item) => (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveCard(item);
              }}
              style={{
                position: 'absolute',
                left: `${item.x}px`,
                top: `${item.y}px`,
                transform: 'translate(-50%, -50%)',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: item.screenshot
                  ? 'linear-gradient(135deg, #38bdf8 0%, #0071e3 100%)'
                  : 'linear-gradient(135deg, #0071e3 0%, #005bb5 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                boxShadow: item.screenshot
                  ? '0 4px 16px rgba(56, 189, 248, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 4px rgba(56, 189, 248, 0.3)'
                  : '0 4px 16px rgba(0, 113, 227, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 4px rgba(0, 113, 227, 0.25)',
                cursor: 'pointer',
                pointerEvents: 'auto',
                userSelect: 'none',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
                zIndex: 2147483642
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.18)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
              }}
              title={`Pin #${item.number}${item.screenshot ? ' (📸 Screenshot Attached)' : ''}: ${item.note || 'Click to edit'}`}
            >
              {item.number}
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* 2. Fixed Overlay Root for Highlighter, Floating Toolbar, Modal Card & Toasts */}
      {createPortal(
        <div
          id="dev-annotator-fixed-root"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 2147483646,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif'
          }}
        >
          {/* Subtle Top Notification Toast */}
          <div
            style={{
              position: 'fixed',
              top: '24px',
              left: '50%',
              transform: toastMsg ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-10px)',
              opacity: toastMsg ? 1 : 0,
              background: 'rgba(12, 14, 18, 0.94)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              padding: '7px 16px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 113, 227, 0.3)',
              zIndex: 2147483647,
              pointerEvents: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
            <span>{toastMsg}</span>
          </div>

          {/* Area Screenshot Marquee Drag Layer (CleanShot X / macOS Studio Grade) */}
          {isScreenshotMode && (
            <div
              id="vp-marquee-backdrop"
              style={{
                position: 'fixed',
                inset: 0,
                background: marqueeBox && marqueeBox.width > 2 ? 'transparent' : 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(1.5px)',
                WebkitBackdropFilter: 'blur(1.5px)',
                cursor: 'crosshair',
                pointerEvents: 'auto',
                zIndex: 2147483644
              }}
            >
              {marqueeBox && marqueeBox.width > 2 && marqueeBox.height > 2 && (
                <div
                  style={{
                    position: 'fixed',
                    left: `${marqueeBox.x}px`,
                    top: `${marqueeBox.y}px`,
                    width: `${marqueeBox.width}px`,
                    height: `${marqueeBox.height}px`,
                    border: '1.5px solid rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.6), 0 0 0 99999px rgba(0, 0, 0, 0.52), 0 12px 40px rgba(0, 113, 227, 0.25)',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                    background: 'transparent'
                  }}
                >
                  {/* 4 Corner Viewfinder Brackets */}
                  <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '8px', height: '8px', borderTop: '2.5px solid #0071e3', borderLeft: '2.5px solid #0071e3' }} />
                  <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', borderTop: '2.5px solid #0071e3', borderRight: '2.5px solid #0071e3' }} />
                  <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '8px', height: '8px', borderBottom: '2.5px solid #0071e3', borderLeft: '2.5px solid #0071e3' }} />
                  <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '8px', height: '8px', borderBottom: '2.5px solid #0071e3', borderRight: '2.5px solid #0071e3' }} />

                  {/* Center Alignment Crosshair */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '12px', height: '12px', opacity: 0.6, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', top: '5px', left: '0', right: '0', height: '1px', background: 'rgba(255,255,255,0.75)', boxShadow: '0 0 2px rgba(0,0,0,0.8)' }} />
                    <div style={{ position: 'absolute', left: '5px', top: '0', bottom: '0', width: '1px', background: 'rgba(255,255,255,0.75)', boxShadow: '0 0 2px rgba(0,0,0,0.8)' }} />
                  </div>

                  {/* Floating Acrylic Glass Dimension Capsule */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: marqueeBox.y + marqueeBox.height + 38 > window.innerHeight ? '10px' : '-34px',
                      right: '0',
                      background: 'rgba(10, 12, 16, 0.92)',
                      backdropFilter: 'blur(16px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: '9999px',
                      color: '#f8fafc',
                      fontSize: '11px',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontWeight: 600,
                      padding: '3px 10px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                    <span>{Math.round(marqueeBox.width)} × {Math.round(marqueeBox.height)}</span>
                    <span style={{ fontSize: '9px', opacity: 0.6, letterSpacing: '0.04em' }}>PX</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full Screen Image Zoom Modal */}
          {zoomImage && (
            <div
              onClick={() => setZoomImage(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.88)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                zIndex: 2147483649,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
                cursor: 'zoom-out',
                padding: '24px'
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'relative',
                  maxWidth: '92vw',
                  maxHeight: '90vh',
                  background: '#0f1115',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 32px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(0, 113, 227, 0.3)'
                }}
              >
                <img
                  src={zoomImage}
                  alt="Area Screenshot Preview"
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    objectFit: 'contain'
                  }}
                />
                <div
                  style={{
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(12, 14, 18, 0.95)'
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: '#94a3b8', fontFamily: 'monospace' }}>Area Screenshot Preview</span>
                  <button
                    onClick={() => setZoomImage(null)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      fontSize: '11.5px',
                      cursor: 'pointer'
                    }}
                  >
                    Close (Esc)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Hover Precision Highlighter Frame */}
          <div
            ref={highlighterRef}
            style={{
              position: 'fixed',
              display: 'none',
              border: '2px solid #0071e3',
              background: 'transparent',
              boxShadow: '0 0 0 1px rgba(0, 113, 227, 0.45), inset 0 0 0 1px rgba(0, 113, 227, 0.25)',
              borderRadius: '6px',
              pointerEvents: 'none',
              zIndex: 2147483640,
              transition: 'all 0.05s ease'
            }}
          >
            <div
              className="highlighter-badge"
              style={{
                position: 'absolute',
                top: '-24px',
                left: '-2px',
                background: 'rgba(15, 17, 21, 0.94)',
                border: '1px solid rgba(0, 113, 227, 0.5)',
                color: '#38bdf8',
                fontSize: '10.5px',
                fontWeight: 600,
                fontFamily: 'monospace',
                padding: '2px 7px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                pointerEvents: 'none',
                backdropFilter: 'blur(8px)'
              }}
            />
          </div>

          {/* Linear / Apple Frosted Glass Note Card */}
          {activeCard && (
            <div
              style={{
                position: 'fixed',
                left: `${cardX}px`,
                top: `${cardY}px`,
                width: '390px',
                maxWidth: 'calc(100vw - 32px)',
                maxHeight: 'calc(100vh - 32px)',
                overflowY: 'auto',
                boxSizing: 'border-box',
                background: 'rgba(14, 16, 20, 0.96)',
                backdropFilter: 'blur(28px) saturate(190%)',
                WebkitBackdropFilter: 'blur(28px) saturate(190%)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '16px',
                boxShadow: '0 28px 56px -10px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 24px rgba(0, 113, 227, 0.22)',
                color: '#f7f8f8',
                padding: '16px 18px',
                zIndex: 2147483648,
                pointerEvents: 'auto',
                userSelect: 'none',
                animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: 'rgba(0, 113, 227, 0.22)',
                    border: '1px solid rgba(0, 113, 227, 0.45)',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    letterSpacing: '0.04em'
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                    PIN {activeCard.number < 10 ? `0${activeCard.number}` : activeCard.number}
                  </span>
                  {activeCard.component ? (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#38bdf8',
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontFamily: 'monospace'
                    }}>
                      &lt;{activeCard.component} /&gt;
                    </span>
                  ) : (
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', fontFamily: 'monospace' }}>
                      &lt;{activeCard.tag}&gt;
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setActiveCard(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  title="Close (Esc)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Source File & Selector / Snippet Preview */}
              <div style={{
                fontSize: '11px',
                color: '#cbd5e1',
                marginBottom: activeCard.screenshot ? '8px' : '12px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '7px 10px',
                borderRadius: '8px',
                borderLeft: '3px solid #0071e3',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {activeCard.sourceFile ? (
                  <span style={{ color: '#38bdf8', marginRight: '6px' }}>📄 {activeCard.sourceFile}</span>
                ) : null}
                <span>{activeCard.textSnippet ? `"${activeCard.textSnippet}"` : activeCard.selector}</span>
              </div>

              {/* Screenshot Thumbnail Preview / Loading Skeleton */}
              {activeCard.screenshot && (
                activeCard.screenshot === 'pending' ? (
                  <div
                    style={{
                      marginBottom: '12px',
                      height: '75px',
                      borderRadius: '10px',
                      background: 'rgba(0, 113, 227, 0.08)',
                      border: '1px dashed rgba(0, 113, 227, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      color: '#38bdf8',
                      fontSize: '11.5px',
                      fontWeight: 600
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
                    <span>Processing area snapshot...</span>
                  </div>
                ) : (
                  <div
                    style={{
                      position: 'relative',
                      marginBottom: '12px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: '#090b0e',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)'
                    }}
                  >
                    <img
                      src={activeCard.screenshot}
                      alt="Captured Area"
                      style={{
                        width: '100%',
                        maxHeight: '120px',
                        objectFit: 'contain',
                        display: 'block',
                        cursor: 'pointer'
                      }}
                      onClick={() => setZoomImage(activeCard.screenshot)}
                      title="Click to Zoom Fullscreen"
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        display: 'flex',
                        gap: '6px'
                      }}
                    >
                      <button
                        onClick={() => setZoomImage(activeCard.screenshot)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(14, 16, 20, 0.88)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          backdropFilter: 'blur(8px)'
                        }}
                      >
                        🔍 Zoom
                      </button>
                      <a
                        href={activeCard.screenshot}
                        download={`visualpatch-pin-${activeCard.number}.png`}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(14, 16, 20, 0.88)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#38bdf8',
                          fontSize: '10px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          backdropFilter: 'blur(8px)'
                        }}
                      >
                        💾 PNG
                      </a>
                    </div>
                  </div>
                )
              )}

              {/* Note Textarea */}
              <textarea
                ref={textareaRef}
                value={cardText}
                onChange={(e) => setCardText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    const updated = annotations.map((item) =>
                      item.id === activeCard.id ? { ...item, note: cardText.trim() } : item
                    );
                    saveAnnotations(updated);
                    setActiveCard(null);
                    showToast(`Saved Pin #${activeCard.number}`);
                  }
                }}
                placeholder="What change would you like here?... (Enter to save, Shift+Enter for new line)"
                style={{
                  width: '100%',
                  height: '76px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  padding: '9px 12px',
                  fontSize: '12.5px',
                  lineHeight: '1.45',
                  resize: 'vertical',
                  outline: 'none',
                  marginBottom: '14px',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5)',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#0071e3')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
              />

              {/* Actions Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <button
                  onClick={() => {
                    const updated = annotations.filter((item) => item.id !== activeCard.id);
                    saveAnnotations(updated);
                    setActiveCard(null);
                    showToast(`Deleted Pin #${activeCard.number}`);
                  }}
                  style={{
                    padding: '0 8px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid transparent',
                    background: 'transparent',
                    color: '#94a3b8',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                    e.currentTarget.style.color = '#f87171';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                  title="Delete this pin"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Delete</span>
                </button>

                {/* Apple Pro Segmented Split Capsule */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  background: 'rgba(15, 18, 24, 0.85)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.45)',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {/* Left Segment: Save Draft */}
                  <button
                    onClick={() => {
                      const updated = annotations.map((item) =>
                        item.id === activeCard.id ? { ...item, note: cardText.trim() } : item
                      );
                      saveAnnotations(updated);
                      setActiveCard(null);
                      showToast(`Saved Pin #${activeCard.number}`);
                    }}
                    style={{
                      padding: '0 9px',
                      height: '28px',
                      border: 'none',
                      background: 'transparent',
                      color: '#cbd5e1',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cbd5e1';
                    }}
                    title="Save draft locally (Enter)"
                  >
                    <span>Save</span>
                    <span style={{ fontSize: '9.5px', opacity: 0.65, fontFamily: 'monospace' }}>↵</span>
                  </button>

                  {/* Hairline Divider */}
                  <div style={{ width: '1px', height: '16px', background: 'rgba(255, 255, 255, 0.12)' }} />

                  {/* Right Segment: Send to Agent */}
                  <button
                    onClick={() => sendToAgent()}
                    style={{
                      padding: '0 11px',
                      height: '28px',
                      border: 'none',
                      background: '#0071e3',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.22)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#007dfc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#0071e3';
                    }}
                    title="Transmit to Agent Inbox (Ctrl+Enter)"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ flexShrink: 0 }}>
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    <span>Send to Agent</span>
                    <span style={{
                      fontSize: '8.5px',
                      opacity: 0.85,
                      fontFamily: 'monospace',
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '1px 3.5px',
                      borderRadius: '3px',
                      letterSpacing: '0.02em',
                      flexShrink: 0
                    }}>Ctrl+↵</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Floating Bottom Toolbar (Linear + Apple Obsidian Acrylic Glass Dock) */}
          {isVisible ? (
            <div
              ref={toolbarRef}
              id="dev-annotator-main-toolbar"
              style={{
                position: 'fixed',
                left: position.x !== null ? `${position.x}px` : 'auto',
                top: position.y !== null ? `${position.y}px` : 'auto',
                bottom: position.y === null ? '24px' : 'auto',
                right: position.x === null ? '24px' : 'auto',
                zIndex: 2147483647,
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 4px',
                width: '38px',
                background: 'rgba(14, 16, 20, 0.94)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: '9999px',
                boxShadow: '0 16px 36px -6px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                pointerEvents: 'auto',
                userSelect: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Drag Grip & Official Brand Mark */}
              <div
                onMouseDown={handleMouseDown}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '5px 4px',
                  width: '30px',
                  height: '30px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'grab',
                  transition: 'background-color 0.15s ease, transform 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
                title="Drag to reposition toolbar anywhere"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
                  <path d="M3 9V3H9" stroke="#0071E3" strokeWidth="2.8" strokeLinecap="square" />
                  <path d="M21 15V21H15" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="square" />
                  <path d="M7 8L12 17L17 8" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="9.5" x2="12" y2="12.5" stroke="#0071E3" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="10.5" y1="11" x2="13.5" y2="11" stroke="#0071E3" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>

              <div style={{ width: '16px', height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '2px 0' }} />

              {/* 1. Inspect Mode Crosshair Button */}
              <button
                onClick={() => {
                  setIsScreenshotMode(false);
                  setIsInspectMode(!isInspectMode);
                }}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: isInspectMode ? '1px solid #0071e3' : '1px solid transparent',
                  background: isInspectMode ? '#0071e3' : 'rgba(255, 255, 255, 0.03)',
                  color: isInspectMode ? '#ffffff' : '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  if (!isInspectMode) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  if (!isInspectMode) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
                title={isInspectMode ? 'Inspect Active · Click element to pin (Esc / Alt+D)' : 'Inspect & Drop Pin (Esc / Alt+D)'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="22" y1="12" x2="18" y2="12" />
                  <line x1="6" y1="12" x2="2" y2="12" />
                  <line x1="12" y1="6" x2="12" y2="2" />
                  <line x1="12" y1="22" x2="12" y2="18" />
                  <circle cx="12" cy="12" r="3" fill={isInspectMode ? 'currentColor' : 'none'} />
                </svg>
              </button>

              {/* 2. Area Screenshot Marquee Tool Button */}
              <button
                onClick={() => {
                  setIsInspectMode(false);
                  setIsScreenshotMode(!isScreenshotMode);
                }}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: isScreenshotMode ? '1px solid #0071e3' : '1px solid transparent',
                  background: isScreenshotMode ? '#0071e3' : 'rgba(255, 255, 255, 0.03)',
                  color: isScreenshotMode ? '#ffffff' : '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  if (!isScreenshotMode) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  if (!isScreenshotMode) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
                title={isScreenshotMode ? 'Area Screenshot Active · Drag box on screen (Press S)' : 'Take Area Screenshot (Press S)'}
              >
                <svg width="14.5" height="14.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" fill={isScreenshotMode ? 'currentColor' : 'none'} />
                </svg>
              </button>

              {/* 3. Send to Agent (Direct 0-Token AI Bridge) */}
              <button
                onClick={sendToAgent}
                style={{
                  position: 'relative',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: annotations.length ? '1px solid #0071e3' : '1px solid transparent',
                  background: annotations.length ? 'linear-gradient(135deg, #0071e3 0%, #005bb5 100%)' : 'rgba(255, 255, 255, 0.03)',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: annotations.length ? '0 0 14px rgba(0, 113, 227, 0.5)' : 'none',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px) scale(1.05)';
                  if (!annotations.length) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  if (!annotations.length) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }
                }}
                title={`⚡ Send ${annotations.length} item${annotations.length !== 1 ? 's' : ''} to Agent Inbox (Ctrl+Enter)`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>

                {annotations.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-3px',
                      right: '-3px',
                      minWidth: '15px',
                      height: '15px',
                      padding: '0 3.5px',
                      borderRadius: '9999px',
                      background: '#ffffff',
                      color: '#0071e3',
                      fontSize: '9px',
                      fontWeight: 800,
                      fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.6)'
                    }}
                  >
                    {annotations.length}
                  </span>
                )}
              </button>

              {/* 4. Copy for AI Icon Button */}
              <button
                onClick={copyForAI}
                style={{
                  position: 'relative',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: annotations.length ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.color = '#94a3b8';
                }}
                title={`Copy ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''} for AI (Ctrl+C)`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>

                {annotations.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-3px',
                      right: '-3px',
                      minWidth: '15px',
                      height: '15px',
                      padding: '0 3.5px',
                      borderRadius: '9999px',
                      background: '#ffffff',
                      color: '#0071e3',
                      fontSize: '9px',
                      fontWeight: 800,
                      fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                    }}
                  >
                    {annotations.length}
                  </span>
                )}
              </button>

              {/* 4. Clear All Pins Button */}
              <button
                onClick={clearAll}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid transparent',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                  e.currentTarget.style.color = '#f87171';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.color = '#94a3b8';
                }}
                title="Clear all pins on this page"
              >
                <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>

              {/* 5. Minimize / Hide Icon */}
              <button
                onClick={() => setIsVisible(false)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.color = '#94a3b8';
                }}
                title="Minimize toolbar (Alt+T)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            /* Minimized Capsule */
            <div
              ref={pillRef}
              onMouseDown={handlePillMouseDown}
              onDoubleClick={() => setIsVisible(true)}
              style={{
                position: 'fixed',
                left: position.x !== null ? `${position.x}px` : 'auto',
                top: position.y !== null ? `${position.y}px` : 'auto',
                bottom: position.y === null ? '24px' : 'auto',
                right: position.x === null ? '24px' : 'auto',
                zIndex: 2147483647,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '6px 12px',
                background: 'rgba(14, 16, 20, 0.94)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '9999px',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'grab',
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                pointerEvents: 'auto',
                userSelect: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease'
              }}
              title="Drag anywhere · Double-click to expand"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
                <path d="M3 9V3H9" stroke="#0071E3" strokeWidth="2.8" strokeLinecap="square" />
                <path d="M21 15V21H15" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="square" />
                <path d="M7 8L12 17L17 8" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="9.5" x2="12" y2="12.5" stroke="#0071E3" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="10.5" y1="11" x2="13.5" y2="11" stroke="#0071E3" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '-0.01em' }}>VisualPatch</span>
              {annotations.length > 0 && (
                <span
                  style={{
                    minWidth: '15px',
                    height: '15px',
                    padding: '0 3.5px',
                    borderRadius: '9999px',
                    background: '#0071e3',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 800,
                    fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '2px'
                  }}
                >
                  {annotations.length}
                </span>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
