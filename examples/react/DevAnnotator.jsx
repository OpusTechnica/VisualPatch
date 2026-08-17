import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * DevAnnotator - Ultra-Premium Linear + Apple Inspired Visual Inspector & Annotation Tool
 * Active only during local development (Vite dev server)
 */
export default function DevAnnotator() {
  const [isVisible, setIsVisible] = useState(true);
  const [isInspectMode, setIsInspectMode] = useState(false);
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

  // Mark in-app annotator active & remove any duplicate extension toolbar host
  useEffect(() => {
    window.__antigravity_in_app_annotator = true;
    const extHost = document.getElementById('antigravity-annotator-host');
    if (extHost) extHost.remove();
    return () => {
      window.__antigravity_in_app_annotator = false;
    };
  }, []);

  // Show temporary toast
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2800);
  };

  // Load annotations from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`aga_notes_${window.location.pathname}`);
      if (saved) setAnnotations(JSON.parse(saved));
      const savedPos = localStorage.getItem('aga_toolbar_pos');
      if (savedPos) setPosition(JSON.parse(savedPos));
    } catch (e) {}
  }, []);

  const saveAnnotations = (newAnnotations) => {
    setAnnotations(newAnnotations);
    try {
      localStorage.setItem(`aga_notes_${window.location.pathname}`, JSON.stringify(newAnnotations));
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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (isTyping) return;

      if ((e.altKey && e.code === 'KeyT') || e.key === 'F8') {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      }
      if ((e.altKey && e.code === 'KeyD') || (e.altKey && e.code === 'KeyA') || e.key === 'F9') {
        e.preventDefault();
        setIsInspectMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Inspect Mode Hover & Click Handlers
  useEffect(() => {
    if (!isInspectMode) {
      if (highlighterRef.current) highlighterRef.current.style.display = 'none';
      document.body.style.cursor = 'default';
      return;
    }

    document.body.style.cursor = 'crosshair';
    showToast('Inspect Mode Active · Click any element to drop a pin');

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
        const badge = highlighterRef.current.querySelector('.dev-tag-badge');
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
      const textSnippet = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80) : '';

      const newPin = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        number: annotations.length ? Math.max(...annotations.map((a) => a.number)) + 1 : 1,
        tag: el.tagName.toLowerCase(),
        selector,
        textSnippet,
        note: '',
        pageX: pinX,
        pageY: pinY,
        timestamp: new Date().toISOString()
      };

      const updated = [...annotations, newPin];
      saveAnnotations(updated);
      setActiveCard(newPin);
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.body.style.cursor = 'default';
    };
  }, [isInspectMode, annotations]);

  // Helper: CSS Selector generator
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
          const classes = el.className.trim().split(/\s+/).filter((c) => c && !c.startsWith('dev-')).slice(0, 2);
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

  const pillRef = useRef(null);

  // Drag Handlers for Toolbar
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    const rect = toolbarRef.current ? toolbarRef.current.getBoundingClientRect() : { left: position.x || 0, top: position.y || 0, width: 220, height: 38 };
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
      const maxX = window.innerWidth - rect.width - 8;
      const maxY = window.innerHeight - rect.height - 8;
      const newX = Math.max(8, Math.min(dragStartRef.current.initialX + deltaX, maxX));
      const newY = Math.max(8, Math.min(dragStartRef.current.initialY + deltaY, maxY));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (toolbarRef.current) {
        const r = toolbarRef.current.getBoundingClientRect();
        try {
          localStorage.setItem('aga_toolbar_pos', JSON.stringify({ x: r.left, y: r.top }));
        } catch (err) {}
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    e.preventDefault();
  };

  // Drag & Click Handler for Collapsed Pill
  const handlePillMouseDown = (e) => {
    if (e.button !== 0) return;
    let hasMoved = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = pillRef.current ? pillRef.current.getBoundingClientRect() : { left: position.x || 0, top: position.y || 0, width: 80, height: 32 };
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
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (hasMoved) {
        if (pillRef.current) {
          const r = pillRef.current.getBoundingClientRect();
          try {
            localStorage.setItem('aga_toolbar_pos', JSON.stringify({ x: r.left, y: r.top }));
          } catch (err) {}
        }
      } else {
        setIsVisible(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    e.preventDefault();
  };

  // Copy structured markdown for AI & auto-clear to prevent duplication
  const copyForAI = () => {
    if (!annotations.length) {
      showToast('No annotations yet · Drop pins first');
      return;
    }
    const count = annotations.length;
    let payload = `### 📌 Antigravity Visual Feedback from Localhost Preview\n`;
    payload += `**URL:** \`${window.location.href}\`\n`;
    payload += `**Total Items:** ${count}\n\n`;

    annotations.forEach((item, index) => {
      payload += `#### ${index + 1}. Element: \`${item.selector}\`\n`;
      if (item.textSnippet) payload += `- **Current Content:** "${item.textSnippet}"\n`;
      payload += `- **Requested Change:** ${item.note || 'No specific note added'}\n\n`;
    });

    navigator.clipboard.writeText(payload).then(() => {
      saveAnnotations([]);
      setActiveCard(null);
      showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''}! Paste into chat.`);
    }).catch(() => {
      saveAnnotations([]);
      setActiveCard(null);
      showToast(`📋 Copied & cleared ${count} item${count > 1 ? 's' : ''}!`);
    });
  };

  // Immediate 1-click clear (no redundant confirmation dialogs)
  const clearAll = () => {
    if (annotations.length) {
      saveAnnotations([]);
      setActiveCard(null);
      showToast('All pins cleared');
    }
  };

  if (typeof document === 'undefined') return null;

  // Calculate card position on screen
  const scrollX = typeof window !== 'undefined' ? (window.scrollX || window.pageXOffset || 0) : 0;
  const scrollY = typeof window !== 'undefined' ? (window.scrollY || window.pageYOffset || 0) : 0;

  const cardViewportX = activeCard ? activeCard.pageX - scrollX : 0;
  const cardViewportY = activeCard ? activeCard.pageY - scrollY : 0;

  const cardLeft = activeCard ? Math.min(Math.max(cardViewportX + 16, 20), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 360) : 0;
  const cardTop = activeCard ? Math.min(Math.max(cardViewportY - 20, 20), (typeof window !== 'undefined' ? window.innerHeight : 800) - 280) : 0;

  return (
    <>
      {/* 1. Absolute Document Layer for Pins (Scrolls perfectly with webpage) */}
      {createPortal(
        <div id="dev-annotator-pins-root" style={{ position: 'absolute', top: 0, left: 0, width: '100%', pointerEvents: 'none', zIndex: 2147483640 }}>
          {annotations.map((item) => (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setActiveCard(item);
              }}
              style={{
                position: 'absolute',
                left: `${item.pageX}px`,
                top: `${item.pageY}px`,
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0071e3 0%, #005bb5 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'var(--font-sans, -apple-system, sans-serif)',
                boxShadow: '0 4px 16px rgba(0, 113, 227, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 4px rgba(0, 113, 227, 0.25)',
                cursor: 'pointer',
                zIndex: 2147483642,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'auto',
                userSelect: 'none',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.15)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 113, 227, 0.7), 0 0 0 2px #ffffff, 0 0 0 5px rgba(0, 113, 227, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 113, 227, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 4px rgba(0, 113, 227, 0.25)';
              }}
              title={`Pin #${item.number}: ${item.note || 'Click to view/edit note'}`}
            >
              {item.number}
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* 2. Fixed Viewport Layer for Highlighter, Note Card, and Toolbar */}
      {createPortal(
        <div id="dev-annotator-fixed-root" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: 0, zIndex: 2147483645, pointerEvents: 'none' }}>
          {/* Precision Fixed Highlighter Box */}
          <div
            ref={highlighterRef}
            style={{
              position: 'fixed',
              border: '2px solid #0071e3',
              background: 'transparent',
              boxShadow: '0 0 0 1px rgba(0, 113, 227, 0.45), inset 0 0 0 1px rgba(0, 113, 227, 0.25)',
              borderRadius: '6px',
              pointerEvents: 'none',
              zIndex: 2147483640,
              display: 'none',
              transition: 'all 0.05s ease'
            }}
          >
            <span
              className="dev-tag-badge"
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
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)'
              }}
            />
          </div>

          {/* Contextual Annotation Card Popup — High-End Linear / Apple Glass Aesthetic */}
          {activeCard && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: `${cardLeft}px`,
                top: `${cardTop}px`,
                width: '345px',
                background: 'rgba(14, 16, 20, 0.96)',
                backdropFilter: 'blur(28px) saturate(190%)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '16px',
                boxShadow: '0 28px 56px -10px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 24px rgba(0, 113, 227, 0.22)',
                color: '#f7f8f8',
                padding: '16px 18px',
                zIndex: 2147483648,
                pointerEvents: 'auto',
                userSelect: 'none',
                animation: 'agaFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Pin Number Capsule */}
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: 'rgba(0, 113, 227, 0.22)',
                    border: '1px solid rgba(0, 113, 227, 0.45)',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    letterSpacing: '0.02em'
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                    PIN {activeCard.number < 10 ? `0${activeCard.number}` : activeCard.number}
                  </span>

                  {/* Element Tag */}
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', fontFamily: 'monospace' }}>
                    &lt;{activeCard.tag}&gt;
                  </span>
                </div>

                {/* Dismiss Button */}
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

              {/* Element Text / Selector Inset Preview */}
              <div style={{
                fontSize: '11.5px',
                color: '#cbd5e1',
                marginBottom: '12px',
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
                {activeCard.textSnippet ? `"${activeCard.textSnippet}"` : activeCard.selector}
              </div>

              {/* Textarea Input */}
              <textarea
                ref={textareaRef}
                value={cardText}
                onChange={(e) => setCardText(e.target.value)}
                placeholder="What change would you like Antigravity to make here?..."
                style={{
                  width: '100%',
                  height: '80px',
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans, -apple-system, sans-serif)',
                  lineHeight: '1.45',
                  resize: 'vertical',
                  outline: 'none',
                  marginBottom: '14px',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0071e3';
                  e.target.style.boxShadow = '0 0 0 2px rgba(0, 113, 227, 0.45), inset 0 2px 4px rgba(0,0,0,0.6)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                  e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.6)';
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    const note = cardText.trim();
                    const updated = annotations.map((a) => (a.id === activeCard.id ? { ...a, note } : a));
                    saveAnnotations(updated);
                    setActiveCard(null);
                    showToast(`Saved Pin #${activeCard.number}`);
                  } else if (e.key === 'Escape') {
                    setActiveCard(null);
                  }
                }}
              />

              {/* Bottom Actions Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Delete Button */}
                <button
                  onClick={() => {
                    const updated = annotations.filter((a) => a.id !== activeCard.id);
                    saveAnnotations(updated);
                    setActiveCard(null);
                    showToast(`Deleted Pin #${activeCard.number}`);
                  }}
                  style={{
                    padding: '6px 11px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#f87171',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                  }}
                  title="Delete this pin"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Delete</span>
                </button>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* Cancel */}
                  <button
                    onClick={() => setActiveCard(null)}
                    style={{
                      padding: '6px 11px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'none',
                      color: '#94a3b8',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                  >
                    Cancel
                  </button>

                  {/* Save Pin Primary CTA */}
                  <button
                    onClick={() => {
                      const note = cardText.trim();
                      const updated = annotations.map((a) => (a.id === activeCard.id ? { ...a, note } : a));
                      saveAnnotations(updated);
                      setActiveCard(null);
                      showToast(`Saved Pin #${activeCard.number}`);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #0071e3 0%, #005bb5 100%)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 10px rgba(0, 113, 227, 0.45)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 113, 227, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 113, 227, 0.45)';
                    }}
                  >
                    <span>Save Pin</span>
                    <span style={{ fontSize: '10px', opacity: 0.8, fontFamily: 'monospace', background: 'rgba(255,255,255,0.2)', padding: '1px 4px', borderRadius: '4px' }}>↵</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Ultra-Premium Toolbar (Linear + Apple Dynamic Island Style) */}
          {isVisible ? (
            <div
              ref={toolbarRef}
              style={{
                position: 'fixed',
                left: position.x !== null ? `${position.x}px` : 'auto',
                top: position.y !== null ? `${position.y}px` : 'auto',
                bottom: position.y === null ? '24px' : 'auto',
                right: position.x === null ? '24px' : 'auto',
                zIndex: 2147483647,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                background: 'rgba(12, 14, 18, 0.92)',
                backdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '9999px',
                boxShadow: '0 16px 40px -6px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 16px rgba(0, 113, 227, 0.18)',
                color: '#f7f8f8',
                pointerEvents: 'auto',
                userSelect: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
              }}
            >
              {/* Drag Grip & Brand Mark (Compact 'A') */}
              <div
                onMouseDown={handleMouseDown}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 8px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'grab',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                title="Drag to reposition toolbar anywhere"
              >
                {/* Grip dots */}
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none" opacity="0.65">
                  <circle cx="2" cy="2" r="1" fill="#ffffff" />
                  <circle cx="6" cy="2" r="1" fill="#ffffff" />
                  <circle cx="2" cy="6" r="1" fill="#ffffff" />
                  <circle cx="6" cy="6" r="1" fill="#ffffff" />
                  <circle cx="2" cy="10" r="1" fill="#ffffff" />
                  <circle cx="6" cy="10" r="1" fill="#ffffff" />
                </svg>

                {/* Pulse Glow Dot */}
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#38bdf8',
                  boxShadow: '0 0 8px #38bdf8'
                }} />

                {/* 'A' Glyph */}
                <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.02em', color: '#ffffff' }}>
                  A
                </span>
              </div>

              {/* Vertical Hairline Divider */}
              <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.1)', margin: '0 2px' }} />

              {/* 1. Inspect / Target Icon Button (Crosshair / Target) */}
              <button
                onClick={() => setIsInspectMode((prev) => !prev)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: isInspectMode ? '1px solid #0071e3' : '1px solid transparent',
                  background: isInspectMode ? 'rgba(0, 113, 227, 0.28)' : 'rgba(255, 255, 255, 0.04)',
                  color: isInspectMode ? '#38bdf8' : '#cbd5e1',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: isInspectMode ? '0 0 12px rgba(0, 113, 227, 0.45)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.08)';
                  if (!isInspectMode) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  if (!isInspectMode) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = '#cbd5e1';
                  }
                }}
                title={isInspectMode ? 'Inspect Active · Click element to pin (Alt+D)' : 'Inspect & Drop Pin (Alt+D)'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="22" y1="12" x2="18" y2="12" />
                  <line x1="6" y1="12" x2="2" y2="12" />
                  <line x1="12" y1="6" x2="12" y2="2" />
                  <line x1="12" y1="22" x2="12" y2="18" />
                  <circle cx="12" cy="12" r="3" fill={isInspectMode ? 'currentColor' : 'none'} />
                </svg>
              </button>

              {/* 2. Copy for AI Icon Button (Recognizable Dual-Sheet Copy Icon + Dynamic Badge) */}
              <button
                onClick={copyForAI}
                style={{
                  position: 'relative',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: annotations.length ? '1px solid rgba(0, 113, 227, 0.5)' : '1px solid transparent',
                  background: annotations.length ? 'linear-gradient(135deg, #0071e3 0%, #005bb5 100%)' : 'rgba(255, 255, 255, 0.04)',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: annotations.length ? '0 2px 10px rgba(0, 113, 227, 0.4)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.08)';
                  if (!annotations.length) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  if (!annotations.length) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  }
                }}
                title={`Copy ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''} for Antigravity AI`}
              >
                {/* Standard Dual-Sheet Clipboard Copy Icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>

                {/* Floating Micro Pin Counter Badge */}
                {annotations.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      minWidth: '16px',
                      height: '16px',
                      padding: '0 4px',
                      borderRadius: '9999px',
                      background: '#ffffff',
                      color: '#0071e3',
                      fontSize: '9.5px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                      animation: 'agaBadgePop 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  >
                    {annotations.length}
                  </span>
                )}
              </button>

              {/* 3. Clear All Icon Button (Trash) */}
              <button
                onClick={clearAll}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '1px solid transparent',
                  background: 'none',
                  color: '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f87171';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.background = 'none';
                }}
                title="Clear all pins on this page"
              >
                <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>

              {/* 4. Minimize / Hide Icon Button (X) */}
              <button
                onClick={() => setIsVisible(false)}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  border: '1px solid transparent',
                  background: 'none',
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.background = 'none';
                }}
                title="Hide toolbar (Alt+T to unhide)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            /* Minimized Apple / Linear Style Dynamic Island Capsule (Draggable & Keeps Current Corner) */
            <div
              ref={pillRef}
              onMouseDown={handlePillMouseDown}
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
                background: 'rgba(12, 14, 18, 0.92)',
                backdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid rgba(0, 113, 227, 0.45)',
                borderRadius: '9999px',
                color: '#ffffff',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'grab',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7), 0 0 14px rgba(0, 113, 227, 0.3)',
                pointerEvents: 'auto',
                userSelect: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 113, 227, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.7), 0 0 14px rgba(0, 113, 227, 0.3)';
              }}
              title="Click to expand or drag to move anywhere (Alt+T)"
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
              <span>A</span>
              {annotations.length > 0 && (
                <span style={{
                  background: '#0071e3',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '9999px'
                }}>
                  {annotations.length}
                </span>
              )}
            </div>
          )}

          {/* Toast Notification — Apple Dynamic Pill */}
          {toastMsg && (
            <div
              style={{
                position: 'fixed',
                top: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(12, 14, 18, 0.94)',
                backdropFilter: 'blur(20px)',
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
                animation: 'agaToastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
              <span>{toastMsg}</span>
            </div>
          )}
        </div>,
        document.body
      )}

      <style>{`
        @keyframes agaFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes agaBadgePop {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        @keyframes agaToastIn {
          from { opacity: 0; transform: translate(-50%, -10px) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
      `}</style>
    </>
  );
}
