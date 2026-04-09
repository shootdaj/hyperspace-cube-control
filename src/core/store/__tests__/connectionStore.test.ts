import { describe, it, expect, beforeEach } from 'vitest';
import { connectionStore } from '../connectionStore';

describe('connectionStore', () => {
  beforeEach(() => {
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
});
