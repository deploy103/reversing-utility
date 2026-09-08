/**
 * app.js
 * DOM 연결. 계산은 다른 모듈에 위임한다.
 * Enter = Calculate. 입력 변경은 debounce.
 * 설정(bit width, tool, theme)만 localStorage 에 저장하고 입력값은 저장하지 않는다.
 */
(function () {
  var state = {
    bitWidth: 32,
    tool: "convert",
    theme: "dark",
    format: "auto"
  };

  var DEBOUNCE_MS = 180;

  function $(id) {
    return document.getElementById(id);
  }

  function clearEl(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text == null ? "" : String(text);
  }

  function addRow(parent, label, value) {
    var row = document.createElement("div");
    row.className = "result-row";

    var lab = document.createElement("span");
    lab.className = "label";
    lab.textContent = label;

    var full = value == null ? RU.NA : String(value);
    var val = document.createElement("code");
    val.className = "value";
    val.textContent = RU.truncateDisplay(full);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.setAttribute("data-copy-text", full);

    row.appendChild(lab);
    row.appendChild(val);
    row.appendChild(btn);
    parent.appendChild(row);
    return row;
  }

  function renderTriple(container, value, bits) {
    clearEl(container);
    if (value == null) {
      addRow(container, "HEX", RU.NA);
      addRow(container, "DEC", RU.NA);
      addRow(container, "BIN", RU.NA);
      return;
    }
    addRow(container, "HEX", RU.formatHex(value, bits));
    addRow(container, "DEC", RU.formatDec(RU.toUnsigned(value, bits)));
    addRow(container, "BIN", RU.formatBin(value, bits));
  }

  function renderBytesOut(container, bytes, extraRows) {
    clearEl(container);
    if (!bytes) {
      addRow(container, "Result", RU.NA);
      return;
    }
    addRow(container, "HEX", RU.bytesToHex(bytes));
    addRow(container, "ASCII", RU.bytesToAscii(bytes, true));
    addRow(container, "C Escape", RU.cEscape(bytes));
    addRow(container, "Python", RU.pythonBytes(bytes));
    if (extraRows) {
      for (var i = 0; i < extraRows.length; i++) {
        addRow(container, extraRows[i][0], extraRows[i][1]);
      }
    }
  }

  function opCard(parent, title) {
    var card = document.createElement("div");
    card.className = "op-card";
    var h = document.createElement("h3");
    h.textContent = title;
    var body = document.createElement("div");
    card.appendChild(h);
    card.appendChild(body);
    parent.appendChild(card);
    return body;
  }

  function flashCopied(btn) {
    var prev = btn.textContent;
    btn.textContent = "Copied";
    btn.classList.add("copied");
    setTimeout(function () {
      btn.textContent = prev || "Copy";
      btn.classList.remove("copied");
    }, 1100);
  }

  function parseCount(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (s === "") return { ok: false, error: "Empty input" };
    var n = RU.parseInteger(s);
    if (!n.ok) return n;
    if (n.value < 0n) return { ok: false, error: "Shift count must be >= 0" };
    if (n.value > 4096n) return { ok: false, error: "Shift count too large" };
    return { ok: true, value: Number(n.value) };
  }

  /**
   * 필드에서 정수를 읽고 현재 bit width 로 인코딩.
   * 실패 시 error 엘리먼트에 메시지를 넣는다.
   */
  function readInt(inputEl, errEl, allowEmpty) {
    var raw = inputEl.value;
    if (String(raw).trim() === "") {
      setText(errEl, allowEmpty ? "" : "Empty input");
      return { ok: false, error: "Empty input" };
    }
    var parsed = RU.parseInteger(raw);
    if (!parsed.ok) {
      setText(errEl, parsed.error);
      return parsed;
    }
    var enc = RU.encodeToBits(parsed.value, state.bitWidth);
    if (!enc.ok) {
      setText(errEl, enc.error);
      return enc;
    }
    setText(errEl, "");
    return { ok: true, value: enc.value, raw: parsed.value };
  }

  function saveSettings() {
    if (state.uitest) return;
    RU.storage.set("bitWidth", state.bitWidth);
    RU.storage.set("tool", state.tool);
    RU.storage.set("theme", state.theme);
  }

  function loadSettings() {
    var w = parseInt(RU.storage.get("bitWidth", "32"), 10);
    if (RU.WIDTHS.indexOf(w) >= 0) state.bitWidth = w;
    var tool = RU.storage.get("tool", "convert");
    if (tool) state.tool = tool;
    var theme = RU.storage.get("theme", "dark");
    if (theme === "light" || theme === "dark") state.theme = theme;
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    $("theme-toggle").textContent = state.theme === "dark" ? "Light" : "Dark";
  }

  function applyWidthButtons() {
    var groups = document.querySelectorAll("[data-role='width'] button");
    for (var i = 0; i < groups.length; i++) {
      var btn = groups[i];
      var w = parseInt(btn.getAttribute("data-width"), 10);
      if (w === state.bitWidth) btn.classList.add("active");
      else btn.classList.remove("active");
    }
  }

  function setBitWidth(w) {
    w = parseInt(w, 10);
    if (RU.WIDTHS.indexOf(w) < 0) return;
    state.bitWidth = w;
    applyWidthButtons();
    saveSettings();
    recalcAll();
  }

  function setTool(name) {
    state.tool = name;
    var btns = document.querySelectorAll(".nav-btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("active", btns[i].getAttribute("data-tool") === name);
    }
    var panels = document.querySelectorAll(".panel");
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.toggle("active", panels[j].id === "panel-" + name);
    }
    saveSettings();
    if (name === "convert") {
      $("u-input").focus();
    }
    recalcTool();
  }

  function setFormat(fmt) {
    state.format = fmt;
    var btns = document.querySelectorAll("#u-format button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("active", btns[i].getAttribute("data-fmt") === fmt);
    }
    runUniversal();
  }

  /* ---------- Universal / Quick Convert ---------- */

  function runUniversal() {
    var raw = $("u-input").value;
    var err = $("u-error");
    var det = $("u-detected");
    var box = $("u-results");
    clearEl(box);
    setText(err, "");
    setText(det, "");

    if (String(raw).trim() === "") {
      return;
    }

    if (raw.length > RU.MAX_INPUT_CHARS) {
      setText(err, "Input truncated to " + RU.MAX_INPUT_CHARS + " chars");
      raw = raw.slice(0, RU.MAX_INPUT_CHARS);
    }

    var analysis = RU.analyzeInput(raw, state.format);
    if (!analysis.ok) {
      setText(err, analysis.error);
      return;
    }

    var norm = RU.normalizeAnalysis(analysis, state.bitWidth);
    var q = RU.quickConvert(norm);

    var kindLabel = {
      int: "integer",
      bytes: "bytes",
      ascii: "ASCII"
    };
    var src = norm.source || analysis.source || "";
    setText(
      det,
      "Detected: " +
        (kindLabel[norm.kind] || norm.kind) +
        (src ? " (" + src + ")" : "") +
        " · " +
        (q.bits || 0) +
        " bits / " +
        (q.byteLen || 0) +
        " bytes" +
        " · register " +
        state.bitWidth +
        "-bit"
    );
    if (q.error) setText(err, q.error);

    var rows = [
      ["HEX", q.hex],
      ["DEC", q.dec],
      ["BIN", q.bin],
      ["OCT", q.oct],
      ["ASCII", q.ascii],
      ["Bytes", q.bytes],
      ["C Escape", q.cEscape],
      ["Python Bytes", q.python],
      ["Big Endian", q.bigEndian],
      ["Little Endian", q.littleEndian],
      ["Signed (full)", q.signed],
      ["Unsigned (full)", q.unsigned],
      ["Signed " + state.bitWidth + "-bit", q.signedReg],
      ["Unsigned " + state.bitWidth + "-bit", q.unsignedReg]
    ];
    for (var i = 0; i < rows.length; i++) {
      addRow(box, rows[i][0], rows[i][1]);
    }
  }

  /* ---------- Bitwise ---------- */

  function runBitwise() {
    var a = readInt($("bw-a"), $("bw-a-err"), true);
    var b = readInt($("bw-b"), $("bw-b-err"), true);
    var box = $("bw-ops");
    clearEl(box);
    var bits = state.bitWidth;
    if (!a.ok && String($("bw-a").value).trim() === "" && !b.ok && String($("bw-b").value).trim() === "") {
      return;
    }
    if (a.ok && b.ok) {
      renderTriple(opCard(box, "A AND B"), RU.and(a.value, b.value, bits), bits);
      renderTriple(opCard(box, "A OR B"), RU.or(a.value, b.value, bits), bits);
      renderTriple(opCard(box, "A XOR B"), RU.xor(a.value, b.value, bits), bits);
      renderTriple(opCard(box, "A ADD B  (mod 2^N)"), RU.addMod(a.value, b.value, bits), bits);
      renderTriple(opCard(box, "A SUB B  (mod 2^N)"), RU.subMod(a.value, b.value, bits), bits);
      renderTriple(opCard(box, "A MUL B  (mod 2^N)"), RU.mulMod(a.value, b.value, bits), bits);
    }
    if (a.ok) renderTriple(opCard(box, "NOT A"), RU.not(a.value, bits), bits);
    if (b.ok) renderTriple(opCard(box, "NOT B"), RU.not(b.value, bits), bits);
  }

  /* ---------- Shift / Rotate ---------- */

  function runShift() {
    var v = readInt($("sh-val"), $("sh-val-err"), true);
    var c = parseCount($("sh-count").value);
    var cerr = $("sh-count-err");
    if (!c.ok) setText(cerr, String($("sh-count").value).trim() === "" ? "" : c.error);
    else setText(cerr, "");

    var box = $("sh-ops");
    clearEl(box);
    if (!v.ok || !c.ok) return;

    var bits = state.bitWidth;
    var n = c.value;
    renderTriple(opCard(box, "SHL  (logical left)"), RU.shl(v.value, n, bits), bits);
    renderTriple(opCard(box, "SHR  (logical right)"), RU.shr(v.value, n, bits), bits);
    renderTriple(opCard(box, "SAR  (arithmetic right)"), RU.sar(v.value, n, bits), bits);
    renderTriple(opCard(box, "ROL  (rotate left)"), RU.rotateLeft(v.value, n, bits), bits);
    renderTriple(opCard(box, "ROR  (rotate right)"), RU.rotateRight(v.value, n, bits), bits);
  }

  /* ---------- XOR ---------- */

  function runNumericXor() {
    var a = readInt($("xn-a"), $("xn-a-err"), true);
    var b = readInt($("xn-b"), $("xn-b-err"), true);
    var box = $("xn-ops");
    clearEl(box);
    if (!a.ok || !b.ok) return;
    renderTriple(opCard(box, "A XOR B"), RU.xor(a.value, b.value, state.bitWidth), state.bitWidth);
  }

  function runStringXor() {
    var dErr = $("xs-data-err");
    var kErr = $("xs-key-err");
    var out = $("xs-out");
    clearEl(out);
    setText(dErr, "");
    setText(kErr, "");
    var dataRaw = $("xs-data").value;
    var keyRaw = $("xs-key").value;
    if (String(dataRaw).trim() === "" && String(keyRaw).trim() === "") return;

    var data = RU.parseXorOperand(dataRaw, $("xs-data-fmt").value);
    var key = RU.parseXorOperand(keyRaw, $("xs-key-fmt").value);
    if (!data.ok) {
      setText(dErr, data.error);
      return;
    }
    if (!key.ok) {
      setText(kErr, key.error);
      return;
    }
    var r = RU.xorBytes(data.bytes, key.bytes);
    if (!r.ok) {
      setText(kErr, r.error);
      return;
    }
    renderBytesOut(out, r.bytes);
  }

  function runRepeatingXor() {
    var dErr = $("xr-data-err");
    var kErr = $("xr-key-err");
    var out = $("xr-out");
    clearEl(out);
    setText(dErr, "");
    setText(kErr, "");
    var dataRaw = $("xr-data").value;
    var keyRaw = $("xr-key").value;
    if (String(dataRaw).trim() === "" && String(keyRaw).trim() === "") return;

    var data = RU.parseXorOperand(dataRaw, $("xr-data-fmt").value);
    var key = RU.parseXorOperand(keyRaw, $("xr-key-fmt").value);
    if (!data.ok) {
      setText(dErr, data.error);
      return;
    }
    if (!key.ok) {
      setText(kErr, key.error);
      return;
    }
    var r = RU.xorRepeating(data.bytes, key.bytes);
    if (!r.ok) {
      setText(kErr, r.error);
      return;
    }
    renderBytesOut(out, r.bytes);
  }

  function runXorBrute() {
    var err = $("xb-data-err");
    var box = $("xb-table");
    clearEl(box);
    setText(err, "");
    var raw = $("xb-data").value;
    if (String(raw).trim() === "") return;
    var data = RU.parseXorOperand(raw, $("xb-fmt").value);
    if (!data.ok) {
      setText(err, data.error);
      return;
    }
    var r = RU.xorBruteforce(data.bytes);
    if (!r.ok) {
      setText(err, r.error);
      return;
    }

    var table = document.createElement("table");
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    ["Key", "Score", "HEX", "ASCII", ""].forEach(function (h) {
      var th = document.createElement("th");
      th.textContent = h;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tb = document.createElement("tbody");
    for (var i = 0; i < r.rows.length; i++) {
      var row = r.rows[i];
      var tr = document.createElement("tr");

      var tdK = document.createElement("td");
      tdK.textContent = "0x" + row.key.toString(16).toUpperCase().padStart(2, "0");

      var tdS = document.createElement("td");
      var bar = document.createElement("span");
      bar.className = "score-bar";
      bar.style.width = Math.max(2, Math.round(row.percent)) + "px";
      tdS.appendChild(bar);
      tdS.appendChild(document.createTextNode(row.percent + "%"));

      var tdH = document.createElement("td");
      tdH.textContent = row.hex;

      var tdA = document.createElement("td");
      tdA.textContent = row.ascii;

      var tdC = document.createElement("td");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.setAttribute("data-copy-text", row.ascii);
      tdC.appendChild(btn);

      tr.appendChild(tdK);
      tr.appendChild(tdS);
      tr.appendChild(tdH);
      tr.appendChild(tdA);
      tr.appendChild(tdC);
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    box.appendChild(table);
  }

  function runXor() {
    runNumericXor();
    runStringXor();
    runRepeatingXor();
    runXorBrute();
  }

  /* ---------- String / Bytes ---------- */

  function runBytes() {
    var raw = $("by-in").value;
    var err = $("by-in-err");
    var out = $("by-out");
    clearEl(out);
    setText(err, "");
    if (String(raw).trim() === "") return;

    var mode = $("by-mode").value;
    var result;

    if (mode === "ascii-hex") {
      renderBytesOut(out, RU.asciiToBytes(raw), [["HEX", RU.asciiToHex(raw)]]);
      return;
    }
    if (mode === "hex-ascii") {
      result = RU.hexToAscii(raw);
      if (!result.ok) {
        setText(err, result.error);
        return;
      }
      renderBytesOut(out, result.bytes);
      return;
    }
    if (mode === "ascii-bin") {
      var bytes = RU.asciiToBytes(raw);
      renderBytesOut(out, bytes, [["Binary", RU.asciiToBinary(raw)]]);
      return;
    }
    if (mode === "bin-ascii") {
      result = RU.binaryToAscii(raw);
      if (!result.ok) {
        setText(err, result.error);
        return;
      }
      renderBytesOut(out, result.bytes, [["ASCII", result.text]]);
      return;
    }
    if (mode === "hex-bin") {
      result = RU.hexToBinary(raw);
      if (!result.ok) {
        setText(err, result.error);
        return;
      }
      renderBytesOut(out, result.bytes, [["Binary", result.text]]);
      return;
    }
    if (mode === "bin-hex") {
      result = RU.binaryToHex(raw);
      if (!result.ok) {
        setText(err, result.error);
        return;
      }
      renderBytesOut(out, result.bytes);
    }
  }

  function runPad() {
    var raw = $("pad-in").value;
    var err = $("pad-in-err");
    var out = $("pad-out");
    clearEl(out);
    setText(err, "");
    if (String(raw).trim() === "") return;
    var p = RU.parseHexBytes(raw);
    if (!p.ok) {
      setText(err, p.error);
      return;
    }
    var len = parseInt($("pad-len").value, 10);
    var r = RU.padBytes(p.bytes, len, $("pad-side").value);
    renderBytesOut(out, r.bytes);
  }

  /* ---------- Endian ---------- */

  function runEndian() {
    var raw = $("en-in").value;
    var err = $("en-in-err");
    var out = $("en-out");
    clearEl(out);
    setText(err, "");
    if (String(raw).trim() === "") return;
    var p = RU.parseHexBytes(raw);
    if (!p.ok) {
      setText(err, p.error);
      return;
    }
    var unit = parseInt($("en-unit").value, 10);
    var r = RU.reverseEndian(p.bytes, unit);
    if (!r.ok) {
      setText(err, r.error);
      return;
    }
    var extra = [];
    if (r.warning) extra.push(["Note", r.warning]);
    renderBytesOut(out, r.bytes, extra);
  }

  function runBswap() {
    var v = readInt($("bs-in"), $("bs-in-err"), true);
    var out = $("bs-out");
    clearEl(out);
    if (!v.ok) return;
    var bits = state.bitWidth;
    renderTriple(out, RU.byteSwap(v.value, bits), bits);
  }

  /* ---------- Integer ---------- */

  function runIntegerTable() {
    var raw = $("int-in").value;
    var err = $("int-in-err");
    var box = $("int-table");
    clearEl(box);
    setText(err, "");
    if (String(raw).trim() === "") {
      runExtras(null);
      return;
    }
    var parsed = RU.parseInteger(raw);
    if (!parsed.ok) {
      setText(err, parsed.error);
      runExtras(null);
      return;
    }

    var table = document.createElement("table");
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    ["Width", "Unsigned", "Signed", "HEX", "BIN", "Status"].forEach(function (h) {
      var th = document.createElement("th");
      th.textContent = h;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tb = document.createElement("tbody");
    var widths = [8, 16, 32, 64];
    for (var i = 0; i < widths.length; i++) {
      var w = widths[i];
      var fits = RU.fitsInWidth(parsed.value, w);
      var masked = RU.maskToBits(parsed.value, w);
      var tr = document.createElement("tr");
      if (w === state.bitWidth) tr.style.outline = "1px solid var(--accent)";
      var cells = [
        w + "-bit",
        RU.formatDec(RU.toUnsigned(masked, w)),
        RU.formatDec(RU.toSigned(masked, w)),
        RU.formatHex(masked, w),
        RU.formatBin(masked, w),
        fits ? "ok" : "truncated"
      ];
      for (var c = 0; c < cells.length; c++) {
        var td = document.createElement("td");
        td.textContent = cells[c];
        if (c === 5 && !fits) td.style.color = "var(--warn)";
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    box.appendChild(table);
    runExtras(parsed.value);
  }

  function runTwos() {
    var raw = $("tc-in").value;
    var err = $("tc-in-err");
    var out = $("tc-out");
    clearEl(out);
    setText(err, "");
    if (String(raw).trim() === "") return;
    var parsed = RU.parseInteger(raw);
    if (!parsed.ok) {
      setText(err, parsed.error);
      return;
    }
    var info = RU.twosComplementInfo(parsed.value, state.bitWidth);
    if (!info.ok) {
      setText(err, info.error);
      return;
    }
    addRow(out, "Original HEX", info.originalHex);
    addRow(out, "Original DEC", info.originalDec);
    addRow(out, "Binary", info.binary);
    addRow(out, "Two's Complement HEX", info.twoComplementHex);
    addRow(out, "Two's Complement BIN", info.twoComplementBin);
    addRow(out, "Signed", info.signed);
    addRow(out, "Unsigned", info.unsigned);
  }

  function runExtras(value) {
    var out = $("ex-out");
    clearEl(out);
    if (value == null) return;
    var enc = RU.encodeToBits(value, state.bitWidth);
    var bits = state.bitWidth;
    var v = enc.ok ? enc.value : RU.maskToBits(value, bits);
    if (!enc.ok) addRow(out, "Note", enc.error + " (showing masked bits)");
    addRow(out, "Byte Swap", RU.formatHex(RU.byteSwap(v, bits), bits));
    addRow(out, "Nibble Swap", RU.formatHex(RU.nibbleSwap(v, bits), bits));
    addRow(out, "Bit Reverse", RU.formatHex(RU.bitReverse(v, bits), bits));
    addRow(out, "Popcount", String(RU.popcount(v, bits)));
    addRow(out, "Parity", RU.parity(v, bits) ? "odd (1)" : "even (0)");
  }

  function runInteger() {
    runIntegerTable();
    runTwos();
  }

  /* ---------- Encoding ---------- */

  function runEncoding() {
    var eIn = $("b64e-in").value;
    var eOut = $("b64e-out");
    clearEl(eOut);
    if (String(eIn).length) {
      var enc = RU.base64EncodeText(eIn);
      addRow(eOut, "Base64", enc.ok ? enc.text : enc.error);
    }

    var dIn = $("b64d-in").value;
    var dErr = $("b64d-err");
    var dOut = $("b64d-out");
    clearEl(dOut);
    setText(dErr, "");
    if (String(dIn).trim()) {
      var dec = RU.base64Decode(dIn);
      if (!dec.ok) setText(dErr, dec.error);
      else {
        addRow(dOut, "ASCII", dec.text);
        addRow(dOut, "HEX", RU.bytesToHex(dec.bytes));
        addRow(dOut, "Python", RU.pythonBytes(dec.bytes));
      }
    }

    var ueIn = $("urle-in").value;
    var ueOut = $("urle-out");
    clearEl(ueOut);
    if (String(ueIn).length) {
      var ue = RU.urlEncode(ueIn);
      addRow(ueOut, "Encoded", ue.ok ? ue.text : ue.error);
    }

    var udIn = $("urld-in").value;
    var udErr = $("urld-err");
    var udOut = $("urld-out");
    clearEl(udOut);
    setText(udErr, "");
    if (String(udIn).length) {
      var ud = RU.urlDecode(udIn);
      if (!ud.ok) setText(udErr, ud.error);
      else addRow(udOut, "Decoded", ud.text);
    }
  }

  /* ---------- HEX dump ---------- */

  function runDump() {
    var raw = $("hd-in").value;
    var err = $("hd-in-err");
    var out = $("hd-out");
    setText(err, "");
    setText(out, "");
    if (String(raw).trim() === "") return;
    var fmt = $("hd-fmt").value;
    var bytes;
    if (fmt === "hex") {
      var p = RU.parseHexBytes(raw);
      if (!p.ok) {
        setText(err, p.error);
        return;
      }
      bytes = p.bytes;
    } else {
      bytes = RU.asciiToBytes(raw.replace(/\r\n/g, "\n"));
    }
    var width = parseInt($("hd-width").value, 10);
    setText(out, RU.hexDump(bytes, width));
  }

  /* ---------- Bit Viewer ---------- */

  function runBits() {
    var v = readInt($("bv-in"), $("bv-in-err"), true);
    var meta = $("bv-meta");
    var box = $("bv-table");
    clearEl(meta);
    clearEl(box);
    if (!v.ok) return;

    var bits = state.bitWidth;
    var view = RU.bitView(v.value, bits);
    addRow(meta, "HEX", view.hex);
    addRow(meta, "BIN", view.bin);
    addRow(meta, "Set bits", view.setBits.length ? view.setBits.join(", ") : "(none)");
    addRow(meta, "Popcount", String(view.popcount));
    addRow(meta, "Parity", view.parity ? "odd" : "even");

    /* 8비트 단위 행으로 나눈다 */
    var table = document.createElement("table");
    var groups = bits / 8;
    for (var g = 0; g < groups; g++) {
      var start = g * 8;
      var idxRow = document.createElement("tr");
      var valRow = document.createElement("tr");
      var thI = document.createElement("th");
      thI.textContent = "Bit";
      idxRow.appendChild(thI);
      var thV = document.createElement("th");
      thV.textContent = "Value";
      valRow.appendChild(thV);
      for (var i = start; i < start + 8; i++) {
        var tdI = document.createElement("td");
        tdI.textContent = String(view.indices[i]);
        idxRow.appendChild(tdI);
        var tdV = document.createElement("td");
        tdV.textContent = String(view.values[i]);
        tdV.className = view.values[i] ? "on" : "off";
        valRow.appendChild(tdV);
      }
      table.appendChild(idxRow);
      table.appendChild(valRow);
    }
    box.appendChild(table);
  }

  /* ---------- dispatch ---------- */

  function recalcTool() {
    switch (state.tool) {
      case "bitwise":
        runBitwise();
        break;
      case "shift":
        runShift();
        break;
      case "xor":
        runXor();
        break;
      case "bytes":
        runBytes();
        runPad();
        break;
      case "endian":
        runEndian();
        runBswap();
        break;
      case "integer":
        runInteger();
        break;
      case "encoding":
        runEncoding();
        break;
      case "dump":
        runDump();
        break;
      case "bits":
        runBits();
        break;
      default:
        break;
    }
  }

  function recalcAll() {
    runUniversal();
    recalcTool();
  }

  var debouncedAll = RU.debounce(recalcAll, DEBOUNCE_MS);
  var debouncedTool = RU.debounce(recalcTool, DEBOUNCE_MS);
  var debouncedUni = RU.debounce(runUniversal, DEBOUNCE_MS);

  function onCopyClick(e) {
    var btn = e.target.closest ? e.target.closest(".copy-btn") : null;
    if (!btn) return;
    var text = btn.getAttribute("data-copy-text");
    if (text == null) {
      var sel = btn.getAttribute("data-copy");
      var el = null;
      if (sel) el = document.querySelector(sel);
      if (!el) {
        var row = btn.parentElement;
        el = row ? row.querySelector(".value") : null;
      }
      text = el ? el.textContent : "";
    }
    if (text === RU.NA || text == null) return;
    RU.copyText(text);
    flashCopied(btn);
  }

  function bind() {
    document.addEventListener("click", onCopyClick);

    document.querySelectorAll("[data-role='width']").forEach(function (group) {
      group.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-width]");
        if (!btn) return;
        setBitWidth(btn.getAttribute("data-width"));
      });
    });

    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTool(btn.getAttribute("data-tool"));
      });
    });

    document.addEventListener("click", function (e) {
      var jump = e.target.closest ? e.target.closest("[data-jump]") : null;
      if (!jump) return;
      setTool(jump.getAttribute("data-jump"));
    });

    document.querySelectorAll("#u-format button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setFormat(btn.getAttribute("data-fmt"));
      });
    });

    document.querySelectorAll(".example-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $("u-input").value = btn.getAttribute("data-example");
        setFormat("auto");
        runUniversal();
        $("u-input").focus();
      });
    });

    $("theme-toggle").addEventListener("click", function () {
      state.theme = state.theme === "dark" ? "light" : "dark";
      applyTheme();
      saveSettings();
    });

    $("u-calc").addEventListener("click", function () {
      recalcAll();
    });

    $("u-input").addEventListener("input", debouncedUni);

    /* Enter = Calculate. textarea 는 줄바꿈 유지, Ctrl+Enter 로 계산. */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var t = e.target;
      if (!t) return;
      if (t.tagName === "TEXTAREA") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          recalcAll();
        }
        return;
      }
      if (t.tagName === "INPUT" || t.id === "u-calc") {
        e.preventDefault();
        recalcAll();
      }
    });

    var liveIds = [
      "bw-a", "bw-b",
      "sh-val", "sh-count",
      "xn-a", "xn-b",
      "xs-data", "xs-key", "xs-data-fmt", "xs-key-fmt",
      "xr-data", "xr-key", "xr-data-fmt", "xr-key-fmt",
      "xb-data", "xb-fmt",
      "by-in", "by-mode",
      "pad-in", "pad-len", "pad-side",
      "en-in", "en-unit",
      "bs-in",
      "int-in", "tc-in",
      "b64e-in", "b64d-in", "urle-in", "urld-in",
      "hd-in", "hd-fmt", "hd-width",
      "bv-in"
    ];
    liveIds.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var ev = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, debouncedTool);
    });
  }

  function init() {
    loadSettings();
    applyTheme();
    applyWidthButtons();
    bind();
    setTool(state.tool);
    runUniversal();
    document.body.setAttribute("data-ready", "1");
    if (/\buitest=1\b/.test(location.search || "")) {
      runUiSmoke();
    }
  }

  /**
   * index.html?uitest=1 로 열면 DOM 을 실제로 채우고 결과를 body 에 기록한다.
   * 배포 사용에는 영향 없다.
   */
  function runUiSmoke() {
    state.uitest = true;
    var fails = [];
    function expect(cond, name) {
      if (!cond) fails.push(name);
    }

    $("u-input").value = "0x41424344";
    state.format = "auto";
    state.bitWidth = 32;
    applyWidthButtons();
    runUniversal();
    expect($("u-results").textContent.indexOf("ABCD") >= 0, "universal ASCII ABCD");
    expect($("u-results").textContent.indexOf("44 43 42 41") >= 0, "universal little endian");

    $("u-input").value = "41".repeat(40);
    runUniversal();
    expect($("u-results").textContent.indexOf("AAAAAAAAAAAAAAAAAAAA") >= 0, "long hex → ASCII A*20+");
    expect($("u-results").textContent.indexOf("0x") >= 0, "long hex still has HEX");
    expect($("u-results").textContent.indexOf("0b") >= 0, "long hex still has BIN");
    expect($("u-results").textContent.indexOf("0o") >= 0, "long hex still has OCT");

    setBitWidth(8);
    $("u-input").value = "0xFF";
    runUniversal();
    expect($("u-results").textContent.indexOf("-1") >= 0, "0xFF signed 8bit");

    setBitWidth(32);
    setTool("bitwise");
    $("bw-a").value = "0xF0";
    $("bw-b").value = "0x0F";
    runBitwise();
    expect($("bw-ops").textContent.indexOf("0x000000FF") >= 0, "bitwise OR 0xFF");

    setBitWidth(8);
    setTool("shift");
    $("sh-val").value = "0x81";
    $("sh-count").value = "1";
    runShift();
    expect($("sh-ops").textContent.indexOf("0x03") >= 0, "ROL8 0x03");
    expect($("sh-ops").textContent.indexOf("0x02") >= 0, "SHL8 0x02");

    $("sh-val").value = "0x01";
    runShift();
    expect($("sh-ops").textContent.indexOf("0x80") >= 0, "ROR8 0x80");

    setTool("endian");
    $("en-in").value = "12 34 56 78";
    $("en-unit").value = "4";
    runEndian();
    expect($("en-out").textContent.indexOf("78 56 34 12") >= 0, "endian reverse");

    setTool("bytes");
    $("by-mode").value = "ascii-hex";
    $("by-in").value = "ABC";
    runBytes();
    expect($("by-out").textContent.indexOf("41 42 43") >= 0, "ABC to hex");

    setTool("xor");
    $("xn-a").value = "0x41";
    $("xn-b").value = "0x20";
    runNumericXor();
    expect($("xn-ops").textContent.indexOf("0x61") >= 0 || $("xn-ops").textContent.indexOf("0x00000061") >= 0, "numeric xor 0x61");

    var banner = document.createElement("pre");
    banner.id = "uitest-report";
    banner.textContent = fails.length
      ? "UITEST FAIL\n" + fails.join("\n")
      : "UITEST PASS";
    document.body.insertBefore(banner, document.body.firstChild);
    document.title = fails.length ? "UITEST FAIL" : "UITEST PASS";
    document.body.setAttribute("data-uitest", fails.length ? "fail" : "pass");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
