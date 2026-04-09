import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildWledUrl } from '../WLEDRestClient';

/**
 * Tests for WLEDRestClient URL construction logic.
 *
 * buildWledUrl is exported for testability. WLEDRestClient uses it internally
 * with import.meta.env.DEV as the default for the devMode parameter.
 */

describe('WLEDRestClient_buildUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('TestWLEDRestClient_BuildUrl_ReturnsProxyUrl_WhenDevTrue', () => {
    const url = buildWledUrl('192.168.1.160', '/json/state', true);
    expect(url).toBe('/api/wled-proxy?target=192.168.1.160&path=%2Fjson%2Fstate');
  });

  it('TestWLEDRestClient_BuildUrl_ReturnsDirectUrl_WhenDevFalse', () => {
    const url = buildWledUrl('192.168.1.160', '/json/state', false);
    expect(url).toBe('http://192.168.1.160/json/state');
  });

  it('TestWLEDRestClient_BuildUrl_EncodesPathCorrectly_WhenDevTrue', () => {
    const url = buildWledUrl('192.168.1.160', '/json/eff', true);
    expect(url).toBe('/api/wled-proxy?target=192.168.1.160&path=%2Fjson%2Feff');
  });

  it('TestWLEDRestClient_BuildUrl_PostUsesProxyUrl_WhenDevTrue', async () => {
    const { WLEDRestClient } = await import('../WLEDRestClient');
    // In vitest, import.meta.env.DEV is true (test mode = dev mode)
    // so setState will use the proxy URL
    const client = new WLEDRestClient('192.168.1.160');
    await client.setState({ on: true });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/wled-proxy?target=192.168.1.160&path=%2Fjson%2Fstate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ on: true }) }),
    );
  });
});
