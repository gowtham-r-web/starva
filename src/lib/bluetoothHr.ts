import { HeartRateZone } from '../types';

export interface BluetoothHrState {
  isConnected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  currentHr: number | null;
  batteryLevel: number | null;
  error: string | null;
}

export type HrCallback = (hr: number) => void;
export type StatusCallback = (state: BluetoothHrState) => void;

class BluetoothHrService {
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;
  private hrCallbacks: Set<HrCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();

  private state: BluetoothHrState = {
    isConnected: false,
    isConnecting: false,
    deviceName: null,
    currentHr: null,
    batteryLevel: null,
    error: null,
  };

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'bluetooth' in navigator;
  }

  public getState(): BluetoothHrState {
    return { ...this.state };
  }

  public subscribeHr(cb: HrCallback): () => void {
    this.hrCallbacks.add(cb);
    return () => this.hrCallbacks.delete(cb);
  }

  public subscribeStatus(cb: StatusCallback): () => void {
    this.statusCallbacks.add(cb);
    cb(this.getState());
    return () => this.statusCallbacks.delete(cb);
  }

  private updateState(partial: Partial<BluetoothHrState>) {
    this.state = { ...this.state, ...partial };
    this.statusCallbacks.forEach((cb) => cb(this.getState()));
  }

  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      this.updateState({
        error: 'Web Bluetooth API is not supported in this browser. Try Chrome/Edge or use the Live Simulator mode.',
      });
      return false;
    }

    try {
      this.updateState({ isConnecting: true, error: null });

      // Request Web Bluetooth Device for Heart Rate Service
      const nav = navigator as any;
      this.device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service'],
      });

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

      this.server = await this.device.gatt.connect();

      // Get Heart Rate Service
      const service = await this.server.getPrimaryService('heart_rate');
      this.characteristic = await service.getCharacteristic('heart_rate_measurement');

      // Start Notifications
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener(
        'characteristicvaluechanged',
        this.handleHrMeasurement.bind(this)
      );

      // Attempt to read battery if available
      try {
        const batteryService = await this.server.getPrimaryService('battery_service');
        const batteryChar = await batteryService.getCharacteristic('battery_level');
        const batteryVal = await batteryChar.readValue();
        const batteryPct = batteryVal.getUint8(0);
        this.updateState({ batteryLevel: batteryPct });
      } catch (e) {
        // Battery service optional
      }

      this.updateState({
        isConnected: true,
        isConnecting: false,
        deviceName: this.device.name || 'Heart Rate Monitor',
        error: null,
      });

      return true;
    } catch (err: any) {
      console.warn('Bluetooth HR Connect error:', err);
      this.updateState({
        isConnecting: false,
        isConnected: false,
        error: err.message || 'Bluetooth pairing was cancelled or failed.',
      });
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.characteristic) {
      try {
        await this.characteristic.stopNotifications();
      } catch (e) {
        // ignore
      }
    }

    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }

    this.handleDisconnect();
  }

  private handleDisconnect() {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.updateState({
      isConnected: false,
      isConnecting: false,
      deviceName: null,
      currentHr: null,
      error: null,
    });
  }

  private handleHrMeasurement(event: any) {
    const value = event.target.value;
    const flags = value.getUint8(0);
    const hr16Bit = flags & 0x01;

    let hrValue: number;
    if (hr16Bit) {
      hrValue = value.getUint16(1, true); // Little endian
    } else {
      hrValue = value.getUint8(1);
    }

    this.updateState({ currentHr: hrValue });
    this.hrCallbacks.forEach((cb) => cb(hrValue));
  }
}

export const bluetoothHr = new BluetoothHrService();

/* Utility Functions for Heart Rate & Fitness Analytics */

export function calculateHrZones(maxHr: number = 190): HeartRateZone[] {
  return [
    {
      zone: 1,
      name: 'Zone 1 - Recovery',
      minHr: Math.round(maxHr * 0.5),
      maxHr: Math.round(maxHr * 0.6),
      color: '#3b82f6', // Blue
      bgColor: 'rgba(59, 130, 246, 0.15)',
      description: 'Active recovery, easy conversational jog',
    },
    {
      zone: 2,
      name: 'Zone 2 - Endurance',
      minHr: Math.round(maxHr * 0.6),
      maxHr: Math.round(maxHr * 0.7),
      color: '#22c55e', // Green
      bgColor: 'rgba(34, 197, 94, 0.15)',
      description: 'Aerobic engine building, sustainable for hours',
    },
    {
      zone: 3,
      name: 'Zone 3 - Tempo',
      minHr: Math.round(maxHr * 0.7),
      maxHr: Math.round(maxHr * 0.8),
      color: '#eab308', // Yellow
      bgColor: 'rgba(234, 179, 8, 0.15)',
      description: 'Comfortably hard, marathon pace effort',
    },
    {
      zone: 4,
      name: 'Zone 4 - Threshold',
      minHr: Math.round(maxHr * 0.8),
      maxHr: Math.round(maxHr * 0.9),
      color: '#f97316', // Orange
      bgColor: 'rgba(249, 115, 22, 0.15)',
      description: 'Lactate threshold, unsustainable > 45 mins',
    },
    {
      zone: 5,
      name: 'Zone 5 - Anaerobic',
      minHr: Math.round(maxHr * 0.9),
      maxHr: maxHr,
      color: '#ef4444', // Red
      bgColor: 'rgba(239, 68, 68, 0.15)',
      description: 'Max effort, sprint intervals & VO2 max peaks',
    },
  ];
}

export function getZoneForHr(hr: number, maxHr: number = 190): HeartRateZone {
  const zones = calculateHrZones(maxHr);
  if (hr < zones[0].minHr) return zones[0];
  if (hr >= zones[4].minHr) return zones[4];
  return zones.find((z) => hr >= z.minHr && hr <= z.maxHr) || zones[1];
}

export function formatPace(paceSeconds: number): string {
  if (!paceSeconds || isNaN(paceSeconds) || paceSeconds <= 0) return "--'--\"";
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.round(paceSeconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins < 10 ? '0' : ''}${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/** Calculates Strava Suffer Score / Relative Effort index based on HR duration in zones */
export function calculateSufferScore(hrPoints: { hr: number; durationSec: number }[], maxHr: number = 190): number {
  let score = 0;
  const zones = calculateHrZones(maxHr);

  hrPoints.forEach(({ hr, durationSec }) => {
    const minRatio = durationSec / 60; // minutes
    if (hr >= zones[4].minHr) score += minRatio * 6.0; // Zone 5
    else if (hr >= zones[3].minHr) score += minRatio * 4.0; // Zone 4
    else if (hr >= zones[2].minHr) score += minRatio * 2.2; // Zone 3
    else if (hr >= zones[1].minHr) score += minRatio * 1.0; // Zone 2
    else score += minRatio * 0.3; // Zone 1
  });

  return Math.round(score);
}
