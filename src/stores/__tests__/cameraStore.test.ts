import { describe, it, expect, beforeEach } from 'vitest';
import { cameraStore } from '../cameraStore';

describe('cameraStore', () => {
  beforeEach(() => {
    cameraStore.getState().reset();
  });

  it('TestCameraStore_DefaultState', () => {
    const state = cameraStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.devices).toEqual([]);
    expect(state.selectedDeviceId).toBeNull();
    expect(state.permissionState).toBeNull();
    expect(state.error).toBeNull();
    expect(state.sensitivity).toBe(128);
    expect(state.motionLevel).toBe(0);
  });

  it('TestCameraStore_SetIsActive', () => {
    cameraStore.getState().setIsActive(true);
    expect(cameraStore.getState().isActive).toBe(true);
  });

  it('TestCameraStore_SetPermissionState', () => {
    cameraStore.getState().setPermissionState('denied');
    expect(cameraStore.getState().permissionState).toBe('denied');
  });

  it('TestCameraStore_SetError', () => {
    cameraStore.getState().setError('Camera blocked');
    expect(cameraStore.getState().error).toBe('Camera blocked');
  });

  it('TestCameraStore_SensitivityClamps', () => {
    cameraStore.getState().setSensitivity(-10);
    expect(cameraStore.getState().sensitivity).toBe(0);

    cameraStore.getState().setSensitivity(300);
    expect(cameraStore.getState().sensitivity).toBe(255);
  });

  it('TestCameraStore_MotionLevelClamps', () => {
    cameraStore.getState().setMotionLevel(-0.5);
    expect(cameraStore.getState().motionLevel).toBe(0);

    cameraStore.getState().setMotionLevel(1.5);
    expect(cameraStore.getState().motionLevel).toBe(1);
  });

  it('TestCameraStore_SetDevices', () => {
    const mockDevices = [
      { kind: 'videoinput', deviceId: 'cam1', label: 'Cam 1' },
    ] as MediaDeviceInfo[];
    cameraStore.getState().setDevices(mockDevices);
    expect(cameraStore.getState().devices).toHaveLength(1);
  });

  it('TestCameraStore_Reset', () => {
    cameraStore.getState().setIsActive(true);
    cameraStore.getState().setSensitivity(200);
    cameraStore.getState().setMotionLevel(0.5);
    cameraStore.getState().setError('test error');

    cameraStore.getState().reset();

    const state = cameraStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.sensitivity).toBe(128);
    expect(state.motionLevel).toBe(0);
    expect(state.error).toBeNull();
  });
});
