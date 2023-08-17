---
layout: post
date: 2022-05-03
title: "malloc, free in glibc 2.23"
tags: [pwnable, Computer Science, ]
categories: [Research, ]
---


# __libc_malloc


---


```c
void* __libc_malloc (size_t bytes)
{
  [mstate](/e219d9a139b0477ba3419b2a9bc8861c#b45741f75a954b5083e928c1c9dbff99) ar_ptr; //아레나 포인터
  void *victim; //return 될 변수

	//hook을 가져옴
  void *(*hook) (size_t, const void *) = atomic_forced_read (__malloc_hook);
  
	//hook이 NULL이  아니라면 hook 실행 후 return
	if (__builtin_expect (hook != NULL, 0)) 
    return (*hook)(bytes, RETURN_ADDRESS (0));

	//ar_ptr에 arena을 가져옴
  [arena_get](/e219d9a139b0477ba3419b2a9bc8861c#b6853501c72645f0b766c45098a6a10b) (ar_ptr, bytes);

	//_int_malloc 함수 호출 후 return 값을 victim에 저장함
  victim = _int_malloc (ar_ptr, bytes);

	/* 아래 코드는 위 코드에서 사용 가능한 아레나를 찾지 못하였을 때 수행 됨 */
  if (!victim && ar_ptr != NULL) //아레나는 잘 받아왔지만 return 값은 잘 받아오지 못했을 때
    {
      LIBC_PROBE (memory_malloc_retry, 1, bytes);
      ar_ptr = arena_get_retry (ar_ptr, bytes);
      victim = _int_malloc (ar_ptr, bytes);
    }

  if (ar_ptr != NULL) //아레나가 잘 받아와졌을 때
    (void) mutex_unlock (&ar_ptr->mutex); //아레나 unlock

	//디버깅을 위한 함수
  assert (!victim || chunk_is_mmapped (mem2chunk (victim)) ||
          ar_ptr == arena_for_chunk (mem2chunk (victim)));

  return victim; //할당된 청크를 가리키는 포인터 반환
}
```


## _int_malloc


---


```c
static void* _int_malloc (mstate av, size_t bytes)
{
  INTERNAL_SIZE_T nb;               //요청 사이즈를 정렬 및 헤더 추가한 사이즈 
  unsigned int idx;                 //bin idx
  mbinptr bin;                      //bin

  mchunkptr victim;                 //리턴된 청크 주소
  INTERNAL_SIZE_T size;             //청크 사이즈
  int victim_index;                 //청크의 bin idx

  mchunkptr remainder;              /* remainder from a split */
  unsigned long remainder_size;     /* its size */

  unsigned int block;               /* bit map traverser */
  unsigned int bit;                 /* bit map traverser */
  unsigned int map;                 /* current word of binmap */

  mchunkptr fwd;                    /* misc temp for linking */
  mchunkptr bck;                    /* misc temp for linking */

  const char *errstr = NULL;

  /*
     Convert request size to internal form by adding SIZE_SZ bytes
     overhead plus possibly more to obtain necessary alignment and/or
     to obtain a size of at least MINSIZE, the smallest allocatable
     size. Also, checked_request2size traps (returning 0) request sizes
     that are so large that they wrap around zero when padded and
     aligned.
   */

  checked_request2size (bytes, nb); //요청 사이즈 확인 및 정렬

  /* There are no usable arenas.  Fall back to sysmalloc to get a chunk from
     mmap.  */
  if (__glibc_unlikely (av == NULL)) //아레나 값이 NULL 이라면
    {
      void *p = sysmalloc (nb, av); //mmap으로 청크 할당 후 포인터 반환
      if (p != NULL)
					alloc_perturb (p, bytes);
      return p;
    }
```


### fastbin


---

- 구현 코드

```c
//요청 사이즈가 fasbin 범위내에 속할 경우
if ((unsigned long) (nb) <= (unsigned long) (get_max_fast ()))
{
		idx = fastbin_index (nb); //요청 사이즈에 맞는 인덱스를 가져옴
    mfastbinptr *fb = &fastbin (av, idx); //fastbin내에 인덱스 위치의 주소를 가져옴
    mchunkptr pp = *fb;
    do
    {
		    victim = pp; //반환 값 = fastbin 인덱스 위치 주소
        if (victim == NULL) //fastbin이 모두 찬 경우
		        break;
    } while ((pp = catomic_compare_and_exchange_val_acq (fb, victim->fd, victim)) != victim); //linked list에서 할당될 청크를 제외하고 연결함
    
		if (victim != 0) //반환 값이 0이 아닐 경우
    {
		    if (__builtin_expect (fastbin_index (chunksize (victim)) != idx, 0)) //인덱스가 올바른지 확인
        {
		        errstr = "malloc(): memory corruption (fast)";
            errout:
	            malloc_printerr (check_action, errstr, chunk2mem (victim), av);
              return NULL; //에러 메세지 출력 후 리턴
        }
        check_remalloced_chunk (av, victim, nb); //메모리가 올바른지 확인한다
        void *p = chunk2mem (victim); //청크를 메모리 형태로 변환한다
        alloc_perturb (p, bytes);
        
				return p;
    }
}
```

- 실습

```c
#include <stdio.h>
#include <malloc.h>

void main()
{

    char* ptr1 = malloc(0x10);
    char* ptr2 = malloc(0x10);
    char* ptr3 = malloc(0x20);
    char* ptr4 = malloc(0x30);

    free(ptr1);
    free(ptr2);
    free(ptr3);
    free(ptr4);

		char* ptr5 = malloc(0x10);
		free(ptr5);
}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0xfcc020 --> 0xfcc000 --> 0x0
(0x30)     fastbin[1]: 0xfcc040 --> 0x0
(0x40)     fastbin[2]: 0xfcc070 --> 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0xfcc0b0 (size : 0x20f50)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x1c34000 --> 0x0
(0x30)     fastbin[1]: 0x1c34040 --> 0x0
(0x40)     fastbin[2]: 0x1c34070 --> 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x1c340b0 (size : 0x20f50)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
gdb-peda$ parseheap
addr                prev                size                 status              fd                bk
0x1c34000           0x0                 0x20                 Freed                0x0              None
0x1c34020           0x0                 0x20                 Used                None              None
0x1c34040           0x0                 0x30                 Freed                0x0              None
0x1c34070           0x0                 0x40                 Freed                0x0              None
```


### small bin


---

- 구현 코드

```c
if (in_smallbin_range (nb)) //요청 사이즈가 small bin 범위에 속할 경우
{
		idx = smallbin_index (nb); //bin에서 사이즈에 맞는 인덱스를 가져온다
    bin = bin_at (av, idx); //주소 값을 가져온다

    if ((victim = last (bin)) != bin) //해당 bin이 비어있지 않다면
    {
		    if (victim == 0) /* initialization check 초기화 되지 않았다면*/
			      malloc_consolidate (av); //병합
	      else //초기화 되었다면
	      {
			      bck = victim->bk; //해당 bin의 마지막 청크의 bk값 저장
						if (__glibc_unlikely (bck->fd != victim)) //위에서 저장한 bck의 fd가 현재 청크와 동일한지 확인
	          {
			          errstr = "malloc(): smallbin double linked list corrupted";
	              goto errout; //에러 메세지 출력
	          }
	          set_inuse_bit_at_offset (victim, nb); //해당 청크의 다음 청크의 inuse bit 활성화
	          bin->bk = bck; //해당 청크 이전 청크를 현재 청크의 이전 청크로 설정
	          bck->fd = bin; //현재 청크 주소를 bin 주소로 설정
	
	          if (av != &main_arena) //main arena에서 관리되지 않을 경우
			          victim->size |= NON_MAIN_ARENA; //NON_MAIN_ARENA 비트 활성화
	          check_malloced_chunk (av, victim, nb); //메모리가 올바른지 확인
	          void *p = chunk2mem (victim); //청크를 메모리 형태로 변환
	          alloc_perturb (p, bytes);
	          return p;
				}
		}
}
```

- 실습

```c
#include <stdio.h>
#include <malloc.h>

void main()
{
    char* ptr1 = malloc(500);
    char* ptr2 = malloc(500);
    free(ptr1);

    char* ptr3 = malloc(1024);
		char* ptr4 = malloc(500);
    free(ptr3);

    free(ptr2);

		free(ptr4);
}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x15a8810 (size : 0x207f0)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
(0x200)  smallbin[30]: 0x15a8000
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x15a8810 (size : 0x207f0)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
gdb-peda$ parseheap
addr                prev                size                 status              fd                bk
0x15a8000           0x0                 0x200                Used                None              None
```


### large bin


---

- 구현 코드

```c
 else
    {
      idx = largebin_index (nb);
      if (have_fastchunks (av)) //fast bin에 free된 청크가 존재할 경우
        malloc_consolidate (av); //fast bin을 병합하여 사용한다
    }
```

- 실습

```c
#include <stdio.h>
#include <malloc.h>

void main()
{
    char* ptr1 = malloc(0x10);
    char* ptr2 = malloc(0x10);
    char* ptr3 = malloc(0x10);
    char* ptr4 = malloc(0x20);

    free(ptr1);
    free(ptr2);
    free(ptr3);
    free(ptr4);

    char* ptr5 = malloc(1024);
}
```


```bash
gef➤  heap chunks
Chunk(addr=0x1c3a010, size=0x20, flags=PREV_INUSE)
    [0x0000000001c3a010     00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00    ................]
Chunk(addr=0x1c3a030, size=0x20, flags=PREV_INUSE)
    [0x0000000001c3a030     00 a0 c3 01 00 00 00 00 00 00 00 00 00 00 00 00    ................]
Chunk(addr=0x1c3a050, size=0x20, flags=PREV_INUSE)
    [0x0000000001c3a050     20 a0 c3 01 00 00 00 00 00 00 00 00 00 00 00 00     ...............]
Chunk(addr=0x1c3a070, size=0x30, flags=PREV_INUSE)
    [0x0000000001c3a070     00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00    ................]
Chunk(addr=0x1c3a0a0, size=0x20f70, flags=PREV_INUSE)  ←  top chunk
```


```bash
gef➤  heap chunks
Chunk(addr=0x1c3a010, size=0x410, flags=PREV_INUSE)
    [0x0000000001c3a010     78 1b b2 80 9d 7f 00 00 78 1b b2 80 9d 7f 00 00    x.......x.......]
Chunk(addr=0x1c3a420, size=0x20bf0, flags=PREV_INUSE)  ←  top chunk
```


## unsorted bin


---


```c
for (;;) //리턴될 때까지 반복 (unsorted bin내 청크 모두 확인)
{
		int iters = 0; //iters가 10000 이상이면 루프 탈출
			
		//unsorted bin의 마지막 청크가 현재 unsorted 청크와 다른 경우 (unsorted 청크를 모두 확인)
		//victim 변수에는 unsorted bin의 마지막 청크가 들어감
    while ((victim = unsorted_chunks (av)->bk) != unsorted_chunks (av))
    {
		    bck = victim->bk; //bck에 마지막 청크의 bk값 저장
				
        if (__builtin_expect (victim->size <= 2 * SIZE_SZ, 0) //최소 사이즈 보다 작은가
            || __builtin_expect (victim->size > av->system_mem, 0)) // 최대 사이즈 보다 큰가
					     malloc_printerr (check_action, "malloc(): memory corruption", 
	               chunk2mem (victim), av); //오류 발생
			  size = chunksize (victim); //현재 청크의 크기
```


### unsorted bin - last remainder


---

- 구현 코드

```c
/* 
	요청 사이즈가 small bin 요청이고, unsorted bin에 단 한개의 청크만 존재할 경우 last_remainder를 사용하려고 시도한다.
	
	small bin이 여러번 요청되었을 때 지역성을 높이는데 도움을 준다.
	이것은 유일하게 알맞은 예외이며, small chunk가 정확히 맞지 않는 경우에만 실행된다.
*/

if (in_smallbin_range (nb) && //small bin 범위에 속할 경우
    bck == unsorted_chunks (av) && //유일한 unsorted bin 청크일 경우
    victim == av->last_remainder && //victim이 last_remainder 청크일 경우
    (unsigned long) (size) > (unsigned long) (nb + MINSIZE)) //청크 사이즈가 요청 사이즈 + 최소 사이즈보다 클 경우
    {
              /* split and reattach remainder */
              remainder_size = size - nb; //청크사이즈 - 요청사이즈
              remainder = chunk_at_offset (victim, nb); //remainder 청크가 들어갈 오프셋을 구함
              unsorted_chunks (av)->bk = unsorted_chunks (av)->fd = remainder; //unsorted 청크의 bk 및 fd는 remainder 청크의 주소를 가리킴              av->last_remainder = remainder; //아레나의 last_remainder 값은 방금 remainder된 청크가 됨
              remainder->bk = remainder->fd = unsorted_chunks (av); //remainder 청크의 bk 및 fd는 unsroted 청크를 가리킴
              if (!in_smallbin_range (remainder_size)) //위에서 구한 remainder 청크 사이즈가 smallbin 범위에 속하지 않을 경우 (large bin)
                {
                  remainder->fd_nextsize = NULL; //fd_nextsize 초기화
                  remainder->bk_nextsize = NULL; //bk_nextsize 초기화
                }

              set_head (victim, nb | PREV_INUSE |
                        (av != &main_arena ? NON_MAIN_ARENA : 0)); //unsorted 청크 헤더 설정
              set_head (remainder, remainder_size | PREV_INUSE); //remainder 청크 헤더 설정
              set_foot (remainder, remainder_size); //reamainder 청크와 인접한 다음 청크의 prev size에 remainder size를 넣음

              check_malloced_chunk (av, victim, nb); //정상적으로 할당되었는지 확인
              void *p = chunk2mem (victim); //청크를 메모리 형태로 변환한다
              alloc_perturb (p, bytes); //메모리 초기화
              return p; //메모리 반환
            }
```

- 실습

```c
#include <stdio.h>
#include <malloc.h>

void main()
{
    char* ptr1 = malloc(500);
    char* ptr2 = malloc(500);

    free(ptr1);
    
    char* ptr3 = malloc(400);
    free(ptr3);
    
    free(ptr2);
}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x72f400 (size : 0x20c00)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x72f000 (size : 0x200)
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x72f400 (size : 0x20c00)
       last_remainder: 0x72f1a0 (size : 0x60)
            unsortbin: 0x72f1a0 (size : 0x60)
```


---


```c
//unsorted list에서 victim 삭제
unsorted_chunks (av)->bk = bck; //unsorted 청크의 bk에 victim의 bk 저장
bck->fd = unsorted_chunks (av); //victim의 bk의 fd에 unsorted 청크 저장
```


### unsorted bin - 청크 재사용


---

- 구현 코드

```c
if (size == nb) //unsorted 청크가 요청 사이즈와 동일할 경우
{
		set_inuse_bit_at_offset (victim, size); //인접한 다음 청크의 inuse bit를 활성화한다
    if (av != &main_arena) //해당 청크가 main arena에서 관리되지 않을 경우
		    victim->size |= NON_MAIN_ARENA; //NON_MAIN_ARENA 플래그 활성화

    check_malloced_chunk (av, victim, nb); //정상적으로 할당되었는지 확인
    void *p = chunk2mem (victim); //청크를 메모리 형태로 변환한다
    alloc_perturb (p, bytes); //메모리 초기화
    return p; //메모리 반환
}
```

- 실습

```c
#include <stdio.h>
#include <malloc.h>

void main()
{
    char* ptr1 = malloc(500);
    char* ptr2 = malloc(500);
    free(ptr1);
    
    char* ptr3 = malloc(500);
    free(ptr3);

    free(ptr2);
}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x257e400 (size : 0x20c00)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x257e000 (size : 0x200)
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x257e400 (size : 0x20c00)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
gdb-peda$ parseheap
addr                prev                size                 status              fd                bk
0x257e000           0x0                 0x200                Used                None              None
```


### unsorted bin - 청크 이동


---


**다음 할당 요청까지 small bin 크기의 청크가 unsorted bin에 있는 경우**

- 구현 코드

```c
if (in_smallbin_range (size)) //해당 unsorted 청크가 small bin 범위에 속할 경우 
{
		victim_index = smallbin_index (size); //small bin내에서 사이즈에 맞는 인덱스를 찾음
    bck = bin_at (av, victim_index); //bck = 해당 인덱스의 주소
    fwd = bck->fd; //가장 앞 청크
}
```


```c
//small bin내에 존재하는 청크와 linked list 연결

mark_bin (av, victim_index); //해당 청크를 binmap에 mark한다
victim->bk = bck; //현재 청크의 bk를 bck로 변경
victim->fd = fwd; //현재 청크의 fd를 fwd로 변경
fwd->bk = victim; //fwd의 bk를 현재 청크로 변경
bck->fd = victim; //bck의 fd를 현재 청크로 변경
```

- 실습

```c
#include <stdio.h>
#include <malloc.h>

void main()
{
    char* ptr1 = malloc(500);
    char* ptr2 = malloc(500);
    free(ptr1);
    
    char* ptr3 = malloc(1024);
    free(ptr3);

    free(ptr2);
}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x24d3400 (size : 0x20c00)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x24d3000 (size : 0x200)
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x24d3810 (size : 0x207f0)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
(0x200)  smallbin[30]: 0x24d3000
```


---


**다음 할당 요청까지 large bin 크기의 청크가 unsorted bin에 있는 경우**

- 구현 코드

```c
else //해당 unsorted 청크가 large bin 범위에 속할 경우 
{
		victim_index = largebin_index (size); //large bin내에서 사이즈에 맞는 인덱스를 찾음
    bck = bin_at (av, victim_index); //bck = 해당 인덱스의 주소
    fwd = bck->fd; //가장 앞 청크 

    /* maintain large bins in sorted order */
		//large bin은 정렬된 상태를 유지해야함
    if (fwd != bck) //해당 bin에 이전에 free된 청크가 존재하는 경우
		{
		    /* Or with inuse bit to speed comparisons */
				//inuse bit를 사용하여 속도를 높임
        size |= PREV_INUSE; //prev inuse bit 활성화

        /* if smaller than smallest, bypass loop below */
				//최소 사이즈보다 작을 경우 아래 루프를 무시함
        assert ((bck->bk->size & NON_MAIN_ARENA) == 0); //해당 인덱스의 bk 값이 main arena에서 관리되는지 확인
        if ((unsigned long) (size) < (unsigned long) (bck->bk->size)) //요청 사이즈가 해당 인덱스의 bk값의 사이즈보다 작을 때 (가장 작은 사이즈)
        {
		        fwd = bck; 
            bck = bck->bk; //가장 작은 청크

            victim->fd_nextsize = fwd->fd; //fd_nextsize를 가장 큰 청크로 설정
            victim->bk_nextsize = fwd->fd->bk_nextsize; //bk_nextsize를 가장 큰 청크의 이전 청크로 설정
            fwd->fd->bk_nextsize = victim->bk_nextsize->fd_nextsize = victim; //가장 큰 청크의 bk_nextsize 및 가장 큰 청크를 victim으로 설정
        }
        else //요청 사이즈 보다 작은 사이즈가 이미 large bin에 있을 경우 
        {
		        assert ((fwd->size & NON_MAIN_ARENA) == 0);
            while ((unsigned long) size < fwd->size) //요청 사이즈가 가장 큰 청크보다 작을 때 반복
            {
		            fwd = fwd->fd_nextsize; //가장 큰 청크 = 가장 큰 청크의 다음 청크 
                assert ((fwd->size & NON_MAIN_ARENA) == 0); //main arena에서 관리 되는지 확인
            }

						//nextsize list 연결
            if ((unsigned long) size == (unsigned long) fwd->size) //요청 사이즈가 가장 큰 청크의 size와 같을 경우
            /* Always insert in the second position.  */
						//항상 두번째 위치에 삽입함
            fwd = fwd->fd; 
            else 
            {
		            victim->fd_nextsize = fwd; //현재 청크의 fd_nextsize는 가장 앞 청크
		            victim->bk_nextsize = fwd->bk_nextsize; //현재 청크의 bk_nextsize는 가장 앞 청크의 bk_nextsize
                fwd->bk_nextsize = victim; //가장 앞 청크의 bk_nextsize를 현재 청크로 설정
                victim->bk_nextsize->fd_nextsize = victim; //현재 청크의 이전 청크의 다음 청크는 현재 청크
            }
            bck = fwd->bk; //인덱스에 위치한 청크는 가장 큰 청크의 이전 청크 (fwd 사용 불가)
	     }
		 }
        
}
//large bin내에 존재하는 청크와 linked list 연결

mark_bin (av, victim_index); //해당 청크를 binmap에 mark한다
victim->bk = bck; //현재 청크의 bk를 bck로 변경
victim->fd = fwd; //현재 청크의 fd를 fwd로 변경
fwd->bk = victim; //fwd의 bk를 현재 청크로 변경
bck->fd = victim; //bck의 fd를 현재 청크로 변경
```

- 실습

```c
#include <stdio.h>
#include <malloc.h>

void main()
{
    char* ptr1 = malloc(1024);
    char* ptr2 = malloc(1024);
    free(ptr1);
    
    char* ptr3 = malloc(1100);
    free(ptr3);

    free(ptr2);
}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x2471820 (size : 0x207e0)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x2471000 (size : 0x410)
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x2471c80 (size : 0x20380)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
         largebin[ 0]: 0x2471000 (size : 0x410)
```


---


```c
//최대 10000번까지 반복
#define MAX_ITERS       10000
		if (++iters >= MAX_ITERS)
		    break;
```


### large bin -  청크 재사용


---

- 구현 코드

```c
if (!in_smallbin_range (nb)) //요청 사이즈 small bin 범위에 속하지 않을 경우
{
		bin = bin_at (av, idx); //bin 주소 가져옴

		/* bin이 비어있거나 가장 큰 청크가 너무 작은 경우 스킵 */
    if ((victim = first (bin)) != bin && //빈의 첫번째 청크와 가져온 bin 주소가 같은지 확인 (비어있지 않은지 검사)
		   (unsigned long) (victim->size) >= (unsigned long) (nb)) //첫번째 청크(가장 큰 청크)의 크기가 요청 사이즈보다 같거나 큰 경우
    {
		    victim = victim->bk_nextsize; //두번째로 큰 청크의 사이즈 저장
        while (((unsigned long) (size = chunksize (victim)) < (unsigned long) (nb))) //현재 청크의 사이즈가 요청 사이즈보다 작은 경우
					     victim = victim->bk_nextsize; //다음으로 큰 청크의 사이즈 저장

				 /* 첫번 째 사이즈의 엔트리는 삭제하지 않기 위해 skip list를 다시 라우팅 하지 않는다 */

         if (victim != last (bin) && victim->size == victim->fd->size) //해당 청크가 가장 작은 청크가 아니고 해당 청크의 사이즈가 다음 청크의 사이즈와 같은 경우
		         victim = victim->fd; //victim은 다음 청크를 가리킨다

         remainder_size = size - nb; //쪼개지고 남을 사이즈 저장
         unlink (av, victim, bck, fwd); //bin에서 해당 청크 링크드리스트 해제

         /* Exhaust */
         if (remainder_size < MINSIZE) //쪼개지고 남은 사이즈가 최소 사이즈보다 작을 경우
         {
		         set_inuse_bit_at_offset (victim, size); //해당 청크 inuse bit 활성화
             if (av != &main_arena) //메인 아레나가 아닌 경우
		             victim->size |= NON_MAIN_ARENA; //NON_MAIN_ARENA bit 활성화
         }
         /* Split */
         else
	       {
		         remainder = chunk_at_offset (victim, nb); //remainder에 요청 사이즈를 오프셋으로 청크의 주소값 저장
             
						 /* unsorted list가 비어있다고 가정할 수 없으므로 
								여기에서 완벽한 삽입을 수행해야한다.  */
             bck = unsorted_chunks (av); //bck에 첫번째 unsorted 청크 저장
             fwd = bck->fd; //fwd에 bck의 fd값 저장
						 if (__glibc_unlikely (fwd->bk != bck)) //bck->fd->bk != bck 인지 확인
             {
		             errstr = "malloc(): corrupted unsorted chunks"; 
                 goto errout; //오류 발생
             }
						 //linked list 연결
             remainder->bk = bck; //remainder->bk = 첫번째 unsorted 청크
             remainder->fd = fwd; //remainder->fd = bck->fd
             bck->fd = remainder; //bck->fd = remainder 
             fwd->bk = remainder; //fwd->bk = remainder

             if (!in_smallbin_range (remainder_size)) //쪼개지고 남은 사이즈가 smallbin 범위보다 클 경우
             {
								 //fd_nextsize 및 bk_nextsize 초기화
		             remainder->fd_nextsize = NULL;
                 remainder->bk_nextsize = NULL;
             }

             set_head (victim, nb | PREV_INUSE |
                      (av != &main_arena ? NON_MAIN_ARENA : 0)); //victim의 flag 설정
             set_head (remainder, remainder_size | PREV_INUSE); //victim 다음 청크의 prev inuse bit 활성화 
             set_foot (remainder, remainder_size); //victim 다음 청크의 prev size 설정
          }

          check_malloced_chunk (av, victim, nb); //청크가 잘 할당되었는지 확인
          void *p = chunk2mem (victim); //청크를 메모리 형태로 변환
          alloc_perturb (p, bytes); //메모리 초기화

          return p; //포인터 반환
		}
}
```

- 실습

**remainder 청크가 최소 사이즈보다 작은 경우**


```c
#include <stdio.h>
#include <malloc.h>

void main()
{
    char* ptr1 = malloc(1024);
    char* ptr2 = malloc(1024);
    free(ptr1);
    
    char* ptr3 = malloc(1100);
    free(ptr3);

    char* ptr4 = malloc(1016);
    free(ptr4);

    free(ptr2);
}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x1d94820 (size : 0x207e0)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
         largebin[ 0]: 0x1d94000 (size : 0x410)
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x1d94820 (size : 0x207e0)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
gdb-peda$ parseheap
addr                prev                size                 status              fd                bk
0x1d94000           0x0                 0x410                Used                None              None
```


**remainder 청크가 최소 사이즈보다 큰 경우** 


```c
#include <stdio.h>
#include <malloc.h>

void main()
{
    char* ptr1 = malloc(1024);
    char* ptr2 = malloc(1024);
    free(ptr1);
    
    char* ptr3 = malloc(1100);
    free(ptr3);

    char* ptr4 = malloc(1000);

    free(ptr2);
}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0xdf4820 (size : 0x207e0)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
         largebin[ 0]: 0xdf4000 (size : 0x410)
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0xdf4820 (size : 0x207e0)
       last_remainder: 0xdf43f0 (size : 0x20)
            unsortbin: 0xdf43f0 (size : 0x20)
gdb-peda$ parseheap
addr                prev                size                 status              fd                bk
0xdf4000            0x0                 0x3f0                Used                None              None
```


---


### 더 큰 bin에서 청크 재사용


---


```c
/*
	다음으로 큰 bin부터 시작하여 bin을 스캔하여 청크를 찾는다. 
	이 과정은 엄격하게 적합한 과정이다. 
	즉, 사이즈가 맞는 것중 가장 작은(거의 가장 최근에 사용된 것으로 연결되는)청크가 선택된다.

  
	비트맵은 대부분의 블록이 비어 있지 않은지 확인할 필요가 없다.
	청크가 아직 반환되지 않은 상태에서 워밍업 단계에서 모든 bin을 건너뛰는 특정 경우는 보기보다 빠르다.
*/

++idx; //bin idx 증가 
bin = bin_at (av, idx); //bin 주소값을 가져온다
block = idx2block (idx); //idx를 블록으로 변환한다
map = av->binmap[block]; //해당 아레나에서 블록값에 맞는 bin map을 가져온다
bit = idx2bit (idx); //idx를 bit로 변환한다

for (;; ) //모든 블록 확인
{
		/* 해당 블록에 설정된 비트가 없으면 이 블록을 건너뜀 */
    if (bit > map || bit == 0)
    {
		    do
        {
		        if (++block >= BINMAPSIZE) /* out of bins */
		            goto use_top; //bin map의 최대 크기만큼 block을 확인했다면 top 청크를 사용한다
        } while ((map = av->binmap[block]) == 0); //해당 bin map이 0이라면 반복 (free chunk가 존재하는지 확인)

        bin = bin_at (av, (block << BINMAPSHIFT)); //찾은 블록의 bin을 저장한다
        bit = 1;
    }

		/* 설정된 bit로 진행. 반드시 1 이어야함 */
    while ((bit & map) == 0) //0이라면 해당 bin은 free chunk가 존재하지 않음
    {
		    bin = next_bin (bin); //다음 bin 저장
        bit <<= 1;
        assert (bit != 0);
    }

		/* bin이 비어있지 않을 수도 있으니 검사함 */
    victim = last (bin); //victim은 해당 bin의 마지막 청크

    /* 비어있는 bin일 경우 bit를 제거함 */
    if (victim == bin) //같다면 비어있는 상태
    {
		    av->binmap[block] = map &= ~bit; /* Write through */ //해당 bin의 비트를 제거함
        bin = next_bin (bin); //다음 bin을 저장한다
        bit <<= 1;
    }

    else //비어있지 않은 경우
    {
		    size = chunksize (victim); //청크 사이즈 저장

				/* 우리는 이 bin의 첫번째 청크가 사용하기에 충분히 크다는 것을 알고있음 */
        assert ((unsigned long) (size) >= (unsigned long) (nb));

         remainder_size = size - nb; //remainder 사이즈 저장

         /* unlink */
	       unlink (av, victim, bck, fwd); //해당 bin에서 linked list 해제

         /* Exhaust */
         if (remainder_size < MINSIZE) //쪼개지고 남은 사이즈가 최소 사이즈보다 작을 경우
         {
		         set_inuse_bit_at_offset (victim, size); //해당 청크 inuse bit 활성화
             if (av != &main_arena) //메인 아레나가 아닌 경우
		             victim->size |= NON_MAIN_ARENA; //NON_MAIN_ARENA bit 활성화
         }
         /* Split */
         else
	       {
		         remainder = chunk_at_offset (victim, nb); //remainder에 요청 사이즈를 오프셋으로 청크의 주소값 저장
             
						 /* unsorted list가 비어있다고 가정할 수 없으므로 
								여기에서 완벽한 삽입을 수행해야한다.  */
             bck = unsorted_chunks (av); //bck에 첫번째 unsorted 청크 저장
             fwd = bck->fd; //fwd에 bck의 fd값 저장
						 if (__glibc_unlikely (fwd->bk != bck)) //bck->fd->bk != bck 인지 확인
             {
		             errstr = "malloc(): corrupted unsorted chunks"; 
                 goto errout; //오류 발생
             }
						 //linked list 연결
             remainder->bk = bck; //remainder->bk = 첫번째 unsorted 청크
             remainder->fd = fwd; //remainder->fd = bck->fd
             bck->fd = remainder; //bck->fd = remainder 
             fwd->bk = remainder; //fwd->bk = remainder

             if (!in_smallbin_range (remainder_size)) //쪼개지고 남은 사이즈가 smallbin 범위보다 클 경우
             {
								 //fd_nextsize 및 bk_nextsize 초기화
		             remainder->fd_nextsize = NULL;
                 remainder->bk_nextsize = NULL;
             }

             set_head (victim, nb | PREV_INUSE |
                      (av != &main_arena ? NON_MAIN_ARENA : 0)); //victim의 flag 설정
             set_head (remainder, remainder_size | PREV_INUSE); //victim 다음 청크의 prev inuse bit 활성화 
             set_foot (remainder, remainder_size); //victim 다음 청크의 prev size 설정
          }

          check_malloced_chunk (av, victim, nb); //청크가 잘 할당되었는지 확인
          void *p = chunk2mem (victim); //청크를 메모리 형태로 변환
          alloc_perturb (p, bytes); //메모리 초기화

          return p; //포인터 반환
		}
}
```


---


### top chunk


---


```c
use_top:
      /*
        (요청이) 꽤 크다면, 메모리 끝의 chunk(top chunk, av->top이 가리킴)를 분리한다. 
				이 방법은 가장 적합한 검색 규칙이다.
        실제로, top chunk(av->top)은 필요에 따라 (시스템 제한까지) 확장될 수 있기 때문에, 
				다른 이용가능한 chunk보다 훨씬 크다.

        초기화 후에는 항상 top chunk(av->top)이 존재해야 한다. 
				(즉, top chunk의 size가 항상 MINSIZE보다 크거나 같아야한다.) 
				그렇지 않고, 현재 요청에 의해 소모된 top chunk의 size가 MINSIZE보다 작을 경우에는, 다시 top chunk를 채운다. 
				(이 과정이 존재하는 주된 이유는 sysmalloc에 경계 확장(fencepost)를 넣기 위해 MINSIZE 공간이 필요할 수도 있기 때문이다.)
       */

      victim = av->top; //vicim은 top청크를 가리킴
      size = chunksize (victim); //사이즈를 가져온다
```


**top 청크의 크기가 요청 사이즈에 최소 사이즈를 더한 것 보다 크거나 같을 경우**

- 구현 코드

```c
if ((unsigned long) (size) >= (unsigned long) (nb + MINSIZE)) //청크 사이즈가 최소사이즈를 더한 거보다 클 경우
{
		remainder_size = size - nb; //쪼개지고 남은 사이즈 저장
    remainder = chunk_at_offset (victim, nb); //
    av->top = remainder;

    set_head (victim, nb | PREV_INUSE |
              (av != &main_arena ? NON_MAIN_ARENA : 0));
    set_head (remainder, remainder_size | PREV_INUSE);

    check_malloced_chunk (av, victim, nb);
    void *p = chunk2mem (victim);
    alloc_perturb (p, bytes);
    
		return p;
}
```

- 실습

```c
#include <stdio.h>
#include <malloc.h>

void main()
{
		char* ptr1 = malloc(0x100);
		free(ptr1);

		char* ptr2 = malloc(131000);
		free(ptr2);
}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x622000 (size : 0x21000)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x641fc0 (size : 0x1040)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
gdb-peda$ parseheap
addr                prev                size                 status              fd                bk
0x622000            0x0                 0x1ffc0              Used                None              None
```


**위의 조건에 해당하지 않고 해당 bin에 fast 청크가 존재하는 경우**

- 구현 코드

```c
/* When we are using atomic ops to free fast chunks we can get
   here for all block sizes.  
	 fast bin 청크를 해제하기 위해 atomic 연산을 사용할 때 
   모든 블록 크기에 대해 여기에서 얻을 수 있습니다.*/
else if (have_fastchunks (av))
{
		 malloc_consolidate (av);
     /* restore original bin index */
     if (in_smallbin_range (nb))
		     idx = smallbin_index (nb);
     else
		     idx = largebin_index (nb);
}
```

- 실습

```c
#include <stdio.h>
#include <malloc.h>

void main()
{
		char* ptr1 = malloc(0x10);
		char* ptr2 = malloc(0x10);
		char* ptr3 = malloc(0x20);
		char* ptr4 = malloc(0x30);
		free(ptr1);
		free(ptr2);
		free(ptr3);
		free(ptr4);

		char* ptr5 = malloc(135130);
		free(ptr5);

}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x2064020 --> 0x2064000 --> 0x0
(0x30)     fastbin[1]: 0x2064040 --> 0x0
(0x40)     fastbin[2]: 0x2064070 --> 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x20640b0 (size : 0x20f50)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x2064000 (size : 0x21000)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
```


**위 두 조건에 모두 부합되지 않을 경우**

- 구현 코드

```c
/*
	Otherwise, relay to handle system-dependent cases
*/
      else
        {
          void *p = sysmalloc (nb, av);
          if (p != NULL)
            alloc_perturb (p, bytes);
          return p;
        }
```

- 실습

```c
#include <stdio.h>
#include <malloc.h>

void main()
{
                char* ptr1 = malloc(0x10);
                char* ptr2 = malloc(335130);

                free(ptr2);
                free(ptr1);
}
```


```bash
gdb-peda$ heapinfo
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x239d020 (size : 0x20fe0)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
```


```bash
(0x20)     fastbin[0]: 0x0
(0x30)     fastbin[1]: 0x0
(0x40)     fastbin[2]: 0x0
(0x50)     fastbin[3]: 0x0
(0x60)     fastbin[4]: 0x0
(0x70)     fastbin[5]: 0x0
(0x80)     fastbin[6]: 0x0
(0x90)     fastbin[7]: 0x0
(0xa0)     fastbin[8]: 0x0
(0xb0)     fastbin[9]: 0x0
                  top: 0x239d020 (size : 0x20fe0)
       last_remainder: 0x0 (size : 0x0)
            unsortbin: 0x0
gdb-peda$ parseheap
addr                prev                size                 status              fd                bk
0x239d000           0x0                 0x20                 Used                None              Nones
```


## __libc_free


---


```c
void __libc_free (void *mem)
{
		mstate ar_ptr;
		mchunkptr p; /* chunk corresponding to mem 메모리 청크와 대응된다 */
		
		void (*hook) (void *, constvoid *) = atomic_forced_read (__free_hook);
		if (__builtin_expect (hook != NULL, 0)) //hook이 비어있지 않는 경우
		{
				(*hook)(mem,RETURN_ADDRESS (0)); //hook 실행 후 리턴
		    return;
		}
		
		if (mem == 0)/* free(0)은 아무런 영향이 없음 */
				return;
		
		p = mem2chunk (mem); //청크를 메모리 형태로 변환
		
		if (chunk_is_mmapped (p))/* release mmapped memory. 청크가 mmap으로 할당되었을 경우 해제하는 루틴 */
		{
				/* see if the dynamic brk/mmap threshold needs adjusting 
					 동적 brk/mmap의 임계값이 조정해야한다면 확인한다 */
				if (!mp_.no_dyn_threshold && p->size > mp_.mmap_threshold && p->size <= DEFAULT_MMAP_THRESHOLD_MAX)
		    {
						mp_.mmap_threshold = chunksize (p); //mmap의 임계값을 청크 사이즈로 변경한다
						mp_.trim_threshold = 2 * mp_.mmap_threshold; //trim의 임계값을 mmap 임계값의 2배로 설정한다
						LIBC_PROBE (memory_mallopt_free_dyn_thresholds, 2, mp_.mmap_threshold,mp_.trim_threshold);
		    }
				munmap_chunk (p); //mmap으로 할당된 청크를 해제 한다
		    return;
		}
		
		ar_ptr = arena_for_chunk (p); //청크가 존재하는 아레나 주소를 가져온다
		_int_free (ar_ptr, p, 0);
}
```


## _int_free


---


```c
static void _int_free (mstate av, mchunkptr p, int have_lock)
{
  INTERNAL_SIZE_T size;        /* its size */
  mfastbinptr *fb;             /* associated fastbin */
  mchunkptr nextchunk;         /* next contiguous chunk */
  INTERNAL_SIZE_T nextsize;    /* its size */
  int nextinuse;               /* true if nextchunk is used */
  INTERNAL_SIZE_T prevsize;    /* size of previous contiguous chunk */
  mchunkptr bck;               /* misc temp for linking */
  mchunkptr fwd;               /* misc temp for linking */

  const char *errstr = NULL;
  int locked = 0;

  size = chunksize (p); //청크 사이즈를 가져온다

  /* Little security check which won't hurt performance: the
     allocator never wrapps around at the end of the address space.
     Therefore we can exclude some size values which might appear
     here by accident or by "design" from some intruder.  
			
		성능을 해치지 않는 약간의 보안 검사:
		할당자는 주소 공간의 끝을 랩핑하지 않습니다.
		따라서 우연히 또는 일부 침입자의 "설계"에 의해 여기에 나타날 수 있는 일부 크기 값을 제외할 수 있습니다.
	*/
  if (__builtin_expect ((uintptr_t) p > (uintptr_t) -size, 0) //청크가 청크의 -size 값보다 큰 경우
      || __builtin_expect (misaligned_chunk (p), 0)) //또는 청크가 올바르게 정렬되었는 지 확인한다
  {
		  errstr = "free(): invalid pointer";
	    errout:
	      if (!have_lock && locked) //해당 아레나가 잠겨있다면
	        (void) mutex_unlock (&av->mutex); //잠금을 해제한다
	      malloc_printerr (check_action, errstr, chunk2mem (p), av); //오류를 출력한다
	      return; //함수 종료
    }
	/* We know that each chunk is at least MINSIZE bytes in size or a
     multiple of MALLOC_ALIGNMENT. 

		 우리는 각 청크의 크기가 MINSIZE 크고 또는 MALLOC_ALIGNMENT의 배수라는 것을 알고 있다.
	 */
  if (__glibc_unlikely (size < MINSIZE || !aligned_OK (size))) //size가 MINSIZE 보다 작고 정렬된 크기가 올바르지 않다면
    {
      errstr = "free(): invalid size";
      goto errout; //오류 출력 루틴으로 이동
    }

  check_inuse_chunk(av, p); //free하려는 청크의 inuse bit를 확인한다

  /*
    If eligible, place chunk on a fastbin so it can be found
    and used quickly in malloc.

	  조건에 맞는 경우 청크를 fastbin에 배치하여 malloc에서 빠르게 찾고 사용할 수 있다.
  */

  if ((unsigned long)(size) <= (unsigned long)(get_max_fast ()) //size가 fast 청크 사이즈에 속할 경우

#if TRIM_FASTBINS
      /*
				If TRIM_FASTBINS set, don't place chunks
				bordering top into fastbins

				TRIM_FASTBINS가 설정된 경우 top 청크의 경계에 있는 청크를 fastbins에 배치하지 않는다.
      */
      && (chunk_at_offset(p, size) != av->top)
#endif
      ) {

    if (__builtin_expect (chunk_at_offset (p, size)->size <= 2 * SIZE_SZ, 0) //bin에 넣으려는 청크가 최소 사이즈보다 작은지 확인한다
				|| __builtin_expect (chunksize (chunk_at_offset (p, size)) >= av->system_mem, 0)) //해당 청크가 system 메모리보다 큰지 확인한다
      {
	/* We might not have a lock at this point and concurrent modifications
	   of system_mem might have let to a false positive.  Redo the test
	   after getting the lock.  

		해당 시점에서 lock 결려있지 않을 수 있으며 system_mem의 동시 수정으로 인해 긍정 오류가 발생할 수 있다.
		lockd을 건 후 다시 테스트를 수행한다.
*/
	if (have_lock // 잠금이 걸려있을 경우
	    || ({ assert (locked == 0); // 잠금 해제
		  mutex_lock(&av->mutex); // 잠금
		  locked = 1; // 잠금
		  chunk_at_offset (p, size)->size <= 2 * SIZE_SZ //청크 사이즈가 최소 사이즈보다 작은지 확인한다
		    || chunksize (chunk_at_offset (p, size)) >= av->system_mem; //청크 사이즈가 system 메모리보다 큰지 확인한다
	      }))
	  {
	    errstr = "free(): invalid next size (fast)";
	    goto errout; //에러 메세지 출력
	  }
	if (! have_lock) //잠금이 걸려있지 않을 경우
	  {
	    (void)mutex_unlock(&av->mutex); //잠금을 해제한다
	    locked = 0;
	  }
      }

    free_perturb (chunk2mem(p), size - 2 * SIZE_SZ); //해당 메모리를 최소사이즈로 초기화한다

    set_fastchunks(av); //fastbin 플래그 설정
    unsigned int idx = fastbin_index(size); //idx에 fastbin의 인덱스를 가져온다
    fb = &fastbin (av, idx); //청크가 들어갈 fastbin의 주소 저장

    /* Atomically link P to its fastbin: P->FD = *FB; *FB = P;  
			 P를 fastbind에 연결한다 */
    mchunkptr old = *fb, old2; //청크 위치의 이전 fast 청크 저장
    unsigned int old_idx = ~0u; //인덱스 저장
    do
      {
	/* Check that the top of the bin is not the record we are going to add
	   (i.e., double free).  
		 빈의 최상단이 추가하려는 레코드가 아닌지 확인 */
	if (__builtin_expect (old == p, 0)) //이전 fast 청크와 p가 같을 경우. double free일 경우
	  {
	    errstr = "double free or corruption (fasttop)";
	    goto errout; //에러 메세지 출력
	  }
	/* Check that size of fastbin chunk at the top is the same as
	   size of the chunk that we are adding.  We can dereference OLD
	   only if we have the lock, otherwise it might have already been
	   deallocated.  See use of OLD_IDX below for the actual check.
		 최상단에 있는 fastbin 청크의 크기가 추가하려는 청크의 크기와 동일한지 확인
		 lock이 걸려있는 경우에만 OLD를 역참조할 수 있다. 그렇지 않으면 이미 할당 해제되었을 수 있다. 
  */
	if (have_lock && old != NULL) //lock이 걸려 있고 이전에 해제된 청크가 없다면
	  old_idx = fastbin_index(chunksize(old)); //이전에 해제된 청크 인덱스 저장
	p->fd = old2 = old; //해제할 청크의 fd를 old 이전에 해제된 청크의 인덱스로 변경 (linked list 연결)
      }
    while ((old = catomic_compare_and_exchange_val_rel (fb, p, old2)) != old2); //반복하면서 linked list의 fd bk의 값을 변경한다

    if (have_lock && old != NULL && __builtin_expect (old_idx != idx, 0)) //lock이 걸려있고 이전에 해제된 청크가 있고 이전에 해제된 청크의 idx가 현재 청크의 idx와 같지 않을 경우
      {
	errstr = "invalid fastbin entry (free)";
	goto errout; //에러 메세지 출력
      }
  }

  /*
		Consolidate other non-mmapped chunks as they arrive.
    mmap되지 않은 다른 청크가 도달하면 병합한다.
  */

  else if (!chunk_is_mmapped(p)) { //해당 청크가 mmap이 아니라면
    if (! have_lock) { //lock이 걸려있지 않다면
      (void)mutex_lock(&av->mutex); //lock 설정
      locked = 1;
    }

    nextchunk = chunk_at_offset(p, size); //해당 청크의 다음 청크 저장

    /* Lightweight tests: check whether the block is already the
       top block.  
			 가벼운 테스트: 블록이 이미 top 청크인지 확인한다.
		*/
    if (__glibc_unlikely (p == av->top)) //해당 청크가 top 청크라면
      {
	errstr = "double free or corruption (top)";
	goto errout; //에러메세지 출력
      }
    /* Or whether the next chunk is beyond the boundaries of the arena.  
			 또는 다음 청크가 아레나의 경계를 넘어 있는지 확인한다.
		*/
    if (__builtin_expect (contiguous (av)
			  && (char *) nextchunk 
			  >= ((char *) av->top + chunksize(av->top)), 0)) //다음 청크 top 청크의 다음 청크보다 큰지 확인
      {
	errstr = "double free or corruption (out)";
	goto errout; //에러메세지 출력
      }
    /* Or whether the block is actually not marked used.  
			 또는 블록이 실제로 사용된 것으로 표시되지 않았는지 확인한다.
		*/
    if (__glibc_unlikely (!prev_inuse(nextchunk))) //다음 청크의 prev inuse bit(현재 청크)가 설정되지 않았는지 확인한다
      {
	errstr = "double free or corruption (!prev)";
	goto errout; //에러 메세지 출력
      }

    nextsize = chunksize(nextchunk); //다음 청크의 사이즈 저장
    if (__builtin_expect (nextchunk->size <= 2 * SIZE_SZ, 0) //다음 청크의 사이즈가 최소 사이즈보다 작은지 확인
	|| __builtin_expect (nextsize >= av->system_mem, 0)) // 또는 system 메모리보다 큰지 확인
      {
	errstr = "free(): invalid next size (normal)";
	goto errout; //에러 메세지 출력
      }

    free_perturb (chunk2mem(p), size - 2 * SIZE_SZ); //해당 청크를 가장 작은 사이즈로 초기화한다.

    /* consolidate backward 
			 이전 청크와 병합
		*/
    if (!prev_inuse(p)) { //해당 청크의 이전 청크가 사용중이 아니라면
      prevsize = p->prev_size; //이전 청크 사이즈 저장
      size += prevsize; //현재 사이즈에 이전 사이즈 추가
      p = chunk_at_offset(p, -((long) prevsize)); //해당 청크의 오프셋 가져옴
      unlink(av, p, bck, fwd); //linked list 해제
    }

    if (nextchunk != av->top) { //다음 청크가 top 청크가 아니라면
      /* get and clear inuse bit */
      nextinuse = inuse_bit_at_offset(nextchunk, nextsize); //다음 청크의 inuse bit를 가져온다

      /* consolidate forward 
				 다음 청크와 병합
		  */
      if (!nextinuse) { //해당 청크의 다음 청크가 사용중이 아니라면
	unlink(av, nextchunk, bck, fwd); //linked list 해제
	size += nextsize; //현재 사이즈에 다음 사이즈 추가
      } else //아닐 경우
	clear_inuse_bit_at_offset(nextchunk, 0); //다음 청크의 inuse bit를 초기화한다

      /*
				Place the chunk in unsorted chunk list. Chunks are
				not placed into regular bins until after they have
				been given one chance to be used in malloc.

				unsorted bin에 청크를 배치한다.
				청크는 malloc에서 사용할 수 있는 기회가 한 번 주어질 때까지 regular 빈에 들어가지 않는다.
      */

      bck = unsorted_chunks(av); //unsorted bin의 헤더 청크를 가져옴
      fwd = bck->fd; //unsorted bin의 첫번째 청크 저장
      if (__glibc_unlikely (fwd->bk != bck)) //unsorted bin의 마지막 청크가 첫번째 청크의 bk값과 동일하지 않은지 확인
	{
	  errstr = "free(): corrupted unsorted chunks";
	  goto errout; //에러메세지 출력
	}
      p->fd = fwd; //해당 청크의 fd를 unsorted bin의 첫번째 청크로 저장
      p->bk = bck; //해당 청크의 bk를 unsorted bin의 마지막 청크로 저장
      if (!in_smallbin_range(size)) //해당 사이즈가 small bin사이즈일 경우
	{
	  p->fd_nextsize = NULL; //fd_nextsize bk_nextsize는 사용하지 않기때문에 NULL로 초기화
	  p->bk_nextsize = NULL;
	}
      bck->fd = p; //마지막 청크의 다음 청크는 해당 청크
      fwd->bk = p; //첫번째 청크의 이전 청크는 해당 청크

      set_head(p, size | PREV_INUSE); //prev inuse bit 활성화
      set_foot(p, size); //다음 청크의 헤더 설정

      check_free_chunk(av, p); //잘 free 되었나 확인
    }

    /*
      If the chunk borders the current high end of memory,
      consolidate into top

			해당 청크가 현재 메모리의 top 청크 경계에 있으면 top 청크와 병합한다
    */

    else { //다음 청크가 top 청크일 경우
      size += nextsize; //현재 사이즈 다음 사이즈를 더한다
      set_head(p, size | PREV_INUSE); //prev inuse bit를 활성화한다
      av->top = p; //top청크를 현재 청크로 설정
      check_chunk(av, p); //청크가 올바른지 확인
    }

    /*
      If freeing a large space, consolidate possibly-surrounding
      chunks. Then, if the total unused topmost memory exceeds trim
      threshold, ask malloc_trim to reduce top.

      Unless max_fast is 0, we don't know if there are fastbins
      bordering top, so we cannot tell for sure whether threshold
      has been reached unless fastbins are consolidated.  But we
      don't want to consolidate on each free.  As a compromise,
      consolidation is performed if FASTBIN_CONSOLIDATION_THRESHOLD
      is reached.

			큰 청크를 할당하는 경우 주변에 있는 청크를 통한다. 그런 다음 사용되지 않은 top 청크가 트림 임계값을 초과하면 malloc_trim에게 top을 줄이도록 요청한다.

      max_fast가 0이 아니면 top 청크 경계에 fastbin이 있는지 알 수 없으므로 fastbin이 병합되지 않는 한 임계값에 도달했는지 여부를 확실히 알 수 없다.
			그러나 여기선 각각의 free를 병합하려 하지 않는다
			FASTBIN_CONSOLIDATION_THRESHOLD에 도달하면 병합이 수행됩니다.
    */

    if ((unsigned long)(size) >= FASTBIN_CONSOLIDATION_THRESHOLD) { //현재 사이즈가 fastbin 병합의 임계값보다 큰 경우
      if (have_fastchunks(av)) //fast 청크가 존재하는 경우
					malloc_consolidate(av); //병합

      if (av == &main_arena) { //해당 아레나가 메인 아레나인 경우
#ifndef MORECORE_CANNOT_TRIM
	if ((unsigned long)(chunksize(av->top)) >= //top 청크가 trim의 임계값 보다 큰지 확인
	    (unsigned long)(mp_.trim_threshold))
	  systrim(mp_.top_pad, av); //top 청크의 사이즈를 줄인다
#endif
      } else { //메인 아레나가 아닐 경우
	/* Always try heap_trim(), even if the top chunk is not
	   large, because the corresponding heap might go away.  
		 해당 힙이 사라질 수 있으므로 top 청크가 large 청크가 아니더라도 항상 heap_trim()을 시도한다
*/
	heap_info *heap = heap_for_ptr(top(av)); //해당 아레나의 시작 주소를 저장한다

	assert(heap->ar_ptr == av); //위에서 가져온 아레나가 해당 아레나와 동일한지 확인
	heap_trim(heap, mp_.top_pad);
      }
    }

    if (! have_lock) { //lock이 걸려있지 않다면
      assert (locked); 
      (void)mutex_unlock(&av->mutex); //lock을 해제한다
    }
  }
  /*
    If the chunk was allocated via mmap, release via munmap().
		만약 해당 청크가 mmap으로 할당되었을 경우 munmap으로 할당을 해제한다
  */

  else {
    munmap_chunk (p);
  }
}
```

