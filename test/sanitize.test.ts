import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { prepareSvgMarkup } from '#sanitize-runtime';
import { prepareSvgMarkup as prepareBrowserSvgMarkup } from '../src/sanitize.browser.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function parseSanitized(markup: string): SVGSVGElement {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`);
  const svg = dom.window.document.querySelector('svg');

  assert.ok(svg);
  return svg;
}

function sanitize(markup: string, options?: Parameters<typeof prepareSvgMarkup>[1]): SVGSVGElement {
  return parseSanitized(prepareSvgMarkup(markup, options));
}

function allElements(root: Element): Element[] {
  return [root, ...Array.from(root.querySelectorAll('*'))];
}

function assertNoEventAttributes(root: Element): void {
  for (const element of allElements(root)) {
    for (const attribute of Array.from(element.attributes)) {
      assert.equal(attribute.name.toLowerCase().startsWith('on'), false, `${element.tagName} kept ${attribute.name}`);
    }
  }
}

test('browser sanitizer adapter uses the browser DOM and strips dangerous markup', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const previousWindow = globalThis.window;

  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });

  try {
    const svg = parseSanitized(
      prepareBrowserSvgMarkup(`<svg viewBox="0 0 10 10" xmlns="${SVG_NS}"><script>alert(1)</script><path id="safe" d="M0 0h10" onload="alert(2)" /></svg>`)
    );

    assert.equal(svg.querySelector('script'), null);
    assert.equal(svg.querySelector('#safe')?.getAttribute('d'), 'M0 0h10');
    assert.equal(svg.querySelector('#safe')?.getAttribute('onload'), null);
  } finally {
    if (previousWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
    } else {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    }

    dom.window.close();
  }
});

test('removes script tags at all depths while preserving safe SVG containers', () => {
  const svg = sanitize(`
    <svg viewBox="0 0 10 10" xmlns="${SVG_NS}">
      <script>alert(1)</script>
      <defs><script><![CDATA[alert(2)]]></script></defs>
      <g><script>alert(3)</script><path id="safe" d="M0 0h10v10z" /></g>
    </svg>
  `);

  assert.equal(svg.querySelector('script'), null);
  assert.ok(svg.querySelector('defs'));
  assert.ok(svg.querySelector('g'));
  assert.equal(svg.querySelector('#safe')?.getAttribute('d'), 'M0 0h10v10z');
});

test('strips event handler attributes case-insensitively from every allowed element', () => {
  const svg = sanitize(`
    <svg viewBox="0 0 10 10" xmlns="${SVG_NS}" onload="alert(1)" oNFocus="alert(2)">
      <path id="path" d="M0 0h10" onclick="alert(3)" ONMOUSEOVER="alert(4)" />
      <image id="image" href="#safe" onerror="alert(5)" />
      <g id="group" OnClick="alert(6)"><circle r="1" ONLOAD="alert(7)" /></g>
    </svg>
  `);

  assertNoEventAttributes(svg);
  assert.equal(svg.querySelector('#path')?.getAttribute('d'), 'M0 0h10');
  assert.ok(svg.querySelector('#image'));
  assert.ok(svg.querySelector('#group circle'));
});

test('strips javascript and data URLs, including entity and whitespace obfuscation', () => {
  const svg = sanitize(`
    <svg viewBox="0 0 10 10" xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink">
      <use id="js" href="javascript:alert(1)" />
      <use id="mixed-case" xlink:href="JaVaScRiPt:alert(2)" />
      <image id="entity" href="jav&#x61;script:alert(3)" />
      <image id="whitespace" href="java&#x0A;script:alert(4)" />
      <image id="data-svg" href="data:image/svg+xml,%3Csvg%20onload=alert(5)%20/%3E" />
      <image id="data-html" href="&#x64;ata:text/html,%3Cscript%3Ealert(6)%3C/script%3E" />
      <use id="safe" href="#safe-symbol" />
    </svg>
  `);

  for (const id of ['js', 'mixed-case', 'entity', 'whitespace', 'data-svg', 'data-html']) {
    const element = svg.querySelector(`#${id}`);
    assert.ok(element, id);
    assert.equal(element.getAttribute('href'), null, id);
    assert.equal(element.getAttribute('xlink:href'), null, id);
  }

  assert.equal(svg.querySelector('#safe')?.getAttribute('href'), '#safe-symbol');
});

test('blocks external references and unsafe url() values while preserving local IRIs', () => {
  const svg = sanitize(`
    <svg viewBox="0 0 10 10" xmlns="${SVG_NS}">
      <defs>
        <clipPath id="clip"><rect width="10" height="10" /></clipPath>
        <mask id="mask"><rect width="10" height="10" /></mask>
        <linearGradient id="paint"><stop offset="0" stop-color="#fff" /></linearGradient>
      </defs>
      <use id="external-use" href="https://evil.example/sprite.svg#icon" />
      <image id="protocol-relative" href="//evil.example/pixel.svg" />
      <path id="refs" d="M0 0h10" filter="url(https://evil.example/filter.svg#f)" clip-path="url(#clip)" mask="url( &#35;mask )" marker-start="url(data:image/svg+xml,%3Csvg%20/%3E)" stroke="url(#paint)" />
    </svg>
  `);
  const refs = svg.querySelector('#refs');

  assert.equal(svg.querySelector('#external-use')?.getAttribute('href'), null);
  assert.equal(svg.querySelector('#protocol-relative')?.getAttribute('href'), null);
  assert.equal(refs?.getAttribute('filter'), null);
  assert.equal(refs?.getAttribute('marker-start'), null);
  assert.equal(refs?.getAttribute('clip-path'), 'url(#clip)');
  assert.equal(refs?.getAttribute('mask'), 'url( #mask )');
  assert.equal(refs?.getAttribute('stroke'), 'url(#paint)');
});

test('removes foreignObject and nested HTML content', () => {
  const svg = sanitize(`
    <svg viewBox="0 0 10 10" xmlns="${SVG_NS}">
      <foreignObject>
        <body xmlns="http://www.w3.org/1999/xhtml">
          <img src="x" onerror="alert(1)" />
          <script>alert(2)</script>
        </body>
      </foreignObject>
      <path id="safe" d="M0 0h10" />
    </svg>
  `);

  assert.equal(svg.querySelector('foreignObject'), null);
  assert.equal(svg.querySelector('body'), null);
  assert.equal(svg.querySelector('img'), null);
  assert.equal(svg.querySelector('script'), null);
  assert.equal(svg.querySelector('#safe')?.getAttribute('d'), 'M0 0h10');
});

test('removes style and CSS injection from style elements, style attributes, and paint attributes', () => {
  const svg = sanitize(`
    <svg viewBox="0 0 10 10" xmlns="${SVG_NS}">
      <style>@import url(https://evil.example/x.css); path{fill:url(javascript:alert(1))}</style>
      <path id="path" d="M0 0h10" style="background:url(javascript:alert(2)); fill:red" fill="url(javascript:alert(3))" stroke="url(#safe)" />
      <stop id="stop" offset="0" stop-color="url( javascript:alert(4) )" />
    </svg>
  `);
  const path = svg.querySelector('#path');
  const stop = svg.querySelector('#stop');

  assert.equal(svg.querySelector('style'), null);
  assert.equal(path?.getAttribute('style'), null);
  assert.equal(path?.getAttribute('fill'), null);
  assert.equal(path?.getAttribute('stroke'), 'url(#safe)');
  assert.equal(stop?.getAttribute('stop-color'), null);
});

test('handles namespace tricks and rejects wrong-root namespaces', () => {
  const namespaced = sanitize(`
    <svg viewBox="0 0 10 10" xmlns="${SVG_NS}" xmlns:p="http://www.w3.org/1999/xhtml">
      <p:script>alert(1)</p:script>
      <path id="safe" d="M0 0h10" />
    </svg>
  `);

  assert.equal(namespaced.querySelector('script'), null);
  assert.equal(namespaced.querySelector('p\\:script'), null);
  assert.equal(namespaced.querySelector('#safe')?.getAttribute('d'), 'M0 0h10');

  assert.throws(
    () => prepareSvgMarkup('<svg xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></svg>'),
    /InlineSVG expected (markup containing a root <svg> element|an SVG root namespace|valid SVG markup)/
  );
});

test('rejects malformed SVG instead of rendering a repaired partial tree', () => {
  assert.throws(
    () => prepareSvgMarkup('<svg><path d="M0 0"><script>alert(1)</script>'),
    /InlineSVG expected (markup containing a root <svg> element|valid SVG markup)/
  );
  assert.throws(
    () => prepareSvgMarkup('<svg><path d="M0 0" onload="alert(1)" <g /></svg>'),
    /InlineSVG expected (markup containing a root <svg> element|valid SVG markup)/
  );
});

test('removes nested dangerous nodes inside allowed containers while safe siblings remain', () => {
  const svg = sanitize(`
    <svg viewBox="0 0 10 10" xmlns="${SVG_NS}">
      <defs>
        <linearGradient id="g"><stop offset="0" stop-color="#fff" /></linearGradient>
        <g><script>alert(1)</script><path id="safe" d="M0 0h10" /></g>
      </defs>
      <use id="use" href="#safe" />
    </svg>
  `);

  assert.equal(svg.querySelector('script'), null);
  assert.ok(svg.querySelector('linearGradient#g'));
  assert.equal(svg.querySelector('stop')?.getAttribute('stop-color'), '#fff');
  assert.equal(svg.querySelector('#safe')?.getAttribute('d'), 'M0 0h10');
  assert.equal(svg.querySelector('#use')?.getAttribute('href'), '#safe');
});

test('preserves supported safe SVG features, accessibility title, dimensions, and currentColor behavior', () => {
  const svg = sanitize(
    `
      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="${SVG_NS}">
        <defs>
          <linearGradient id="g"><stop offset="0" stop-color="#fff" /><stop offset="1" stop-color="#000" /></linearGradient>
          <clipPath id="c"><rect width="24" height="24" /></clipPath>
          <filter id="f"><feGaussianBlur stdDeviation="1" /></filter>
        </defs>
        <path id="p" class="icon-path" data-testid="path" aria-label="shape" d="M0 0h24v24z" fill="url(#g)" clip-path="url(#c)" filter="url(#f)" stroke="#123" />
        <text id="label" x="1" y="12"><tspan>OK</tspan></text>
      </svg>
    `,
    { currentColor: true, title: 'Safe icon' }
  );
  const path = svg.querySelector('#p');

  assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
  assert.equal(svg.getAttribute('width'), '24');
  assert.equal(svg.getAttribute('height'), '24');
  assert.equal(svg.getAttribute('role'), 'img');
  assert.equal(svg.getAttribute('aria-label'), 'Safe icon');
  assert.equal(svg.querySelector('title')?.textContent, 'Safe icon');
  assert.equal(path?.getAttribute('class'), 'icon-path');
  assert.equal(path?.getAttribute('data-testid'), 'path');
  assert.equal(path?.getAttribute('fill'), 'url(#g)');
  assert.equal(path?.getAttribute('clip-path'), 'url(#c)');
  assert.equal(path?.getAttribute('filter'), 'url(#f)');
  assert.equal(path?.getAttribute('stroke'), 'currentColor');
  assert.equal(svg.querySelector('linearGradient#g stop')?.getAttribute('stop-color'), '#fff');
  assert.ok(svg.querySelector('clipPath#c rect'));
  assert.equal(svg.querySelector('filter#f feGaussianBlur')?.getAttribute('stdDeviation'), '1');
  assert.equal(svg.querySelector('#label tspan')?.textContent, 'OK');
});
