import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/virtualCube';
import { WLEDRestClient } from '@/core/wled/WLEDRestClient';

const TEST_IP = '192.168.1.100';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('WLEDRestClient', () => {
  it('TestWLEDRestClient_GetInfo_ReturnsHs16Firmware', async () => {
    const client = new WLEDRestClient(TEST_IP);
    const info = await client.getInfo();
    expect(info.ver).toBe('hs-1.6');
    expect(info.leds.count).toBe(480);
  });

  it('TestWLEDRestClient_GetEffects_ReturnsArrayContainingSolid', async () => {
    const client = new WLEDRestClient(TEST_IP);
    const effects = await client.getEffects();
    expect(effects).toContain('Solid');
  });

  it('TestWLEDRestClient_GetPalettes_ReturnsArrayContainingDefault', async () => {
    const client = new WLEDRestClient(TEST_IP);
    const palettes = await client.getPalettes();
    expect(palettes).toContain('Default');
  });

  it('TestWLEDRestClient_SetState_SendsPostToJsonState', async () => {
    const client = new WLEDRestClient(TEST_IP);
    // Should not throw
    await expect(client.setState({ bri: 200 })).resolves.toBeUndefined();
  });

  it('TestWLEDRestClient_QueueSerializesCalls_NotParallel', async () => {
    const callOrder: string[] = [];
    server.use(
      http.get('http://*/json/eff', async () => {
        callOrder.push('eff-start');
        await new Promise(r => setTimeout(r, 50));
        callOrder.push('eff-end');
        return HttpResponse.json(['Solid']);
      }),
      http.get('http://*/json/pal', async () => {
        callOrder.push('pal-start');
        return HttpResponse.json(['Default']);
      }),
    );
    const client = new WLEDRestClient(TEST_IP);
    // Enqueue both before either resolves
    const p1 = client.getEffects();
    const p2 = client.getPalettes();
    await Promise.all([p1, p2]);
    // Sequential means eff-end must come before pal-start
    expect(callOrder.indexOf('eff-end')).toBeLessThan(callOrder.indexOf('pal-start'));
  });

  it('TestWLEDRestClient_FailedRequest_DoesNotBlockQueue', async () => {
    server.use(
      http.post('http://*/json/state', () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const client = new WLEDRestClient(TEST_IP);
    // First call fails
    const failPromise = client.setState({ bri: 200 });
    // Second call should still succeed (getInfo uses the default handler)
    const infoPromise = client.getInfo();

    await expect(failPromise).rejects.toThrow('WLED setState failed: 500');
    const info = await infoPromise;
    expect(info.ver).toBe('hs-1.6');
  });

  it('TestWLEDRestClient_QueueDepth_ReflectsQueueState', async () => {
    const client = new WLEDRestClient(TEST_IP);
    expect(client.queueDepth).toBe(0);

    server.use(
      http.get('http://*/json/info', async () => {
        await new Promise(r => setTimeout(r, 100));
        return HttpResponse.json({ ver: 'hs-1.6', leds: { count: 480 } });
      }),
    );

    const p1 = client.getInfo();
    const p2 = client.getEffects();
    // One processing + one waiting
    expect(client.queueDepth).toBeGreaterThanOrEqual(1);
    await Promise.all([p1, p2]);
  });
});
