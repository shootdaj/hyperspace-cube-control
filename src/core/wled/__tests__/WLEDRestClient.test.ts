import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildWledUrl } from '../WLEDRestClient';

/**
 * Tests for WLEDRestClient URL construction logic.
 *
 * buildWledUrl is exported for testability. WLEDRestClient uses it internally
 * with `import.meta.env.DEV && !import.meta.env.TEST` so that tests continue
 * to use direct IP URLs (MSW can intercept them), while the dev browser uses
 * the /api/wled-proxy endpoint to bypass Chrome PNA blocks.
 */

describe('WLEDRestClient_buildUrl', () => {
  afterEach(() => {
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

  it('TestWLEDRestClient_BuildUrl_PostUsesProxyUrl_WhenDevTrue', () => {
    // Verify proxy URL construction for the setState path used in POST requests
    const url = buildWledUrl('192.168.1.160', '/json/state', true);
    expect(url).toBe('/api/wled-proxy?target=192.168.1.160&path=%2Fjson%2Fstate');
  });
});
