/**
 * Web Bluetooth BLE Thermal Printer Manager
 * Connects directly to Bluetooth BLE thermal printers (e.g. POS-58, RPP02N, PT-210)
 * without requiring any third-party app or print service.
 */

// Common Thermal Printer BLE Service UUIDs
export const THERMAL_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS-58 / Thermal Printer
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent Transmission
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // ZJiang / Goojprt / POS-58
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 Generic BLE Serial
  '0000ff00-0000-1000-8000-00805f9b34fb', // Common Thermal POS
  '0000ae00-0000-1000-8000-00805f9b34fb', // Vendor BLE Serial
  '0000fff0-0000-1000-8000-00805f9b34fb', // Generic BLE Serial
];

export interface BluetoothPrinterInfo {
  id: string;
  name: string;
  connected: boolean;
}

// Module-level singleton state for active connection
let activeDevice: any = null;
let activeCharacteristic: any = null;

export function isWebBluetoothSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(navigator && (navigator as any).bluetooth);
}

export function getActiveBluetoothPrinter(): BluetoothPrinterInfo | null {
  if (typeof window === 'undefined') return null;
  const isConnected = Boolean(activeDevice && activeDevice.gatt && activeDevice.gatt.connected && activeCharacteristic);
  const savedName = localStorage.getItem('last_bluetooth_printer_name');
  const savedId = localStorage.getItem('last_bluetooth_printer_id');

  if (activeDevice) {
    return {
      id: activeDevice.id,
      name: activeDevice.name || savedName || 'Printer Bluetooth POS-58',
      connected: isConnected,
    };
  }

  if (savedName) {
    return {
      id: savedId || 'saved_bt_printer',
      name: savedName,
      connected: false,
    };
  }

  return null;
}

/**
 * Scan and connect to a Bluetooth thermal printer via Web Bluetooth
 */
export async function connectBluetoothPrinter(): Promise<BluetoothPrinterInfo> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Browser ini belum mendukung Web Bluetooth. Pastikan Anda menggunakan Chrome di Android / PC.');
  }

  const bluetooth = (navigator as any).bluetooth;

  // Request Bluetooth Device with all known thermal printer services
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: THERMAL_PRINTER_SERVICES,
  });

  if (!device) {
    throw new Error('Perangkat tidak dipilih.');
  }

  activeDevice = device;

  // Listen for disconnection
  device.addEventListener('gattserverdisconnected', () => {
    activeCharacteristic = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('bluetooth-printer-status-changed'));
    }
  });

  // Connect to GATT Server
  const server = await device.gatt.connect();

  // Find the writable characteristic across services
  let writableChar: any = null;

  for (const serviceUuid of THERMAL_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      if (service) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          const props = char.properties;
          if (props.write || props.writeWithoutResponse) {
            writableChar = char;
            break;
          }
        }
      }
    } catch {
      // Continue searching next service UUID
    }
    if (writableChar) break;
  }

  // Fallback: If not found in known UUIDs, query all primary services
  if (!writableChar) {
    try {
      const allServices = await server.getPrimaryServices();
      for (const service of allServices) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            const props = char.properties;
            if (props.write || props.writeWithoutResponse) {
              writableChar = char;
              break;
            }
          }
        } catch {}
        if (writableChar) break;
      }
    } catch {}
  }

  if (!writableChar) {
    throw new Error('Tidak dapat menemukan saluran data cetak (write characteristic) pada printer ini.');
  }

  activeCharacteristic = writableChar;

  // Save printer info in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('last_bluetooth_printer_name', device.name || 'Printer POS-58');
    localStorage.setItem('last_bluetooth_printer_id', device.id || '');
    window.dispatchEvent(new Event('bluetooth-printer-status-changed'));
  }

  return {
    id: device.id,
    name: device.name || 'Printer POS-58',
    connected: true,
  };
}

/**
 * Disconnect active Bluetooth thermal printer
 */
export async function disconnectBluetoothPrinter(): Promise<void> {
  if (activeDevice && activeDevice.gatt && activeDevice.gatt.connected) {
    activeDevice.gatt.disconnect();
  }
  activeDevice = null;
  activeCharacteristic = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('bluetooth-printer-status-changed'));
  }
}

/**
 * Send raw binary ESC/POS data to Bluetooth thermal printer in safe chunks
 */
export async function printRawBluetooth(data: Uint8Array): Promise<void> {
  // Ensure printer is connected
  if (!activeCharacteristic || !activeDevice || !activeDevice.gatt || !activeDevice.gatt.connected) {
    // If device object exists, attempt fast reconnection
    if (activeDevice && activeDevice.gatt) {
      await connectBluetoothPrinter();
    } else {
      throw new Error('Printer Bluetooth belum terhubung. Silakan hubungkan printer terlebih dahulu.');
    }
  }

  if (!activeCharacteristic) {
    throw new Error('Saluran cetak printer tidak tersedia.');
  }

  // Chunking data (50 bytes per chunk with 20ms delay) to avoid buffer overflow
  const CHUNK_SIZE = 60;
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    
    if (activeCharacteristic.writeValueWithoutResponse) {
      await activeCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await activeCharacteristic.writeValue(chunk);
    }

    // Small delay between packets for POS-58 buffer processing
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
