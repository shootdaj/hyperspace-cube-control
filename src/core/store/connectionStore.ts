import { create } from 'zustand';
import type { ConnectionStatus } from './types';

const IP_STORAGE_KEY = 'hypercube-device-ip';

function loadSavedIp(): string {
  try {
    return localStorage.getItem(IP_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function persistIp(ip: string): void {
  try {
    if (ip) {
      localStorage.setItem(IP_STORAGE_KEY, ip);
    } else {
      localStorage.removeItem(IP_STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable — silently fail
  }
}

interface ConnectionStore {
  ip: string;
  status: ConnectionStatus;
  setIp: (ip: string) => void;
  setStatus: (status: ConnectionStatus) => void;
}

export type { ConnectionStore };

export const connectionStore = create<ConnectionStore>()((set) => ({
  ip: loadSavedIp(),
  status: 'disconnected',
  setIp: (ip) => {
    persistIp(ip);
    set({ ip });
  },
  setStatus: (status) => set({ status }),
}));
