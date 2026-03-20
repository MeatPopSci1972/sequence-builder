#!/usr/bin/env node
// sequence-builder.canary.js
// Browser canary test suite for SequenceForge.
// Purpose: verify the app works correctly in the CURRENT browser engine.
//          Catches rendering regressions that unit tests cannot (SVG, CSS, DOM events).
// Usage:   Open http://localhost:3799/canary in Chrome after starting sf-server.js
// NOT a release gate -- run manually when:
//   - Testing against Chrome Canary / Beta / a new stable release
//   - After any change to render functions or CSS
// Pass criterion: all scenarios green. Any red = investigate before shipping.
//
// Architecture: this file is served by sf-server.js and executed in-browser.
// It drives the live sequence-builder.html page via postMessage + DOM queries
// in a same-origin iframe.

(async function runCanary() {
  const results = [];
  let frame, win, store;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function log(name, pass, detail) {
    results.push({ name, pass, detail: detail || '' });
    const el = document.getElementById('canary-log');
    if (!el) return;
    const row = document.createElement('div');
    row.className = 'row ' + (pass ? 'pass' : 'fail');
    row.textContent = (pass ? '\u2713 ' : '\u2717 ') + name + (detail ? '  --  ' + detail : '');
    el.appendChild(row);
  }

  function assert(name, condition, detail) {
    log(name, !!condition, detail);
    if (!condition) throw new Error('FAIL: ' + name + (detail ? ' -- ' + detail : ''));
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function waitFor(fn, timeout = 2000, interval = 50) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = fn();
      if (result) return result;
      await sleep(interval);
    }
    return null;
  }

  function getStore() {
    // Access store from iframe window
    return win._sequenceStore || win.__store || null;
  }

  function dispatch(action) {
    win._storeDispatch(action);
  }

  // ─── Setup: load app in iframe ─────────────────────────────────────────────

  async function setup() {
    frame = document.getElementById('canary-frame');
    // Pre-set tour-done in localStorage before iframe loads (same origin)
    // This prevents the tour overlay from blocking canary interactions
    localStorage.setItem('sf-tour-done', '1');
    await new Promise(resolve => {
      frame.onload = resolve;
      frame.src = '/sequence-builder.html?canary=1&t=' + Date.now();
    });
    await sleep(300); // let render settle
    win = frame.contentWindow;
    // Ensure tour is suppressed in iframe context too
    win.localStorage.setItem('sf-tour-done', '1');
    // Dismiss any tour overlay that may have already launched
    const overlay = frame.contentDocument.querySelector('.sf-tour-overlay,[class*="tour-overlay"],[class*="tour"]');
    if (overlay) {
      frame.contentDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(100);
    }
  }

  // ─── Scenario helpers ──────────────────────────────────────────────────────

  function actorsLayer()   { return frame.contentDocument.querySelector('#actors-layer'); }
  function messagesLayer() { return frame.contentDocument.querySelector('#messages-layer'); }
  function sidebar()       { return frame.contentDocument.querySelector('#sidebar'); }
  function panel()         { return frame.contentDocument.querySelector('#panel'); }
  function propsContent()  { return frame.contentDocument.querySelector('#props-content'); }
  function statusActors()  { return frame.contentDocument.querySelector('#stat-actors'); }
  function statusMsgs()    { return frame.contentDocument.querySelector('#stat-msgs'); }

  function clickEl(selector) {
    const el = frame.contentDocument.querySelector(selector);
    if (!el) throw new Error('Element not found: ' + selector);
    el.click();
    return el;
  }

  // ─── Scenarios ────────────────────────────────────────────────────────────

  const scenarios = [

    async function S1_page_loads() {
      const title = frame.contentDocument.title;
      assert('S1: page title present', title && title.length > 0, title);
      assert('S1: canvas present',     !!frame.contentDocument.querySelector('#canvas'));
      assert('S1: sidebar present',    !!frame.contentDocument.querySelector('#sidebar'));
      assert('S1: actors-layer present', !!actorsLayer());
      assert('S1: messages-layer present', !!messagesLayer());
    },

    async function S2_load_demo() {
      clickEl('#btn-load-demo');
      await sleep(200);
      const actorEls = actorsLayer().querySelectorAll('g[data-type="actor"]');
      const msgEls   = messagesLayer().querySelectorAll('g[data-type="message"]');
      assert('S2: demo loads actors into SVG',   actorEls.length >= 3, `found ${actorEls.length}`);
      assert('S2: demo loads messages into SVG', msgEls.length >= 3,   `found ${msgEls.length}`);
      assert('S2: statusbar reflects actors',    parseInt(statusActors().textContent) >= 3);
      assert('S2: statusbar reflects messages',  parseInt(statusMsgs().textContent)   >= 3);
    },

    async function S3_click_actor_opens_properties() {
      // Click the first rendered actor group
      const firstActor = actorsLayer().querySelector('g[data-type="actor"]');
      assert('S3: at least one actor in SVG', !!firstActor);
      firstActor.click();
      await sleep(200);
      // Properties pane should have content
      const content = propsContent().textContent.trim();
      assert('S3: props-content populated after actor click', content.length > 0, `"${content.slice(0,40)}"`);
      // Reset: click canvas background to deselect and return to select mode
      const canvas = frame.contentDocument.querySelector('#canvas');
      if (canvas) canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(150);
    },

    async function S4_add_actor_via_toolbar() {
      // Ensure we are in select mode before clicking toolbar
      const before = actorsLayer().querySelectorAll('g[data-type="actor"]').length;
      // Click add-actor twice: first click may enter place-actor mode, second confirms
      clickEl('#btn-add-actor');
      await sleep(300);
      const mid = actorsLayer().querySelectorAll('g[data-type="actor"]').length;
      // If count increased on first click we are done; otherwise click canvas to place
      if (mid <= before) {
        // App entered place-actor mode -- click canvas to place the ghost actor
        const canvas = frame.contentDocument.querySelector('#canvas');
        if (canvas) canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }));
        await sleep(300);
      }
      const after = actorsLayer().querySelectorAll('g[data-type="actor"]').length;
      assert('S4: toolbar add-actor increases SVG actor count', after > before, `${before} -> ${after}`);
      assert('S4: statusbar updated', parseInt(statusActors().textContent) === after);
    },

    async function S5_undo_removes_actor() {
      const before = actorsLayer().querySelectorAll('g[data-type="actor"]').length;
      clickEl('#btn-undo');
      await sleep(150);
      const after = actorsLayer().querySelectorAll('g[data-type="actor"]').length;
      assert('S5: undo removes the added actor', after < before, `${before} -> ${after}`);
    },

    async function S6_sidebar_collapse_toggle() {
      const sb = sidebar();
      const wasFull = sb.classList.contains('state-full');
      clickEl('#sidebar-toggle-btn');
      await sleep(150);
      const isIcons = sb.classList.contains('state-icons') || sb.classList.contains('state-collapsed');
      assert('S6: sidebar toggles out of state-full', isIcons || !sb.classList.contains('state-full'), sb.className);
      // Toggle back
      clickEl('#sidebar-toggle-btn');
      await sleep(150);
    },

    async function S7_plantuml_output_populated() {
      // Click Output tab
      clickEl('#tab-output');
      await sleep(150);
      const code = frame.contentDocument.querySelector('#output-code');
      assert('S7: output-code element present', !!code);
      assert('S7: PlantUML output non-empty',   code.textContent.trim().length > 0, `len=${code.textContent.trim().length}`);
      assert('S7: output contains @startuml',   code.textContent.includes('@startuml') || code.textContent.includes('sequenceDiagram'));
    },

    async function S8_tour_launches() {
      // Clear tour-done flag so tour can launch
      frame.contentWindow.localStorage.removeItem('sf-tour-done');
      clickEl('#sf-tour-help-btn');
      await sleep(300);
      const overlay = frame.contentDocument.querySelector('.sf-tour-overlay, .tour-overlay, [class*="tour"]');
      const card    = frame.contentDocument.querySelector('.sf-tour-card, [class*="tour-card"]');
      assert('S8: tour overlay or card appears after ? click', !!(overlay || card),
        `overlay=${!!overlay} card=${!!card}`);
      // Dismiss: press Escape
      frame.contentDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(150);
    },

  ];

  // ─── Runner ───────────────────────────────────────────────────────────────

  await setup();

  let passed = 0, failed = 0;
  for (const scenario of scenarios) {
    try {
      await scenario();
      passed++;
    } catch(e) {
      // Individual asserts already logged; catch stops scenario but continues suite
      failed++;
    }
  }

  // Summary
  const summary = document.getElementById('canary-summary');
  if (summary) {
    summary.className = failed === 0 ? 'all-pass' : 'has-fail';
    summary.textContent = failed === 0
      ? `\u2713 ALL PASS  ${passed} passed | 0 failed | ${passed} total`
      : `${passed} passed | ${failed} failed | ${passed + failed} total`;
  }

  // Expose results for programmatic access
  window.canaryResults = results;

}());
