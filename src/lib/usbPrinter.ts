/**
 * WebUSB OTG Thermal Printer Manager
 * Connects directly to thermal printers via USB cable / USB OTG on Android & PC
 * without any third-party driver.
 */

let activeUsbDevice: any = null;
let activeUsbEndpoint: number = 1;

export function isWebUsbSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(navigator && (navigator as any).usb);
}

export function getActiveUsbPrinterName(): string | null {
  if (typeof window === 'undefined') return null;
  if (activeUsbDevice && activeUsbDevice.opened) {
    return activeUsbDevice.productName || 'Printer POS USB';
  }
  return localStorage.getItem('last_usb_printer_name');
}

/**
 * Scan and connect to USB thermal printer
 */
export async function connectUsbPrinter(): Promise<string> {
  if (!isWebUsbSupported()) {
    throw new Error('Browser ini belum mendukung WebUSB.');
  }

  const usb = (navigator as any).usb;
  const device = await usb.requestDevice({
    filters: [
      { classCode: 7 }, // Printer Class Code
    ],
  });

  if (!device) {
    throw new Error('Perangkat USB tidak dipilih.');
  }

  await device.open();
  await device.selectConfiguration(1);

  // Claim interface
  let claimedInterface = 0;
  let outEndpoint = 1;

  for (const iface of device.configuration.interfaces) {
    for (const alt of iface.alternates) {
      if (alt.interfaceClass === 7 || alt.interfaceClass === 0xff || alt.interfaceClass === 0x00) {
        claimedInterface = iface.interfaceNumber;
        for (const ep of alt.endpoints) {
          if (ep.direction === 'out') {
            outEndpoint = ep.endpointNumber;
            break;
          }
        }
        break;
      }
    }
  }

  await device.claimInterface(claimedInterface);
  activeUsbDevice = device;
  activeUsbEndpoint = outEndpoint;

  const name = device.productName || 'Printer POS-58 USB';
  if (typeof window !== 'undefined') {
    localStorage.setItem('last_usb_printer_name', name);
  }

  return name;
}

/**
 * Send raw binary ESC/POS data to USB thermal printer
 */
export async function printRawUsb(data: Uint8Array): Promise<void> {
  if (!activeUsbDevice || !activeUsbDevice.opened) {
    await connectUsbPrinter();
  }

  if (!activeUsbDevice || !activeUsbDevice.opened) {
    throw new Error('Printer USB belum terhubung.');
  }

  // Transfer data via OUT endpoint
  const CHUNK_SIZE = 512;
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    await activeUsbDevice.transferOut(activeUsbEndpoint, chunk);
  }
}

