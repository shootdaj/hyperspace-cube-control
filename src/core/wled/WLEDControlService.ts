import { cubeStateStore } from '@/core/store/cubeStateStore';
import type { WLEDColor } from '@/core/store/types';
import { WLEDRestClient } from './WLEDRestClient';

/**
 * WLEDControlService — mediator between UI components and the WLED device.
 *
 * CRITICAL: UI components MUST use this service for all WLED mutations.
 * Never call WLEDRestClient directly from components.
 *
 * Pattern: optimistic store update → serialized REST call → WebSocket reconciles.
 */
export class WLEDControlService {
  private static instances = new Map<string, WLEDControlService>();

  constructor(private readonly client: WLEDRestClient) {}

  /**
   * Get or create a WLEDControlService for a given IP.
   * Reuses instances to avoid creating duplicate REST clients.
   */
  static getInstance(ip: string): WLEDControlService {
    let instance = WLEDControlService.instances.get(ip);
    if (!instance) {
      instance = new WLEDControlService(new WLEDRestClient(ip));
      WLEDControlService.instances.set(ip, instance);
    }
    return instance;
  }

  /** Reset all instances — for testing only */
  static _resetForTest(): void {
    WLEDControlService.instances.clear();
  }

  async setPower(on: boolean): Promise<void> {
    cubeStateStore.getState().setOn(on);
    await this.client.setState({ on });
  }

  async setBrightness(bri: number): Promise<void> {
    cubeStateStore.getState().setBrightness(bri);
    await this.client.setState({ bri });
  }

  async setEffect(fx: number): Promise<void> {
    cubeStateStore.getState().setEffectIndex(fx);
    await this.client.setState({ seg: [{ fx }] });
  }

  async setPalette(pal: number): Promise<void> {
    cubeStateStore.getState().setPaletteIndex(pal);
    await this.client.setState({ seg: [{ pal }] });
  }

  async setSpeed(sx: number): Promise<void> {
    cubeStateStore.getState().setSpeed(sx);
    await this.client.setState({ seg: [{ sx }] });
  }

  async setIntensity(ix: number): Promise<void> {
    cubeStateStore.getState().setIntensity(ix);
    await this.client.setState({ seg: [{ ix }] });
  }

  async setColors(colors: WLEDColor[]): Promise<void> {
    cubeStateStore.getState().setColors(colors);
    await this.client.setState({ seg: [{ col: colors }] });
  }

  /**
   * Send a batch update — merges multiple fields into a single REST call.
   * Optimistically updates the store for all recognized fields.
   */
  async batchUpdate(payload: Record<string, unknown>): Promise<void> {
    // Optimistically update store for known fields
    if (typeof payload.on === 'boolean') {
      cubeStateStore.getState().setOn(payload.on);
    }
    if (typeof payload.bri === 'number') {
      cubeStateStore.getState().setBrightness(payload.bri);
    }
    if (Array.isArray(payload.seg) && payload.seg.length > 0) {
      const seg = payload.seg[0] as Record<string, unknown>;
      if (typeof seg.fx === 'number') cubeStateStore.getState().setEffectIndex(seg.fx);
      if (typeof seg.pal === 'number') cubeStateStore.getState().setPaletteIndex(seg.pal);
      if (typeof seg.sx === 'number') cubeStateStore.getState().setSpeed(seg.sx);
      if (typeof seg.ix === 'number') cubeStateStore.getState().setIntensity(seg.ix);
      if (Array.isArray(seg.col)) cubeStateStore.getState().setColors(seg.col as WLEDColor[]);
    }
    await this.client.setState(payload);
  }

  /** Access the underlying REST client (for fetching effects/palettes) */
  getRestClient(): WLEDRestClient {
    return this.client;
  }
}
