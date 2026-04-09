import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from '../mocks/virtualCube';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { connectionStore } from '@/core/store/connectionStore';
import type { WLEDMessage } from '@/core/wled/types';

const TEST_IP = '192.168.1.100';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  WLEDWebSocketService._resetForTest();
  connectionStore.setState({ ip: '', status: 'disconnected' });
  server.resetHandlers();
});
afterAll(() => server.close());

function waitForStatus(status: string, timeout = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for status: ${status}`)), timeout);
    const unsub = connectionStore.subscribe((state) => {
      if (state.status === status) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
    // Check immediately in case already at status
    if (connectionStore.getState().status === status) {
      clearTimeout(timer);
      unsub();
      resolve();
    }
  });
}

describe('WLEDWebSocketService', () => {
  it('TestWLEDWebSocketService_GetInstance_ReturnsSameSingleton', () => {
    const a = WLEDWebSocketService.getInstance();
    const b = WLEDWebSocketService.getInstance();
    expect(a).toBe(b);
  });

  it('TestWLEDWebSocketService_Connect_SetsStatusToConnected', async () => {
    const service = WLEDWebSocketService.getInstance();
    service.connect(TEST_IP);
    await waitForStatus('connected');
    expect(connectionStore.getState().status).toBe('connected');
  });

  it('TestWLEDWebSocketService_Connect_ReceivesInitialState', async () => {
    const service = WLEDWebSocketService.getInstance();
    const messages: WLEDMessage[] = [];
    service.subscribe((msg) => messages.push(msg));
    service.connect(TEST_IP);
    await waitForStatus('connected');

    // Wait for message delivery
    await new Promise((r) => setTimeout(r, 200));
    expect(messages.length).toBeGreaterThan(0);
    const firstMsg = messages[0] as { state?: unknown; info?: unknown };
    expect(firstMsg.state).toBeDefined();
    expect(firstMsg.info).toBeDefined();
  });

  it('TestWLEDWebSocketService_Subscribe_MultipleHandlersReceiveMessages', async () => {
    const service = WLEDWebSocketService.getInstance();
    const handler1: WLEDMessage[] = [];
    const handler2: WLEDMessage[] = [];
    service.subscribe((msg) => handler1.push(msg));
    service.subscribe((msg) => handler2.push(msg));
    service.connect(TEST_IP);
    await waitForStatus('connected');
    await new Promise((r) => setTimeout(r, 200));
    expect(handler1.length).toBeGreaterThan(0);
    expect(handler2.length).toBeGreaterThan(0);
  });

  it('TestWLEDWebSocketService_Unsubscribe_StopsDelivery', async () => {
    const service = WLEDWebSocketService.getInstance();
    const handler1: WLEDMessage[] = [];
    const handler2: WLEDMessage[] = [];
    const unsub1 = service.subscribe((msg) => handler1.push(msg));
    service.subscribe((msg) => handler2.push(msg));

    // Unsubscribe handler1 before connecting
    unsub1();

    service.connect(TEST_IP);
    await waitForStatus('connected');
    await new Promise((r) => setTimeout(r, 200));
    expect(handler1.length).toBe(0);
    expect(handler2.length).toBeGreaterThan(0);
  });

  it('TestWLEDWebSocketService_RequestLiveStream_SendsOnlyOnce', async () => {
    const service = WLEDWebSocketService.getInstance();
    const messages: WLEDMessage[] = [];
    service.subscribe((msg) => messages.push(msg));
    service.connect(TEST_IP);
    await waitForStatus('connected');
    await new Promise((r) => setTimeout(r, 100));

    const countBefore = messages.length;
    service.requestLiveStream();
    service.requestLiveStream(); // second call should be no-op
    service.requestLiveStream(); // third call should be no-op
    await new Promise((r) => setTimeout(r, 200));

    // Only one live LED message should arrive (from one lv:true send)
    const liveMessages = messages.slice(countBefore).filter((m) => 'leds' in m);
    expect(liveMessages.length).toBe(1);
  });

  it('TestWLEDWebSocketService_Disconnect_PreventsReconnect', async () => {
    const service = WLEDWebSocketService.getInstance();
    service.connect(TEST_IP);
    await waitForStatus('connected');

    service.disconnect();
    expect(connectionStore.getState().status).toBe('disconnected');

    // Wait to verify no reconnect attempt
    await new Promise((r) => setTimeout(r, 700));
    expect(connectionStore.getState().status).toBe('disconnected');
  });
});
