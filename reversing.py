#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reversing Utility CLI. 표준 라이브러리만 사용. 네트워크 없음.

대회 전에 Python 3 를 설치해 두면, 브라우저 없이 터미널에서도
긴 HEX/BIN/DEC/OCT/ASCII 를 같은 방식으로 변환할 수 있다.

  python3 reversing.py 0x41424344
  python3 reversing.py
  (붙여넣은 뒤 Linux/macOS: Ctrl+D, Windows: Ctrl+Z Enter)
  python3 reversing.py -f dump.txt
"""
from __future__ import print_function

import argparse
import re
import sys


def _fail(msg):
    return None, msg


def parse_auto(raw):
    s = raw.strip()
    if not s:
        return _fail("Empty input")

    if re.search(r"\\x[0-9a-fA-F]{2}", s):
        tokens = re.findall(r"\\x([0-9a-fA-F]{2})", s)
        if tokens:
            return bytes(int(t, 16) for t in tokens), None

    compact = re.sub(r"[\s_]", "", s)

    multi_0x = len(re.findall(r"0x", s, flags=re.I)) >= 2
    sep = re.search(r"[\s:,-]", s)
    if sep or multi_0x:
        cleaned = re.sub(r"0x", "", s, flags=re.I)
        cleaned = re.sub(r"[\s:,_-]", "", cleaned)
        if len(cleaned) >= 2 and len(cleaned) % 2 == 0 and re.fullmatch(r"[0-9a-fA-F]+", cleaned):
            return bytes.fromhex(cleaned), None

    if re.search(r"[+*^&|]", s) or re.search(r"[0-9a-fA-FxX]\s*-\s*[0-9]", s):
        try:
            def _tok(m):
                t = m.group(0)
                if t.lower().startswith("0x"):
                    return str(int(t, 16))
                if t.lower().startswith("0b"):
                    return str(int(t, 2))
                if t.lower().startswith("0o"):
                    return str(int(t, 8))
                return t
            expr = re.sub(r"0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+", _tok, compact)
            if re.fullmatch(r"[0-9+\-*/()^&|<>]+", expr):
                n = eval(expr, {"__builtins__": {}}, {})
                return _int_to_bytes(int(n)), None
        except Exception:
            pass

    if re.fullmatch(r"[-+]?0[xX][0-9a-fA-F]+", compact):
        return _int_to_bytes(int(compact, 16)), None
    if re.fullmatch(r"[-+]?0[bB][01]+", compact):
        return _int_to_bytes(int(compact, 2)), None
    if re.fullmatch(r"[-+]?0[oO][0-7]+", compact):
        return _int_to_bytes(int(compact, 8)), None
    if re.fullmatch(r"[0-9a-fA-F]+h", compact, re.I):
        return _int_to_bytes(int(compact[:-1], 16)), None
    if re.fullmatch(r"[01]+b", compact, re.I):
        return _int_to_bytes(int(compact[:-1], 2)), None

    if re.fullmatch(r"[01]+", compact) and len(compact) >= 8:
        return _int_to_bytes(int(compact, 2)), None

    if re.fullmatch(r"[0-9a-fA-F]+", compact):
        has_letter = re.search(r"[A-Fa-f]", compact)
        if has_letter or (len(compact) % 2 == 0 and len(compact) >= 8):
            if len(compact) % 2 == 1:
                compact = "0" + compact
            return bytes.fromhex(compact), None
        return _int_to_bytes(int(compact, 10)), None

    if re.fullmatch(r"[-+]?\d+", compact):
        return _int_to_bytes(int(compact, 10)), None

    return s.encode("utf-8", errors="surrogateescape"), None


def _int_to_bytes(n):
    if n < 0:
        bits = max(8, n.bit_length() + 1)
        bits = ((bits + 7) // 8) * 8
        n = n & ((1 << bits) - 1)
    if n == 0:
        return b"\x00"
    length = (n.bit_length() + 7) // 8
    return n.to_bytes(length, "big")


def _to_int(buf):
    return int.from_bytes(buf, "big") if buf else 0


def _signed(n, bits):
    sign = 1 << (bits - 1)
    n &= (1 << bits) - 1
    if n & sign:
        return n - (1 << bits)
    return n


def dump(buf):
    n = _to_int(buf)
    bits = max(8, len(buf) * 8)
    ascii_s = "".join(chr(b) if 32 <= b <= 126 else "." for b in buf)
    hex_sp = " ".join("%02X" % b for b in buf)
    le = " ".join("%02X" % b for b in buf[::-1])
    bin_s = format(n, "0%db" % bits)
    bin_s = " ".join(bin_s[i:i + 8] for i in range(0, len(bin_s), 8))
    lines = [
        "HEX       0x" + buf.hex().upper(),
        "DEC       " + str(n),
        "BIN       0b" + bin_s,
        "OCT       0o" + format(n, "o"),
        "ASCII     " + ascii_s,
        "Bytes     " + hex_sp,
        "C Escape  " + "".join("\\x%02x" % b for b in buf),
        "Python    " + repr(buf),
        "Big Endian     " + hex_sp,
        "Little Endian  " + le,
        "Signed (full)    " + str(_signed(n, bits)),
        "Unsigned (full)  " + str(n),
        "Size      %d bytes / %d bits" % (len(buf), bits),
    ]
    return "\n".join(lines)


def _hex_bytes(s):
    cleaned = re.sub(r"0x", "", s, flags=re.I)
    cleaned = re.sub(r"[\s:,_-]", "", cleaned)
    return bytes.fromhex(cleaned)


def crib(ct, pt):
    """암호문 XOR 평문가정 = 키. pip 필요 없음."""
    cb = _hex_bytes(ct)
    pb = _hex_bytes(pt)
    n = min(len(cb), len(pb))
    key = bytes(cb[i] ^ pb[i] for i in range(n))
    for i in range(n):
        print("0x%02X ^ 0x%02X = 0x%02X" % (cb[i], pb[i], key[i]))
    print("키  " + " ".join("%02X" % b for b in key))
    return 0


def main(argv):
    if argv and argv[0] in ("crib", "xor-crib"):
        if len(argv) < 3:
            print('사용: python3 reversing.py crib "B5 21 D0 FE" "F3 0F 1E FA"', file=sys.stderr)
            return 2
        return crib(argv[1], argv[2])

    parser = argparse.ArgumentParser(
        description="Offline reversing converter (HEX/DEC/BIN/OCT/ASCII)."
    )
    parser.add_argument("value", nargs="?", help="input value (omit to read stdin)")
    parser.add_argument("-f", "--file", help="read input from a text file")
    args = parser.parse_args(argv)

    if args.file:
        with open(args.file, "r", encoding="utf-8", errors="replace") as fh:
            raw = fh.read()
    elif args.value is not None:
        raw = args.value
    else:
        raw = sys.stdin.read()

    data, err = parse_auto(raw)
    if err:
        print(err, file=sys.stderr)
        return 1
    try:
        print(dump(data))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
