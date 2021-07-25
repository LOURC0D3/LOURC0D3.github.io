---
title: Dreamhack wargame rev-basic-8 write-up
tags: [Dreamhack, reversing, basic]
style: 
color: 
description: Reverse Engineering 통해 코드를 분석해보자.
---

## Code Analysis
---

ida로 소스를 까보자.
![img1](/assets/rev-basic-8/1.png)

-5랑 한글자씩 곱해서 unsigned형으로 형변환을 해서 비교를 하는 것 같다.<br>
키값을 확인해보자.
![img2](/assets/rev-basic-8/2.png)
<br>

댓글에 아이다를 너무 맹신하지말자 라는 글을 보고 x64dbg로 열어봤다.
![img3](/assets/rev-basic-8/3.png)
브레이크포인트 걸고 연산 루틴으로 진입해보자.
![img4](/assets/rev-basic-8/4.png)
<br>
![img5](/assets/rev-basic-8/5.png)
여기서 직접적인 연산을 하는 거 같다. <br>
imul -> and <br>
imul이라는 어셈블리어를 처음 봐서 검색해봤더니 음수를 포함한 곱셈을 하는 명령어라고 한다.<br>
그리고 두번째 operand와 세번째 operand의 연산값을 첫번째 operand에 저장한다고 한다. <br>
레지스터를 확인해보자.
![img6](/assets/rev-basic-8/6.png)
나는 abcdefg를 입력했었다. <br>
그러면 0x61 * 0xFB인데 0x5F1B가 나온걸 보니 맞긴 한거 같다.
![img7](/assets/rev-basic-8/13.png)
가만 생각을해보니 음수가 포함될 경우는 그다지 없는 거 같다.<br>
일단 and 연산까지 진행해보자.
![img8](/assets/rev-basic-8/7.png)
0xFF랑 and연산을 하므로 1 byte 이상은 다 날라간다. <br>
비교 구문을 확인해보자.
![img9](/assets/rev-basic-8/8.png)
![img10](/assets/rev-basic-8/9.png)
아까 나온 0x1B와 키값인 0xAC를 비교한다.<br><br>

## Exploit
---
처음에 날라간 앞자리를 복구시켜서 나온 값을 0xFB로 나눌려고 했었는데 앞자리를 복구시킬 방법이 도저히 생각이 안나서 드림핵 댓글을 보던 중
![img11](/assets/rev-basic-8/10.png)
이런 글이 있었는데 도저히 내 머리로는 이해가 안가서 무작정 코드를 짜기 시작했다. <br>

``` c 
#include <stdio.h>

void main()
{
    unsigned __int8 byte_140003000[32] = { 0xAC, 0xF3, 0x0C, 0x25, 0xA3, 0x10, 0xB7, 0x25, 0x16, 0xC6,
                                           0xB7, 0xBC, 0x7, 0x25, 0x2, 0xD5, 0xC6, 0x11, 0x7, 0xC5, 0x0C, 0, 0 };

    for (int i = 0; i < 0x14; ++i)
        for (int k = 0x0; k < 0xFF; k++)
            if (((k * 0xFB) & 0xFF) == byte_140003000[i])
                printf("%c", k);
}
```
결론은 ascii 범위인 0~255 숫자를 모두 연산식에 맞춰 brute force 하기로 했다! 껄껄<br>
<br> 어찌됐던 일단 출력값을 확인해보자.

![img12](/assets/rev-basic-8/11.png)

딱 들켰다. <br>
소름이 돋았다.. <br><br>
답이 맞는지 확인 해보자.

![img13](/assets/rev-basic-8/12.png)
맞긴 하지만 뭔가 찝찝하다. <br>
들켜서 그런가?

### Good Game!
E..EEEE











