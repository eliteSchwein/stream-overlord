import asyncio
import argparse
import json
import os
import tempfile
from datetime import datetime

from dbus_next import BusType, Variant
from dbus_next.aio import MessageBus
from dbus_next.service import ServiceInterface, method

READ_EVERY_SECONDS = 2

UUID_FFE1 = "0000ffe1-0000-1000-8000-00805f9b34fb"
UUID_FFE5 = "0000ffe5-0000-1000-8000-00805f9b34fb"

FFE1_UNLOCK_VALUE = b"000000"
DO_AUTH_ON_CONNECT = True

CHARACTERISTICS = {
    "Model": "00002a24-0000-1000-8000-00805f9b34fb",
    "Serial": "00002a25-0000-1000-8000-00805f9b34fb",
    "System ID": "00002a23-0000-1000-8000-00805f9b34fb",
    "Firmware": "00002a26-0000-1000-8000-00805f9b34fb",
    "Hardware": "00002a27-0000-1000-8000-00805f9b34fb",
    "Manufacturer": "00002a29-0000-1000-8000-00805f9b34fb",
    "Temperature": "00002a6e-0000-1000-8000-00805f9b34fb",
    "Battery": "00002a19-0000-1000-8000-00805f9b34fb",
}

TARGET_MAC = None
TARGET_NAME = None
STATE_JSON_FILE = None
PASSKEY = "000000"
AGENT_PATH = f"/test/smallrig_agent_{os.getpid()}"


class BluetoothAgent(ServiceInterface):
    def __init__(self):
        super().__init__("org.bluez.Agent1")

    @method()
    def Release(self):
        pass

    @method()
    def RequestPinCode(self, device: "o") -> "s":
        print(f"[agent] PIN requested for {device}, sending {PASSKEY}")
        return str(PASSKEY)

    @method()
    def RequestPasskey(self, device: "o") -> "u":
        passkey_int = int(str(PASSKEY).strip())
        print(f"[agent] Passkey requested for {device}, sending {passkey_int}")
        return passkey_int

    @method()
    def DisplayPasskey(self, device: "o", passkey: "u", entered: "q"):
        print(f"[agent] DisplayPasskey {device}: {passkey}, entered={entered}")

    @method()
    def RequestConfirmation(self, device: "o", passkey: "u"):
        print(f"[agent] Confirming passkey {passkey} for {device}")

    @method()
    def RequestAuthorization(self, device: "o"):
        print(f"[agent] Authorizing {device}")

    @method()
    def AuthorizeService(self, device: "o", uuid: "s"):
        print(f"[agent] Authorizing service {uuid} for {device}")

    @method()
    def Cancel(self):
        print("[agent] Request cancelled")


def parse_args():
    parser = argparse.ArgumentParser(description="Bluetooth helper for SmallRig X99")
    parser.add_argument("--mac", required=True, help="Target Bluetooth MAC address")
    parser.add_argument("--name", required=True, help="Target device name")
    parser.add_argument("--passphrase", default="000000", help="Pairing passkey, e.g. 1 or 000000")
    return parser.parse_args()


async def register_agent(bus):
    bus.export(AGENT_PATH, BluetoothAgent())

    xml = await bus.introspect("org.bluez", "/org/bluez")
    obj = bus.get_proxy_object("org.bluez", "/org/bluez", xml)
    mgr = obj.get_interface("org.bluez.AgentManager1")

    for capability in ("KeyboardDisplay", "KeyboardOnly", "DisplayYesNo", "NoInputNoOutput"):
        try:
            await mgr.call_register_agent(AGENT_PATH, capability)
            print(f"[agent] Registered with capability={capability}")
            break
        except Exception as e:
            msg = str(e)
            if "Already Exists" in msg:
                try:
                    await mgr.call_unregister_agent(AGENT_PATH)
                    await asyncio.sleep(0.2)
                    await mgr.call_register_agent(AGENT_PATH, capability)
                    print(f"[agent] Re-registered with capability={capability}")
                    break
                except Exception as e2:
                    print(f"[agent] Re-register failed with {capability}: {e2}")
            else:
                print(f"[agent] Register failed with {capability}: {e}")
    else:
        print("[agent] Could not register agent; continuing anyway")

    try:
        await mgr.call_request_default_agent(AGENT_PATH)
        print("[agent] Set as default agent")
    except Exception as e:
        print(f"[agent] RequestDefaultAgent ignored: {e}")


def clear():
    os.system("clear")


def hx(data):
    return " ".join(f"{x:02X}" for x in data)


def parse_value(label, data):
    b = bytes(data)

    if not b:
        return None

    if label == "Battery":
        return b[0]

    if label == "Temperature" and len(b) >= 2:
        return round(int.from_bytes(b[:2], "little", signed=True) / 100, 2)

    if label == "System ID":
        return int.from_bytes(b, "little", signed=False)

    try:
        return b.decode("utf-8").strip("\x00")
    except Exception:
        return list(b)


def save_json(values, connected, auth_status):
    os.makedirs("/tmp/bat", exist_ok=True)

    data = {
        "device": {
            "mac": TARGET_MAC,
            "name": TARGET_NAME,
        },
        "connected": connected is True,
        "auth": auth_status,
        "values": values,
        "last_update": datetime.now().isoformat(timespec="seconds"),
    }

    fd, tmp_path = tempfile.mkstemp(prefix=".bat.", suffix=".json", dir="/tmp/bat")

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)
            f.write("\n")
        os.replace(tmp_path, STATE_JSON_FILE)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def remove_json_file():
    if STATE_JSON_FILE and os.path.exists(STATE_JSON_FILE):
        try:
            os.remove(STATE_JSON_FILE)
        except Exception as e:
            print(f"Failed to remove JSON file: {e}")


async def get_om(bus):
    root_xml = await bus.introspect("org.bluez", "/")
    root = bus.get_proxy_object("org.bluez", "/", root_xml)
    return root.get_interface("org.freedesktop.DBus.ObjectManager")


async def get_objects(om):
    return await om.call_get_managed_objects()


async def get_adapter(bus, objects):
    for path, ifaces in objects.items():
        if "org.bluez.Adapter1" in ifaces:
            xml = await bus.introspect("org.bluez", path)
            obj = bus.get_proxy_object("org.bluez", path, xml)
            return obj.get_interface("org.bluez.Adapter1")
    raise RuntimeError("No Bluetooth adapter found")


def is_target(dev):
    addr = dev.get("Address").value.lower() if dev.get("Address") else ""
    name = dev.get("Name").value if dev.get("Name") else ""
    alias = dev.get("Alias").value if dev.get("Alias") else ""
    return addr == TARGET_MAC or name == TARGET_NAME or alias == TARGET_NAME


async def find_device(bus, om):
    objects = await get_objects(om)

    for path, ifaces in objects.items():
        dev = ifaces.get("org.bluez.Device1")
        if dev and is_target(dev):
            return path

    print(f"Scanning for {TARGET_NAME}...")
    adapter = await get_adapter(bus, objects)

    try:
        await adapter.call_set_discovery_filter({
            "Transport": Variant("s", "le"),
            "DuplicateData": Variant("b", True),
        })
    except Exception:
        pass

    await adapter.call_start_discovery()

    try:
        for _ in range(45):
            await asyncio.sleep(1)
            objects = await get_objects(om)

            for path, ifaces in objects.items():
                dev = ifaces.get("org.bluez.Device1")
                if dev and is_target(dev):
                    return path
    finally:
        try:
            await adapter.call_stop_discovery()
        except Exception:
            pass

    raise RuntimeError(f"{TARGET_NAME} not found")


async def connect(bus, om, device_path):
    objects = await get_objects(om)
    adapter = await get_adapter(bus, objects)

    try:
        await adapter.call_stop_discovery()
    except Exception:
        pass

    xml = await bus.introspect("org.bluez", device_path)
    obj = bus.get_proxy_object("org.bluez", device_path, xml)

    dev = obj.get_interface("org.bluez.Device1")
    props = obj.get_interface("org.freedesktop.DBus.Properties")

    connected = await props.call_get("org.bluez.Device1", "Connected")
    if not connected.value:
        for attempt in range(10):
            try:
                await dev.call_connect()
                break
            except Exception as e:
                print(f"[warn] connect failed (attempt {attempt + 1}/10): {e}")
                await asyncio.sleep(2)
        else:
            raise RuntimeError("Unable to connect after retries")

    for _ in range(30):
        connected = await props.call_get("org.bluez.Device1", "Connected")
        resolved = await props.call_get("org.bluez.Device1", "ServicesResolved")

        if connected.value and resolved.value:
            return dev, props

        await asyncio.sleep(0.5)

    raise RuntimeError("Connected, but services did not resolve")


async def ensure_connected(bus, om, device_path, dev, dev_props):
    try:
        connected = await dev_props.call_get("org.bluez.Device1", "Connected")
        if connected.value:
            return dev, dev_props, False
    except Exception:
        pass

    try:
        dev, dev_props = await connect(bus, om, device_path)
        return dev, dev_props, True
    except Exception as e:
        print(f"[warn] reconnect failed: {e}")
        await asyncio.sleep(2)
        return dev, dev_props, False


async def refresh_state(bus, om, device_path, dev, dev_props):
    dev, dev_props, reconnected = await ensure_connected(bus, om, device_path, dev, dev_props)
    chars = await char_map(om, device_path)

    auth_status = "not run"
    if DO_AUTH_ON_CONNECT:
        try:
            auth_status = await auth_device(bus, chars)
        except Exception as e:
            auth_status = f"error: {e}"

    return dev, dev_props, chars, auth_status, reconnected


async def char_map(om, device_path):
    objects = await get_objects(om)
    chars = {}

    for path, ifaces in objects.items():
        char = ifaces.get("org.bluez.GattCharacteristic1")
        if not char or not path.startswith(device_path):
            continue

        uuid = char["UUID"].value.lower()
        flags = char["Flags"].value
        chars[uuid] = (path, flags)

    return chars


async def read_raw_char(bus, chars, uuid, timeout=5.0):
    item = chars.get(uuid.lower())
    if not item:
        return None, "unavailable"

    path, flags = item

    if "read" not in flags:
        return None, f"not readable flags={flags}"

    async def do_read():
        xml = await bus.introspect("org.bluez", path)
        obj = bus.get_proxy_object("org.bluez", path, xml)
        iface = obj.get_interface("org.bluez.GattCharacteristic1")
        return bytes(await iface.call_read_value({}))

    for _ in range(5):
        try:
            return await asyncio.wait_for(do_read(), timeout=timeout), None
        except asyncio.TimeoutError:
            return None, "timeout"
        except Exception as e:
            if "In Progress" in str(e):
                await asyncio.sleep(0.5)
                continue
            return None, f"error: {e}"

    return None, "busy"


async def read_char(bus, chars, label, uuid, timeout=5.0):
    value, err = await read_raw_char(bus, chars, uuid, timeout=timeout)
    if err:
        return err
    return parse_value(label, value)


async def write_char(bus, chars, uuid, data, with_response=True):
    item = chars.get(uuid.lower())
    if not item:
        return "unavailable"

    path, flags = item

    if "write" not in flags and "write-without-response" not in flags:
        return f"not writable flags={flags}"

    xml = await bus.introspect("org.bluez", path)
    obj = bus.get_proxy_object("org.bluez", path, xml)
    iface = obj.get_interface("org.bluez.GattCharacteristic1")

    opts = {
        "type": Variant("s", "request" if with_response else "command")
    }

    try:
        await iface.call_write_value(bytes(data), opts)
        return "ok"
    except Exception as e:
        return f"error: {e}"


async def auth_device(bus, chars):
    ffe5_value, ffe5_err = await read_raw_char(bus, chars, UUID_FFE5, timeout=8.0)

    if ffe5_err:
        return f"FFE5: {ffe5_err}"

    unlock_result = await write_char(
        bus,
        chars,
        UUID_FFE1,
        FFE1_UNLOCK_VALUE,
        with_response=True,
    )

    return f"FFE5={hx(ffe5_value)} FFE1={unlock_result}"


async def run():
    global TARGET_MAC, TARGET_NAME, STATE_JSON_FILE, PASSKEY

    args = parse_args()
    TARGET_MAC = args.mac.lower()
    TARGET_NAME = args.name
    STATE_JSON_FILE = f"/tmp/bat/{TARGET_NAME}.json"
    PASSKEY = args.passphrase

    bus = await MessageBus(bus_type=BusType.SYSTEM).connect()
    await register_agent(bus)
    om = await get_om(bus)

    dev = None
    dev_props = None
    chars = {}
    auth_status = "not run"

    try:
        device_path = await find_device(bus, om)

        while True:
            try:
                dev, dev_props, chars, auth_status, _ = await refresh_state(
                    bus, om, device_path, dev, dev_props
                )
                break
            except Exception as e:
                print(f"[warn] initial refresh failed: {e}")
                await asyncio.sleep(2)

        while True:
            try:
                dev, dev_props, chars, auth_status, reconnected = await refresh_state(
                    bus, om, device_path, dev, dev_props
                )
            except Exception as e:
                print(f"[warn] refresh failed: {e}")
                await asyncio.sleep(2)
                continue

            if reconnected:
                print("[warn] device reconnected; refreshed connected/auth state")

            clear()
            print(f"=== {TARGET_NAME} ===")
            print("Press Ctrl+C to stop\n")

            try:
                connected = await dev_props.call_get("org.bluez.Device1", "Connected")
                connected_value = connected.value
            except Exception as e:
                connected_value = f"unknown ({e})"

            print(f"Connected    : {connected_value}")
            print(f"Auth         : {auth_status}\n")

            if connected_value is not True:
                print("Waiting for reconnect...")
                save_json({}, False, auth_status)
                await asyncio.sleep(READ_EVERY_SECONDS)
                continue

            values = {}
            for label, uuid in CHARACTERISTICS.items():
                values[label] = await read_char(bus, chars, label, uuid)

            print(f"Model        : {values.get('Model')}")
            print(f"Serial       : {values.get('Serial')}")
            print(f"System ID    : {values.get('System ID')}")
            print(f"Firmware     : {values.get('Firmware')}")
            print(f"Hardware     : {values.get('Hardware')}")
            print(f"Manufacturer : {values.get('Manufacturer')}")
            print(f"Temperature  : {values.get('Temperature')}")
            print(f"Battery      : {values.get('Battery')}")
            print(f"JSON         : {STATE_JSON_FILE}")

            save_json(values, connected_value, auth_status)

            await asyncio.sleep(READ_EVERY_SECONDS)

    finally:
        if dev is not None:
            try:
                print(f"\nDisconnecting {TARGET_NAME}...")
                await dev.call_disconnect()
                print("Disconnected.")
            except Exception as e:
                print(f"Disconnect failed/ignored: {e}")

        remove_json_file()


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        remove_json_file()