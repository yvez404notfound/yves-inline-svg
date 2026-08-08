"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { prepareSvgMarkup } from './sanitize.js';

export type InlineSVGSource = string | { src: string };
export type InlineSVGLoading = 'eager' | 'lazy';

export interface InlineSVGLoadEvent {
  source: 'src' | 'svg';
  src?: string;
  svg: string;
}

export interface InlineSVGProps {
  /** URL produced by an SVG import/static asset pipeline, a public asset path, or a remote SVG URL. */
  src?: InlineSVGSource;
  /** Raw SVG markup. Supplying this enables deterministic server rendering. */
  svg?: string;
  /** CSS color applied to the component wrapper; literal fill/stroke paints use it when supplied. */
  color?: string;
  /** Convenience square width/height for the wrapper; the inner SVG fills it. */
  size?: number | string;
  /** Explicit wrapper width. Overrides size for width. */
  width?: number | string;
  /** Explicit wrapper height. Overrides size for height. */
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Accessible image title. Omit or pass an empty string to mark the SVG decorative. */
  title?: string;
  /** Remove source width/height attributes. Dimension props also replace those source attributes with SVG fill sizing. */
  removeDimensions?: boolean;
  /** Rewrite fill/stroke paint attributes to currentColor. Defaults to true when color is supplied; set false to preserve source paints. */
  currentColor?: boolean;
  /** URL loading strategy. Lazy loading uses IntersectionObserver when available. */
  loading?: InlineSVGLoading;
  /** Stable content shown while a URL is loading or if loading/sanitization fails; make it accessible if it conveys meaning. */
  fallback?: ReactNode;
  onLoad?: (event: InlineSVGLoadEvent) => void;
  onError?: (error: Error) => void;
}

interface PreparedState {
  error: Error | null;
  markup: string | null;
}

export function InlineSVG({
  className,
  color,
  currentColor,
  fallback = null,
  height,
  loading = 'eager',
  onError,
  onLoad,
  removeDimensions = false,
  size,
  src,
  style,
  svg,
  title,
  width
}: InlineSVGProps): JSX.Element {
  const normalizedSrc = normalizeSrc(src);
  const shellRef = useRef<HTMLSpanElement | null>(null);
  const [canFetch, setCanFetch] = useState(() => loading !== 'lazy');
  const [fetchedSvg, setFetchedSvg] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const hasInlineMarkup = svg !== undefined;
  const shouldRewriteToCurrentColor = currentColor ?? (color !== undefined);
  const shouldFillSvgWidth = shouldFillWidth({ size, style, width });
  const shouldFillSvgHeight = shouldFillHeight({ height, size, style });

  useEffect(() => {
    setCanFetch(loading !== 'lazy');
  }, [loading, normalizedSrc]);

  useEffect(() => {
    if (loading !== 'lazy' || canFetch || hasInlineMarkup || !normalizedSrc) {
      return;
    }

    const shell = shellRef.current;
    const BrowserIntersectionObserver = globalThis.window?.IntersectionObserver;

    if (!shell || !BrowserIntersectionObserver) {
      setCanFetch(true);
      return;
    }

    const observer = new BrowserIntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setCanFetch(true);
        observer.disconnect();
      }
    });

    observer.observe(shell);

    return () => {
      observer.disconnect();
    };
  }, [canFetch, hasInlineMarkup, loading, normalizedSrc]);

  useEffect(() => {
    if (hasInlineMarkup || !normalizedSrc) {
      setFetchedSvg(null);
      setFetchError(null);
      setIsFetching(false);
      return;
    }

    if (!canFetch) {
      setFetchedSvg(null);
      setFetchError(null);
      setIsFetching(false);
      return;
    }

    const fetchSvg = globalThis.fetch;
    if (!fetchSvg) {
      setFetchedSvg(null);
      setFetchError(new Error('InlineSVG requires fetch() to load src URLs in the browser.'));
      setIsFetching(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setFetchedSvg(null);
    setFetchError(null);
    setIsFetching(true);

    fetchSvg(normalizedSrc, {
      headers: {
        Accept: 'image/svg+xml,text/plain;q=0.8,*/*;q=0.5'
      },
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`InlineSVG failed to load ${normalizedSrc}: ${response.status} ${response.statusText}`.trim());
        }

        return response.text();
      })
      .then((text) => {
        if (!active) {
          return;
        }

        setFetchedSvg(text);
        setIsFetching(false);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) {
          return;
        }

        setFetchedSvg(null);
        setFetchError(toError(error));
        setIsFetching(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [canFetch, hasInlineMarkup, normalizedSrc]);

  const rawMarkup = hasInlineMarkup ? svg : fetchedSvg;
  const prepared = useMemo<PreparedState>(() => {
    if (rawMarkup === undefined || rawMarkup === null) {
      return { error: null, markup: null };
    }

    try {
      return {
        error: null,
        markup: prepareSvgMarkup(rawMarkup, {
          currentColor: shouldRewriteToCurrentColor,
          fillHeight: shouldFillSvgHeight,
          fillWidth: shouldFillSvgWidth,
          removeDimensions,
          title
        })
      };
    } catch (error) {
      return { error: toError(error), markup: null };
    }
  }, [rawMarkup, removeDimensions, shouldFillSvgHeight, shouldFillSvgWidth, shouldRewriteToCurrentColor, title]);

  const currentError = fetchError ?? prepared.error;
  const lastReportedError = useRef<string | null>(null);

  useEffect(() => {
    if (!currentError) {
      lastReportedError.current = null;
      return;
    }

    const key = `${currentError.name}:${currentError.message}`;
    if (lastReportedError.current === key) {
      return;
    }

    lastReportedError.current = key;
    onError?.(currentError);
  }, [currentError, onError]);

  const lastLoadedMarkup = useRef<string | null>(null);

  useEffect(() => {
    if (!prepared.markup) {
      return;
    }

    if (lastLoadedMarkup.current === prepared.markup) {
      return;
    }

    lastLoadedMarkup.current = prepared.markup;
    onLoad?.({
      source: hasInlineMarkup ? 'svg' : 'src',
      src: hasInlineMarkup ? undefined : normalizedSrc,
      svg: prepared.markup
    });
  }, [hasInlineMarkup, normalizedSrc, onLoad, prepared.markup]);

  const wrapperStyle = useMemo(
    () => buildWrapperStyle({ color, height, size, style, width }),
    [color, height, size, style, width]
  );
  const status = prepared.markup ? 'loaded' : currentError ? 'error' : isFetching || normalizedSrc ? 'loading' : 'idle';

  const shellProps = {
    'aria-busy': status === 'loading' ? true : undefined,
    className,
    'data-inline-svg': status,
    ref: shellRef,
    style: wrapperStyle,
    suppressHydrationWarning: true
  };

  if (prepared.markup) {
    return <span {...shellProps} dangerouslySetInnerHTML={{ __html: prepared.markup }} />;
  }

  return <span {...shellProps}>{fallback}</span>;
}

InlineSVG.displayName = 'InlineSVG';

export default InlineSVG;

function normalizeSrc(src: InlineSVGSource | undefined): string | undefined {
  if (typeof src === 'string') {
    return src;
  }

  if (src && typeof src.src === 'string') {
    return src.src;
  }

  return undefined;
}

function buildWrapperStyle({
  color,
  height,
  size,
  style,
  width
}: {
  color?: string;
  height?: number | string;
  size?: number | string;
  style?: CSSProperties;
  width?: number | string;
}): CSSProperties {
  return {
    display: 'block',
    ...(style ?? {}),
    ...(size !== undefined ? { height: size, width: size } : null),
    ...(width !== undefined ? { width } : null),
    ...(height !== undefined ? { height } : null),
    ...(color !== undefined ? { color } : null)
  };
}

function shouldFillWidth({ size, style, width }: { size?: number | string; style?: CSSProperties; width?: number | string }): boolean {
  return size !== undefined || width !== undefined || style?.width !== undefined || style?.inlineSize !== undefined;
}

function shouldFillHeight({ height, size, style }: { height?: number | string; size?: number | string; style?: CSSProperties }): boolean {
  return size !== undefined || height !== undefined || style?.height !== undefined || style?.blockSize !== undefined;
}

function isAbortError(error: unknown): boolean {
  return typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError';
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
