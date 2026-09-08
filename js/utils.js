/**
 * utils.js
 * 공통 유틸리티. DOM에 의존하지 않는다.
 * 64bit 정수는 반드시 BigInt 로 다룬다. JS Number 의 & | ^ << 는 쓰지 않는다.
 */
var RU = globalThis.RU || (globalThis.RU = {});

RU.NA = "N/A";

/** 지원 bit width */
RU.WIDTHS = [8, 16, 32, 64];

/**
 * n-bit 마스크. 예: 8 → 0xFFn, 32 → 0xFFFFFFFFn, 64 → 0xFFFFFFFFFFFFFFFFn
 * (1n << 64n) - 1n 은 JS Number 로는 표현할 수 없다.
 */
RU.bitMask = function (bits) {
  var n = BigInt(bits);
  return (1n << n) - 1n;
};

/** value 를 bits 폭으로 자른다 (하위 bits만 유지). */
RU.maskToBits = function (value, bits) {
  return BigInt(value) & RU.bitMask(bits);
};

/**
 * 부호 있는 해석.
 * 예: 0xFFn / 8bit → -1n, 0x80000000n / 32bit → -2147483648n
 */
RU.toSigned = function (value, bits) {
  var u = RU.maskToBits(value, bits);
  var sign = 1n << BigInt(bits - 1);
  if ((u & sign) !== 0n) {
    return u - (1n << BigInt(bits));
  }
  return u;
};

/**
 * 부호 없는 해석 (항상 0 .. 2^bits-1).
 * 음수 BigInt 는 2의 보수로 래핑된다. 예: -1n & 0xFFn === 0xFFn
 */
RU.toUnsigned = function (value, bits) {
  return RU.maskToBits(value, bits);
};

/**
 * 입력 정수가 선택한 bit width 에 들어가는지 검사.
 * unsigned 최대값(2^n-1) 또는 signed 최소값(-2^(n-1))까지 허용.
 */
RU.fitsInWidth = function (value, bits) {
  var v = BigInt(value);
  var minSigned = -(1n << BigInt(bits - 1));
  var maxUnsigned = RU.bitMask(bits);
  return v >= minSigned && v <= maxUnsigned;
};

/**
 * 값을 bit pattern 으로 인코딩.
 * 범위 밖이면 error, 범위 안이면 마스크된 비트열을 반환.
 */
RU.encodeToBits = function (value, bits) {
  var v = BigInt(value);
  if (!RU.fitsInWidth(v, bits)) {
    return { ok: false, error: "Value exceeds selected bit width" };
  }
  return { ok: true, value: RU.maskToBits(v, bits) };
};

/** 값이 폭을 넘으면 에러와 함께 마스크된 값도 돌려준다 (경고 표시용). */
RU.encodeToBitsWarn = function (value, bits) {
  var v = BigInt(value);
  var masked = RU.maskToBits(v, bits);
  if (!RU.fitsInWidth(v, bits)) {
    return {
      ok: false,
      error: "Value exceeds selected bit width",
      value: masked
    };
  }
  return { ok: true, value: masked };
};

RU.formatHex = function (value, bits, withPrefix) {
  if (withPrefix === undefined) withPrefix = true;
  var hexDigits = bits / 4;
  var hex = RU.maskToBits(value, bits)
    .toString(16)
    .toUpperCase()
    .padStart(hexDigits, "0");
  return withPrefix ? "0x" + hex : hex;
};

RU.formatDec = function (value) {
  return BigInt(value).toString(10);
};

RU.formatBin = function (value, bits, withPrefix, grouped) {
  if (withPrefix === undefined) withPrefix = true;
  if (grouped === undefined) grouped = true;
  var bin = RU.maskToBits(value, bits).toString(2).padStart(bits, "0");
  if (grouped && bits > 8) {
    bin = bin.match(/.{1,8}/g).join(" ");
  }
  return withPrefix ? "0b" + bin : bin;
};

RU.formatOct = function (value, bits, withPrefix) {
  if (withPrefix === undefined) withPrefix = true;
  var octDigits = Math.ceil(bits / 3);
  var oct = RU.maskToBits(value, bits)
    .toString(8)
    .padStart(octDigits, "0");
  return withPrefix ? "0o" + oct : oct;
};

/** 양수 비트 패턴의 최소 비트 수 (0 은 1). */
RU.bitLength = function (value) {
  var v = BigInt(value);
  if (v < 0n) v = -v;
  if (v === 0n) return 1;
  return v.toString(2).length;
};

/** 바이트 정렬된 비트 폭. 최소 8. */
RU.naturalWidth = function (value) {
  var n = RU.bitLength(value);
  var bits = Math.ceil(n / 8) * 8;
  return bits < 8 ? 8 : bits;
};

RU.groupEvery = function (s, n, sep) {
  if (!s) return s;
  sep = sep || " ";
  var rem = s.length % n;
  var parts = [];
  var i = 0;
  if (rem) {
    parts.push(s.slice(0, rem));
    i = rem;
  }
  for (; i < s.length; i += n) parts.push(s.slice(i, i + n));
  return parts.join(sep);
};

/**
 * 고정 bit width 없이 전체 정수를 HEX/DEC/BIN/OCT 로 만든다.
 * 64bit 를 넘는 값도 BigInt 로 그대로 출력한다.
 */
RU.formatHexFree = function (value, withPrefix) {
  if (withPrefix === undefined) withPrefix = true;
  var v = BigInt(value);
  if (v < 0n) v = -v;
  var hex = v.toString(16).toUpperCase();
  if (hex.length % 2) hex = "0" + hex;
  return withPrefix ? "0x" + hex : hex;
};

RU.formatBinFree = function (value, withPrefix, grouped) {
  if (withPrefix === undefined) withPrefix = true;
  if (grouped === undefined) grouped = true;
  var bits = RU.naturalWidth(value);
  var v = BigInt(value);
  if (v < 0n) v = -v;
  var bin = v.toString(2).padStart(bits, "0");
  if (grouped) bin = RU.groupEvery(bin, 8);
  return withPrefix ? "0b" + bin : bin;
};

RU.formatOctFree = function (value, withPrefix) {
  if (withPrefix === undefined) withPrefix = true;
  var v = BigInt(value);
  if (v < 0n) v = -v;
  return (withPrefix ? "0o" : "") + v.toString(8);
};

RU.DISPLAY_LIMIT = 8000;

RU.truncateDisplay = function (text, limit) {
  limit = limit || RU.DISPLAY_LIMIT;
  var s = String(text == null ? "" : text);
  if (s.length <= limit) return s;
  return s.slice(0, limit) + "\n… (" + s.length + " chars total, Copy = full)";
};

RU.MAX_INPUT_CHARS = 2 * 1024 * 1024;

/** 바이트 배열 → "41 42 43 44" */
RU.bytesToHex = function (bytes, sep) {
  if (sep === undefined) sep = " ";
  var parts = [];
  for (var i = 0; i < bytes.length; i++) {
    parts.push((bytes[i] & 0xff).toString(16).toUpperCase().padStart(2, "0"));
  }
  return parts.join(sep);
};

/** 정수 → 빅엔디안 바이트 배열. length 미지정 시 최소 길이(최소 1). push+reverse 로 긴 값도 O(n). */
RU.intToBytesBE = function (value, length) {
  var v = BigInt(value);
  if (v < 0n) {
    throw new Error("intToBytesBE expects non-negative bit pattern");
  }
  var bytes = [];
  if (v === 0n) bytes.push(0);
  while (v > 0n) {
    bytes.push(Number(v & 0xffn));
    v >>= 8n;
  }
  bytes.reverse();
  if (length !== undefined && length !== null) {
    while (bytes.length < length) bytes.unshift(0);
    if (bytes.length > length) bytes = bytes.slice(bytes.length - length);
  }
  return bytes;
};

RU.intToBytesLE = function (value, length) {
  return RU.intToBytesBE(value, length).reverse();
};

/** 빅엔디안 바이트 → 정수 */
RU.bytesToIntBE = function (bytes) {
  var v = 0n;
  for (var i = 0; i < bytes.length; i++) {
    v = (v << 8n) | BigInt(bytes[i] & 0xff);
  }
  return v;
};

RU.bytesToIntLE = function (bytes) {
  var v = 0n;
  for (var i = bytes.length - 1; i >= 0; i--) {
    v = (v << 8n) | BigInt(bytes[i] & 0xff);
  }
  return v;
};

RU.isPrintableByte = function (b) {
  return b >= 0x20 && b <= 0x7e;
};

/** 바이트 → ASCII. 비인쇄 문자는 '.' 로 치환. */
RU.bytesToAscii = function (bytes, useDot) {
  if (useDot === undefined) useDot = true;
  var out = "";
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    if (RU.isPrintableByte(b)) out += String.fromCharCode(b);
    else out += useDot ? "." : "";
  }
  return out;
};

RU.asciiToBytes = function (str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c <= 255) {
      bytes.push(c);
    } else {
      /* 비 Latin-1 문자는 UTF-8 바이트로 넣는다. 네트워크 없이 encodeURIComponent 만 사용. */
      var enc = encodeURIComponent(str.charAt(i));
      var k = 0;
      while (k < enc.length) {
        if (enc.charAt(k) === "%") {
          bytes.push(parseInt(enc.slice(k + 1, k + 3), 16));
          k += 3;
        } else {
          bytes.push(enc.charCodeAt(k));
          k += 1;
        }
      }
    }
  }
  return bytes;
};

RU.cEscape = function (bytes) {
  var out = "";
  for (var i = 0; i < bytes.length; i++) {
    out += "\\x" + (bytes[i] & 0xff).toString(16).padStart(2, "0");
  }
  return out;
};

/** Python bytes 리터럴. 인쇄 가능하면 그대로, 아니면 \\xNN */
RU.pythonBytes = function (bytes) {
  var out = "b'";
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    if (b === 0x27) out += "\\'";
    else if (b === 0x5c) out += "\\\\";
    else if (RU.isPrintableByte(b)) out += String.fromCharCode(b);
    else out += "\\x" + b.toString(16).padStart(2, "0");
  }
  return out + "'";
};

/**
 * printable ASCII 비율 (0~1).
 * 공백~틸드 + 탭/LF/CR 을 인쇄 가능으로 본다.
 */
RU.printableScore = function (bytes) {
  if (!bytes || bytes.length === 0) return 0;
  var n = 0;
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    if ((b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d) {
      n++;
    }
  }
  return n / bytes.length;
};

RU.debounce = function (fn, ms) {
  var t = null;
  return function () {
    var ctx = this;
    var args = arguments;
    if (t) clearTimeout(t);
    t = setTimeout(function () {
      fn.apply(ctx, args);
    }, ms);
  };
};

/**
 * file:// 에서는 Clipboard API 가 막히는 경우가 많아
 * textarea + execCommand 폴백을 둔다.
 */
RU.copyText = function (text) {
  text = String(text == null ? "" : text);
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(function () {
      return RU._copyFallback(text);
    });
  }
  return Promise.resolve(RU._copyFallback(text));
};

RU._copyFallback = function (text) {
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  var ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
};

RU.storage = {
  get: function (key, fallback) {
    try {
      var v = localStorage.getItem("ru." + key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  },
  set: function (key, value) {
    try {
      localStorage.setItem("ru." + key, String(value));
    } catch (e) {
      /* file:// 일부 브라우저는 localStorage 를 막을 수 있다 */
    }
  }
};

/** 값이 비어 있거나 N/A 인지 */
RU.isNA = function (v) {
  return v === null || v === undefined || v === "" || v === RU.NA;
};
