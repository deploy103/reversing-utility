# AGENTS.md

## 프로젝트 개요

이 프로젝트는 Reverse Engineering / CTF 환경에서 사용하는 로컬 전용 데이터 변환 및 비트 연산 도구이다.

목표는 사용자가 여러 계산기, Python REPL, CyberChef 등을 오가지 않고 하나의 HTML 페이지에서 자주 사용하는 연산을 빠르게 수행하는 것이다.

프로젝트는 반드시 인터넷 연결 없이 작동해야 한다.

---

## 핵심 원칙

1. 서버를 사용하지 않는다.
2. Node.js, npm, Python 등의 런타임을 요구하지 않는다.
3. 외부 CDN을 사용하지 않는다.
4. `index.html`을 직접 열어도 모든 기능이 동작해야 한다.
5. 모든 계산은 브라우저 내부 JavaScript에서 처리한다.
6. 입력값을 외부로 전송하지 않는다.
7. 리버싱 대회 중 빠르게 사용할 수 있도록 기능 접근성을 최우선으로 한다.
8. 화려한 UI보다 정보 구분과 입력 속도를 우선한다.
9. BigInt를 사용하여 64bit 연산에서 JavaScript Number 정밀도 문제를 피한다.
10. 사용자가 잘못된 값을 입력했을 경우 페이지가 깨지면 안 된다.

---

# 기술 스택

* HTML5
* CSS3
* Vanilla JavaScript
* BigInt
* Web APIs

외부 라이브러리 사용 금지.

가능하면 아래 구조를 사용한다.

```text
reversing-calculator/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── parser.js
│   ├── bitwise.js
│   ├── converter.js
│   ├── endian.js
│   ├── xor.js
│   └── utils.js
├── README.md
├── AGENTS.md
└── 요구사항.md
```

다만 단일 파일 배포가 더 편리한 경우 최종적으로 `dist/index.html` 하나로 합친 버전을 추가해도 된다.

---

# UI 기본 구조

상단:

```text
Reversing Utility
[ Universal Input                         ]
```

입력값 하나를 입력하면 가능한 경우 자동으로 형식을 감지한다.

예:

```text
0x41424344
1094861636
01000001010000100100001101000100
ABCD
41 42 43 44
\x41\x42\x43\x44
```

---

# 주요 메뉴

탭 또는 좌측 메뉴 형식으로 구성한다.

```text
Quick Convert
Bitwise
Shift / Rotate
XOR
String / Bytes
Endian
Integer
Encoding
```

현재 선택한 기능이 명확하게 보여야 한다.

---

# Quick Convert

하나의 입력값에 대해 동시에 아래 결과를 보여준다.

```text
HEX
DEC
BIN
OCT
ASCII
Bytes
C Escape
Python Bytes
Little Endian
Big Endian
Signed
Unsigned
```

가능하지 않은 항목은 `N/A`로 표시한다.

각 결과 옆에 Copy 버튼을 둔다.

---

# 숫자 Parser

다음 형식을 자동 인식한다.

```text
1234
0x1234
1234h
0b101010
101010b
0o755
```

공백과 `_`는 무시할 수 있어야 한다.

예:

```text
0x41_42_43_44
```

---

# Bitwise Calculator

지원:

```text
A & B
A | B
A ^ B
~A
```

각 결과에 대해 아래 값을 동시에 표시한다.

```text
HEX
DEC
BIN
```

비트 폭:

```text
8
16
32
64
```

선택 가능.

---

# Shift / Rotate

지원:

```text
SHL
SHR
SAR
ROL
ROR
```

입력:

```text
Value
Shift Count
Bit Width
```

지원 bit width:

```text
8
16
32
64
```

ROL/ROR는 반드시 bit width 기준으로 정상적으로 wrap되어야 한다.

---

# XOR Tool

## Numeric XOR

```text
Value A XOR Value B
```

## String XOR

다음 조합 지원:

```text
ASCII XOR ASCII
HEX XOR HEX
ASCII XOR HEX Key
HEX XOR ASCII Key
```

## Repeating XOR

예:

```text
Data: 48 65 6c 6c 6f
Key: KEY
```

키가 반복되면서 XOR된다.

## Single Byte XOR Bruteforce

0x00 ~ 0xFF 키를 전부 시도한다.

결과:

```text
Key
HEX
ASCII
Printable Score
```

출력은 printable ASCII 점수가 높은 순으로 정렬한다.

---

# String / Bytes

지원:

```text
ASCII → HEX
HEX → ASCII
ASCII → Binary
Binary → ASCII
HEX → Binary
Binary → HEX
```

HEX 입력은 아래를 모두 허용한다.

```text
41424344
41 42 43 44
41:42:43:44
0x41 0x42 0x43 0x44
\x41\x42\x43\x44
```

---

# Endian Tool

지원:

```text
Big Endian → Little Endian
Little Endian → Big Endian
```

예:

```text
12 34 56 78
```

결과:

```text
78 56 34 12
```

2/4/8 byte 단위 변환을 지원한다.

---

# Integer Interpreter

같은 bit pattern을 다양한 형태로 표시한다.

예:

```text
0xFFFFFFFF
```

32bit 선택 시:

```text
Unsigned: 4294967295
Signed: -1
HEX: FFFFFFFF
BIN: 11111111111111111111111111111111
```

지원:

```text
8-bit
16-bit
32-bit
64-bit
```

---

# Two's Complement

입력값과 bit width를 받아 다음을 표시한다.

```text
Original
Binary
Two's Complement
Signed Interpretation
Unsigned Interpretation
```

---

# Encoding

보조 기능으로 다음을 제공한다.

```text
Base64 Encode
Base64 Decode
URL Encode
URL Decode
```

리버싱 도구이므로 이 기능은 메인 기능보다 하단에 배치한다.

---

# UX

Enter 키로 계산할 수 있어야 한다.

입력 변경 시 자동 계산되는 기능은 debounce를 적용한다.

모든 출력값 옆에 Copy 버튼을 제공한다.

Copy 클릭 시 잠깐:

```text
Copied
```

상태를 보여준다.

---

# 오류 처리

잘못된 입력:

```text
Invalid HEX
Invalid Binary
Value exceeds selected bit width
Odd-length HEX
```

페이지 전체 alert() 사용을 최소화한다.

각 입력 필드 아래에서 오류를 표시한다.

---

# 64bit 처리

64bit 정수는 반드시 JavaScript `BigInt`를 사용한다.

다음과 같은 코드 사용을 피한다.

```javascript
Number("0xffffffffffffffff")
```

대신:

```javascript
BigInt("0xffffffffffffffff")
```

을 사용한다.

---

# Bit Mask

bit width 연산에는 항상 mask를 적용한다.

개념:

```text
mask = (1 << bits) - 1
result = value & mask
```

BigInt 구현을 사용한다.

---

# 코드 품질

각 기능을 별도 함수로 분리한다.

예:

```javascript
parseInteger()
formatHex()
formatBinary()
maskToBits()
rotateLeft()
rotateRight()
xorBytes()
reverseEndian()
toSigned()
toUnsigned()
```

계산 코드와 DOM 코드를 분리한다.

---

# 테스트

최소 아래 테스트를 직접 수행한다.

### XOR

```text
0x41 XOR 0x20 = 0x61
```

### AND

```text
0xFF & 0x0F = 0x0F
```

### OR

```text
0xF0 | 0x0F = 0xFF
```

### ROL8

```text
ROL8(0x81, 1) = 0x03
```

### ROR8

```text
ROR8(0x01, 1) = 0x80
```

### Signed

```text
0xFF / 8bit = -1
```

### Endian

```text
12 34 56 78
→
78 56 34 12
```

### ASCII

```text
ABC
→
41 42 43
```

---

# 금지 사항

* React 사용 금지
* Vue 사용 금지
* npm 의존성 금지
* CDN 금지
* 서버 API 금지
* 인터넷 연결 요구 금지
* 입력 데이터 전송 금지
* 불필요한 애니메이션 금지
* 기능보다 디자인을 우선하지 말 것

---

# 최종 목표

CTF 현장에서 아래 상황에서 즉시 사용할 수 있어야 한다.

```text
cmp eax, 0x12345678
xor eax, 0x1337
rol eax, 5
and eax, 0xff
```

같은 코드를 발견했을 때 별도의 Python 스크립트를 작성하지 않고 브라우저에서 즉시 값을 계산할 수 있어야 한다.
