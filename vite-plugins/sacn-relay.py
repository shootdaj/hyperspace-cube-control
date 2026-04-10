#!/usr/bin/env python3
"""
sACN UDP relay — reads 672-byte frames from stdin, sends as sACN E1.31 unicast.
Spawned by the Vite sacn-bridge plugin to bypass macOS Local Network restrictions on Node.js.

Usage: echo <binary_frame> | python3 sacn-relay.py <cube_ip>

Protocol: reads length-prefixed frames from stdin:
  [2 bytes big-endian length][payload]
  payload = 672 bytes (224 LEDs x 3 RGB)
"""
import sys
import struct
import socket
import time

UNIVERSE_1_CHANNELS = 510  # 170 LEDs x 3
UNIVERSE_2_CHANNELS = 162  # 54 LEDs x 3
SACN_PORT = 5568
SEQUENCE = [0]  # mutable for closure

def build_sacn_packet(universe: int, channels: bytes, source_name: str = "HyperCube Bridge", priority: int = 100) -> bytes:
    """Build a minimal E1.31 (sACN) data packet."""
    seq = SEQUENCE[0]
    SEQUENCE[0] = (SEQUENCE[0] + 1) % 256

    slot_count = len(channels)
    prop_length = slot_count + 1  # +1 for start code
    dmp_length = prop_length + 10
    frame_length = dmp_length + 77
    root_length = frame_length + 22

    # Root layer
    preamble = struct.pack(">HH", 0x0010, 0x0000)  # preamble size, postamble size
    acn_id = b"\x41\x53\x43\x2d\x45\x31\x2e\x31\x37\x00\x00\x00"  # "ASC-E1.17\0\0\0"
    root_flags_length = 0x7000 | root_length
    root_vector = struct.pack(">I", 0x00000004)  # VECTOR_ROOT_E131_DATA
    cid = b"\x48\x79\x70\x65\x72\x43\x75\x62\x65\x42\x72\x69\x64\x67\x65\x21"  # "HyperCubeBridge!"

    # Framing layer
    frame_flags_length = 0x7000 | frame_length
    frame_vector = struct.pack(">I", 0x00000002)  # VECTOR_E131_DATA_PACKET
    source = source_name.encode("utf-8")[:64].ljust(64, b"\x00")
    priority_byte = struct.pack("B", priority)
    sync_address = struct.pack(">H", 0)
    sequence_number = struct.pack("B", seq)
    options = struct.pack("B", 0)
    universe_bytes = struct.pack(">H", universe)

    # DMP layer
    dmp_flags_length = 0x7000 | dmp_length
    dmp_vector = struct.pack("B", 0x02)  # VECTOR_DMP_SET_PROPERTY
    address_type = struct.pack("B", 0xA1)  # address/data type
    first_property = struct.pack(">H", 0)
    address_increment = struct.pack(">H", 1)
    property_value_count = struct.pack(">H", prop_length)
    start_code = b"\x00"

    packet = (
        preamble + acn_id +
        struct.pack(">H", root_flags_length) + root_vector + cid +
        struct.pack(">H", frame_flags_length) + frame_vector + source +
        priority_byte + sync_address + sequence_number + options + universe_bytes +
        struct.pack(">H", dmp_flags_length) + dmp_vector + address_type +
        first_property + address_increment + property_value_count +
        start_code + channels
    )
    return packet


def main():
    if len(sys.argv) < 2:
        print("Usage: sacn-relay.py <cube_ip>", file=sys.stderr)
        sys.exit(1)

    cube_ip = sys.argv[1]
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    sys.stderr.write(f"[sacn-relay] Started, target={cube_ip}:{SACN_PORT}\n")
    sys.stderr.flush()

    stdin = sys.stdin.buffer
    frames_sent = 0
    t0 = time.time()

    while True:
        # Read 2-byte length prefix
        header = stdin.read(2)
        if not header or len(header) < 2:
            break
        length = struct.unpack(">H", header)[0]
        data = stdin.read(length)
        if not data or len(data) < length:
            break

        # Split into 2 universes
        u1_data = data[:UNIVERSE_1_CHANNELS].ljust(UNIVERSE_1_CHANNELS, b"\x00")
        u2_data = data[UNIVERSE_1_CHANNELS:UNIVERSE_1_CHANNELS + UNIVERSE_2_CHANNELS].ljust(UNIVERSE_2_CHANNELS, b"\x00")

        pkt1 = build_sacn_packet(1, u1_data)
        pkt2 = build_sacn_packet(2, u2_data)

        try:
            sock.sendto(pkt1, (cube_ip, SACN_PORT))
            sock.sendto(pkt2, (cube_ip, SACN_PORT))
            frames_sent += 1
        except Exception as e:
            sys.stderr.write(f"[sacn-relay] send error: {e}\n")
            sys.stderr.flush()

        # Log fps every 5s
        elapsed = time.time() - t0
        if elapsed >= 5.0:
            fps = frames_sent / elapsed
            sys.stderr.write(f"[sacn-relay] {fps:.1f} fps ({frames_sent} frames)\n")
            sys.stderr.flush()
            frames_sent = 0
            t0 = time.time()

    sock.close()
    sys.stderr.write("[sacn-relay] stdin closed, exiting\n")
    sys.stderr.flush()


if __name__ == "__main__":
    main()
