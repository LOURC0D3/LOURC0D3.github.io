---
title: Dreamhack wargame rev-basic-7 write-up
tags: [Dreamhack, reversing, basic]
style: 
color: 
description: Reverse Engineering 통해 코드를 분석해보자.
---

## Code Analysis
--- 
ida로 소스를 까보자.
![img1](/assets/rev-basic-7/1.png)
<br>
sub_140001000 함수로 진입해보자.

![img2](/assets/rev-basic-7/2.png)
<br>
입력된 값을 i와 7을 AND을 시킨 값만큼 ROL한 후 i와 xor한다.<br>

ROL이란 rotate to left의 약자로 일반적인 shift 연산과 다르게 밀려나는 특징을 가지고 있다. 1000을 ROL연산을 하면 0001이 된다. <br>

다음은 연산된 값을 키 값과 비교한다.<br>
키 값은 다음과 같다.
![img3](/assets/rev-basic-7/3.png)

<br>
키를 복구시킬려면 ROR연산을 해야한다.<br>
c에 내장되어 있는 ror, rol은 회전이 자료형의 크기에 영향을 받는다.<br>
그러나 이 문제는 1 byte 안에서 회전이 되기 때문에 char형으로 연산 하거나 회전을 1 byte 안에서만 하는 함수를 구현해줘야 한다. 필자는 직접 구현했다.<br>
아래는 ROR 연산을 구현한 코드이다.

``` c
unsigned int _rotr1(unsigned int value, int shift) 
{ 
    shift %= 8;
    unsigned int body = value >> shift;
    unsigned int remains = (value << (8 - shift)) - (body << 8);
    return (body + remains);
}
```
<br>

## Exploit
---
``` c 
#include <stdio.h>

unsigned int _rotl1(unsigned int value, int shift) 
{ 
    shift %= 8;
    unsigned int remains = value >> (8 - shift);
    unsigned int body = (value << shift) - (remains << 8);
    return (body + remains);
}

void main()
{
    unsigned int byte_140003000[32] = { 0x52, 0xDF, 0xB3, 0x60, 0xF1, 0x8B, 0x1C, 0xB5, 0x57, 0xD1,
                                        0x9F, 0x38, 0x4B, 0x29, 0xD9, 0x26, 0x7F, 0xC9, 0xA3, 0xE9,
                                        0x53, 0x18, 0x4F, 0xB8, 0x6A, 0xCB, 0x87, 0x58, 0x5B, 0x39,
                                        0x1E, 0x0 };
    for (int i = 0; i < 31; i++)
    {
        byte_140003000[i] ^= i;

        byte_140003000[i] = _rotr1(byte_140003000[i], i & 7);

        printf("%c", byte_140003000[i]);
    }
}
```

![img4](/assets/rev-basic-7/8.png)
FLAG 등장!!<br>

### Good Game!
EZ

