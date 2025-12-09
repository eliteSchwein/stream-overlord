import { networkInterfaces } from "os";
import * as net from "node:net";

const networkInterfaceBlacklist: RegExp[] = [
    /^lo\d*$/i,       // lo, lo0, lo1...
    /^vmnet\d*$/i,    // vmnet, vmnet1, vmnet8...
    /^docker\d*$/i,   // docker, docker0...
];

function isBlacklistedInterface(name: string): boolean {
    return networkInterfaceBlacklist.some((re) => re.test(name));
}

type IpAddressInfo = {
    address: string;
    netmask: string;
    cidr?: string | null;
    broadcast: string;
    startIp: number | null;
    endIp: number | null;
    partial: string | null;
};

function ipToInt(ip: string): number {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) {
        throw new Error(`Invalid IPv4 address: ${ip}`);
    }
    return (
        ((parts[0] << 24) |
            (parts[1] << 16) |
            (parts[2] << 8) |
            parts[3]) >>> 0
    );
}

function intToIp(int: number): string {
    return [
        (int >>> 24) & 255,
        (int >>> 16) & 255,
        (int >>> 8) & 255,
        int & 255
    ].join(".");
}

function rangeFromAddressNetmask(address: string, netmask: string) {
    const ipInt = ipToInt(address);
    const maskInt = ipToInt(netmask);

    const partial = `${address.split('.')[0]}.${address.split('.')[1]}.${address.split('.')[2]}.`;

    const networkInt = (ipInt & maskInt) >>> 0;
    const broadcastInt = (networkInt | (~maskInt)) >>> 0;

    const size = broadcastInt - networkInt + 1;

    // Usable range only for subnets with at least 4 addresses (/30 or larger)
    const startIp = size >= 4 ? Number.parseInt(intToIp(networkInt + 1).split('.')[3]) : null;
    const endIp = size >= 4 ? Number.parseInt(intToIp(broadcastInt - 1).split('.')[3]) : null;

    return {
        network: intToIp(networkInt),
        broadcast: intToIp(broadcastInt),
        startIp,
        endIp,
        partial: partial
    };
}

export function getIpAddresses(): IpAddressInfo[] {
    const interfaces = networkInterfaces();
    const ipAddresses: IpAddressInfo[] = [];

    for (const name in interfaces) {
        if (isBlacklistedInterface(name)) continue;

        const nets = interfaces[name];
        if (!nets) continue;

        for (const ni of nets) {
            if (ni.internal) continue;

            // Be tolerant of Node typings/versions
            const isIpv4 = ni.family === "IPv4" || (ni as any).family === 4;
            if (!isIpv4) continue;

            const { broadcast, startIp, endIp, partial } =
                rangeFromAddressNetmask(ni.address, ni.netmask);

            ipAddresses.push({
                address: ni.address,
                netmask: ni.netmask,
                cidr: ni.cidr ?? null,
                broadcast,
                startIp,
                endIp,
                partial
            });
        }
    }

    return ipAddresses;
}

function isPortOpen(host: string, port: number, timeoutMs = 500): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let done = false;

        const finish = (result: boolean) => {
            if (done) return;
            done = true;
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(timeoutMs);
        socket.once("connect", () => finish(true));
        socket.once("timeout", () => finish(false));
        socket.once("error", () => finish(false));

        socket.connect(port, host);
    });
}

export async function scanDeviceWithPort(
    port: number = 80,
    additionalTargets: string[] = []
) {
    const ipAddresses = getIpAddresses();
    const foundDevices: string[] = [];
    const checkPromises: Promise<void>[] = [];

    for (const ipAddress of ipAddresses) {
        for (let index = ipAddress.startIp + 1; index <= ipAddress.endIp; index++) {
            const deviceIpAddress = `${ipAddress.partial}${index}`;

            const checkPromise = (async () => {
                const isOpen = await isPortOpen(deviceIpAddress, port);
                if (isOpen) {
                    foundDevices.push(deviceIpAddress);
                }
            })();

            checkPromises.push(checkPromise);
        }
    }

    for (const target of additionalTargets) {
        const checkPromise = (async () => {
            const isOpen = await isPortOpen(target, port);
            if (isOpen) {
                foundDevices.push(target);
            }
        })();
        checkPromises.push(checkPromise);
    }

    await Promise.all(checkPromises);

    return foundDevices;
}