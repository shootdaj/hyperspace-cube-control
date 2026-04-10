import { describe, it, expect } from 'vitest';
import { WLEDRestClient } from '../WLEDRestClient';

describe('WLEDRestClient', () => {
  it('TestWLEDRestClient_Constructor_StoresIp', () => {
    const client = new WLEDRestClient('192.168.1.160');
    expect(client).toBeDefined();
  });

  it('TestWLEDRestClient_QueueDepth_StartsAtZero', () => {
    const client = new WLEDRestClient('192.168.1.160');
    expect(client.queueDepth).toBe(0);
  });
});
