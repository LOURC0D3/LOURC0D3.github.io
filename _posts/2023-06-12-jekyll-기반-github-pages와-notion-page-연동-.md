---
layout: post
date: 2023-06-12
title: Jekyll 기반 Github Pages와 Notion Page 연동 
tags: [Github Actions, ]
categories: [Development, DevOps, ]
---

### 개요


최근에 Notion과 Next.js를 연동하여 Notion Page를 자동으로 import 해주는 블로그 템플릿을 제공하는 흥미로운 [Repository](https://github.com/morethanmin/morethan-log)를 발견하였다. 


다만, 지금 블로그가 내가 선호하던 디자인에 더 가까웠기에 지금 블로그에 해당 기능을 추가하기로 결정했다.


평소에는 Notion에 작성한 후에 Markdown으로 뽑고 살짝 수정을 거쳐서 블로그에 업로드 했었는데, 지금은 Notion에 작성만 하면 알아서 블로그에 업로드 되서 아주 간편하다.


기존에 Jekyll과 Notion을 연동한 내용을 담은 블로그 글이 있길래 해당 [블로그](https://aymanbagabas.com/blog/2022/03/29/import-notion-pages-to-jekyll.html)를 참고해서 개발하였다.


완성본은 다음과 같다.


![](https://s3.us-west-2.amazonaws.com/secure.notion-static.com/34b86fac-a1f1-446a-b255-9fc3dcbf275e/%E1%84%89%E1%85%B3%E1%84%8F%E1%85%B3%E1%84%85%E1%85%B5%E1%86%AB%E1%84%89%E1%85%A3%E1%86%BA_2023-06-12_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_5.25.44.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAT73L2G45EIPT3X45%2F20230612%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20230612T084508Z&X-Amz-Expires=3600&X-Amz-Signature=b88a8dfcb305833d6034ebafbdde7cda7e2618ed8cc711d56af09f70372ffe56&X-Amz-SignedHeaders=host&x-id=GetObject)


갱신 버튼을 눌러주는 것만으로 블로그에 글이 자동으로 등록된다.


이제 구현 방법에 대해 알아보자!


### Notion 환경 설정


먼저, Notion에서 API 통합을 생성해주어야 한다.


아래의 링크에서 새 API 통합을 생성해준 후에 Secret 값을 안전한 곳에 보관한다.


[https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)


![](https://s3.us-west-2.amazonaws.com/secure.notion-static.com/cdfbf3b8-b89f-4845-be43-bb204086a3ac/%E1%84%89%E1%85%B3%E1%84%8F%E1%85%B3%E1%84%85%E1%85%B5%E1%86%AB%E1%84%89%E1%85%A3%E1%86%BA_2023-06-12_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_5.17.00.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAT73L2G45EIPT3X45%2F20230612%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20230612T084508Z&X-Amz-Expires=3600&X-Amz-Signature=e4ab51339be1655f30ac721763bff17cbdeef447ed8c45bc181363235318c0c4&X-Amz-SignedHeaders=host&x-id=GetObject)


다음으로는 블로그 게시물을 작성할 페이지를 생성한다. 아래 템플릿을 사용하면 된다.


[블로그 템플릿](https://lourcode.notion.site/Blog-Template-d6d587e11ac04f2abcdba4412dae5387?pvs=4)


다음과 같이 생성했던 API 통합을 페이지에 추가해준다.


![](https://s3.us-west-2.amazonaws.com/secure.notion-static.com/a721ff68-b0f5-4ea9-bdd1-d330158bd93f/%E1%84%89%E1%85%B3%E1%84%8F%E1%85%B3%E1%84%85%E1%85%B5%E1%86%AB%E1%84%89%E1%85%A3%E1%86%BA_2023-06-12_%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE_5.21.12.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAT73L2G45EIPT3X45%2F20230612%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20230612T084508Z&X-Amz-Expires=3600&X-Amz-Signature=35dd0d5310c47ee3ee379c1b0abcb713ea754e796e719dd7b0ea83f132025dfb&X-Amz-SignedHeaders=host&x-id=GetObject)


다음으로는 데이터베이스에 대한 ID를 알아야한다. 페이지 링크를 복사하면 데이터베이스 아이디를 구할 수 있다.


DB 페이지로 이동한 후 링크 복사를 눌러주면 아래와 같이 생긴 링크를 얻을 수 있다.


`https://www.notion.so/<database_id>?v=<long_hash>`


여기서 `database_id`를 안전한 곳에 보관해준다.


이제 Notion에서 해야 할 일은 모두 끝났다.


### Github Actions 등록

