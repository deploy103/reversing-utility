/**
 * xor.js
 * Numeric XOR, 바이트 XOR, repeating-key XOR, single-byte brute force.
 */
var RU = globalThis.RU || (globalThis.RU = {});

/** 두 바이트 배열 XOR. 길이가 다르면 에러. */
RU.xorBytes = function (a, b) {
  if (!a || !b) return { ok: false, error: "Empty input" };
  if (a.length !== b.length) {
    return { ok: false, error: "Data and key length must match (use repeating XOR for different lengths)" };
  }
  var out = [];
  for (var i = 0; i < a.length; i++) {
    out.push((a[i] ^ b[i]) & 0xff);
  }
  return { ok: true, bytes: out };
};

/**
 * repeating-key XOR.
 * Data: 48 65 6c 6c 6f / Key: KEY
 * 키가 데이터 길이만큼 반복되며 XOR 된다.
 */
RU.xorRepeating = function (data, key) {
  if (!data || data.length === 0) return { ok: false, error: "Empty input" };
  if (!key || key.length === 0) return { ok: false, error: "Empty key" };
  var out = [];
  for (var i = 0; i < data.length; i++) {
    out.push((data[i] ^ key[i % key.length]) & 0xff);
  }
  return { ok: true, bytes: out };
};

RU.xorSingleByte = function (data, keyByte) {
  var k = keyByte & 0xff;
  var out = [];
  for (var i = 0; i < data.length; i++) {
    out.push((data[i] ^ k) & 0xff);
  }
  return out;
};

/**
 * 0x00 ~ 0xFF 키를 전부 시도하고 printable score 내림차순 정렬.
 * 결과: [{ key, hex, ascii, score, bytes }, ...]
 */
RU.xorBruteforce = function (data) {
  if (!data || data.length === 0) return { ok: false, error: "Empty input" };
  var rows = [];
  for (var k = 0; k <= 0xff; k++) {
    var bytes = RU.xorSingleByte(data, k);
    var score = RU.printableScore(bytes);
    rows.push({
      key: k,
      hex: RU.bytesToHex(bytes),
      ascii: RU.bytesToAscii(bytes, true),
      score: score,
      percent: Math.round(score * 1000) / 10,
      bytes: bytes
    });
  }
  rows.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.key - b.key;
  });
  return { ok: true, rows: rows };
};

/**
 * 데이터/키 포맷 변환 후 XOR.
 * format: "ascii" | "hex"
 */
RU.parseXorOperand = function (raw, format) {
  if (format === "hex") return RU.parseHexBytes(raw);
  if (raw == null || String(raw).length === 0) {
    return { ok: false, error: "Empty input" };
  }
  return { ok: true, bytes: RU.asciiToBytes(String(raw)) };
};
