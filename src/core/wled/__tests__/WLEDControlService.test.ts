import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WLEDControlService } from '../WLEDControlService';
import { cubeStateStore } from '@/core/store/cubeStateStore';
import type { WLEDRestClient } from '../WLEDRestClient';

function createMockClient(): WLEDRestClient {
  return {
    setState: vi.fn().mockResolvedValue(undefined),
    getInfo: vi.fn(),
    getState: vi.fn(),
    getEffects: vi.fn(),
    getPalettes: vi.fn(),
    setLEDs: vi.fn(),
    get queueDepth() { return 0; },
    ip: '10.0.0.1',
  } as unknown as WLEDRestClient;
}

describe('WLEDControlService', () => {
  let service: WLEDControlService;
  let mockClient: WLEDRestClient;

  beforeEach(() => {
    mockClient = createMockClient();
    service = new WLEDControlService(mockClient);
    // Reset store to defaults
    cubeStateStore.setState({
      on: false,
      brightness: 128,
      effectIndex: 0,
      paletteIndex: 0,
      speed: 128,
      intensity: 128,
      colors: [[255, 160, 0], [0, 0, 0], [0, 0, 0]],
    });
  });

  it('setPower updates store optimistically and calls REST client', async () => {
    await service.setPower(true);
    expect(cubeStateStore.getState().on).toBe(true);
    expect(mockClient.setState).toHaveBeenCalledWith({ on: true });
  });

  it('setPower(false) turns off', async () => {
    cubeStateStore.setState({ on: true });
    await service.setPower(false);
    expect(cubeStateStore.getState().on).toBe(false);
    expect(mockClient.setState).toHaveBeenCalledWith({ on: false });
  });

  it('setBrightness updates store and calls REST client', async () => {
    await service.setBrightness(200);
    expect(cubeStateStore.getState().brightness).toBe(200);
    expect(mockClient.setState).toHaveBeenCalledWith({ bri: 200 });
  });

  it('setEffect updates store and sends segment fx', async () => {
    await service.setEffect(42);
    expect(cubeStateStore.getState().effectIndex).toBe(42);
    expect(mockClient.setState).toHaveBeenCalledWith({ seg: [{ fx: 42 }] });
  });

  it('setPalette updates store and sends segment pal', async () => {
    await service.setPalette(5);
    expect(cubeStateStore.getState().paletteIndex).toBe(5);
    expect(mockClient.setState).toHaveBeenCalledWith({ seg: [{ pal: 5 }] });
  });

  it('setSpeed updates store and sends segment sx', async () => {
    await service.setSpeed(200);
    expect(cubeStateStore.getState().speed).toBe(200);
    expect(mockClient.setState).toHaveBeenCalledWith({ seg: [{ sx: 200 }] });
  });

  it('setIntensity updates store and sends segment ix', async () => {
    await service.setIntensity(150);
    expect(cubeStateStore.getState().intensity).toBe(150);
    expect(mockClient.setState).toHaveBeenCalledWith({ seg: [{ ix: 150 }] });
  });

  it('setColors updates store and sends segment col', async () => {
    const colors: [number, number, number][] = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
    await service.setColors(colors);
    expect(cubeStateStore.getState().colors).toEqual(colors);
    expect(mockClient.setState).toHaveBeenCalledWith({ seg: [{ col: colors }] });
  });

  it('batchUpdate merges multiple changes into one REST call', async () => {
    await service.batchUpdate({ on: true, bri: 200, seg: [{ fx: 10, sx: 128 }] });
    expect(cubeStateStore.getState().on).toBe(true);
    expect(cubeStateStore.getState().brightness).toBe(200);
    expect(cubeStateStore.getState().effectIndex).toBe(10);
    expect(cubeStateStore.getState().speed).toBe(128);
    expect(mockClient.setState).toHaveBeenCalledTimes(1);
    expect(mockClient.setState).toHaveBeenCalledWith({ on: true, bri: 200, seg: [{ fx: 10, sx: 128 }] });
  });
});
