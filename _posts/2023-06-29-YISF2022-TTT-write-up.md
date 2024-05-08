---
layout: post
date: 2023-06-29
title: "YISF2022 TTT write-up"
tags: [MISC, ]
categories: [CTF, YISF2022, ]
---



### 문제 파일


---



{% raw %}
```c
// Tic-tac-toe playing AI. Exhaustive tree-search. WTFPL
// Matthew Steel 2009, www.www.repsilat.com

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <fcntl.h>
#include <string.h>
#include <unistd.h>

char flag[0x40] = {
    '\0',
};

char gridChar(int i)
{
    switch (i)
    {
    case -1:
        return 'X';
    case 0:
        return ' ';
    case 1:
        return 'O';
    }
}

void draw(int b[9])
{
    printf(" %c | %c | %c \n", gridChar(b[0]), gridChar(b[1]), gridChar(b[2]));
    printf("---+---+---\n");
    printf(" %c | %c | %c \n", gridChar(b[3]), gridChar(b[4]), gridChar(b[5]));
    printf("---+---+---\n");
    printf(" %c | %c | %c \n", gridChar(b[6]), gridChar(b[7]), gridChar(b[8]));
}

int win(const int board[9])
{
    unsigned wins[8][3] = {{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, {0, 3, 6}, {1, 4, 7}, {2, 5, 8}, {0, 4, 8}, {2, 4, 6}};
    int i;
    for (i = 0; i < 8; ++i)
    {
        if (board[wins[i][0]] != 0 &&
            board[wins[i][0]] == board[wins[i][1]] &&
            board[wins[i][0]] == board[wins[i][2]])
            return board[wins[i][2]];
    }
    return 0;
}

int minimax(int board[9], int player)
{
    int winner = win(board);
    if (winner != 0)
        return winner * player;

    int move = -1;
    int score = -2;
    int i;
    for (i = 0; i < 9; ++i)
    {
        if (board[i] == 0)
        {
            board[i] = player;
            int thisScore = -minimax(board, player * -1);
            if (thisScore > score)
            {
                score = thisScore;
                move = i;
            }
            board[i] = 0;
        }
    }
    if (move == -1)
        return 0;
    return score;
}

void computerMove(int board[9])
{
    int move = -1;
    int score = -2;
    int i;

    int index = 0;
    for (int i = 0; i < 9; ++i)
    {
        if (1 == board[i])
            index = board[i];
    }

    if (index != 1)
    {
        int random = rand() % 9;

        while (board[random] == -1)
        {
            random = rand() % 9;
        }

        board[random] = 1;
        return;
    }

    for (i = 0; i < 9; ++i)
    {
        if (board[i] == 0)
        {
            board[i] = 1;
            int tempScore = -minimax(board, -1);
            board[i] = 0;
            if (tempScore > score)
            {
                score = tempScore;
                move = i;
            }
        }
    }

    board[move] = 1;
}

void playerMove(int board[9])
{
    int move = 0;
    do
    {
        printf("\nInput move ([0..8]): ");
        scanf("%d", &move);
        printf("\n");
    } while (move >= 9 || move < 0 || board[move] != 0);
    board[move] = -1;
}

void initialize()
{
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);
    srand(time(NULL));

    int fd = open("flag", O_RDONLY);
    if (fd == -1)
    {
        return;
    }
    if (!read(fd, flag, 0x3f))
    {
        close(fd);
        return;
    }
    flag[strlen(flag)] = '\n';
    close(fd);
}

int main()
{
    initialize();

    int board[9] = {0, 0, 0, 0, 0, 0, 0, 0, 0};
    unsigned turn;
    int winCount = 0;

    for (;;)
    {
        if (winCount >= 500)
        {
            printf("Wow!\n%s\n", flag);
            return 0;
        }

        for (int i = 0; i < 9; i++)
        {
            board[i] = 0;
        }

        printf("Computer: O, You: X\n");

        for (turn = 0; turn < 9 && win(board) == 0; ++turn)
        {
            if ((turn + 1) % 2 == 0)
                computerMove(board);
            else
            {
                draw(board);
                playerMove(board);
            }
        }
        switch (win(board))
        {
        case 0:
            printf("A draw. How droll.\n");
            continue;
        case 1:
            draw(board);
            printf("You lose.\n");
            return 0;
        case -1:
            printf("You win. Inconceivable!\n");
            winCount++;
            break;
        }
    }
}
```
{% endraw %}




### Solution


---



{% raw %}
```python
#TTT.py
from pwn import *

board = [0,0,0,0,0,0,0,0,0]
winCount = 0

def checkBoard():
    global winCount

    if winCount == 500:
        p.recvuntil(b"Wow!\n")
        print(p.recvline().decode('utf-8'))
        return
    try:
        for i in range(3):
            tmp = p.recvuntil('\n').decode('utf-8').replace('\n','').split('|')
            if tmp[0] == 'You win. Inconceivable!':
                winCount += 1
                print('win left: ' + str(500 - winCount))

            if tmp[0] == '---+---+---':
                tmp = p.recvuntil('\n').decode('utf-8').replace('\n','').split('|')
            for j in range(3):
                if tmp[j][1] == 'O':
                    board[(i * 3) + j] = 1
                elif tmp[j][1] == 'X':
                    board[(i * 3) + j] = -1
                elif tmp[j][1] == ' ':
                    board[(i * 3) + j] = 0
    except:
        checkBoard()


def win(board):
    wins = [[0,1,2],[3,4,5],[6,7,8],[8,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
    for i in range(8):
        if board[wins[i][0]] != 0 and board[wins[i][0]] == board[wins[i][1]] and board[wins[i][0]] == board[wins[i][2]]:
            return board[wins[i][2]]
    return 0

def minmax(board, player):
    winner = win(board)
    if winner != 0:
        return winner*player
    
    move = 1
    score = -2
    
    for i in range(9):
        if board[i] == 0:
            board[i] = player
            thisScore = -minmax(board, player*-1)
            if thisScore > score:
                score = thisScore
                move = i
            board[i] = 0
    if move == 1:
        return 0
    return score

def move(board):
    move = -1
    score = -2
    
    for i in range(9):
        if board[i] == 0:
            board[i] = -1
            tempScore = -minmax(board, 1)
            board[i] = 0
            if tempScore > score:
                score = tempScore
                move = i

    return move

p = process('./TTT')

p.recvuntil(b'Computer: O, You: X\n')
p.sendline('4')


while True:
    try:
        p.recvuntil(b'Input move ([0..8]): \n')
        checkBoard()
        p.sendline(str(move(board)))
    except:
        break


p.interactive()
```
{% endraw %}


