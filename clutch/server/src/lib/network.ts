import { networkInterfaces } from 'node:os';

/**
 * Returns the first non-loopback IPv4 address we can find, or null.
 *
 * Interface selection heuristic: prefer common LAN interface names over virtual
 * adapters (VirtualBox, WSL, vEthernet, Hyper-V, VPN tunnels). Users can always
 * override via PUBLIC_HOST.
 */
export function detectLanIPv4(): string | null {
  const ifaces = networkInterfaces();
  const entries = Object.entries(ifaces);

  const score = (name: string): number => {
    const n = name.toLowerCase();
    // Lower score wins. Prefer Wi-Fi and Ethernet over virtual.
    if (n.includes('loopback')) return 1000;
    if (n.includes('vethernet') || n.includes('virtualbox') || n.includes('vmware')) return 900;
    if (n.includes('wsl') || n.includes('docker')) return 800;
    if (n.includes('tap') || n.includes('tun') || n.includes('vpn')) return 700;
    if (n.startsWith('wi-fi') || n.startsWith('wifi') || n.startsWith('wlan')) return 10;
    if (n.includes('ethernet') || n.startsWith('eth') || n.startsWith('en')) return 20;
    return 100;
  };

  const candidates = entries
    .flatMap(([name, addrs]) =>
      (addrs ?? [])
        .filter((a) => a.family === 'IPv4' && !a.internal && !isLinkLocal(a.address))
        .map((a) => ({ name, address: a.address, score: score(name) })),
    )
    .sort((a, b) => a.score - b.score);

  return candidates[0]?.address ?? null;
}

function isLinkLocal(addr: string): boolean {
  return addr.startsWith('169.254.');
}
