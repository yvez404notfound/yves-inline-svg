import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { render, waitFor, cleanup } from '@testing-library/react';
import { JSDOM } from 'jsdom';
import { renderToString } from 'react-dom/server';
import { InlineSVG } from '../src/index.js';
import type { InlineSVGLoadEvent } from '../src/index.js';

const nativeFetch = globalThis.fetch;
let dom: JSDOM;

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://app.example/' });

  Object.defineProperties(globalThis, {
    document: { configurable: true, value: dom.window.document },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    MutationObserver: { configurable: true, value: dom.window.MutationObserver },
    navigator: { configurable: true, value: dom.window.navigator },
    SVGElement: { configurable: true, value: dom.window.SVGElement },
    window: { configurable: true, value: dom.window }
  });
});

afterEach(() => {
  cleanup();
  globalThis.fetch = nativeFetch;
  dom.window.close();
});

test('renders sanitized inline markup immediately and preserves viewBox/title', () => {
  const { container } = render(
    <InlineSVG svg='<svg viewBox="0 0 10 10"><path d="M0 0h10v10z" /></svg>' title="Search" />
  );

  const shell = container.querySelector('[data-inline-svg="loaded"]');
  const svg = shell?.querySelector('svg');

  assert.ok(svg);
  assert.equal(svg.getAttribute('viewBox'), '0 0 10 10');
  assert.equal(svg.getAttribute('role'), 'img');
  assert.equal(svg.getAttribute('aria-label'), 'Search');
  assert.equal(svg.querySelector('title')?.textContent, 'Search');
});

test('removes script-like SVG input and event handler attributes', () => {
  const dirty = `
    <svg viewBox="0 0 10 10" onload="alert('root')">
      <script>alert('script')</script>
      <path data-testid="path" d="M0 0h10v10z" onclick="alert('path')" fill="red" />
      <path data-testid="unsafe-url" d="M0 0h10" clip-path="url(javascript:alert('clip'))" />
      <use data-testid="use" href="javascript:alert('href')" />
    </svg>
  `;

  const { container } = render(<InlineSVG svg={dirty} />);
  const svg = container.querySelector('svg');
  const path = container.querySelector('[data-testid="path"]');
  const unsafeUrl = container.querySelector('[data-testid="unsafe-url"]');
  const use = container.querySelector('[data-testid="use"]');

  assert.ok(svg);
  assert.equal(container.querySelector('script'), null);
  assert.equal(svg.getAttribute('onload'), null);
  assert.equal(path?.getAttribute('onclick'), null);
  assert.equal(unsafeUrl?.getAttribute('clip-path'), null);
  assert.equal(use?.getAttribute('href'), null);
});

test('handles removeDimensions, size, width, and height while preserving viewBox', () => {
  const source = '<svg width="16" height="12" viewBox="0 0 16 12"><path d="M0 0h16v12z" /></svg>';
  const { container, rerender } = render(<InlineSVG svg={source} removeDimensions />);
  let svg = container.querySelector('svg');

  assert.ok(svg);
  assert.equal(svg.hasAttribute('width'), false);
  assert.equal(svg.hasAttribute('height'), false);
  assert.equal(svg.getAttribute('viewBox'), '0 0 16 12');

  rerender(<InlineSVG svg={source} removeDimensions size={24} height="2rem" />);
  svg = container.querySelector('svg');

  assert.ok(svg);
  assert.equal(svg.getAttribute('width'), '24');
  assert.equal(svg.getAttribute('height'), '2rem');
  assert.equal(svg.getAttribute('viewBox'), '0 0 16 12');
});

test('preserves source colors without color, rewrites with color, and supports opt-out', () => {
  const source = `
    <svg viewBox="0 0 10 10">
      <defs><linearGradient id="g"><stop offset="0" stop-color="#fff" /></linearGradient></defs>
      <path data-kind="paint" d="M0 0h10" fill="#123456" stroke="red" />
      <path data-kind="preserve" d="M0 1h10" fill="none" stroke="url(#g)" />
      <path data-kind="css-var" d="M0 2h10" fill="var(--icon-fill)" stroke="currentColor" />
    </svg>
  `;

  const { container, rerender } = render(<InlineSVG svg={source} />);
  let painted = container.querySelector('[data-kind="paint"]');
  let preserved = container.querySelector('[data-kind="preserve"]');
  let cssVar = container.querySelector('[data-kind="css-var"]');
  const stop = container.querySelector('stop');

  assert.equal((container.firstElementChild as HTMLElement).style.color, '');
  assert.equal(painted?.getAttribute('fill'), '#123456');
  assert.equal(painted?.getAttribute('stroke'), 'red');
  assert.equal(preserved?.getAttribute('fill'), 'none');
  assert.equal(preserved?.getAttribute('stroke'), 'url(#g)');
  assert.equal(cssVar?.getAttribute('fill'), 'var(--icon-fill)');
  assert.equal(cssVar?.getAttribute('stroke'), 'currentColor');
  assert.equal(stop?.getAttribute('stop-color'), '#fff');

  rerender(<InlineSVG svg={source} color="tomato" />);
  painted = container.querySelector('[data-kind="paint"]');
  preserved = container.querySelector('[data-kind="preserve"]');
  cssVar = container.querySelector('[data-kind="css-var"]');

  assert.equal((container.firstElementChild as HTMLElement).style.color, 'tomato');
  assert.equal(painted?.getAttribute('fill'), 'currentColor');
  assert.equal(painted?.getAttribute('stroke'), 'currentColor');
  assert.equal(preserved?.getAttribute('fill'), 'none');
  assert.equal(preserved?.getAttribute('stroke'), 'url(#g)');
  assert.equal(cssVar?.getAttribute('fill'), 'var(--icon-fill)');
  assert.equal(cssVar?.getAttribute('stroke'), 'currentColor');

  rerender(<InlineSVG svg={source} currentColor />);
  painted = container.querySelector('[data-kind="paint"]');

  assert.equal(painted?.getAttribute('fill'), 'currentColor');
  assert.equal(painted?.getAttribute('stroke'), 'currentColor');

  rerender(<InlineSVG svg={source} color="rebeccapurple" currentColor={false} />);
  painted = container.querySelector('[data-kind="paint"]');
  preserved = container.querySelector('[data-kind="preserve"]');
  cssVar = container.querySelector('[data-kind="css-var"]');

  assert.equal((container.firstElementChild as HTMLElement).style.color, 'rebeccapurple');
  assert.equal(painted?.getAttribute('fill'), '#123456');
  assert.equal(painted?.getAttribute('stroke'), 'red');
  assert.equal(preserved?.getAttribute('fill'), 'none');
  assert.equal(preserved?.getAttribute('stroke'), 'url(#g)');
  assert.equal(cssVar?.getAttribute('fill'), 'var(--icon-fill)');
  assert.equal(cssVar?.getAttribute('stroke'), 'currentColor');
});

test('fetches imported/static URL objects and reports sanitized load events', async () => {
  const loadEvents: InlineSVGLoadEvent[] = [];
  const fetchedUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchedUrls.push(String(input));
    return new Response('<svg viewBox="0 0 8 8"><path d="M0 0h8v8z" onclick="bad()" /></svg>', {
      headers: { 'Content-Type': 'image/svg+xml' },
      status: 200
    });
  }) as typeof fetch;

  const { container } = render(
    <InlineSVG
      src={{ src: '/assets/icon.svg' }}
      fallback={<span data-testid="fallback">loading</span>}
      onLoad={(event) => loadEvents.push(event)}
    />
  );

  assert.equal(container.querySelector('[data-testid="fallback"]')?.textContent, 'loading');

  await waitFor(() => {
    assert.ok(container.querySelector('svg'));
    assert.equal(loadEvents.length, 1);
  });

  assert.deepEqual(fetchedUrls, ['/assets/icon.svg']);
  assert.equal(loadEvents[0]?.source, 'src');
  assert.equal(loadEvents[0]?.src, '/assets/icon.svg');
  assert.equal(container.querySelector('path')?.getAttribute('onclick'), null);
});

test('renders fallback and calls onError when URL loading fails', async () => {
  const errors: Error[] = [];

  globalThis.fetch = (async () =>
    new Response('missing', {
      status: 404,
      statusText: 'Not Found'
    })) as typeof fetch;

  const { container } = render(
    <InlineSVG
      src="https://cdn.example/missing.svg"
      fallback={<span data-testid="fallback">fallback</span>}
      onError={(error) => errors.push(error)}
    />
  );

  await waitFor(() => {
    assert.equal(container.querySelector('[data-inline-svg="error"]')?.textContent, 'fallback');
    assert.match(errors[0]?.message ?? '', /404 Not Found/);
  });
});

test('server rendering inlines sanitized svg markup', () => {
  const html = renderToString(
    <InlineSVG
      svg='<svg width="20" height="20" viewBox="0 0 20 20" onload="bad()"><script>bad()</script><path fill="#000" d="M0 0h20v20z" /></svg>'
      removeDimensions
      title="Server icon"
    />
  );

  assert.match(html, /data-inline-svg="loaded"/);
  assert.match(html, /<svg/);
  assert.match(html, /viewBox="0 0 20 20"/);
  assert.match(html, /fill="#000"/);
  assert.match(html, /Server icon/);
  assert.doesNotMatch(html, /<script|onload|width="20"|height="20"/);
});

test('server rendering a browser-only src produces a stable fallback shell', () => {
  const html = renderToString(
    <InlineSVG src="https://cdn.example/icon.svg" fallback={<span data-testid="fallback">loading</span>} />
  );

  assert.match(html, /data-inline-svg="loading"/);
  assert.match(html, /loading/);
  assert.doesNotMatch(html, /<svg/);
});
