export type PrinterConnectionType = 'bluetooth' | 'network' | 'usb';

export interface PrinterDevice {
  id: string;
  name: string;
  connectionType: PrinterConnectionType;
  paperWidth: '58mm' | '80mm';
  targetAddress?: string; // IP Address (for network) or Bluetooth ID
  port?: number;
  isDefault: boolean;
  status: 'ready' | 'connected' | 'saved';
  addedAt: string;
}

export interface PrinterSettings {
  devices: PrinterDevice[];
  activeDeviceId?: string;
  paperWidth: '58mm' | '80mm';
  autoPrint: boolean;
  printCopies: number;
  shopName: string;
  addressLine1: string;
  addressLine2: string;
  whatsappNumber: string;
  showLogo: boolean;
  logoUrl?: string;
  showSocialMedia: boolean;
  facebookName: string;
  instagramName: string;
  tiktokName: string;
  showImei: boolean;
  warningNote: string;
  footerNote: string;
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  devices: [],
  paperWidth: '58mm',
  autoPrint: false,
  printCopies: 1,
  shopName: 'SERIES PONSEL',
  addressLine1: 'Jalan Pasar Beringin no.05',
  addressLine2: 'SUNGAI PINYUH',
  whatsappNumber: '0812-5866-6628',
  showLogo: true,
  logoUrl: '/logo-struk.png',
  showSocialMedia: true,
  facebookName: 'MArr LinDa\nVierry Kien\'z',
  instagramName: 'Series_ponsel',
  tiktokName: 'SERIES PONSEL',
  showImei: true,
  warningNote: 'Barang yang sudah di beli tidak bisa di kembalikan!!!',
  footerNote: 'TERIMA KASIH BOSKUUU!!!',
};

const STORAGE_KEY = 'series_printer_settings';

export function getPrinterSettings(): PrinterSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_PRINTER_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRINTER_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PRINTER_SETTINGS, ...parsed, devices: parsed.devices || [] };
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function savePrinterSettings(settings: Partial<PrinterSettings>): PrinterSettings {
  if (typeof window === 'undefined') return DEFAULT_PRINTER_SETTINGS;
  const current = getPrinterSettings();
  const updated: PrinterSettings = { ...current, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('printer-settings-updated'));
  } catch (e) {
    console.error('Failed to save printer settings:', e);
  }
  return updated;
}

export function addPrinterDevice(device: Omit<PrinterDevice, 'id' | 'addedAt'>): PrinterSettings {
  const current = getPrinterSettings();
  const newId = `printer_${Date.now()}`;
  const isFirst = current.devices.length === 0;
  const newDevice: PrinterDevice = {
    ...device,
    id: newId,
    isDefault: device.isDefault || isFirst,
    status: 'ready',
    addedAt: new Date().toISOString(),
  };

  let updatedDevices = [...current.devices];
  if (newDevice.isDefault) {
    updatedDevices = updatedDevices.map(d => ({ ...d, isDefault: false }));
  }
  updatedDevices.push(newDevice);

  return savePrinterSettings({
    devices: updatedDevices,
    activeDeviceId: newDevice.isDefault ? newDevice.id : current.activeDeviceId || newDevice.id,
    paperWidth: newDevice.isDefault ? newDevice.paperWidth : current.paperWidth,
  });
}

export function removePrinterDevice(deviceId: string): PrinterSettings {
  const current = getPrinterSettings();
  const updatedDevices = current.devices.filter(d => d.id !== deviceId);
  let activeId = current.activeDeviceId;
  let paperWidth = current.paperWidth;

  if (activeId === deviceId) {
    if (updatedDevices.length > 0) {
      updatedDevices[0].isDefault = true;
      activeId = updatedDevices[0].id;
      paperWidth = updatedDevices[0].paperWidth;
    } else {
      activeId = undefined;
    }
  }

  return savePrinterSettings({
    devices: updatedDevices,
    activeDeviceId: activeId,
    paperWidth,
  });
}

export function setDefaultPrinterDevice(deviceId: string): PrinterSettings {
  const current = getPrinterSettings();
  let selectedWidth = current.paperWidth;
  const updatedDevices = current.devices.map(d => {
    const isTarget = d.id === deviceId;
    if (isTarget) selectedWidth = d.paperWidth;
    return { ...d, isDefault: isTarget };
  });

  return savePrinterSettings({
    devices: updatedDevices,
    activeDeviceId: deviceId,
    paperWidth: selectedWidth,
  });
}

export function resetPrinterSettings(): PrinterSettings {
  if (typeof window === 'undefined') return DEFAULT_PRINTER_SETTINGS;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('printer-settings-updated'));
  } catch (e) {
    console.error('Failed to reset printer settings:', e);
  }
  return DEFAULT_PRINTER_SETTINGS;
}
