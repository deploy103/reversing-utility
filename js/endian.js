/**
 * endian.js
 * 엔디안 변환, 바이트 배열 단위 reverse.
 *
 * 예: 12 34 56 78  (4-byte unit)
 *  →  78 56 34 12
 */
var RU = globalThis.RU || (globalThis.RU = {});

/**
 * bytes 를 unitSize (2/4/8) 단위로 뒤집는다.
 * 길이가 unit 의 배수가 아니면 마지막 자투리도 뒤집어 포함하되
 * leftover 경고를 붙인다.
 */
RU.reverseEndian = function (bytes, unitSize) {
  var unit = unitSize || 4;
  if (unit !== 2 && unit !== 4 && unit !== 8) {
    return { ok: false, error: "Unit size must be 2, 4, or 8" };
  }
  if (!bytes || bytes.length === 0) {
    return { ok: false, error: "Empty input" };
  }
  var out = [];
  var leftover = bytes.length % unit !== 0;
  for (var i = 0; i < bytes.length; i += unit) {
    var chunk = bytes.slice(i, i + unit);
    for (var j = chunk.length - 1; j >= 0; j--) {
      out.push(chunk[j]);
    }
  }
  return {
    ok: true,
    bytes: out,
    leftover: leftover,
    warning: leftover
      ? "Input length is not a multiple of " + unit + " bytes (remainder reversed)"
      : null
  };
};

/** Big Endian ↔ Little Endian 은 같은 바이트 스왑이다. */
RU.swapEndian = RU.reverseEndian;

/**
 * 정수 값의 엔디안 스왑 (BSWAP 과 동일, width 바이트 기준).
 */
RU.swapEndianInt = function (value, bits) {
  return RU.byteSwap(value, bits);
};
