/**
 * bitwise.js
 * AND / OR / XOR / NOT / SHL / SHR / SAR / ROL / ROR
 * ADD / SUB / MUL (mod 2^N)
 *
 * JavaScript 의 & | ^ ~ << >> 는 내부적으로 32bit signed 로 변환되므로
 * 32/64bit 연산에는 절대 사용하지 않고 BigInt 만 사용한다.
 */
var RU = globalThis.RU || (globalThis.RU = {});

RU.and = function (a, b, bits) {
  return RU.maskToBits(BigInt(a) & BigInt(b), bits);
};

RU.or = function (a, b, bits) {
  return RU.maskToBits(BigInt(a) | BigInt(b), bits);
};

RU.xor = function (a, b, bits) {
  return RU.maskToBits(BigInt(a) ^ BigInt(b), bits);
};

/** 1의 보수. ~A 를 bits 폭으로 자른다. */
RU.not = function (a, bits) {
  return RU.maskToBits(~BigInt(a), bits);
};

/**
 * 논리 왼쪽 시프트. count >= bits 이면 0.
 * count 를 bits 로 모듈로 하지 않는다 (x86 SHL 과 달리 명시적 폭 기준).
 */
RU.shl = function (value, count, bits) {
  var v = RU.maskToBits(value, bits);
  var c = Number(count);
  if (!isFinite(c) || c < 0) c = 0;
  c = c >>> 0;
  if (c >= bits) return 0n;
  return RU.maskToBits(v << BigInt(c), bits);
};

/** 논리 오른쪽 시프트 (빈 비트는 0). */
RU.shr = function (value, count, bits) {
  var v = RU.maskToBits(value, bits);
  var c = Number(count);
  if (!isFinite(c) || c < 0) c = 0;
  c = c >>> 0;
  if (c >= bits) return 0n;
  return v >> BigInt(c);
};

/**
 * 산술 오른쪽 시프트 (부호 비트 유지).
 * BigInt 의 >> 는 산술 시프트이므로 먼저 signed 로 해석한다.
 * 예: 8bit 0x80 SAR 1 → 0xC0
 */
RU.sar = function (value, count, bits) {
  var signed = RU.toSigned(value, bits);
  var c = Number(count);
  if (!isFinite(c) || c < 0) c = 0;
  c = c >>> 0;
  if (c >= bits) {
    return signed < 0n ? RU.bitMask(bits) : 0n;
  }
  return RU.maskToBits(signed >> BigInt(c), bits);
};

/**
 * Rotate Left. bit width 기준으로 wrap.
 * ROL8(0x81, 1) = 0x03  (10000001 → 00000011)
 */
RU.rotateLeft = function (value, count, bits) {
  var b = BigInt(bits);
  var v = RU.maskToBits(value, bits);
  var c = BigInt(count);
  if (c < 0n) c = ((c % b) + b) % b;
  else c = c % b;
  if (c === 0n) return v;
  return RU.maskToBits((v << c) | (v >> (b - c)), bits);
};

/**
 * Rotate Right. bit width 기준으로 wrap.
 * ROR8(0x01, 1) = 0x80  (00000001 → 10000000)
 */
RU.rotateRight = function (value, count, bits) {
  var b = BigInt(bits);
  var v = RU.maskToBits(value, bits);
  var c = BigInt(count);
  if (c < 0n) c = ((c % b) + b) % b;
  else c = c % b;
  if (c === 0n) return v;
  return RU.maskToBits((v >> c) | (v << (b - c)), bits);
};

RU.addMod = function (a, b, bits) {
  return RU.maskToBits(BigInt(a) + BigInt(b), bits);
};

RU.subMod = function (a, b, bits) {
  return RU.maskToBits(BigInt(a) - BigInt(b), bits);
};

RU.mulMod = function (a, b, bits) {
  return RU.maskToBits(BigInt(a) * BigInt(b), bits);
};

/** 1 비트 개수 */
RU.popcount = function (value, bits) {
  var v = RU.maskToBits(value, bits);
  var n = 0;
  while (v > 0n) {
    if ((v & 1n) === 1n) n++;
    v >>= 1n;
  }
  return n;
};

/** 패리티 (1 비트 개수의 짝/홀). 0 = even, 1 = odd */
RU.parity = function (value, bits) {
  return RU.popcount(value, bits) & 1;
};

/** 비트 순서 반전. 8bit 0x01 → 0x80 */
RU.bitReverse = function (value, bits) {
  var v = RU.maskToBits(value, bits);
  var out = 0n;
  for (var i = 0; i < bits; i++) {
    out = (out << 1n) | (v & 1n);
    v >>= 1n;
  }
  return out;
};

/** 각 바이트의 니블 스왑. 0x1234 → 0x2143 */
RU.nibbleSwap = function (value, bits) {
  var v = RU.maskToBits(value, bits);
  var out = 0n;
  var nbytes = bits / 8;
  for (var i = 0; i < nbytes; i++) {
    var byte = (v >> BigInt(i * 8)) & 0xffn;
    var swapped = ((byte & 0x0fn) << 4n) | ((byte & 0xf0n) >> 4n);
    out |= swapped << BigInt(i * 8);
  }
  return out;
};

/**
 * BSWAP: 바이트 순서 반전 (bit width 단위).
 * 32bit 0x12345678 → 0x78563412
 */
RU.byteSwap = function (value, bits) {
  var bytes = RU.intToBytesBE(RU.maskToBits(value, bits), bits / 8);
  bytes.reverse();
  return RU.bytesToIntBE(bytes);
};
