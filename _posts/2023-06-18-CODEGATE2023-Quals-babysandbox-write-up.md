---
layout: post
date: 2023-06-18
title: CODEGATE2023 Quals babysandbox write-up
tags: [pwnable, seccomp, FSB, ]
categories: [CTF, CODEGATE2023, ]
---

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
