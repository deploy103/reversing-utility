/**
 * Node 로 계산 코어를 검증한다. 브라우저 런타임은 필요 없다.
 * 사용: node tests/run.js
 */
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.join(__dirname, "..");
var files = [
  "js/utils.js",
  "js/parser.js",
  "js/bitwise.js",
  "js/endian.js",
  "js/xor.js",
  "js/converter.js"
];

var context = {
  globalThis: {},
  console: console,
  btoa: function (s) {
    return Buffer.from(s, "binary").toString("base64");
  },
  atob: function (s) {
    return Buffer.from(s, "base64").toString("binary");
  }
};
context.globalThis = context;
context.window = context;
vm.createContext(context);

files.forEach(function (f) {
  var code = fs.readFileSync(path.join(root, f), "utf8");
  vm.runInContext(code, context, { filename: f });
});

var RU = context.RU;
var failed = 0;
var passed = 0;

function eq(actual, expected, name) {
  var a = typeof actual === "bigint" ? actual.toString() : String(actual);
  var e = typeof expected === "bigint" ? expected.toString() : String(expected);
  if (a === e) {
    passed++;
    console.log("  PASS  " + name);
  } else {
    failed++;
    console.log("  FAIL  " + name);
    console.log("        expected: " + e);
    console.log("        actual:   " + a);
  }
}

function ok(cond, name) {
  eq(Boolean(cond), true, name);
}

console.log("\n== Required cases ==");
eq(RU.xor(0x41n, 0x20n, 8), 0x61n, "0x41 XOR 0x20 = 0x61");
eq(RU.and(0xffn, 0x0fn, 8), 0x0fn, "0xFF AND 0x0F = 0x0F");
eq(RU.or(0xf0n, 0x0fn, 8), 0xffn, "0xF0 OR 0x0F = 0xFF");
eq(RU.rotateLeft(0x81n, 1, 8), 0x03n, "ROL8(0x81, 1) = 0x03");
eq(RU.rotateRight(0x01n, 1, 8), 0x80n, "ROR8(0x01, 1) = 0x80");
eq(RU.toSigned(0xffn, 8), -1n, "0xFF signed 8bit = -1");

var en = RU.reverseEndian([0x12, 0x34, 0x56, 0x78], 4);
eq(RU.bytesToHex(en.bytes), "78 56 34 12", "endian 12 34 56 78 → 78 56 34 12");
eq(RU.asciiToHex("ABC"), "41 42 43", "ABC → 41 42 43");

console.log("\n== 64-bit / BigInt ==");
eq(RU.parseInteger("0xFFFFFFFFFFFFFFFF").value, 0xffffffffffffffffn, "parse 0xFFFFFFFFFFFFFFFF");
eq(RU.parseInteger("0xFFFFFFFF").value, 0xffffffffn, "parse 0xFFFFFFFF");
eq(RU.parseInteger("0x80000000").value, 0x80000000n, "parse 0x80000000");
eq(RU.parseInteger("0xFF").value, 0xffn, "parse 0xFF");
eq(RU.toSigned(0xffffffffffffffffn, 64), -1n, "64bit 0xFFFFFFFFFFFFFFFF signed = -1");
eq(RU.toUnsigned(0xffffffffffffffffn, 64), 0xffffffffffffffffn, "64bit unsigned max");
eq(RU.toSigned(0xffffffffn, 32), -1n, "32bit 0xFFFFFFFF signed = -1");
eq(RU.toSigned(0x80000000n, 32), -2147483648n, "32bit 0x80000000 signed = INT_MIN");
eq(RU.and(0xffffffffffffffffn, 1n, 64), 1n, "64bit AND low bit");
eq(RU.not(0n, 64), 0xffffffffffffffffn, "NOT 0 = 64bit all ones");
eq(RU.addMod(0xffffffffffffffffn, 1n, 64), 0n, "64bit add overflow wraps");
eq(RU.shl(1n, 63, 64), 0x8000000000000000n, "SHL 1 << 63 64bit");

console.log("\n== Parser formats ==");
eq(RU.parseInteger("1234").value, 1234n, "decimal 1234");
eq(RU.parseInteger("0x1234").value, 0x1234n, "0x1234");
eq(RU.parseInteger("1234h").value, 0x1234n, "1234h");
eq(RU.parseInteger("0b101010").value, 0b101010n, "0b101010");
eq(RU.parseInteger("101010b").value, 0b101010n, "101010b");
eq(RU.parseInteger("0o755").value, 0o755n, "0o755");
eq(RU.parseInteger("0x41_42_43_44").value, 0x41424344n, "0x41_42_43_44");
eq(RU.parseInteger("DEADBEEF").value, 0xdeadbeefn, "DEADBEEF bare hex");
eq(RU.parseInteger("-1").value, -1n, "decimal -1");

var hb1 = RU.parseHexBytes("41 42 43 44");
eq(RU.bytesToHex(hb1.bytes), "41 42 43 44", "hex spaces");
var hb2 = RU.parseHexBytes("41:42:43:44");
eq(RU.bytesToHex(hb2.bytes), "41 42 43 44", "hex colons");
var hb3 = RU.parseHexBytes("\\x41\\x42\\x43\\x44");
eq(RU.bytesToHex(hb3.bytes), "41 42 43 44", "c escape bytes");
var hb4 = RU.parseHexBytes("0x41 0x42 0x43 0x44");
eq(RU.bytesToHex(hb4.bytes), "41 42 43 44", "0x byte list");
eq(RU.parseHexBytes("414").error, "Odd-length HEX", "odd-length hex");
eq(RU.parseHexBytes("41 GG").ok, false, "invalid hex");

console.log("\n== Shift / Rotate extra ==");
eq(RU.shl(0x81n, 1, 8), 0x02n, "SHL8(0x81,1)=0x02");
eq(RU.shr(0x80n, 1, 8), 0x40n, "SHR8(0x80,1)=0x40");
eq(RU.sar(0x80n, 1, 8), 0xc0n, "SAR8(0x80,1)=0xC0");
eq(RU.sar(0xffn, 1, 8), 0xffn, "SAR8(0xFF,1)=0xFF");
eq(RU.rotateLeft(0x81n, 9, 8), 0x03n, "ROL8 count 9 ≡ 1");
eq(RU.rotateRight(0x01n, 9, 8), 0x80n, "ROR8 count 9 ≡ 1");
eq(RU.shl(1n, 8, 8), 0n, "SHL count>=width → 0");
eq(RU.byteSwap(0x12345678n, 32), 0x78563412n, "BSWAP32 0x12345678");
eq(RU.nibbleSwap(0x1234n, 16), 0x2143n, "nibble swap 0x1234");
eq(RU.bitReverse(0x01n, 8), 0x80n, "bit reverse 0x01");
eq(RU.popcount(0xa5n, 8), 4, "popcount 0xA5 = 4");

console.log("\n== XOR bytes / repeating / brute ==");
var xr = RU.xorRepeating(
  RU.parseHexBytes("48 65 6c 6c 6f").bytes,
  RU.asciiToBytes("KEY")
);
eq(RU.bytesToHex(xr.bytes), "03 20 35 27 2A", "repeating XOR Hello / KEY");
var xs = RU.xorBytes(RU.asciiToBytes("AAAA"), RU.asciiToBytes("AAAA"));
eq(RU.bytesToHex(xs.bytes), "00 00 00 00", "equal length xor AAAA^AAAA");
eq(RU.xor(0x40n, 0x20n, 8), 0x60n, "'@' XOR space = 0x60");

var brute = RU.xorBruteforce(RU.xorSingleByte(RU.asciiToBytes("Hello World"), 0x13));
var hit = null;
for (var bi = 0; bi < brute.rows.length; bi++) {
  if (brute.rows[bi].key === 0x13) hit = brute.rows[bi];
}
eq(hit.ascii, "Hello World", "bruteforce key 0x13 recovers Hello World");
eq(hit.percent, 100, "bruteforce correct key is 100% printable");
ok(brute.rows[0].score >= brute.rows[brute.rows.length - 1].score, "bruteforce sorted by score");

console.log("\n== Two's complement / encoding ==");
var tc = RU.twosComplementInfo(5n, 8);
eq(tc.twoComplement, 0xfbn, "two's complement of 5 is 0xFB");
eq(tc.signed, "5", "signed 5");
var tcff = RU.twosComplementInfo(0xffn, 8);
eq(tcff.signed, "-1", "0xFF signed -1");
eq(tcff.twoComplement, 1n, "negation of 0xFF is 1");

var b64 = RU.base64EncodeText("Hello");
eq(b64.text, "SGVsbG8=", "base64 Hello");
eq(RU.base64Decode("SGVsbG8=").text, "Hello", "base64 decode Hello");
eq(RU.urlEncode("a b=c").text, "a%20b%3Dc", "url encode");
eq(RU.urlDecode("a%20b%3Dc").text, "a b=c", "url decode");

var dump = RU.hexDump(RU.asciiToBytes("Hello World"), 8);
ok(dump.indexOf("48 65 6C 6C 6F 20 57 6F") >= 0, "hex dump contains Hello Wo hex");
ok(dump.indexOf("Hello Wo") >= 0, "hex dump ascii column");

var bv = RU.bitView(0xa5n, 8);
eq(bv.values.join(""), "10100101", "bit view 0xA5");
eq(bv.indices.join(" "), "7 6 5 4 3 2 1 0", "bit indices 7..0");

console.log("\n== Universal analyze ==");
var a1 = RU.analyzeInput("0x41424344", "auto");
eq(a1.kind, "int", "0x41424344 is int");
eq(a1.value, 0x41424344n, "0x41424344 value");
var a2 = RU.analyzeInput("41 42 43 44", "auto");
eq(a2.kind, "bytes", "spaced hex is bytes");
var a3 = RU.analyzeInput("Hello World", "auto");
eq(a3.kind, "ascii", "Hello World is ascii");
var a4 = RU.analyzeInput("\\x41\\x42\\x43\\x44", "auto");
eq(a4.kind, "bytes", "c-escape is bytes");
eq(RU.fitsInWidth(0xffffffffffffffffn, 32), false, "64bit value exceeds 32");
eq(RU.fitsInWidth(0xffffffffn, 32), true, "0xFFFFFFFF fits 32");
eq(RU.encodeToBits(256n, 8).ok, false, "256 exceeds 8bit");

var q = RU.quickConvert(RU.normalizeAnalysis(RU.analyzeInput("0x41424344"), 32));
eq(q.ascii, "ABCD", "quick convert ASCII ABCD");
eq(q.signed, "1094861636", "quick convert signed");
eq(q.littleEndian, "44 43 42 41", "quick convert LE");
var qff = RU.quickConvert(RU.normalizeAnalysis(RU.analyzeInput("0xFF"), 8));
eq(qff.signed, "-1", "quick convert 0xFF 8bit signed = -1");
eq(qff.unsigned, "255", "quick convert 0xFF 8bit unsigned = 255");
var q32 = RU.quickConvert(RU.normalizeAnalysis(RU.analyzeInput("0xFFFFFFFF"), 32));
eq(q32.signed, "-1", "quick convert 0xFFFFFFFF 32bit signed = -1");
eq(q32.unsigned, "4294967295", "quick convert 0xFFFFFFFF unsigned");

console.log("\n== Long strings / unlimited bases ==");
var bare = RU.analyzeInput("41424344", "auto");
eq(bare.kind, "bytes", "41424344 auto is hex bytes not decimal");
var qbare = RU.quickConvert(RU.normalizeAnalysis(bare, 32));
eq(qbare.ascii, "ABCD", "41424344 → ASCII ABCD");
eq(qbare.hex, "0x41424344", "41424344 → HEX");
eq(qbare.dec, "1094861636", "41424344 → DEC");

var longHex = "41".repeat(80);
var aLong = RU.analyzeInput(longHex, "auto");
eq(aLong.kind, "bytes", "160 hex chars auto bytes");
eq(aLong.bytes.length, 80, "80 bytes");
var qLong = RU.quickConvert(RU.normalizeAnalysis(aLong, 32));
ok(qLong.hex.indexOf("N/A") < 0, "long HEX is not N/A");
ok(qLong.dec !== "N/A" && qLong.dec.length > 10, "long DEC is full integer");
ok(qLong.bin.indexOf("0b") === 0, "long BIN starts with 0b");
ok(qLong.oct.indexOf("0o") === 0, "long OCT starts with 0o");
eq(qLong.ascii, "A".repeat(80), "80 A's");
ok(qLong.byteLen === 80, "byteLen 80");

var longSpaced = [];
for (var li = 0; li < 64; li++) longSpaced.push("48");
var aSp = RU.analyzeInput(longSpaced.join(" "), "auto");
eq(aSp.kind, "bytes", "spaced long hex dump");
eq(aSp.bytes.length, 64, "64 spaced bytes");
eq(RU.quickConvert(RU.normalizeAnalysis(aSp, 32)).ascii, "H".repeat(64), "64 H's");

var longBin = "01000001".repeat(40);
var aBin = RU.analyzeInput(longBin, "auto");
eq(aBin.base, 2, "long 0/1 is binary");
var qBin = RU.quickConvert(RU.normalizeAnalysis(aBin, 32));
eq(qBin.ascii, "A".repeat(40), "40-byte binary → AAAA...");
eq(qBin.hex, "0x" + "41".repeat(40).toUpperCase(), "binary → hex");

var hugeDec = RU.analyzeInput("1606938044258990275541962092341162602522202993782792835301376", "auto");
ok(hugeDec.ok && hugeDec.kind === "int", "huge decimal parses");
var qDec = RU.quickConvert(RU.normalizeAnalysis(hugeDec, 64));
ok(qDec.hex.indexOf("0x") === 0 && qDec.hex.length > 10, "huge decimal → hex");
ok(qDec.bin.indexOf("0b") === 0, "huge decimal → bin");

console.log("\n== index.html local-only + IDs ==");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
ok(html.indexOf("http://") < 0 && html.indexOf("https://") < 0, "index.html has no http(s) URL");
ok(html.indexOf("cdn") < 0, "index.html has no cdn");
ok(html.indexOf('type="module"') < 0, "index.html does not use ES modules");
[
  "u-input", "bw-a", "bw-b", "sh-val", "sh-count",
  "xn-a", "xs-data", "xr-data", "xb-data",
  "by-in", "en-in", "int-in", "tc-in",
  "b64e-in", "hd-in", "bv-in"
].forEach(function (id) {
  ok(html.indexOf('id="' + id + '"') >= 0, "has #" + id);
});

var css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
ok(css.indexOf("http://") < 0 && css.indexOf("https://") < 0, "style.css has no http(s) URL");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
