'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const moduleUrl = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'platform', 'host-adapter.mjs')).href;
const adapterModule = import(moduleUrl);

test('W25-001: fake browser và fake native cùng thực thi contract host tối thiểu', async () => {
  const {
    CapabilityStatus,
    HostSurface,
    assertHostAdapter,
    createFakeBrowserHostAdapter,
    createFakeNativeHostAdapter,
  } = await adapterModule;
  const browser = createFakeBrowserHostAdapter();
  const native = createFakeNativeHostAdapter({ capabilities: { microphone: CapabilityStatus.DENIED } });

  assert.equal(assertHostAdapter(browser), browser);
  assert.equal(assertHostAdapter(native), native);
  assert.equal(browser.getContext().surface, HostSurface.DESKTOP);
  assert.equal(native.getContext().surface, HostSurface.NATIVE);
  assert.deepEqual(await native.requestCapability('microphone'), {
    capability: 'microphone', status: CapabilityStatus.DENIED,
  });
  assert.deepEqual(await native.requestCapability('camera'), {
    capability: 'camera', status: CapabilityStatus.UNAVAILABLE,
  });
});

test('W25-002: chọn shell theo surface tường minh; Native không fallback sang Browser', async () => {
  const {
    HostAdapterUnavailableError,
    HostSurface,
    createFakeBrowserHostAdapter,
    createFakeNativeHostAdapter,
    createHostAdapterRegistry,
  } = await adapterModule;
  const browser = createFakeBrowserHostAdapter();
  const native = createFakeNativeHostAdapter();

  const complete = createHostAdapterRegistry({ browser, native });
  assert.equal(complete.select(HostSurface.DESKTOP), browser);
  assert.equal(complete.select(HostSurface.NATIVE), native);

  const browserOnly = createHostAdapterRegistry({ browser });
  assert.throws(() => browserOnly.select(HostSurface.NATIVE), (error) => (
    error instanceof HostAdapterUnavailableError && error.code === 'HOST_ADAPTER_UNAVAILABLE'
  ));
  assert.throws(() => complete.select('responsive'), /surface không hợp lệ/);
});

test('W25-003: fake native mô phỏng lifecycle, safe area, deep link và Back mà không mang principal', async () => {
  const {
    HostEvent,
    createFakeNativeHostAdapter,
  } = await adapterModule;
  const native = createFakeNativeHostAdapter({ safeArea: { top: 24, bottom: 20 } });
  const events = [];
  const stop = native.subscribe(HostEvent.LIFECYCLE, (payload) => events.push(['lifecycle', payload]));
  native.subscribe(HostEvent.VIEWPORT, (payload) => events.push(['viewport', payload]));
  native.subscribe(HostEvent.DEEP_LINK, (payload) => events.push(['deep-link', payload]));

  native.emit(HostEvent.LIFECYCLE, { state: 'background' });
  native.emit(HostEvent.VIEWPORT, { safeArea: { bottom: 34 } });
  native.emit(HostEvent.DEEP_LINK, { path: '/people/42' });
  stop();
  native.setSystemGestureEnabled(false);
  assert.deepEqual(await native.goBack({ reason: 'dirty-form-discarded' }), { status: 'handled' });

  assert.equal(native.getLifecycle(), 'background');
  assert.deepEqual(native.getSafeArea(), { top: 24, right: 0, bottom: 34, left: 0 });
  assert.equal('principal' in native.getContext(), false, 'adapter không được là nguồn principal trước O3');
  assert.deepEqual(events, [
    ['lifecycle', { state: 'background' }],
    ['viewport', { safeArea: { bottom: 34 } }],
    ['deep-link', { path: '/people/42' }],
  ]);
  assert.deepEqual(native.inspect().calls, [
    { method: 'setSystemGestureEnabled', enabled: false },
    { method: 'goBack', reason: 'dirty-form-discarded' },
  ]);
});

test('W25-004: provider thiếu method hoặc trả capability status sai bị từ chối sớm', async () => {
  const {
    assertHostAdapter,
    createFakeBrowserHostAdapter,
    createFakeNativeHostAdapter,
  } = await adapterModule;
  assert.throws(() => assertHostAdapter({ surface: 'native' }), /getContext/);
  assert.throws(() => createFakeNativeHostAdapter({ capabilities: { microphone: 'allowed' } }), /không hợp lệ/);
  assert.throws(() => createFakeNativeHostAdapter({ context: { principal: { id: 'forbidden' } } }), /không được chứa principal/);
  assert.equal(createFakeBrowserHostAdapter({ surface: 'native' }).surface, 'desktop', 'fake browser không thể tự nhận Native');
});
