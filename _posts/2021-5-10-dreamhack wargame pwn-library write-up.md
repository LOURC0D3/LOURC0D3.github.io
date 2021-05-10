---
title: Dreamhack wargame pwn-library write-up
tags: [Dreamhack, pwnable, pwn-library]
style: 
color: 
description: Let's pwn
---

## Code Analysis
~~~ c
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

struct bookstruct{
	char bookname[0x20];
	char* contents;
};

__uint32_t booksize;
struct bookstruct listbook[0x50];
struct bookstruct secretbook;

void booklist(){
	printf("1. theori theory\n");
	printf("2. dreamhack theory\n");
	printf("3. einstein theory\n");
}

int borrow_book(){
	if(booksize >= 0x50){ 
		printf("[*] book storage is full!\n");
		return 1;
	}
	__uint32_t select = 0;
	printf("[*] Welcome to borrow book menu!\n");
	booklist();
	printf("[+] what book do you want to borrow? : ");
	scanf("%u", &select);
	if(select == 1){
		strcpy(listbook[booksize].bookname, "theori theory");
		listbook[booksize].contents = (char *)malloc(0x100);
		memset(listbook[booksize].contents, 0x0, 0x100);
		strcpy(listbook[booksize].contents, "theori is theori!");
	} else if(select == 2){
		strcpy(listbook[booksize].bookname, "dreamhack theory");
		listbook[booksize].contents = (char *)malloc(0x200);
		memset(listbook[booksize].contents, 0x0, 0x200);
		strcpy(listbook[booksize].contents, "dreamhack is dreamhack!");
	} else if(select == 3){
		strcpy(listbook[booksize].bookname, "einstein theory");
		listbook[booksize].contents = (char *)malloc(0x300);
		memset(listbook[booksize].contents, 0x0, 0x300);
		strcpy(listbook[booksize].contents, "einstein is einstein!");

	} else{
		printf("[*] no book...\n");
		return 1;
	}
	printf("book create complete!\n");
	booksize++;
	return 0;
}

int read_book(){
	__uint32_t select = 0;
	printf("[*] Welcome to read book menu!\n");
	if(!booksize){
		printf("[*] no book here..\n");
		return 0;
	}
	for(__uint32_t i = 0; i<booksize; i++){
		printf("%u : %s\n", i, listbook[i].bookname);
	}
	printf("[+] what book do you want to read? : ");
	scanf("%u", &select);
	if(select > booksize-1){
		printf("[*] no more book!\n");
		return 1;
	}
	printf("[*] book contents below [*]\n");
	printf("%s\n\n", listbook[select].contents);
	return 0;
}

int return_book(){
	printf("[*] Welcome to return book menu!\n");
	if(!booksize){
		printf("[*] no book here..\n");
		return 1;
	}
	if(!strcmp(listbook[booksize-1].bookname, "-----returned-----")){
		printf("[*] you alreay returns last book!\n");
		return 1;
	}
	free(listbook[booksize-1].contents);
	memset(listbook[booksize-1].bookname, 0, 0x20);
	strcpy(listbook[booksize-1].bookname, "-----returned-----");
	printf("[*] lastest book returned!\n");
	return 0;
}

int steal_book(){
	FILE *fp = 0;
	__uint32_t filesize = 0;
	__uint32_t pages = 0;
	char buf[0x100] = {0, };
	printf("[*] Welcome to steal book menu!\n");
	printf("[!] caution. it is illegal!\n");
	printf("[+] whatever, where is the book? : ");
	scanf("%144s", buf);
	fp = fopen(buf, "r");
	if(!fp){
		printf("[*] we can not find a book...\n");
		return 1;
	} else {
		fseek(fp, 0, SEEK_END);
    	filesize = ftell(fp);
    	fseek(fp, 0, SEEK_SET);
		printf("[*] how many pages?(MAX 400) : ");
		scanf("%u", &pages);
		if(pages > 0x190){
			printf("[*] it is heavy!!\n");
			return 1;
		}
		if(filesize > pages){
			filesize = pages;
		}
		secretbook.contents = (char *)malloc(pages);
		memset(secretbook.contents, 0x0, pages);
		__uint32_t result = fread(secretbook.contents, 1, filesize, fp);

		if(result != filesize){
			printf("[*] result : %u\n", result);
			printf("[*] it is locked..\n");
			return 1;
		}
		memset(secretbook.bookname, 0, 0x20);
		strcpy(secretbook.bookname, "STOLEN BOOK");
		printf("\n[*] (Siren rangs) (Siren rangs)\n");
		printf("[*] Oops.. cops take your book..\n");
		fclose(fp);
		return 0;
	}

}


void menuprint(){
	printf("1. borrow book\n");
	printf("2. read book\n");
	printf("3. return book\n");
	printf("4. exit library\n");
}

void main(){
	__uint32_t select = 0;
	printf("\n[*] Welcome to library!\n");
	setvbuf(stdin, 0, 2, 0);
	setvbuf(stdout, 0, 2, 0);
	while(1){
		menuprint();
		printf("[+] Select menu : ");
		scanf("%u", &select);
		switch(select){
			case 1:
				borrow_book();
				break;
			case 2:
				read_book();
				break;
			case 3:
				return_book();
				break;
			case 4:
				printf("Good Bye!");
				exit(0);
				break;
			case 0x113:
				steal_book();
				break;
			default:
				printf("Wrong menu...\n");
				break;
		}
	}
}
~~~

메인 함수의 switch문을 보면 select menu에서 275를 입력하면 steal_book 함수를 실행 할 수 있다. <br>
steal_book 함수를 확인해보자.
<br><br>
~~~ c
int steal_book(){
	FILE *fp = 0;
	__uint32_t filesize = 0;
	__uint32_t pages = 0;
	char buf[0x100] = {0, };
	printf("[*] Welcome to steal book menu!\n");
	printf("[!] caution. it is illegal!\n");
	printf("[+] whatever, where is the book? : ");
	scanf("%144s", buf);
	fp = fopen(buf, "r");
	if(!fp){
		printf("[*] we can not find a book...\n");
		return 1;
	} else {
		fseek(fp, 0, SEEK_END);
    	filesize = ftell(fp);
    	fseek(fp, 0, SEEK_SET);
		printf("[*] how many pages?(MAX 400) : ");
		scanf("%u", &pages);
		if(pages > 0x190){
			printf("[*] it is heavy!!\n");
			return 1;
		}
		if(filesize > pages){
			filesize = pages;
		}
		secretbook.contents = (char *)malloc(pages);
		memset(secretbook.contents, 0x0, pages);
		__uint32_t result = fread(secretbook.contents, 1, filesize, fp);

		if(result != filesize){
			printf("[*] result : %u\n", result);
			printf("[*] it is locked..\n");
			return 1;
		}
		memset(secretbook.bookname, 0, 0x20);
		strcpy(secretbook.bookname, "STOLEN BOOK");
		printf("\n[*] (Siren rangs) (Siren rangs)\n");
		printf("[*] Oops.. cops take your book..\n");
		fclose(fp);
		return 0;
	}
~~~
파일명을 입력 받아서 그 파일을 연다.<br>
우리는 Flag를 알아야되기 때문에 Flag.txt를 열어야 한다.<br>
Flag 파일의 위치는 
![img1](/assets/pwn-library/1.png)
/home/pwnlibrary/flag.txt에 존재한다고 한다.<br>
이렇게 해서 Flag가 메모리에 잘 할당되었지만 read_book메뉴에서는 Flag가 담긴 메모리를 읽을 수 없다. 따라서 취약점을 찾아야한다. 

<br>

## Vulnerability Analysis
c에서 메모리를 할당할 때 이전에 free된 메모리 중 같은 사이즈의 메모리가 존재하였으면 그 위치에 다시 메모리를 할당한다.<br> 이 취약점을 UAF(Use After Free)라고 한다.<br>
return_book 함수에서는 book.content를 NULL문자로 채우지만 return된 책을 다시 읽을 수 없게하는 조치를 취하지 않았다. <br>
따라서 borrow_book 함수를 통해 메모리를 할당 하고, return_book 함수를 통해 메모리를 free한다. 그리고 steal_book 함수를 통해 이전에 free된 책의 사이즈와 동일하게 사이즈를 정해주고 할당하게 되면 우리는 Flag를 읽을 수 있을 것이다. <br>
주의해야 할 점은 steal_book 함수에서 size를 400까지만 줄 수 있기 때문에 size가 400이 넘지않는 1번책을 빌려야한다.
<br><br>

## Exploit
![img2](/assets/pwn-library/2.png)
1번 책을 빌린 후
![img3](/assets/pwn-library/3.png)
반납하고
![img4](/assets/pwn-library/4.png)
steal_book함수로 진입 후 flag.txt의 위치와 1번 책과 동일 한 사이즈인 256 입력
![img5](/assets/pwn-library/5.png)
read_book 함수를 통해 return된 책을 읽으면 Flag가 등장한다.

<br>

### Good Game!



