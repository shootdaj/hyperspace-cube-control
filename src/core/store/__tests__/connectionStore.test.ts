import { describe, it, expect, beforeEach } from 'vitest';
import { connectionStore } from '../connectionStore';

const IP_STORAGE_KEY = 'hypercube-device-ip';

describe('connectionStore', () => {
  beforeEach(() => {
    localStorage.removeItem(IP_STORAGE_KEY);
    connectionStore.setState({ ip: '', status: 'disconnected' });
  });

  it('TestConnectionStore_InitialStatus_IsDisconnected', () => {
    expect(connectionStore.getState().status).toBe('disconnected');
  });

  it('TestConnectionStore_InitialIp_IsEmptyString', () => {
    expect(connectionStore.getState().ip).toBe('');
  });

  it('TestConnectionStore_SetIp_UpdatesIp', () => {
    connectionStore.getState().setIp('192.168.1.100');
    expect(connectionStore.getState().ip).toBe('192.168.1.100');
  });

  it('TestConnectionStore_SetStatus_UpdatesToConnected', () => {
    connectionStore.getState().setStatus('connected');
    expect(connectionStore.getState().status).toBe('connected');
  });

  it('TestConnectionStore_SetStatus_UpdatesToReconnecting', () => {
    connectionStore.getState().setStatus('reconnecting');
    expect(connectionStore.getState().status).toBe('reconnecting');
  });

  it('TestConnectionStore_SetIp_PersistsToLocalStorage', () => {
    connectionStore.getState().setIp('10.0.0.5');
    expect(localStorage.getItem(IP_STORAGE_KEY)).toBe('10.0.0.5');
  });

  it('TestConnectionStore_SetIp_EmptyRemovesFromLocalStorage', () => {
    localStorage.setItem(IP_STORAGE_KEY, '10.0.0.5');
    connectionStore.getState().setIp('');
    expect(localStorage.getItem(IP_STORAGE_KEY)).toBeNull();
  });
});
