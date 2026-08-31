/**
 * W2.5 host adapter contract.
 *
 * This module deliberately contains no AMIS bridge API names or credentials.
 * O3 owns the production bridge contract. UI selects its shell from an explicit
 * host surface, then continues to obtain identity and authorization from the
 * existing server-side session/API contract.
 */

export const HostSurface = Object.freeze({
  DESKTOP: 'desktop',
  NATIVE: 'native',
});

export const HostEvent = Object.freeze({
  VIEWPORT: 'viewport',
  LIFECYCLE: 'lifecycle',
  DEEP_LINK: 'deep-link',
  KEYBOARD: 'keyboard',
});

export const CapabilityStatus = Object.freeze({
  GRANTED: 'granted',
  LIMITED: 'limited',
  DENIED: 'denied',
  BLOCKED: 'blocked',
  UNAVAILABLE: 'unavailable',
});

const SURFACES = new Set(Object.values(HostSurface));
const EVENTS = new Set(Object.values(HostEvent));
const CAPABILITY_STATUSES = new Set(Object.values(CapabilityStatus));
const REQUIRED_METHODS = Object.freeze([
  'getContext',
  'getSafeArea',
  'getLifecycle',
  'subscribe',
  'goBack',
  'requestCapability',
  'openSettings',
  'setSystemGestureEnabled',
]);

export class HostAdapterUnavailableError extends Error {
  constructor(surface) {
    super(`Không có host adapter hợp lệ cho surface "${surface}".`);
    this.name = 'HostAdapterUnavailableError';
    this.code = 'HOST_ADAPTER_UNAVAILABLE';
  }
}

function assertSurface(surface) {
  if (!SURFACES.has(surface)) {
    throw new TypeError(`surface không hợp lệ: ${String(surface)}`);
  }
}

function clone(value) {
  return Object.freeze({ ...value });
}

/**
 * Validate the intentionally small, stable contract that every real/fake host
 * provider must implement.  Keeping this narrow avoids guessing the eventual
 * AMIS bridge message schema before O3 is approved.
 */
export function assertHostAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new TypeError('Host adapter phải là một object.');
  }
  assertSurface(adapter.surface);
  for (const method of REQUIRED_METHODS) {
    if (typeof adapter[method] !== 'function') {
      throw new TypeError(`Host adapter thiếu method bắt buộc: ${method}().`);
    }
  }
  return adapter;
}

/**
 * Surface is supplied by a trusted host/bootstrap, never inferred from a user
 * agent or role.  In particular, a Native screen cannot silently render using
 * the Browser adapter when a native provider is absent.
 */
export function createHostAdapterRegistry({ browser, native } = {}) {
  const adapters = {
    browser: browser ? assertHostAdapter(browser) : null,
    native: native ? assertHostAdapter(native) : null,
  };

  if (adapters.browser && adapters.browser.surface !== HostSurface.DESKTOP) {
    throw new TypeError('Browser adapter phải khai báo surface "desktop".');
  }
  if (adapters.native && adapters.native.surface !== HostSurface.NATIVE) {
    throw new TypeError('Native adapter phải khai báo surface "native".');
  }

  return Object.freeze({
    select(surface) {
      assertSurface(surface);
      const adapter = surface === HostSurface.NATIVE ? adapters.native : adapters.browser;
      if (!adapter) throw new HostAdapterUnavailableError(surface);
      return adapter;
    },
  });
}

function createFakeHostAdapter({ kind, surface, context = {}, safeArea = {}, capabilities = {} }) {
  assertSurface(surface);
  if (Object.hasOwn(context, 'principal')) {
    throw new TypeError('Host adapter không được chứa principal trước khi O3 có bridge contract được xác thực.');
  }
  const listeners = new Map([...EVENTS].map((event) => [event, new Set()]));
  const calls = [];
  let lifecycle = 'foreground';
  let currentSafeArea = { top: 0, right: 0, bottom: 0, left: 0, ...safeArea };
  let systemGestureEnabled = true;

  for (const [capability, status] of Object.entries(capabilities)) {
    if (!CAPABILITY_STATUSES.has(status)) {
      throw new TypeError(`Capability ${capability} có trạng thái không hợp lệ: ${String(status)}`);
    }
  }

  const adapter = {
    kind,
    surface,
    getContext() {
      // Do not add an authenticated principal here. O3 must define a verified
      // bridge-to-server principal flow before production code may consume one.
      return clone({ locale: 'vi-VN', theme: 'system', ...context, surface });
    },
    getSafeArea() {
      return clone(currentSafeArea);
    },
    getLifecycle() {
      return lifecycle;
    },
    subscribe(event, listener) {
      if (!EVENTS.has(event)) throw new TypeError(`Host event không hợp lệ: ${String(event)}`);
      if (typeof listener !== 'function') throw new TypeError('Host event listener phải là function.');
      listeners.get(event).add(listener);
      return () => listeners.get(event).delete(listener);
    },
    async goBack({ reason = 'user' } = {}) {
      calls.push({ method: 'goBack', reason });
      return { status: 'handled' };
    },
    async requestCapability(capability) {
      const status = capabilities[capability] || CapabilityStatus.UNAVAILABLE;
      calls.push({ method: 'requestCapability', capability, status });
      return { capability, status };
    },
    async openSettings(capability) {
      calls.push({ method: 'openSettings', capability });
      return { status: CapabilityStatus.UNAVAILABLE };
    },
    setSystemGestureEnabled(enabled) {
      if (typeof enabled !== 'boolean') throw new TypeError('Gesture state phải là boolean.');
      systemGestureEnabled = enabled;
      calls.push({ method: 'setSystemGestureEnabled', enabled });
    },
    // Fake-only controls keep tests deterministic. They are not part of the
    // production provider contract and must never be called by feature UI.
    emit(event, payload) {
      if (!EVENTS.has(event)) throw new TypeError(`Host event không hợp lệ: ${String(event)}`);
      if (event === HostEvent.LIFECYCLE && typeof payload?.state === 'string') lifecycle = payload.state;
      if (event === HostEvent.VIEWPORT && payload?.safeArea) currentSafeArea = { ...currentSafeArea, ...payload.safeArea };
      for (const listener of listeners.get(event)) listener(payload);
    },
    inspect() {
      return {
        calls: calls.map((call) => clone(call)),
        listenerCount: Object.fromEntries([...listeners].map(([event, set]) => [event, set.size])),
        systemGestureEnabled,
      };
    },
  };

  return Object.freeze(adapter);
}

/** Browser fallback for local development and desktop UI contract tests. */
export function createFakeBrowserHostAdapter(options = {}) {
  return createFakeHostAdapter({ ...options, kind: 'fake-browser', surface: HostSurface.DESKTOP });
}

/** Native-WebView simulation for mobile composition contract tests. */
export function createFakeNativeHostAdapter(options = {}) {
  return createFakeHostAdapter({ ...options, kind: 'fake-native', surface: HostSurface.NATIVE });
}
