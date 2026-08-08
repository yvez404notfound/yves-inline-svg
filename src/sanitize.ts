import sanitizeHtml from 'sanitize-html';

export interface PrepareSvgOptions {
  currentColor?: boolean;
  fillHeight?: boolean;
  fillWidth?: boolean;
  removeDimensions?: boolean;
  title?: string;
}

const SVG_TAGS = [
  'svg',
  'g',
  'path',
  'circle',
  'rect',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'defs',
  'symbol',
  'use',
  'title',
  'desc',
  'metadata',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
  'image',
  'text',
  'tspan',
  'textPath',
  'marker',
  'filter',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence'
];

const SVG_ATTRIBUTES = [
  'aria-*',
  'class',
  'clip-path',
  'clip-rule',
  'clipPathUnits',
  'color',
  'cx',
  'cy',
  'd',
  'data-*',
  'dx',
  'dy',
  'edgeMode',
  'fill',
  'fill-opacity',
  'fill-rule',
  'filter',
  'filterUnits',
  'flood-color',
  'flood-opacity',
  'focusable',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'fx',
  'fy',
  'gradientTransform',
  'gradientUnits',
  'height',
  'href',
  'id',
  'in',
  'in2',
  'kerning',
  'letter-spacing',
  'lighting-color',
  'marker-end',
  'marker-mid',
  'marker-start',
  'markerHeight',
  'markerUnits',
  'markerWidth',
  'mask',
  'maskContentUnits',
  'maskUnits',
  'offset',
  'opacity',
  'orient',
  'overflow',
  'pathLength',
  'patternContentUnits',
  'patternTransform',
  'patternUnits',
  'points',
  'preserveAlpha',
  'preserveAspectRatio',
  'r',
  'refX',
  'refY',
  'result',
  'role',
  'rx',
  'ry',
  'shape-rendering',
  'spreadMethod',
  'stdDeviation',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'tabindex',
  'text-anchor',
  'text-decoration',
  'transform',
  'type',
  'values',
  'vector-effect',
  'viewBox',
  'viewbox',
  'width',
  'word-spacing',
  'x',
  'x1',
  'x2',
  'xlink:href',
  'xmlns',
  'xmlns:xlink',
  'y',
  'y1',
  'y2'
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: SVG_TAGS,
  allowedAttributes: {
    '*': SVG_ATTRIBUTES
  },
  allowedSchemes: ['http', 'https'],
  allowedSchemesAppliedToAttributes: ['href', 'src', 'xlink:href'],
  allowProtocolRelative: false,
  parser: {
    lowerCaseAttributeNames: false,
    lowerCaseTags: false
  }
};

interface ParsedAttribute {
  name: string;
  rawValue: string | null;
}

export function prepareSvgMarkup(markup: string, options: PrepareSvgOptions = {}): string {
  if (typeof markup !== 'string' || markup.trim().length === 0) {
    throw new Error('InlineSVG expected non-empty SVG markup.');
  }

  const sanitized = removeUnsafeUrlFunctionAttributes(sanitizeHtml(markup, SANITIZE_OPTIONS));
  const extracted = extractSvgElement(sanitized);

  if (!extracted) {
    throw new Error('InlineSVG expected markup containing a root <svg> element.');
  }

  const colorReady = options.currentColor === true ? rewritePaintAttributesToCurrentColor(extracted) : extracted;
  return applyRootSvgOptions(colorReady, options);
}

export function rewritePaintAttributesToCurrentColor(svg: string): string {
  return svg.replace(
    /\s(fill|stroke)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
    (match, attributeName: string, quotedValue: string, doubleQuoted?: string, singleQuoted?: string, bare?: string) => {
      const value = doubleQuoted ?? singleQuoted ?? bare ?? '';
      if (!shouldRewritePaint(value)) {
        return match;
      }

      const quote = quotedValue.startsWith("'") ? "'" : '"';
      return ` ${attributeName}=${quote}currentColor${quote}`;
    }
  );
}

function shouldRewritePaint(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (
    normalized.length === 0 ||
    normalized === 'none' ||
    normalized === 'currentcolor' ||
    normalized === 'inherit' ||
    normalized === 'initial' ||
    normalized === 'revert' ||
    normalized === 'transparent' ||
    normalized === 'unset' ||
    normalized === 'context-fill' ||
    normalized === 'context-stroke' ||
    normalized.startsWith('var(') ||
    normalized.includes('url(')
  ) {
    return false;
  }

  return true;
}

function removeUnsafeUrlFunctionAttributes(markup: string): string {
  return markup.replace(
    /\s([^\s"'<>/=]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,
    (match, _attributeName: string, _quotedValue: string, doubleQuoted?: string, singleQuoted?: string, bare?: string) => {
      const value = doubleQuoted ?? singleQuoted ?? bare ?? '';
      return hasUnsafeUrlFunction(value) ? '' : match;
    }
  );
}

function hasUnsafeUrlFunction(value: string): boolean {
  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(value)) !== null) {
    if (!isSafeUrlReference(match[2] ?? '')) {
      return true;
    }
  }

  return false;
}

function isSafeUrlReference(value: string): boolean {
  const normalized = decodeBasicEntities(value).trim().replace(/^['"]|['"]$/g, '').toLowerCase();

  return normalized.startsWith('#') || normalized.startsWith('http://') || normalized.startsWith('https://');
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function extractSvgElement(markup: string): string | null {
  const start = markup.search(/<svg\b/i);
  if (start < 0) {
    return null;
  }

  const end = markup.toLowerCase().lastIndexOf('</svg>');
  if (end < start) {
    return null;
  }

  return markup.slice(start, end + '</svg>'.length).trim();
}

function applyRootSvgOptions(svg: string, options: PrepareSvgOptions): string {
  const openingEnd = findOpeningTagEnd(svg);
  if (openingEnd < 0) {
    throw new Error('InlineSVG could not read the root <svg> element.');
  }

  const openingTag = svg.slice(0, openingEnd + 1);
  const closingAndBody = svg.slice(openingEnd + 1);
  const attributes = parseAttributes(openingTag.slice('<svg'.length, -1));

  if (options.removeDimensions || options.fillWidth || options.fillHeight) {
    deleteAttribute(attributes, 'width');
    deleteAttribute(attributes, 'height');
  }

  if (options.fillWidth) {
    setAttribute(attributes, 'width', '100%');
  }

  if (options.fillHeight) {
    setAttribute(attributes, 'height', '100%');
  }

  let body = closingAndBody;

  if (options.title !== undefined) {
    body = body.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '');

    if (options.title.length > 0) {
      setAttribute(attributes, 'role', 'img');
      setAttribute(attributes, 'aria-label', options.title);
      body = `<title>${escapeText(options.title)}</title>${body}`;
    } else {
      deleteAttribute(attributes, 'role');
      deleteAttribute(attributes, 'aria-label');
      setAttribute(attributes, 'aria-hidden', 'true');
    }
  }

  return `<svg${stringifyAttributes(attributes)}>${body}`;
}

function findOpeningTagEnd(markup: string): number {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < markup.length; index += 1) {
    const char = markup[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '>') {
      return index;
    }
  }

  return -1;
}

function parseAttributes(source: string): ParsedAttribute[] {
  const attributes: ParsedAttribute[] = [];
  const attributePattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(source)) !== null) {
    attributes.push({
      name: match[1],
      rawValue: match[2] ?? match[3] ?? match[4] ?? null
    });
  }

  return attributes;
}

function deleteAttribute(attributes: ParsedAttribute[], name: string): void {
  const normalized = name.toLowerCase();

  for (let index = attributes.length - 1; index >= 0; index -= 1) {
    if (attributes[index]?.name.toLowerCase() === normalized) {
      attributes.splice(index, 1);
    }
  }
}

function setAttribute(attributes: ParsedAttribute[], name: string, value: string): void {
  const normalized = name.toLowerCase();
  const existing = attributes.find((attribute) => attribute.name.toLowerCase() === normalized);
  const rawValue = escapeAttribute(value);

  if (existing) {
    existing.name = name;
    existing.rawValue = rawValue;
    return;
  }

  attributes.push({ name, rawValue });
}

function stringifyAttributes(attributes: ParsedAttribute[]): string {
  return attributes
    .map((attribute) => {
      if (attribute.rawValue === null) {
        return ` ${attribute.name}`;
      }

      return ` ${attribute.name}="${attribute.rawValue}"`;
    })
    .join('');
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
