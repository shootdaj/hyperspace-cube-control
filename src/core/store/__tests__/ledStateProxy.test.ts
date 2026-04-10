import { describe, it, expect, beforeEach } from 'vitest';
import { ledStateProxy } from '../ledStateProxy';

describe('ledStateProxy', () => {
  beforeEach(() => {
    // Reset state between tests
    ledStateProxy.colors.fill(0);
    ledStateProxy.lastUpdated = 0;
  });

  it('TestLedStateProxy_ColorsIsUint8Array_WithLength672', () => {
    expect(ledStateProxy.colors).toBeInstanceOf(Uint8Array);
    expect(ledStateProxy.colors.length).toBe(672); // 224 LEDs x 3 channels
  });

  it('TestLedStateProxy_InitialLastUpdated_IsZero', () => {
    expect(ledStateProxy.lastUpdated).toBe(0);
  });

  it('TestLedStateProxy_WritesToColors_Persist', () => {
    ledStateProxy.colors[0] = 255; // R of LED 0
    ledStateProxy.colors[1] = 128; // G of LED 0
    ledStateProxy.colors[2] = 64;  // B of LED 0
    expect(ledStateProxy.colors[0]).toBe(255);
    expect(ledStateProxy.colors[1]).toBe(128);
    expect(ledStateProxy.colors[2]).toBe(64);
  });

  it('TestLedStateProxy_BulkSet_UpdatesBuffer', () => {
    const newColors = new Uint8Array(672).fill(200);
    ledStateProxy.colors.set(newColors);
    expect(ledStateProxy.colors[0]).toBe(200);
    expect(ledStateProxy.colors[671]).toBe(200);
  });

  it('TestLedStateProxy_LastUpdated_IsWritable', () => {
    ledStateProxy.lastUpdated = 9999;
    expect(ledStateProxy.lastUpdated).toBe(9999);
  });

  it('TestLedStateProxy_IsNotZustandStore_NoGetStateMethod', () => {
    // Valtio proxy should not have Zustand-style methods
    expect(typeof (ledStateProxy as Record<string, unknown>)['getState']).toBe('undefined');
    expect(typeof (ledStateProxy as Record<string, unknown>)['subscribe']).toBe('undefined');
  });
});
