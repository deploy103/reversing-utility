# Reversing Utility

Reverse Engineering / CTF 현장에서 쓰는 로컬 전용 만능 변환·계산 도구.

인터넷이 끊긴 대회장에서도 동작해야 한다. 입력값은 외부로 나가지 않는다.

**기본 실행은 브라우저만 있으면 된다.** `index.html` 을 더블클릭한다.
Python 은 선택이다. 쓰려면 **대회 전에** 설치해 USB 에 넣어 둔다. 대회장에서 설치 파일을 받을 수는 없다.

긴 HEX 덤프, 긴 비트열, 큰 10진수도 64bit 에 자르지 않고 HEX / DEC / BIN / OCT / ASCII 를 한 번에 보여 준다.

---

## 실행 방법 (브라우저, 설치 없음)

1. 이 폴더를 USB 또는 로컬 디스크에 둔다.
2. `index.html` 을 더블클릭한다. (`file://` 로 열린다.)
3. 상단 Universal Input 에 값을 붙여넣는다. 짧든 길든 Auto 가 형식을 고른다.

서버, npm, Node.js 는 필요 없다.

---

## 선택: Python CLI 설치 (대회 전에)

브라우저가 있으면 Python 은 필요 없다.
터미널에서 파일 단위로 돌리고 싶을 때만 쓴다. **인터넷이 되는 날 미리 설치**한다.

확인:

```text
python3 --version
```

Windows 에서는 아래도 시도한다.

```text
py -3 --version
python --version
```

`Python 3.6` 이상이면 된다.

### Windows (대회 전에)

1. https://www.python.org/downloads/ 에서 Windows installer 를 받는다.
2. 설치할 때 **Add python.exe to PATH** 를 반드시 체크한다.
3. 설치 파일을 USB 에 같이 넣어 두면, 오프라인 PC 에도 같은 설치 파일로 깔 수 있다.

### Linux (대회 전에)

대부분 이미 있다. 없으면 네트워크가 될 때:

```text
sudo apt install python3
```

또는 배포판에 맞는 패키지 매니저.

### macOS (대회 전에)

`python3 --version` 이 되면 그대로 쓴다. 없으면 python.org 설치 파일을 미리 받는다.

### 사용

```text
python3 reversing.py 0x41424344
python3 reversing.py 0100000101000010
python3 reversing.py -f dump.txt
```

인자 없이 실행하면 표준입력에서 읽는다. 긴 덤프를 붙여넣은 뒤:

- Linux / macOS: `Ctrl+D`
- Windows: `Ctrl+Z` 그리고 Enter

```text
python3 reversing.py
(여기에 HEX/BIN/DEC/문자열 붙여넣기)
```

`reversing.py` 는 표준 라이브러리만 쓴다. pip 설치는 없다.

---

## 기능 목록

| 메뉴 | 하는 일 |
| --- | --- |
| Quick Convert | 상단 Universal Input. 한 값을 HEX/DEC/BIN/OCT/ASCII/Bytes/C escape/Python bytes/Endian/Signed/Unsigned 로 동시에 표시 |
| Bitwise | AND, OR, XOR, NOT, ADD/SUB/MUL (mod 2^N) |
| Shift / Rotate | SHL, SHR, SAR, ROL, ROR |
| XOR | 숫자 XOR, 문자열/바이트 XOR, repeating-key XOR, single-byte brute force |
| String / Bytes | ASCII ↔ HEX ↔ Binary, 바이트 패딩 |
| Endian | 2/4/8 바이트 단위 BE ↔ LE, 정수 BSWAP |
| Integer | 8/16/32/64bit signed·unsigned 해석, 2의 보수, nibble/bit reverse, popcount, parity |
| Encoding | Base64 encode/decode, URL encode/decode |
| HEX Dump | hexdump 형식 뷰어 |
| Bit Viewer | 비트 자리(31..0 등)와 값 표시 |

비트 폭은 헤더의 **8 / 16 / 32 / 64** 로 고른다. 기본값 32bit.

다크 모드가 기본이다. 헤더의 Light/Dark 로 전환한다.
마지막에 고른 비트 폭, 도구 탭, 테마만 `localStorage` 에 저장한다. **입력 데이터는 저장하지 않는다.**

---

## 지원 입력 형식

숫자:

```text
1234
0x1234
1234h
0b101010
101010b
0o755
0x41_42_43_44
DEADBEEF
-1
```

HEX 바이트:

```text
41424344
41 42 43 44
41:42:43:44
0x41 0x42 0x43 0x44
\x41\x42\x43\x44
```

공백과 `_` 는 숫자 파서가 무시한다.

긴 입력도 그대로 받는다. 예:

```text
41 42 43 44 가 수백 바이트
01000001 01000010 … 긴 비트열
48656c6c6f20576f726c6421 … 접두 없는 HEX
1606938044258990275541962092341162602522202993782792835301376
```

Auto 규칙 요약:

* `0x` / `0b` / `0o` / `h` / `b` 접두·접미가 있으면 그 진법
* 공백·콜론으로 나뉜 HEX 는 바이트 덤프
* 0 과 1 만 있고 길이 8 이상이면 2진
* A–F 가 있거나 짝수 길이 8자 이상 HEX 숫자면 HEX (예: `41424344` → `ABCD`)
* 그 외 숫자만 있으면 10진
* 아니면 ASCII

Format 버튼으로 Auto / HEX / DEC / BIN / OCT / ASCII / Bytes 를 강제할 수 있다.
화면에는 앞부분만 보이고, Copy 는 전체 값을 복사한다.

---

## 키보드 사용법

| 키 | 동작 |
| --- | --- |
| Enter | 계산 (한 줄 입력란). 브라우저 기본 단축키(Ctrl+L 등)는 가로채지 않는다 |
| Ctrl+Enter | Universal Input (여러 줄) 계산 |
| 입력 후 대기 | 약 180ms debounce 후 자동 계산 |
| Copy | 각 결과 오른쪽 버튼. 클릭 시 잠시 `Copied` 표시 |

`file://` 에서는 Clipboard API 가 막힐 수 있어 `document.execCommand('copy')` 폴백을 사용한다.

---

## 예제

Universal Input 아래 버튼을 누르거나 직접 붙여넣는다.

```text
0xDEADBEEF
0xFFFFFFFF
0xFFFFFFFFFFFFFFFF
41 42 43 44
\x66\x6c\x61\x67
Hello World
```

필수 연산 결과:

```text
0x41 XOR 0x20          = 0x61
0xFF AND 0x0F          = 0x0F
0xF0 OR  0x0F          = 0xFF
ROL8(0x81, 1)          = 0x03
ROR8(0x01, 1)          = 0x80
0xFF as signed 8-bit   = -1
12 34 56 78  endian    = 78 56 34 12
ABC                    = 41 42 43
```

64bit 값은 JavaScript Number 가 아니라 `BigInt` 로 계산한다.

```text
0xFFFFFFFFFFFFFFFF     signed 64-bit = -1
0xFFFFFFFF             signed 32-bit = -1
0x80000000             signed 32-bit = -2147483648
```

---

## 리버싱에서 언제 쓰나

**Quick Convert**  
디스어셈블리에서 `cmp eax, 0x41424344` 같은 상수를 만났을 때. HEX·10진·ASCII·엔디안을 한 화면에 본다. `0x41424344` 는 ASCII `ABCD`, little-endian 바이트는 `44 43 42 41` 이다.

**Bitwise**  
`and eax, 0xff`, `or eax, 0x0F`, `xor eax, 0x1337` 의 결과를 폭(8/16/32/64)을 맞춰 확인한다. JS 기본 `&` 는 32bit signed 로 잘리므로 이 도구는 BigInt + mask 를 쓴다.

**Shift / Rotate**  
`shl`, `shr`, `sar`, `rol eax, 5`, `ror al, 1` 을 재현한다.  
ROL/ROR 는 반드시 선택한 bit width 로 wrap 된다. `ROL8(0x81, 1) = 0x03`.

**XOR**  
단일 바이트 키로 난독화된 문자열, repeating-key (Vigenère 스타일) 패킹, 짧은 암호문 brute force.
printable 점수 높은 후보가 위로 올라온다.

**String / Bytes**  
패킷, 파일 헤더, 셸코드 앞부분을 ASCII ↔ HEX ↔ Binary 로 바꾼다.

**Endian**  
`mov eax, [buf]` 가 little-endian 으로 읽은 값과 덤프의 바이트 순서를 맞출 때. PE/ELF 필드, 네트워크 버퍼(보통 BE) 변환.

**Integer / Two's Complement**  
`0xFFFFFFFF` 가 unsigned `4294967295` 인지 signed `-1` 인지, `cmp` 직후 JSCC 조건을 볼 때. 8bit `0xFF = -1`.

**Encoding**  
Base64 로 박힌 설정 문자열, URL 인코딩된 쿼리. 메인 기능이 아니라 보조.

**HEX Dump / Bit Viewer**  
짧은 버퍼를 hexdump 로 보고, `test eax, 0xA5` 같은 마스크에서 어느 비트가 켜져 있는지 확인한다.

---

## 프로젝트 구조

```text
bit_calculator/
├── index.html          ← 이것만 연다 (오프라인 기본)
├── reversing.py        ← 선택 CLI (Python 3, 대회 전 설치)
├── css/style.css
├── js/
│   ├── utils.js        마스크, 포맷, copy, BigInt 헬퍼
│   ├── parser.js       숫자 / HEX 바이트 자동 인식
│   ├── bitwise.js      AND/OR/XOR/NOT/shift/rotate (BigInt)
│   ├── endian.js
│   ├── xor.js
│   ├── converter.js    진법, 2의 보수, Base64, dump, bit view
│   └── app.js          DOM 연결
├── tests/
│   ├── run.js          Node 코어 테스트 (선택)
│   └── browser.html    브라우저 코어 테스트 (선택)
├── README.md
├── AGENTS.md
└── 요구사항
```

ES module (`type="module"`) 은 쓰지 않는다. `file://` CORS 때문에 일반 `<script src>` 순서 로드이다.

---

## 오프라인 / 보안

다음이 없다.

- `fetch`, `XMLHttpRequest`, `WebSocket`
- 외부 스크립트 / 외부 CSS / CDN
- 서버 API, analytics
- npm 의존성, React, Vue

페이지가 깨지지 않도록 잘못된 입력은 필드 아래 메시지로만 표시한다.

```text
Invalid HEX
Invalid Binary
Value exceeds selected bit width
Odd-length HEX
```
