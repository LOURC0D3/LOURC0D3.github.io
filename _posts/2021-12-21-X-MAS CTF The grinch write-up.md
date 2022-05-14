---
title: X-MAS CTF The grinch write-up
tags: [X-MAS, CTF, reversing]
style: 
color: 
description: Let's analyze the code through Reverse Engineering
---

## Code Analysis
---
![img1](/assets/The-grinch/1.png)
<br>
grinch.exe라는 winform기반으로 작성된 프로그램을 제공해준다.<br>
8개의 체크박스들이 있는데 조건에 맞게 선택해주면 플래그를 알아낼 수 있을 것 같다.<br><br>
c#으로 작성된 프로그램은 디컴파일이 굉장히 쉽기 때문에 디컴파일러인 dotpeek으로 열어줬다.<br>
?Button? 버튼이 눌렸을 때 이벤트를 확인해보자.

``` cs
private void button1_Click(object sender, EventArgs e)
    {
      CheckBox[] a = new CheckBox[8]
      {
        this.checkBox1,
        this.checkBox2,
        this.checkBox3,
        this.checkBox4,
        this.checkBox5,
        this.checkBox6,
        this.checkBox7,
        this.checkBox8
      };
      int[] numArray = new int[4]{ 154, 43, 63, 200 };
      int num1 = 0;
      for (int index = 0; index < a.Length; ++index)
        num1 += (int) Convert.ToByte((int) Convert.ToInt16(a[index].Checked) << index);
      if (numArray[Form1.level] == num1)
      {
        int num2 = 0;
        for (int index = 0; index < 8; ++index)
          num2 += (int) Convert.ToByte(Convert.ToInt16(a[index].Checked)) * 3 << index;
        byte num3 = Convert.ToByte(num2 % 256);
        Form1.k[Form1.level] = num3;
        ++Form1.level;
        if (Form1.level == 4)
        {
          for (int index = 0; index < Form1.what.Length; ++index)
            Form1.what[index] ^= Form1.k[index % 4];
          int num4 = (int) MessageBox.Show("Make up your mind already\n" + Encoding.Default.GetString(Form1.what));
          Form1.level = 0;
        }
        this.reset_checks(a);
      }
      else
      {
        int num5 = (int) MessageBox.Show("Try again!");
        Form1.level = 0;
      }
    }
```
level을 인덱스로 numarray의 값과 num1 인덱스로 쉬프트 연산한 값을 서로 비교하는 것을 알 수 있다.<br>
level이 4가되면 복호화 루틴을 통해 플래그를 출력해준다.<br>


## Exploit
---
num1을 numarray로 맞추기 위해 계산해보자.<br>

``` python
>>> 1 << 0
1
>>> 1 << 1
2
>>> 1 << 2
4
>>> 1 << 3
8
>>> 1 << 4
16
>>> 1 << 5
32
>>> 1 << 6
64
>>> 1 << 7
128
```
<br>

``` python
>>> 128 + 16 + 8 + 2
154
```
level이 0일때는 154로 만들기 위해서 1번째 3번째 4번째 7번째를 체크해주고 버튼을 눌러주면 된다.<br><br>

``` python
>>> 32 + 8 + 2 + 1
43
```
이제 level이 증가되어 level이 1일때의 값인 43으로 만들어줘야한다.<br>
5번째와 3번째와 1번째와 0번째를 체크해주고 버튼을 눌러주면된다.<br><br>

``` python
>>> 32 + 16 + 8 + 4 + 2 + 1
63
```
level 2일때의 값인 63으로 만들어줘야한다.<br>
5번째, 4번째, 3번째, 2번째, 1번째, 0번째를 체크해주고 버튼 클릭!!<br><br>

``` python
>>> 128 + 64 + 8
200
```
level이 3일때는 200으로 맞춰줘야한다.<br>
7번째, 6번째, 3번째를 체크해주면 된다.<br><br>

이거 때문에 많은 시간 삽질했다.<br>
체크박스에 체크해줄 때 왼쪽부터 7, 6, 5 순이다.<br>
처음에 0, 1, 2 인줄 알고 삽질했다 ㅜㅜ<br>

<br>

![img2](/assets/The-grinch/2.png)
플래그가 출력되었다.
<br>

### Good Game!
EZ<br><br>