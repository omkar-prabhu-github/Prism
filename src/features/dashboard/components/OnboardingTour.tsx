import React, { useEffect, useState, useCallback, useRef } from 'react';

/*
  Task-based onboarding tour v3.
  - Blocks clicks OUTSIDE the spotlight using 4 edge-blocking divs
  - Spotlight area is fully interactive (real clicks pass through)
  - For navigate/action: an intercept div captures the click
  - For input/observe: no intercept, real UI is usable
  - Generate steps wait for the result before advancing
*/

type CompletionType = 'modal' | 'navigate' | 'input' | 'action' | 'observe';

interface TourStep {
  target: string;
  title: string;
  message: string;
  page: string | null;
  position?: 'top' | 'bottom';
  completion: CompletionType;
  inputSelector?: string;
  observeSelector?: string;
}

const STEPS: TourStep[] = [
  // ── Welcome ──
  { target: '', title: 'Welcome!', message: 'Follow each step.', page: null, completion: 'modal' },

  // ── Products ──
  { target: '#feature-card-products', title: 'Tap "Add Product"', message: '', page: null, completion: 'navigate' },
  { target: '#tour-step-image', title: 'Upload a Photo', message: '', page: 'products', position: 'bottom', completion: 'observe', observeSelector: '#tour-step-image img' },
  { target: '#tour-field-name', title: 'Type the product name', message: '', page: 'products', position: 'bottom', completion: 'input', inputSelector: '#tour-field-name input' },
  { target: '#tour-field-price', title: 'Enter the price', message: '', page: 'products', position: 'bottom', completion: 'input', inputSelector: '#tour-field-price input' },
  { target: '#tour-field-category', title: 'Type a category', message: '', page: 'products', position: 'top', completion: 'input', inputSelector: '#tour-field-category input' },
  { target: '#tour-field-inventory', title: 'Enter inventory amount', message: '', page: 'products', position: 'top', completion: 'input', inputSelector: '#tour-field-inventory input' },
  { target: '#tour-step-generate', title: 'Tap Create Product', message: '', page: 'products', position: 'top', completion: 'observe', observeSelector: '#tour-step-publish' },
  { target: '#tour-step-publish', title: 'Tap Publish', message: '', page: 'products', position: 'top', completion: 'observe', observeSelector: '#tour-success-product' },

  // ── Blog ──
  { target: '#feature-card-blog', title: 'Tap "Write Blog"', message: '', page: null, completion: 'navigate' },
  { target: '#tour-step-blog-topic', title: 'Type a blog topic', message: '', page: 'blog', position: 'bottom', completion: 'input', inputSelector: '#tour-step-blog-topic textarea' },
  { target: '#tour-step-blog-generate', title: 'Tap Write Article', message: '', page: 'blog', position: 'top', completion: 'observe', observeSelector: '#tour-success-blog' },

  // ── Policies ──
  { target: '#feature-card-policies', title: 'Tap "Setup Rules"', message: '', page: null, completion: 'navigate' },
  { target: '#tour-field-business', title: 'Type your store name', message: '', page: 'policies', position: 'bottom', completion: 'input', inputSelector: '#tour-field-business input' },
  { target: '#tour-field-email', title: 'Type your email', message: '', page: 'policies', position: 'bottom', completion: 'input', inputSelector: '#tour-field-email input' },
  { target: '#tour-step-policy-generate', title: 'Tap Generate Policies', message: '', page: 'policies', position: 'top', completion: 'observe', observeSelector: '#tour-success-policy' },

  // ── Orders ──
  { target: '#feature-card-orders', title: 'Tap "Manage Orders"', message: '', page: null, completion: 'navigate' },
  { target: '#tour-step-order-list', title: 'Tap any order', message: '', page: 'orders', position: 'bottom', completion: 'action' },

  // ── Done ──
  { target: '', title: 'All Done!', message: 'You know everything now.', page: null, completion: 'modal' },
];

interface Props {
  navigate: (page: string | null) => void;
  active: boolean;
  onEnd: () => void;
}

export const OnboardingTour: React.FC<Props> = ({ navigate, active, onEnd }) => {
  const [step, setStep] = useState(-1);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const raf = useRef<number>(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferred = ['Google UK English Female', 'Microsoft Zira', 'Samantha', 'Google US English'];
      let voice = null;
      for (const name of preferred) {
        voice = voices.find(v => v.name.includes(name));
        if (voice) break;
      }
      if (!voice) voice = voices.find(v => v.lang.startsWith('en')) || null;
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  useEffect(() => {
    (window as any).isTourActive = active;
    if (active && step === -1) {
      setTimeout(() => goToStep(0), 300);
    } else if (!active) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  }, [active, step]);

  const cleanup = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  const endTour = useCallback(() => {
    cleanup();
    setStep(-1);
    setVisible(false);
    navigate(null);
    onEnd();
  }, [navigate, onEnd, cleanup]);

  const goToStep = useCallback((idx: number) => {
    cleanup();
    if (idx >= STEPS.length) { endTour(); return; }

    const s = STEPS[idx];
    setVisible(false);
    navigate(s.page);

    setTimeout(() => {
      setStep(idx);
      speak(`${s.title}. ${s.message}`);
      if (s.target) {
        const el = document.querySelector(s.target);
        if (el) {
          setTargetRect(el.getBoundingClientRect());
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }

      // Input watcher
      if (s.completion === 'input' && s.inputSelector) {
        setTimeout(() => {
          const inputEl = document.querySelector(s.inputSelector!) as HTMLInputElement | HTMLTextAreaElement | null;
          if (inputEl) {
            inputEl.focus();
            let debounce: ReturnType<typeof setTimeout>;
            const handler = () => {
              clearTimeout(debounce);
              debounce = setTimeout(() => {
                if (inputEl.value.trim().length > 0) goToStep(idx + 1);
              }, 1000);
            };
            inputEl.addEventListener('input', handler);
            cleanupRef.current = () => { inputEl.removeEventListener('input', handler); clearTimeout(debounce); };
          }
        }, 500);
      }

      // Observer watcher (for image upload, success banners, etc.)
      if (s.completion === 'observe' && s.observeSelector) {
        const sel = s.observeSelector;
        const interval = setInterval(() => {
          if (document.querySelector(sel)) {
            clearInterval(interval);
            // Small delay so user sees the result
            setTimeout(() => goToStep(idx + 1), 1500);
          }
        }, 500);
        cleanupRef.current = () => clearInterval(interval);
      }

      setTimeout(() => setVisible(true), 200);
    }, 400);
  }, [navigate, cleanup, endTour]);

  // Track rect
  useEffect(() => {
    if (step < 0) return;
    const update = () => {
      const s = STEPS[step];
      if (s?.target) {
        const el = document.querySelector(s.target);
        if (el) setTargetRect(el.getBoundingClientRect());
      }
      raf.current = requestAnimationFrame(update);
    };
    raf.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf.current);
  }, [step]);

  const handleInterceptClick = useCallback(() => {
    const s = STEPS[step];
    if (!s) return;
    if (s.completion === 'navigate') setTimeout(() => goToStep(step + 1), 150);
    else if (s.completion === 'action') goToStep(step + 1);
  }, [step, goToStep]);

  if (step < 0 || !active) return null;

  const s = STEPS[step];
  const isModal = !s.target || !targetRect;
  const pad = 12;
  const needsPassthrough = s.completion === 'input' || s.completion === 'observe';

  // Build 4 edge-blocking rects around the spotlight
  const blockers: React.CSSProperties[] = [];
  if (targetRect && !isModal) {
    const sl = targetRect.left - pad;
    const st = targetRect.top - pad;
    const sw = targetRect.width + pad * 2;
    const sh = targetRect.height + pad * 2;
    // Top
    blockers.push({ position: 'fixed', top: 0, left: 0, right: 0, height: st, zIndex: 10001 });
    // Bottom
    blockers.push({ position: 'fixed', top: st + sh, left: 0, right: 0, bottom: 0, zIndex: 10001 });
    // Left
    blockers.push({ position: 'fixed', top: st, left: 0, width: sl, height: sh, zIndex: 10001 });
    // Right
    blockers.push({ position: 'fixed', top: st, left: sl + sw, right: 0, height: sh, zIndex: 10001 });
  } else if (isModal) {
    // Block everything
    blockers.push({ position: 'fixed', inset: 0, zIndex: 10001 });
  }

  // Tooltip position
  let tooltipStyle: React.CSSProperties = {};
  if (!isModal && targetRect) {
    const pos = s.position || 'bottom';
    const leftPos = Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - 170, window.innerWidth - 356));
    if (pos === 'bottom') {
      tooltipStyle = { position: 'fixed', top: targetRect.bottom + pad + 16, left: leftPos, zIndex: 10003 };
    } else {
      tooltipStyle = { position: 'fixed', bottom: window.innerHeight - targetRect.top + pad + 16, left: leftPos, zIndex: 10003 };
    }
  } else {
    tooltipStyle = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10003 };
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <>
      {/* Dark visual overlay (non-blocking, just for dimming) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && !isModal && (
                <rect
                  x={targetRect.left - pad} y={targetRect.top - pad}
                  width={targetRect.width + pad * 2} height={targetRect.height + pad * 2}
                  rx="12" fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#tour-mask)" />
        </svg>
      </div>

      {/* 4 transparent click-blocking divs around the spotlight */}
      {blockers.map((style, i) => (
        <div key={i} onClick={e => e.stopPropagation()} style={{ ...style, cursor: 'not-allowed' }} />
      ))}

      {/* For navigate/action steps: intercept div OVER the spotlight */}
      {targetRect && !isModal && !needsPassthrough && (
        <div
          onClick={handleInterceptClick}
          style={{
            position: 'fixed',
            left: targetRect.left - pad,
            top: targetRect.top - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
            zIndex: 10002,
            cursor: 'pointer',
            borderRadius: 12,
            border: '2px solid #008060',
            animation: 'tour-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* For input/observe steps: just a visual border (no blocking, clicks pass through) */}
      {targetRect && !isModal && needsPassthrough && (
        <div
          style={{
            position: 'fixed',
            left: targetRect.left - pad,
            top: targetRect.top - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
            zIndex: 10002,
            pointerEvents: 'none',
            borderRadius: 12,
            border: '2px solid #008060',
            animation: 'tour-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Tooltip */}
      {visible && (
        <div style={{
          ...tooltipStyle,
          background: '#fff',
          borderRadius: 12,
          padding: '16px 20px',
          maxWidth: 320,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          animation: 'axiomFadeIn 0.25s ease',
        }}>
          <div style={{ height: 3, background: '#e4e5e7', borderRadius: 2, marginBottom: 12 }}>
            <div style={{ height: '100%', background: '#008060', borderRadius: 2, width: `${progress}%`, transition: 'width 0.4s ease' }} />
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: '#1a1a1a' }}>{s.title}</h3>
          <p style={{ fontSize: 13, color: '#616161', margin: '0 0 12px', lineHeight: 1.5 }}>{s.message}</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', gap: '16px' }}>
            <button onClick={endTour} style={{
              background: 'transparent', border: 'none', color: '#8c9196',
              fontSize: 13, cursor: 'pointer', padding: '8px 12px', margin: 0,
              borderRadius: 6, fontWeight: 500, outline: 'none'
            }}>
              End Tour
            </button>
            
            {isModal && (
              <button onClick={() => goToStep(step + 1)} style={{
                background: '#008060', color: '#fff', border: 'none',
                padding: '8px 24px', borderRadius: 8, fontSize: 14,
                fontWeight: 600, cursor: 'pointer', margin: 0, outline: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {step === 0 ? 'Start' : 'Finish 🎉'}
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 128, 96, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(0, 128, 96, 0); }
        }
      `}</style>
    </>
  );
};
