import { create } from 'zustand';
import type { ConnectionStatus } from './types';

interface ConnectionStore {
  ip: string;
  status: ConnectionStatus;
  setIp: (ip: string) => void;
  setStatus: (status: ConnectionStatus) => void;
}

export type { ConnectionStore };

export const connectionStore = create<ConnectionStore>()((set) => ({
  ip: '',
  status: 'disconnected',
  setIp: (ip) => set({ ip }),
  setStatus: (status) => set({ status }),
}));
