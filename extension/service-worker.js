/**
 * Prism Shopify Guide — Service Worker (Background)
 *
 * Responsibilities:
 *  1. Capture visible tab screenshots via chrome.tabs.captureVisibleTab
 *  2. Forward screenshots to the backend /api/guide/analyze endpoint
 *  3. Relay results back to the content-script
 */

/* ── Config ── */
const DEFAULT_BACKEND = 'https://shimmy-friday-buddy.ngrok-free.dev';

/* ── Message handler ── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CAPTURE_AND_ANALYZE') {
    handleCaptureAndAnalyze(msg, sender)
      .then(result => {
        console.log('✅ SW: Sending result back to content script');
        sendResponse(result);
      })
      .catch(err => {
        console.error('❌ SW: Error:', err.message, err.stack);
        sendResponse({ error: err.message });
      });
    return true; // keep channel open for async response
  }

  if (msg.type === 'PING_SW') {
    sendResponse({ pong: true });
    return false;
  }
});

async function handleCaptureAndAnalyze({ question, currentStepInstruction, stepsCompleted, backendUrl }, sender) {
  // Always use localhost — the extension service worker runs on the user's machine
  // and can access localhost directly. Avoids ngrok body-size limits on screenshots.
  const backend = 'http://localhost:3000';

  // 1. Capture screenshot of the active tab
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;

  console.log('📸 SW: Capturing screenshot... tabId:', tabId, 'windowId:', windowId);

  if (!windowId && !tabId) {
    throw new Error('No tab/window ID — extension cannot capture screenshot');
  }

  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId || undefined, {
      format: 'jpeg',
      quality: 40,
    });
  } catch (captureErr) {
    console.error('❌ SW: captureVisibleTab failed:', captureErr);
    throw new Error('Screenshot capture failed: ' + captureErr.message);
  }

  console.log('✅ SW: Screenshot captured, size:', Math.round(dataUrl.length / 1024), 'KB');

  // 2. Send to backend for AI analysis
  console.log('🤖 SW: Sending to backend:', backend + '/api/guide/analyze');

  let res;
  try {
    res = await fetch(`${backend}/api/guide/analyze`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        question,
        screenshot: dataUrl,
        stepsCompleted,
        currentStepInstruction,
      }),
    });
  } catch (fetchErr) {
    console.error('❌ SW: fetch failed:', fetchErr);
    throw new Error('Backend request failed: ' + fetchErr.message);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backend returned ${res.status}`);
  }

  const result = await res.json();
  console.log('✅ SW: AI analysis result:', JSON.stringify(result).slice(0, 200));
  return result;
}
     