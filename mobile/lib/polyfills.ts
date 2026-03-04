// Polyfills for APIs missing in Hermes (React Native JS engine)

// DOMException — used by various web APIs but not available in Hermes
if (typeof globalThis.DOMException === 'undefined') {
  class DOMExceptionPolyfill extends Error {
    code: number;
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || 'Error';
      this.code = 0;
    }
  }
  (globalThis as any).DOMException = DOMExceptionPolyfill;
}

// AbortSignal.timeout() — used by @atproto/oauth-client but not available in Hermes
if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = (ms: number): AbortSignal => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), ms);
    return controller.signal;
  };
}

// AbortSignal.throwIfAborted() — missing in some Hermes versions
if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.prototype.throwIfAborted !== 'function') {
  AbortSignal.prototype.throwIfAborted = function () {
    if (this.aborted) {
      throw this.reason ?? new DOMException('The operation was aborted', 'AbortError');
    }
  };
}

// Patch fetch to handle options React Native doesn't support.
// The ATProto OAuth library passes redirect:'error' and cache:'no-cache'
// to fetch — both are standard browser Fetch API options that RN ignores
// or chokes on. Since bsky.social doesn't redirect anyway, stripping
// these is a no-op in practice.
const _originalFetch = globalThis.fetch;
globalThis.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (init?.redirect === 'error' || init?.cache) {
    const { redirect, cache, ...safeInit } = init;
    return _originalFetch(input, safeInit);
  }
  return _originalFetch(input, init);
} as typeof fetch;
