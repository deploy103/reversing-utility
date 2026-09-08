/**
 * converter.js
 * 진법 변환, ASCII/HEX/BIN, 2의 보수, Base64, URL, HEX dump, Bit Viewer.
 */
var RU = globalThis.RU || (globalThis.RU = {});

/**
 * Quick Convert 용 결과 객체.
 * 불가능한 항목은 "N/A".
 */
RU.quickConvert = function (normalized) {
  var na = RU.NA;
  var out = {
    hex: na,
    dec: na,
    bin: na,
    oct: na,
    ascii: na,
    bytes: na,
    cEscape: na,
    python: na,
    bigEndian: na,
    littleEndian: na,
    signed: na,
    unsigned: na,
    signedReg: na,
    unsignedReg: na,
    detected: "",
    error: null,
    bits: 0,
    byteLen: 0
  };
  if (!normalized || !normalized.ok) {
    out.error = normalized && normalized.error ? normalized.error : "Invalid input";
    return out;
  }

  var bits = normalized.bitWidth;
  var bytes = normalized.bytes || [];
  var autoBits = normalized.autoBits || Math.max(8, bytes.length * 8);
  var v = normalized.value;
  out.byteLen = bytes.length;
  out.bits = autoBits;
  out.detected = (normalized.source || normalized.kind || "") +
    " · " + autoBits + " bits · " + bytes.length + " bytes";

  if (bytes.length) {
    out.bytes = RU.bytesToHex(bytes);
    out.ascii = RU.bytesToAscii(bytes, true);
    out.cEscape = RU.cEscape(bytes);
    out.python = RU.pythonBytes(bytes);
    out.bigEndian = RU.bytesToHex(bytes);
    out.littleEndian = RU.bytesToHex(bytes.slice().reverse());
  }

  if (v != null) {
    out.hex = RU.formatHexFree(v);
    out.dec = RU.formatDec(v);
    out.bin = RU.formatBinFree(v);
    out.oct = RU.formatOctFree(v);
    out.unsigned = RU.formatDec(v);
    out.signed = RU.formatDec(RU.toSigned(v, autoBits));
    var reg = normalized.register != null ? normalized.register : RU.maskToBits(v, bits);
    out.unsignedReg = RU.formatDec(RU.toUnsigned(reg, bits));
    out.signedReg = RU.formatDec(RU.toSigned(reg, bits));
  }

  if (normalized.error) out.error = normalized.error;
  return out;
};

/** ASCII → HEX ("ABC" → "41 42 43") */
RU.asciiToHex = function (str) {
  return RU.bytesToHex(RU.asciiToBytes(str));
};

RU.hexToAscii = function (raw) {
  var p = RU.parseHexBytes(raw);
  if (!p.ok) return p;
  return { ok: true, text: RU.bytesToAscii(p.bytes, true), bytes: p.bytes };
};

RU.asciiToBinary = function (str) {
  var bytes = RU.asciiToBytes(str);
  var parts = [];
  for (var i = 0; i < bytes.length; i++) {
    parts.push(bytes[i].toString(2).padStart(8, "0"));
  }
  return parts.join(" ");
};

RU.binaryToAscii = function (raw) {
  var p = RU.parseBinaryBytes(raw);
  if (!p.ok) return p;
  return { ok: true, text: RU.bytesToAscii(p.bytes, true), bytes: p.bytes };
};

RU.hexToBinary = function (raw) {
  var p = RU.parseHexBytes(raw);
  if (!p.ok) return p;
  var parts = [];
  for (var i = 0; i < p.bytes.length; i++) {
    parts.push(p.bytes[i].toString(2).padStart(8, "0"));
  }
  return { ok: true, text: parts.join(" "), bytes: p.bytes };
};

RU.binaryToHex = function (raw) {
  var p = RU.parseBinaryBytes(raw);
  if (!p.ok) return p;
  return { ok: true, text: RU.bytesToHex(p.bytes), bytes: p.bytes };
};

/**
 * 2의 보수 정보.
 * twoComplement = 부호 반전 비트 패턴 (~x + 1) & mask
 */
RU.twosComplementInfo = function (value, bits) {
  var enc = RU.encodeToBits(value, bits);
  if (!enc.ok) return enc;
  var u = enc.value;
  var neg = RU.maskToBits((~u) + 1n, bits);
  return {
    ok: true,
    original: u,
    originalHex: RU.formatHex(u, bits),
    originalDec: RU.formatDec(u),
    binary: RU.formatBin(u, bits, false, true),
    twoComplement: neg,
    twoComplementHex: RU.formatHex(neg, bits),
    twoComplementBin: RU.formatBin(neg, bits, false, true),
    signed: RU.formatDec(RU.toSigned(u, bits)),
    unsigned: RU.formatDec(RU.toUnsigned(u, bits))
  };
};

/** 바이트 패딩 (앞 또는 뒤 0x00). */
RU.padBytes = function (bytes, length, side) {
  side = side || "left";
  var out = bytes.slice();
  if (out.length >= length) return { ok: true, bytes: out, truncated: out.length > length };
  while (out.length < length) {
    if (side === "right") out.push(0);
    else out.unshift(0);
  }
  return { ok: true, bytes: out, truncated: false };
};

/**
 * HEX dump (hexdump -C 스타일).
 * 기본 16바이트/줄.
 */
RU.hexDump = function (bytes, bytesPerLine) {
  bytesPerLine = bytesPerLine || 16;
  if (!bytes || bytes.length === 0) return "";
  var lines = [];
  for (var off = 0; off < bytes.length; off += bytesPerLine) {
    var chunk = bytes.slice(off, off + bytesPerLine);
    var hexParts = [];
    var ascii = "";
    for (var i = 0; i < chunk.length; i++) {
      hexParts.push(chunk[i].toString(16).toUpperCase().padStart(2, "0"));
      ascii += RU.isPrintableByte(chunk[i]) ? String.fromCharCode(chunk[i]) : ".";
    }
    var hex = hexParts.join(" ");
    var hexWidth = bytesPerLine * 3 - 1;
    while (hex.length < hexWidth) hex += " ";
    var addr = off.toString(16).toUpperCase().padStart(8, "0");
    lines.push(addr + "  " + hex + "  " + ascii);
  }
  return lines.join("\n");
};

/**
 * Bit Viewer.
 * 0xA5 / 8bit →
 *   Bit:   7 6 5 4 3 2 1 0
 *   Value: 1 0 1 0 0 1 0 1
 */
RU.bitView = function (value, bits) {
  var v = RU.maskToBits(value, bits);
  var indices = [];
  var values = [];
  var setBits = [];
  for (var i = bits - 1; i >= 0; i--) {
    indices.push(i);
    var bit = (v >> BigInt(i)) & 1n;
    values.push(Number(bit));
    if (bit === 1n) setBits.push(i);
  }
  return {
    indices: indices,
    values: values,
    setBits: setBits,
    popcount: setBits.length,
    parity: setBits.length & 1,
    hex: RU.formatHex(v, bits),
    bin: RU.formatBin(v, bits, false, true)
  };
};

/**
 * Base64. btoa/atob 는 라틴-1 기준이므로 바이트 배열을 경유한다.
 * 네트워크 요청 없음.
 */
RU.base64Encode = function (bytes) {
  var bin = "";
  for (var i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] & 0xff);
  }
  try {
    return { ok: true, text: btoa(bin) };
  } catch (e) {
    return { ok: false, error: "Base64 encode failed" };
  }
};

RU.base64EncodeText = function (str) {
  return RU.base64Encode(RU.asciiToBytes(str));
};

RU.base64Decode = function (raw) {
  var s = String(raw == null ? "" : raw).trim();
  if (s === "") return { ok: false, error: "Empty input" };
  s = s.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 === 1) {
    return { ok: false, error: "Invalid Base64" };
  }
  try {
    var bin = atob(s);
    var bytes = [];
    for (var i = 0; i < bin.length; i++) bytes.push(bin.charCodeAt(i) & 0xff);
    return { ok: true, bytes: bytes, text: RU.bytesToAscii(bytes, true) };
  } catch (e) {
    return { ok: false, error: "Invalid Base64" };
  }
};

RU.urlEncode = function (str) {
  try {
    return { ok: true, text: encodeURIComponent(str) };
  } catch (e) {
    return { ok: false, error: "URL encode failed" };
  }
};

RU.urlDecode = function (str) {
  try {
    return { ok: true, text: decodeURIComponent(String(str).replace(/\+/g, "%20")) };
  } catch (e) {
    return { ok: false, error: "Invalid URL encoding" };
  }
};

/**
 * 동일 비트 패턴을 여러 폭의 signed/unsigned 로 해석.
 */
RU.interpretInteger = function (value, bits) {
  var enc = RU.encodeToBits(value, bits);
  if (!enc.ok) return enc;
  var u = enc.value;
  return {
    ok: true,
    bits: bits,
    unsigned: RU.toUnsigned(u, bits),
    signed: RU.toSigned(u, bits),
    hex: RU.formatHex(u, bits),
    bin: RU.formatBin(u, bits)
  };
};
