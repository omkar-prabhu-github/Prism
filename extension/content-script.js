/**
 * Prism Shopify Guide — Content Script
 *
 * Runs on Shopify admin pages. Listens for messages from the embedded
 * Prism iframe, coordinates screenshot capture with the service-worker,
 * and draws highlight overlays + blur masks over the Shopify admin UI.
 */

(() => {
  'use strict';

  const SOURCE = 'prism-shopify-guide';
  let guideActive = false;
  let guideState = {
    question: '',
    steps: [],
    backendUrl: '',
    currentStepIndex: 0,
    completedSteps: [],
  };

  // Store the found DOM element for click handling
  let currentFoundElement = null;

  /* ═══════════════════════════════════════════════════════════════
     DOM ELEMENT FINDER — find elements by text content
     ═══════════════════════════════════════════════════════════════ */

  function findElementByText(elementText, elementType) {
    if (!elementText || elementText.trim() === '') return null;

    const searchText = elementText.trim().toLowerCase();

    // Define selectors based on element type
    const selectorMap = {
      button: 'button, [role="button"], a.Polaris-Button, input[type="submit"]',
      link: 'a, [role="link"]',
      menuItem: 'a, button, [role="menuitem"], [role="option"], li',
      tab: '[role="tab"], button, a',
      input: 'input, textarea, select',
      checkbox: 'input[type="checkbox"], [role="checkbox"]',
      icon: 'button, [role="button"], a',
    };

    const selector = selectorMap[elementType] || 'a, button, [role="button"], [role="menuitem"], [role="link"], [role="tab"], span, li, div';

    const candidates = document.querySelectorAll(selector);
    let bestMatch = null;
    let bestScore = Infinity;

    for (const el of candidates) {
      // Skip hidden elements
      if (el.offsetParent === null && el.tagName !== 'BODY') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // Get direct text content (not deeply nested)
      const directText = (el.textContent || '').trim().toLowerCase();

      if (directText === searchText) {
        // Exact match — prefer smaller/more specific elements
        const area = rect.width * rect.height;
        if (area < bestScore) {
          bestMatch = el;
          bestScore = area;
        }
      } else if (directText.includes(searchText) && !bestMatch) {
        // Partial match fallback
        bestMatch = el;
        bestScore = rect.width * rect.height + 100000; // penalize partial
      }
    }

    // Also try aria-label matching
    if (!bestMatch) {
      const allElements = document.querySelectorAll('[aria-label]');
      for (const el of allElements) {
        if (el.offsetParent === null) continue;
        const label = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        if (label === searchText || label.includes(searchText)) {
          bestMatch = el;
          break;
        }
      }
    }

    return bestMatch;
  }

  function getElementBoundingPercent(el) {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    return {
      xPercent: (rect.left / vw) * 100,
      yPercent: (rect.top / vh) * 100,
      widthPercent: (rect.width / vw) * 100,
      heightPercent: (rect.height / vh) * 100,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     DOM HELPERS — create / destroy the overlay + persistent HUD
     ═══════════════════════════════════════════════════════════════ */

  function removeOverlay() {
    const old = document.getElementById('prism-overlay-root');
    if (old) old.remove();
    currentFoundElement = null;
  }

  function removeHUD() {
    const old = document.getElementById('prism-hud');
    if (old) old.remove();
  }

  function createHUD() {
    removeHUD();

    const hud = document.createElement('div');
    hud.id = 'prism-hud';

    // Stop button — top left
    const stopBtn = document.createElement('button');
    stopBtn.className = 'prism-stop-btn';
    stopBtn.textContent = '✕ Stop Guide';
    stopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleStopGuide();
    }, true);
    hud.appendChild(stopBtn);

    // Step counter pill — top right
    const pill = document.createElement('div');
    pill.id = 'prism-step-pill';
    pill.className = 'prism-step-pill';
    pill.textContent = `Step ${guideState.currentStepIndex + 1} of ${guideState.steps.length}`;
    hud.appendChild(pill);

    document.documentElement.appendChild(hud);
  }

  function updateHUDStep() {
    const pill = document.getElementById('prism-step-pill');
    if (pill) {
      pill.textContent = `Step ${guideState.currentStepIndex + 1} of ${guideState.steps.length}`;
    }
  }

  function createOverlay(boundingBox, instruction, foundElement) {
    removeOverlay();
    currentFoundElement = foundElement || null;

    const root = document.createElement('div');
    root.id = 'prism-overlay-root';
    root.className = 'prism-overlay-root';

    // Adjust bounding box: increase height by 50%
    let { xPercent, yPercent, widthPercent, heightPercent } = boundingBox;
    const addedHeight = heightPercent * 0.5;
    heightPercent += addedHeight;
    yPercent -= (addedHeight / 2);

    // Clamp values
    xPercent = Math.max(0, xPercent);
    yPercent = Math.max(0, yPercent);

    // Full-screen click blocker with cutout for the highlight
    const blocker = document.createElement('div');
    blocker.className = 'prism-blocker';
    blocker.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // Cut a hole using clip-path polygon
    const left = xPercent;
    const right = Math.min(100, xPercent + widthPercent);
    const top = yPercent;
    const bottom = Math.min(100, yPercent + heightPercent);
    blocker.style.clipPath = `polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%, ${left}% ${top}%, ${right}% ${top}%, ${right}% ${bottom}%, ${left}% ${bottom}%, ${left}% ${top}%)`;
    root.appendChild(blocker);

    // Highlight box
    const highlight = document.createElement('div');
    highlight.className = 'prism-highlight';
    highlight.style.left = `${xPercent}%`;
    highlight.style.top = `${yPercent}%`;
    highlight.style.width = `${widthPercent}%`;
    highlight.style.height = `${heightPercent}%`;

    // Make the highlight area clickable
    highlight.addEventListener('click', (e) => {
      e.stopPropagation();
      handleHighlightClick(boundingBox);
    }, true);
    root.appendChild(highlight);

    // Instruction tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'prism-tooltip';
    tooltip.textContent = instruction;

    const tooltipTop = yPercent + heightPercent + 1;
    if (tooltipTop < 85) {
      tooltip.style.top = `${tooltipTop}%`;
    } else {
      tooltip.style.top = `${Math.max(0, yPercent - 6)}%`;
    }
    tooltip.style.left = `${Math.max(2, Math.min(xPercent, 60))}%`;
    root.appendChild(tooltip);

    // Update the persistent HUD step counter
    updateHUDStep();

    document.documentElement.appendChild(root);
  }

  /* ═══════════════════════════════════════════════════════════════
     GUIDE FLOW
     ═══════════════════════════════════════════════════════════════ */

  function sendStatusToIframe(data) {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        iframe.contentWindow.postMessage({ source: SOURCE, type: 'STATUS', ...data }, '*');
      } catch (_) { /* cross-origin — skip */ }
    });
  }

  function sendCompleteToIframe() {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        iframe.contentWindow.postMessage({ source: SOURCE, type: 'COMPLETE' }, '*');
      } catch (_) {}
    });
  }

  async function runNextStep() {
    if (!guideActive) return;
    const idx = guideState.currentStepIndex;
    if (idx >= guideState.steps.length) {
      removeOverlay();
      removeHUD();
      guideActive = false;
      sendCompleteToIframe();
      return;
    }

    const step = guideState.steps[idx];

    sendStatusToIframe({
      status: 'capturing',
      currentStep: step.number,
      instruction: step.instruction,
      completedSteps: guideState.completedSteps,
    });

    await sleep(600);
    if (!guideActive) return; // user pressed stop during delay

    sendStatusToIframe({
      status: 'analyzing',
      currentStep: step.number,
      instruction: step.instruction,
    });

    try {
      console.log('📸 Prism: Requesting screenshot capture for step:', step.instruction);
      const result = await chrome.runtime.sendMessage({
        type: 'CAPTURE_AND_ANALYZE',
        question: guideState.question,
        currentStepInstruction: step.instruction,
        stepsCompleted: guideState.completedSteps,
        backendUrl: guideState.backendUrl,
      });

      // Check again — user may have pressed stop while AI was analyzing
      if (!guideActive) return;

      console.log('🤖 Prism: Analysis result:', result);

      if (!result || result.error) {
        console.error('❌ Prism: Analysis error:', result?.error);
        sendStatusToIframe({ status: 'error', instruction: result?.error || 'No response from extension' });
        removeOverlay();
        removeHUD();
        guideActive = false;
        return;
      }

      if (result.isComplete) {
        removeOverlay();
        removeHUD();
        guideActive = false;
        sendCompleteToIframe();
        return;
      }

      if (!guideActive) return; // one more check

      if (result.found) {
        let domElement = null;
        let bbox = result.boundingBox;

        if (result.elementText) {
          domElement = findElementByText(result.elementText, result.elementType);
          if (domElement) {
            bbox = getElementBoundingPercent(domElement);
            console.log('🎯 Prism: Found element by text:', result.elementText, bbox);
          } else {
            console.log('⚠️ Prism: DOM search failed for:', result.elementText, '— using AI coordinates');
          }
        }

        if (bbox && guideActive) {
          createOverlay(bbox, result.instruction || step.instruction, domElement);
          sendStatusToIframe({
            status: 'highlighting',
            currentStep: step.number,
            instruction: result.instruction || step.instruction,
          });
        }
      } else if (result.needsScroll) {
        const dir = result.scrollDirection || 'down';
        window.scrollBy({ top: dir === 'down' ? 400 : -400, behavior: 'smooth' });
        await sleep(800);
        if (!guideActive) return;
        runNextStep();
      } else {
        sendStatusToIframe({
          status: 'error',
          instruction: `Could not find element for: "${step.instruction}". Try scrolling or navigating manually, then click "Visualize" again.`,
        });
        removeOverlay();
        removeHUD();
        guideActive = false;
      }
    } catch (err) {
      if (!guideActive) return; // silently bail if stopped
      console.error('❌ Prism: Exception in runNextStep:', err);
      sendStatusToIframe({ status: 'error', instruction: err.message });
      removeOverlay();
      removeHUD();
      guideActive = false;
    }
  }

  function handleHighlightClick(boundingBox) {
    removeOverlay();

    const step = guideState.steps[guideState.currentStepIndex];
    guideState.completedSteps.push(step.instruction);
    guideState.currentStepIndex++;

    // If we found the DOM element, click it directly (most reliable)
    if (currentFoundElement) {
      console.log('🖱️ Prism: Clicking DOM element directly');
      currentFoundElement.click();
    } else {
      // Fall back to coordinate-based click
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const clickX = (boundingBox.xPercent / 100) * vw + (boundingBox.widthPercent / 100) * vw / 2;
      const clickY = (boundingBox.yPercent / 100) * vh + (boundingBox.heightPercent / 100) * vh / 2;
      const el = document.elementFromPoint(clickX, clickY);
      if (el) el.click();
    }

    currentFoundElement = null;
    guideState._nextStepTimer = setTimeout(() => runNextStep(), 1500);
  }

  function handleStopGuide() {
    console.log('🛑 Prism: Guide stopped by user');
    guideActive = false;
    if (guideState._nextStepTimer) {
      clearTimeout(guideState._nextStepTimer);
      guideState._nextStepTimer = null;
    }
    removeOverlay();
    removeHUD();
    currentFoundElement = null;
    sendStatusToIframe({ status: 'idle' });
  }

  /* ═══════════════════════════════════════════════════════════════
     MESSAGE LISTENER — from embedded Prism iframe
     ═══════════════════════════════════════════════════════════════ */

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.source !== SOURCE) return;

    switch (data.type) {
      case 'PING':
        event.source?.postMessage({ source: SOURCE, type: 'PONG' }, { targetOrigin: '*' });
        break;

      case 'START_GUIDE':
        guideActive = true;
        guideState = {
          question: data.question,
          steps: data.steps || [],
          backendUrl: data.backendUrl || '',
          currentStepIndex: 0,
          completedSteps: [],
        };
        createHUD();
        runNextStep();
        break;

      case 'STOP_GUIDE':
        guideActive = false;
        removeOverlay();
        removeHUD();
        break;
    }
  });

  /* ── Utility ── */
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  console.log('✅ Prism Shopify Guide extension loaded');
})();
  