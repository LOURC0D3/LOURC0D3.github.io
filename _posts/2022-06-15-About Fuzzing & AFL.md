---
title: About Fuzzing & AFL
tags: [Fuzzing, AFL, study]
style: 
color: 
description: Let's learning about Fuzzing and AFL
---

## 퍼징

---

### 퍼징이란 무엇일까?

퍼징 (Fuzzing, Fuzz testing) : 자동화 소프트웨어 테스팅 기법
프로그램에 대한 입력으로 유효하지 않거나 예상치 못한 랜덤한 데이터를 삽입한다.<br>

손으로 생성할 수 없는 많은 테스트를 실행하거나 복잡한 입력을 처리해야 하는 프로그램을 테스트한다.

### 퍼징을 하는 이유가 무엇일까?

프로그래머, 테스터는 사람이기 때문에 프로그램 내에 생각지도 못한 오류가 존재할 수도 있다.
이러한 빈틈을 메우기 위해서 자동화 테스팅인 퍼징을 한다.

### 퍼징의 목적은 무엇일까?

프로그램의 올바른 기능을 테스트 하는게 아닌 정의되지 않은 영역을 검증하고 확인한다.

### 퍼징의 종류

- 블랙 박스 퍼징 (Black-box fuzzing)
프로그램 내부를 보지 않고 기능들이 정상적으로 잘 동작하는지 확인하는 테스트

프로그램의 모든 입출력 기능이 지정된 요구 사항에 맞게 동작하는 지 확인하고 예상치 못한 결과는 개발팀에 보고하여 소스코드를 수정한다.

주로 사용자, 개발자 또는 테스터가 수행한다.
- 화이트 박스 퍼징 (White-box fuzzing)
소프트웨어 내부 구동 방식을 하나도 빠짐 없이 모두 숙지한 상태로 진행하는 테스트

논리적 취약성, 잠재적 보안 노출, 보안 구성 오류, 잘못 작성된 개발 코드 및 방어 수단 부족과 같은 다양한 영역에서 잠재적인 취약점을 찾아내고 개발팀에게 보고하여 소스코드를 수정한다.

주로 개발자 또는 테스터가 수행한다.

테스터가 테스트 중인 소프트웨어를 완벽히 이해해야 한다.
- 그레이 박스 퍼징 (Grey-box fuzzing)
블랙 박스와 화이트 박스 퍼징의 중간 단계

블랙 박스 테스트처럼 모든 입출력 기능을 테스트하지만 화이트 박스 테스트 처럼 코드에 대한 정보를 이용하여 테스트를 진행한다. (내부 구동 방식에 대한 부분적인 지식 필요)

AFL 또한 그레이 박스 커버리지 가이드 퍼저 중 하나이다.

### 뮤테이션 기반 퍼징이란 무엇인가?

뮤테이션 기반 퍼징 (Mutation-based fuzzing)
무작위로 생성된 입력은 구문상 유효하지 않으므로 프로그램에서 거부한다.
그렇기 때문에 입력 이후의 기능을 실행하려면 유효한 입력을 보내야한다.

뮤테이션 기반 퍼징이란 유효한 입력을 만들기 위한 방법 중 하나이다.
유효한 입력을 계속 유지하면서 새로운 동작을 실행할 수 있게끔 기존 입력 값을 조금씩 변경한다.

### 커버리지란 무엇인가?

소프트웨어 테스트가 성공적으로 수행되었는지 결과를 수치로 표현한 것

커버리지는 테스트 케이스의 품질을 판단하기 위해 자주 측정된다.
더 높은 커버리지가 측정되면 쓸모 없는 테스트 케이스는 제거된다.

## AFL

---

### AFL이란 무엇인가?

AFL (American Fuzzy Lop)
코드 커버리지 기반, 뮤테이션 기반, 덤(dumb) 퍼저

OpenSSH, PHP, Firefox 및 기타 많은 소프트웨어와 같은 널리 퍼져 있는 소프트웨어에서 치명적인 취약점을 발견하는데 사용되었다.

엣지 커버리지에 기반한 코드 커버리지 가이드 방식을 사용한다.
수정된 엣지 커버리지를 이용하여 프로그램의 흐름을 아주 조금씩 바꿔간다.

### 블록 커버리지란 무엇인가?

블록이 실행되는 것을 기록한다. ex) A, B, C

![Untitled](/assets/Fuzzing_AFL//Untitled.png)

x가 666이 넘을 경우인 B 블록을 기록한다.

![Untitled](/assets/Fuzzing_AFL//Untitled%201.png)

### 엣지 커버리지란 무엇인가?

블록이 전환되는 것을 기록한다. ex) A→B, A→C

![Untitled](/assets/Fuzzing_AFL//Untitled%202.png)

A블록에서 B블록으로 갈 때를 기록한다.
이러한 전환을 튜플이라고 한다.

![Untitled](/assets/Fuzzing_AFL//Untitled%203.png)

단순히 새로운 블록에 도달하는 것을 기록하는 것이 아닌 예상치 못한 오류가 발생했을 때의 조건을 기록한다.

### Instrumentation이란 무엇인가?

> 컴퓨터 프로그래밍에서 계측(Instrumentation)은 오류를 진단하거나 추적 정보를 쓰기 위해 제품의 성능 정보를 모니터 하거나 측정하는 기능을 가리킨다. - [https://ko.wikipedia.org/wiki/인스트루먼테이션](https://ko.wikipedia.org/wiki/%EC%9D%B8%EC%8A%A4%ED%8A%B8%EB%A3%A8%EB%A8%BC%ED%85%8C%EC%9D%B4%EC%85%98)
> 

요약하자면 프로그램 분석을 위해 코드를 삽입하는 것이다.

AFL에서는 다음 코드가 모든 분기점에 삽입된다.

```c
cur_location = <COMPILE_TIME_RANDOM>;
shared_mem[cur_location ^ prev_location]++;
prev_location = cur_location >> 1;
```

### AFL에서 queue가 어떻게 사용되는가?

큐는 대체되거나 삭제되지 않고 항상 추가돼서 자라는 형태이다.

따라서 큐를 통해 프로그램의 상호 배타적인 기능을 점진적으로 탐색할 수 있다.

평균적으로 대부분의 프로그램에서 큐는 1k ~ 10k의 크기를 가진다.

### AFL에서 사용되는 queue의 구조체를 살펴보자

![Untitled](/assets/Fuzzing_AFL/Untitled%204.png)

test case의 파일명
input 길이
이미 테스트 됐는가
새로운 커버리지를 발견했는가
path depth

다음 요소
다음 100번째의 요소

### AFL의 전략은 무엇인가?

input 값에 대한 주요 목표

- input 값에 대한 변경 사항이 너무 약하면 좋은 커버리지에 도달할 수 없다.
- input 값에 대한 변경 사항이 너무 공격적이면 초기 단계에서 구문 분석에 실패한다.

### AFL 전략 - Deterministic (결정론적)

AFL에서 가장 먼저 시도하는 전략이다.

- 비트 플립 수행
- 단순한 산술 연산 (-35 ~ +35)
- 흥미로운 정수 (0, 1, INT_MAX 등) 순차적 삽입

### AFL 전략 - Havoc(Non-Deterministic: 비결정론적)

결정론적 전략이 모두 소진되면 아래 작업들이 무한 루프된다.

- 비트 플립 수행
- 흥미로운 정수 삽입
- 임의의 엔디안 덧셈/뺄셈
- 단일 바이트를 임의의 값으로 변경
- 블록 삭제/복사/할당

### AFL 전략 - Splice

이전의 모든 단계에서 새롭고 흥미로운 입력 값을 찾지 못하였을 때 사용한다.

- 큐에서 2개의 다른 입력을 조합
여기서 합쳐진 입력 값은 Havoc 단계에 입력으로 들어가게 되고 보통 20%의 새로운 튜플을 발견한다.

### AFL의 작동원리는 무엇인가?

AFL은 성능 향상을 위해 fork server를 사용한다.

프로그램을 실행시킬 때마다 초기화, 시작 루틴을 반복하면 시간이 너무 오래 걸리고 효율이 떨어지기 때문에 fork server에서 초기화 루틴, 시작 루틴을 먼저 실행시켜서 힘든 작업을 미리 끝낸 후에 분기점에서 자식 프로세스에게 test case를 주입하라고 명령한다. 

1. AFL에서 퍼징하려는 프로그램을 실행한다.
2. 프로그램이 실행되면 AFL과 통신하면서 fork server를 만들고 새로운 프로그램을 실행한다.
3. 입력 값이 퍼징 대상 프로그램으로 전달된다.
4. 실행 결과를 공유 메모리에 기록한다.
5. AFL은 공유 메모리에서 기록을 읽고 입력 값을 변경하여 새로운 입력을 만든다.
6. 새로운 입력 값을 가지고 3번으로 이동한다.

![Untitled](/assets/Fuzzing_AFL/Untitled5.png)
