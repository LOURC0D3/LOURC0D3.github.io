---
title: Sigreturn-oriented programming 기법 정리
tags: [pwnable, HackCTF, srop, x64]
style: 
color: 
description: Sigreturn-oriented programming 기법에 대해 알아보자
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
---

<br>
Example Code

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

![img1](/assets/srop64/1.png)

익스하고 글 쓰고 잘려했는데 pop rax 가젯이 안 보인다. 왜지
<br> 내일 다시 해봐야징 넘 졸리다

![img2](/assets/srop64/2.png)
pop rax 가젯 없어서 라젠카에 올라온 익스 코드가 터짐 <br>
내가 잘 몰라서 어케하는지 모르는건가 

### 2021 09 22 
아 static으로 컴파일 하는거였음 