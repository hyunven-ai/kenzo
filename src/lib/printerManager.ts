/**
 * Unified Thermal Printer Dispatcher
 * Automatically chooses between Direct Web Bluetooth (BLE), WebUSB,
 * or Native Browser Print Dialog based on settings and device capabilities.
 */

import { getPrinterSettings, PrinterSettings } from './printerSettings';
import { buildReceiptEscPos, buildTestPrintEscPos, EscPosReceiptData } from './escpos';
import { printRawBluetooth, getActiveBluetoothPrinter, isWebBluetoothSupported } from './bluetoothPrinter';
import { printRawUsb, getActiveUsbPrinterName } from './usbPrinter';

export interface PrintResult {
  success: boolean;
  method: 'bluetooth_ble' | 'usb_otg' | 'browser' | 'none';
  message: string;
  error?: string;
}

/**
 * Print a receipt using the best available printer engine
 */
export async function executeThermalPrint(
  data: EscPosReceiptData,
  customSettings?: PrinterSettings
): Promise<PrintResult> {
  const settings = customSettings || getPrinterSettings();
  const engine = settings.printEngine || 'auto';

  // 1. Try Direct Web Bluetooth (BLE) if enabled or auto
  if ((engine === 'auto' || engine === 'bluetooth_ble') && isWebBluetoothSupported()) {
    const btPrinter = getActiveBluetoothPrinter();
    if (btPrinter && btPrinter.connected) {
      try {
        const rawBytes = buildReceiptEscPos(data, settings);
        await printRawBluetooth(rawBytes);
        return {
          success: true,
          method: 'bluetooth_ble',
          message: `Struk berhasil dicetak ke ${btPrinter.name} (Bluetooth Native)!`,
        };
      } catch (err: any) {
        console.warn('Bluetooth print failed, attempting fallback:', err);
        // If user explicitly chose bluetooth_ble, report error
        if (engine === 'bluetooth_ble') {
          return {
            success: false,
            method: 'bluetooth_ble',
            message: 'Gagal mengirim data ke printer Bluetooth.',
            error: err.message,
          };
        }
      }
    }
  }

  // 2. Try Direct WebUSB OTG if enabled
  if ((engine === 'auto' || engine === 'usb_otg')) {
    const usbName = getActiveUsbPrinterName();
    if (usbName) {
      try {
        const rawBytes = buildReceiptEscPos(data, settings);
        await printRawUsb(rawBytes);
        return {
          success: true,
          method: 'usb_otg',
          message: `Struk berhasil dicetak via USB (${usbName})!`,
        };
      } catch (err: any) {
        if (engine === 'usb_otg') {
          return {
            success: false,
            method: 'usb_otg',
            message: 'Gagal mencetak via USB.',
            error: err.message,
          };
        }
      }
    }
  }

  // 3. Fallback to Browser Print Dialog (window.print)
  if (typeof window !== 'undefined') {
    try {
      window.print();
      return {
        success: true,
        method: 'browser',
        message: 'Membuka dialog cetak browser.',
      };
    } catch (err: any) {
      return {
        success: false,
        method: 'browser',
        message: 'Gagal membuka dialog cetak browser.',
        error: err.message,
      };
    }
  }

  return {
    success: false,
    method: 'none',
    message: 'Tidak ada metode pencetakan yang tersedia.',
  };
}

/**
 * Execute a test print
 */
export async function executeTestThermalPrint(
  customSettings?: PrinterSettings
): Promise<PrintResult> {
  const settings = customSettings || getPrinterSettings();
  const engine = settings.printEngine || 'auto';

  // 1. Bluetooth test print
  if ((engine === 'auto' || engine === 'bluetooth_ble') && isWebBluetoothSupported()) {
    const btPrinter = getActiveBluetoothPrinter();
    if (btPrinter && btPrinter.connected) {
      try {
        const rawBytes = buildTestPrintEscPos(settings);
        await printRawBluetooth(rawBytes);
        return {
          success: true,
          method: 'bluetooth_ble',
          message: `Tes cetak berhasil dikirim langsung ke ${btPrinter.name}!`,
        };
      } catch (err: any) {
        if (engine === 'bluetooth_ble') {
          return {
            success: false,
            method: 'bluetooth_ble',
            message: 'Gagal melakukan tes cetak Bluetooth.',
            error: err.message,
          };
        }
      }
    }
  }

  // 2. USB test print
  if ((engine === 'auto' || engine === 'usb_otg')) {
    const usbName = getActiveUsbPrinterName();
    if (usbName) {
      try {
        const rawBytes = buildTestPrintEscPos(settings);
        await printRawUsb(rawBytes);
        return {
          success: true,
          method: 'usb_otg',
          message: `Tes cetak berhasil dikirim ke ${usbName} (USB)!`,
        };
      } catch (err: any) {
        if (engine === 'usb_otg') {
          return {
            success: false,
            method: 'usb_otg',
            message: 'Gagal melakukan tes cetak USB.',
            error: err.message,
          };
        }
      }
    }
  }

  // 3. Browser print fallback
  if (typeof window !== 'undefined') {
    window.print();
    return {
      success: true,
      method: 'browser',
      message: 'Membuka dialog cetak browser untuk tes cetak.',
    };
  }

  return {
    success: false,
    method: 'none',
    message: 'Gagal melakukan tes cetak.',
  };
}
