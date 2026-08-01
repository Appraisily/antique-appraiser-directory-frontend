import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('no-match feedback masks the query and clears when the query is edited', async (context) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://directory.test/',
  });
  const priorGlobals = new Map();
  for (const [key, value] of [
    ['window', dom.window],
    ['document', dom.window.document],
    ['navigator', dom.window.navigator],
    ['location', dom.window.location],
    ['HTMLElement', dom.window.HTMLElement],
    ['Node', dom.window.Node],
    ['Event', dom.window.Event],
    ['IS_REACT_ACT_ENVIRONMENT', true],
    ['fetch', async () => ({ ok: true })],
  ]) {
    priorGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const vite = await createServer({
    root: repoRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  const { default: React, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router-dom');
  const { CitySearch } = await vite.ssrLoadModule('/src/components/CitySearch.tsx');
  const root = createRoot(document.getElementById('root'));

  context.after(async () => {
    await act(async () => root.unmount());
    await vite.close();
    dom.window.close();
    for (const [key, descriptor] of priorGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  const searchRef = React.createRef();
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        { future: { v7_startTransition: true, v7_relativeSplatPath: true } },
        React.createElement(CitySearch, { ref: searchRef }),
      ),
    );
  });

  const input = document.querySelector('input[name="city"]');
  assert.ok(input instanceof dom.window.HTMLInputElement);

  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    valueSetter.call(input, 'private@example.com');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await act(async () => {
    assert.equal(searchRef.current.submitSearch(), false);
  });

  const status = document.querySelector('[data-directory-search-status="no-match"]');
  assert.ok(status instanceof dom.window.HTMLElement);
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.querySelector('a')?.getAttribute('href'), '#city-directory');
  const protectedQuery = status.querySelector('.session-replay-mask[data-ph-mask-text]');
  assert.equal(protectedQuery?.textContent?.trim(), 'private@example.com');
  assert.equal(protectedQuery?.getAttribute('data-clarity-mask'), 'true');

  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    valueSetter.call(input, 'private@example.co');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  assert.equal(document.querySelector('[data-directory-search-feedback="1"]'), null);
});
