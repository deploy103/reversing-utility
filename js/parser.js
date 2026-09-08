/**
 * parser.js
 * 숫자 / HEX 바이트 / 바이너리 / ASCII 입력을 자동 인식한다.
 *
 * 숫자:
 *   1234, 0x1234, 1234h, 0b1010, 1010b, 0o755
 *   공백과 _ 는 무시 (0x41_42_43_44)
 *
 * HEX 바이트:
 *   41424344 / 41 42 43 44 / 41:42:43:44
 *   0x41 0x42 0x43 0x44 / \x41\x42\x43\x44
 */
var RU = globalThis.RU || (globalThis.RU = {});

function _fail(error) {
  return { ok: false, error: error };
}

/**
 * 정수 문자열 → BigInt.
 * JS Number("0xffffffffffffffff") 는 정밀도가 깨지므로 BigInt 만 사용한다.
 */
RU.parseInteger = function (raw) {
  if (raw == null) return _fail("Empty input");
  var s = String(raw).trim();
  if (s === "") return _fail("Empty input");

  var compact = s.replace(/[\s_]/g, "");
  if (compact === "") return _fail("Empty input");

  var neg = false;
  if (compact.charAt(0) === "+" || compact.charAt(0) === "-") {
    neg = compact.charAt(0) === "-";
    compact = compact.slice(1);
    if (!compact) return _fail("Invalid number");
  }

  var base = 10;
  var digits = compact;

  if (/^0x/i.test(compact)) {
    base = 16;
    digits = compact.slice(2);
    if (!digits) return _fail("Invalid HEX");
    if (!/^[0-9a-fA-F]+$/.test(digits)) return _fail("Invalid HEX");
  } else if (/^0b/i.test(compact)) {
    base = 2;
    digits = compact.slice(2);
    if (!digits) return _fail("Invalid Binary");
    if (!/^[01]+$/.test(digits)) return _fail("Invalid Binary");
  } else if (/^0o/i.test(compact)) {
    base = 8;
    digits = compact.slice(2);
    if (!digits) return _fail("Invalid Octal");
    if (!/^[0-7]+$/.test(digits)) return _fail("Invalid Octal");
  } else if (/h$/i.test(compact)) {
    base = 16;
    digits = compact.slice(0, -1);
    if (!digits || !/^[0-9a-fA-F]+$/.test(digits)) return _fail("Invalid HEX");
  } else if (/^[01]+b$/i.test(compact)) {
    /* 1010b — 접미 b. 0/1 만 있을 때만 바이너리로 본다 (ABh 와 구분). */
    base = 2;
    digits = compact.slice(0, -1);
    if (!digits) return _fail("Invalid Binary");
  } else if (/^[0-9]+$/.test(compact)) {
    base = 10;
    digits = compact;
  } else if (/^[0-9a-fA-F]+$/.test(compact)) {
    /* 접두 없는 HEX: DEADBEEF, ABCD */
    base = 16;
    digits = compact;
  } else {
    return _fail("Invalid number");
  }

  try {
    var value;
    if (base === 16) value = BigInt("0x" + digits);
    else if (base === 2) value = BigInt("0b" + digits);
    else if (base === 8) value = BigInt("0o" + digits);
    else value = BigInt(digits);
    if (neg) value = -value;
    return { ok: true, value: value, base: base, digits: digits };
  } catch (e) {
    return _fail("Invalid number");
  }
};

/**
 * HEX 바이트열 파서.
 * 구분자: 공백, 콜론, 하이픈, 콤마, 0x, \x
 */
RU.parseHexBytes = function (raw) {
  if (raw == null) return _fail("Empty input");
  var s = String(raw).trim();
  if (s === "") return _fail("Empty input");

  /* \xNN 형태가 있으면 해당 토큰만 추출. 잘못된 \x 는 에러. */
  if (/\\x/i.test(s)) {
    var invalid = s.match(/\\x(?![0-9a-fA-F]{2})/i);
    if (invalid) return _fail("Invalid HEX");
    var tokens = s.match(/\\x[0-9a-fA-F]{2}/gi);
    if (!tokens || tokens.length === 0) return _fail("Invalid HEX");
    var bytesX = [];
    for (var i = 0; i < tokens.length; i++) {
      bytesX.push(parseInt(tokens[i].slice(2), 16));
    }
    return { ok: true, bytes: bytesX };
  }

  var cleaned = s
    .replace(/0x/gi, "")
    .replace(/[\s:,_-]/g, "");

  if (cleaned === "") return _fail("Empty input");
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) return _fail("Invalid HEX");
  if (cleaned.length % 2 !== 0) return _fail("Odd-length HEX");

  var bytes = [];
  for (var j = 0; j < cleaned.length; j += 2) {
    bytes.push(parseInt(cleaned.slice(j, j + 2), 16));
  }
  return { ok: true, bytes: bytes };
};

/**
 * 0/1 과 공백/_ 만 허용.
 * pad=true 이면 왼쪽 0 으로 8비트 배수에 맞춘다 (긴 비트열 자동 변환용).
 */
RU.parseBinaryBytes = function (raw, pad) {
  if (raw == null) return _fail("Empty input");
  var s = String(raw).trim().replace(/[\s_]/g, "");
  if (s === "") return _fail("Empty input");
  if (!/^[01]+$/.test(s)) return _fail("Invalid Binary");
  if (s.length % 8 !== 0) {
    if (pad) s = "0".repeat((8 - (s.length % 8)) % 8) + s;
    else return _fail("Binary length must be a multiple of 8");
  }
  var bytes = [];
  for (var i = 0; i < s.length; i += 8) {
    bytes.push(parseInt(s.slice(i, i + 8), 2));
  }
  return { ok: true, bytes: bytes };
};

/**
 * 공백/콜론 등으로 나뉜 HEX 덤프인지 O(n) 으로 본다.
 * 단일 `0x41424344` / `0x41_42_43_44` 는 정수이지 바이트 리스트가 아니다.
 */
RU.looksLikeSeparatedHex = function (raw) {
  var s = String(raw).trim();
  var multi0x = (s.match(/0x/gi) || []).length >= 2;
  var sep = /[\s:,-]/.test(s);
  if (!sep && !multi0x) return false;
  var cleaned = s.replace(/0x/gi, "").replace(/[\s:,_-]/g, "");
  return cleaned.length >= 2 && cleaned.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(cleaned);
};

/**
 * 주소/정수 식인지. `0x401C04+7`, `0x401C04 + 7`, `4*8+0x10`
 * HEX 덤프 `41-42-43-44` 는 식이 아니다.
 */
RU.looksLikeExpression = function (raw) {
  var t = String(raw).trim();
  if (!t) return false;
  if (/[+]/.test(t) || /[*\/()]/.test(t)) return true;
  if (!/-/.test(t)) return false;
  if (RU.looksLikeSeparatedHex(t)) return false;
  /* 0x401C0B-7 또는 100 - 3 처럼 숫자 두 개와 빼기 */
  return /[0-9a-fA-FhHbBoOxX][ \t]*-[ \t]*[+]?[0-9a-fA-FhHbBoOxX]/.test(t);
};

/**
 * + - * / 와 괄호. 곱·나눗셈이 덧셈보다 먼저. 나눗셈은 정수(BigInt).
 * 예: 0x401C04 + 7 → 0x401C0B
 */
RU.parseExpression = function (raw) {
  if (raw == null) return _fail("Empty input");
  var s = String(raw).trim();
  if (s === "") return _fail("Empty input");

  var i = 0;
  function peek() {
    while (i < s.length && /\s/.test(s.charAt(i))) i++;
    return i < s.length ? s.charAt(i) : "";
  }
  function eat(ch) {
    if (peek() === ch) {
      i++;
      return true;
    }
    return false;
  }

  function parseNumber() {
    peek();
    var start = i;
    if (i < s.length && (s.charAt(i) === "+" || s.charAt(i) === "-")) {
      /* 부호는 unary 에서 처리 */
    }
    while (i < s.length && /[0-9a-fA-FhHbBoOxX_]/.test(s.charAt(i))) i++;
    var tok = s.slice(start, i);
    if (!tok) return _fail("Invalid expression");
    var n = RU.parseInteger(tok);
    if (!n.ok) return n;
    return { ok: true, value: n.value, text: tok };
  }

  function parseFactor() {
    peek();
    if (eat("+")) return parseFactor();
    if (eat("-")) {
      var f = parseFactor();
      if (!f.ok) return f;
      return { ok: true, value: -f.value };
    }
    if (eat("(")) {
      var inner = parseAdd();
      if (!inner.ok) return inner;
      if (!eat(")")) return _fail("Missing )");
      return inner;
    }
    return parseNumber();
  }

  function parseMul() {
    var left = parseFactor();
    if (!left.ok) return left;
    for (;;) {
      peek();
      var op = "";
      if (eat("*")) op = "*";
      else if (eat("/")) op = "/";
      else break;
      var right = parseFactor();
      if (!right.ok) return right;
      if (op === "*") left = { ok: true, value: left.value * right.value };
      else {
        if (right.value === 0n) return _fail("Division by zero");
        left = { ok: true, value: left.value / right.value };
      }
    }
    return left;
  }

  function parseAdd() {
    var left = parseMul();
    if (!left.ok) return left;
    for (;;) {
      peek();
      var op = "";
      if (eat("+")) op = "+";
      else if (eat("-")) op = "-";
      else break;
      var right = parseMul();
      if (!right.ok) return right;
      if (op === "+") left = { ok: true, value: left.value + right.value };
      else left = { ok: true, value: left.value - right.value };
    }
    return left;
  }

  var result = parseAdd();
  if (!result.ok) return result;
  peek();
  if (i < s.length) return _fail("Invalid expression");
  return {
    ok: true,
    kind: "int",
    value: result.value,
    base: 16,
    source: "expr",
    expr: s.replace(/\s+/g, " ")
  };
};

RU.parseBinaryBits = function (raw) {
  if (raw == null) return _fail("Empty input");
  var s = String(raw).trim().replace(/[\s_]/g, "");
  if (s === "") return _fail("Empty input");
  if (!/^[01]+$/.test(s)) return _fail("Invalid Binary");
  try {
    return { ok: true, value: BigInt("0b" + s), bits: s.length };
  } catch (e) {
    return _fail("Invalid Binary");
  }
};

/**
 * Universal Input 자동 감지.
 * force: "auto" | "hex" | "dec" | "bin" | "oct" | "ascii" | "bytes"
 */
RU.analyzeInput = function (raw, force) {
  force = force || "auto";
  if (raw == null) return _fail("Empty input");
  var s = String(raw);
  var t = s.trim();
  if (t === "") return _fail("Empty input");

  if (force === "ascii") {
    return { ok: true, kind: "ascii", bytes: RU.asciiToBytes(s.replace(/\r\n/g, "\n")), source: "ascii" };
  }
  if (force === "bytes") {
    var hb = RU.parseHexBytes(t);
    if (!hb.ok) return hb;
    return { ok: true, kind: "bytes", bytes: hb.bytes, source: "hex-bytes" };
  }
  if (force === "hex" || force === "dec" || force === "bin" || force === "oct") {
    var prefixed = t;
    if (force === "hex" && !/^[-+]?0x/i.test(t.replace(/[\s_]/g, "")) && !/h$/i.test(t.replace(/[\s_]/g, ""))) {
      prefixed = "0x" + t.replace(/[\s_]/g, "");
    }
    if (force === "bin" && !/^[-+]?0b/i.test(t.replace(/[\s_]/g, "")) && !/[bB]$/.test(t.replace(/[\s_]/g, ""))) {
      prefixed = "0b" + t.replace(/[\s_]/g, "");
    }
    if (force === "oct" && !/^[-+]?0o/i.test(t.replace(/[\s_]/g, ""))) {
      prefixed = "0o" + t.replace(/[\s_]/g, "");
    }
    var nforced = RU.parseInteger(prefixed);
    if (!nforced.ok) return nforced;
    return {
      ok: true,
      kind: "int",
      value: nforced.value,
      base: nforced.base,
      source: force
    };
  }

  /* ---- auto: 긴 덤프도 선형 스캔으로 판별 ---- */

  /* 주소 계산: 0x401C04+7 → 0x401C0B. HEX 덤프 41-42-43-44 보다 먼저 보면 안 되므로 looksLike 로 걸러짐. */
  if (force === "auto" && RU.looksLikeExpression(t)) {
    var ex = RU.parseExpression(t);
    if (ex.ok) return ex;
  }

  /* C-style \x41\x42 */
  if (/\\x[0-9a-fA-F]{2}/i.test(t)) {
    var cx = RU.parseHexBytes(t);
    if (cx.ok) {
      return { ok: true, kind: "bytes", bytes: cx.bytes, source: "c-escape" };
    }
  }

  /* 41 42 43 44 / 41:42:43:44 / 0x41 0x42  — 구분자 있는 HEX 덤프 */
  if (RU.looksLikeSeparatedHex(t)) {
    var sb = RU.parseHexBytes(t);
    if (sb.ok) {
      return { ok: true, kind: "bytes", bytes: sb.bytes, source: "hex-bytes" };
    }
  }

  var compact = t.replace(/[\s_]/g, "");

  /* 접두/접미가 있는 숫자는 그대로 정수 파서 */
  if (
    /^[-+]?0[xXbBoO]/.test(compact) ||
    /h$/i.test(compact) ||
    /^[01]+b$/i.test(compact)
  ) {
    var prefixed = RU.parseInteger(t);
    if (prefixed.ok) {
      return {
        ok: true,
        kind: "int",
        value: prefixed.value,
        base: prefixed.base,
        source: "int"
      };
    }
  }

  /* 긴 비트열: 0/1 만 있고 길이 >= 8 이면 2진 (1010 짧은 십진과 구분) */
  if (/^[01]+$/.test(compact) && compact.length >= 8) {
    try {
      return {
        ok: true,
        kind: "int",
        value: BigInt("0b" + compact),
        base: 2,
        source: "binary"
      };
    } catch (eBin) {
      return _fail("Invalid Binary");
    }
  }

  /* HEX 숫자만. A-F 가 있거나 짝수 길이 >= 8 이면 HEX 덤프로 본다 (41424344 → ABCD). */
  if (/^[0-9a-fA-F]+$/.test(compact) && compact.length > 0) {
    var hasLetter = /[A-Fa-f]/.test(compact);
    if (hasLetter || (compact.length % 2 === 0 && compact.length >= 8)) {
      if (compact.length % 2 === 0) {
        var even = RU.parseHexBytes(compact);
        if (even.ok) {
          return { ok: true, kind: "bytes", bytes: even.bytes, source: "hex-bytes" };
        }
      }
      var asHex = RU.parseInteger("0x" + compact);
      if (asHex.ok) {
        return {
          ok: true,
          kind: "int",
          value: asHex.value,
          base: 16,
          source: "hex"
        };
      }
    }
  }

  /* 순수 십진 */
  var asDec = RU.parseInteger(t);
  if (asDec.ok) {
    return {
      ok: true,
      kind: "int",
      value: asDec.value,
      base: asDec.base,
      source: "int"
    };
  }

  return {
    ok: true,
    kind: "ascii",
    bytes: RU.asciiToBytes(s.replace(/\r\n/g, "\n")),
    source: "ascii"
  };
};

/**
 * 분석 결과를 전체 정수 + 전체 바이트로 정규화.
 * 길이에 제한을 두지 않는다. bitWidth 는 레지스터 뷰(하위 N비트) 용.
 */
RU.normalizeAnalysis = function (analysis, bitWidth) {
  if (!analysis || !analysis.ok) return analysis;

  var bytes;
  var fullValue;
  var autoBits;

  if (analysis.kind === "int") {
    var raw = analysis.value;
    if (raw < 0n) {
      autoBits = Math.max(RU.naturalWidth(-raw), bitWidth);
      /* 음수는 선택한 폭이 충분하면 그 폭, 아니면 값 크기에 맞춘 폭의 2의 보수 */
      if (RU.fitsInWidth(raw, bitWidth)) autoBits = bitWidth;
      fullValue = RU.toUnsigned(raw, autoBits);
    } else {
      fullValue = raw;
      autoBits = RU.naturalWidth(raw);
    }
    bytes = RU.intToBytesBE(fullValue, null);
    return {
      ok: true,
      kind: "int",
      source: analysis.source,
      value: fullValue,
      rawValue: raw,
      register: RU.maskToBits(fullValue, bitWidth),
      bytes: bytes,
      tooWide: !RU.fitsInWidth(raw < 0n ? raw : fullValue, bitWidth),
      error: null,
      bitWidth: bitWidth,
      autoBits: autoBits
    };
  }

  bytes = analysis.bytes.slice();
  fullValue = RU.bytesToIntBE(bytes);
  autoBits = Math.max(8, bytes.length * 8);
  return {
    ok: true,
    kind: analysis.kind,
    source: analysis.source,
    value: fullValue,
    rawValue: fullValue,
    register: RU.maskToBits(fullValue, bitWidth),
    bytes: bytes,
    tooWide: autoBits > bitWidth,
    error: null,
    bitWidth: bitWidth,
    autoBits: autoBits
  };
};
