# TV 构建、签名与发布

## 发布内容

代码遵循根目录 AGPL-3.0；保留 LICENSE、THIRD-PARTY-NOTICES.md、CONTRIBUTORS.md 和上游来源。Release 应包含版本说明、测试范围、已知限制、APK 的 SHA-256，以及与该 APK 对应的源码提交/标签。

当前 1.0.6 是电视测试版本，尚不宣称适配所有品牌。网页、桌面、Docker 等继承模块保留用于上游结构兼容，不代表本分支为这些平台独立发布安装包。

## 构建

macOS / Linux：配置 Node 24+、JDK 21、Android SDK 36.1 后运行：

```sh
npm ci
npm run build:android:tv
```

Windows PowerShell：

```powershell
npm ci
$env:VITE_FOLIA_TV = 'true'
$env:VITE_LIBRARY_INITIAL_SUITE = 'grid'
npm run cap:sync:android
cd android
.\gradlew.bat -PfoliaTv :app:assembleDebug
```

调试输出为 `android/app/build/outputs/apk/debug/app-debug.apk`。公开 Release 包应使用受控的正式签名；现有工程支持本地 `android/keystore.properties`（模板见 `android/keystore.properties.example`），配置后以 `-PfoliaTv :app:assembleRelease` 构建。先完成相同 TV 环境变量的网页构建与 Capacitor 同步。绝不提交 properties 实值或 keystore。

当前已交付的 1.0.4 使用本地调试证书。改用正式证书会影响覆盖更新，应先明确迁移与备份方案；不能将“使用正式证书”说成仍能直接覆盖旧调试包。CI 的临时调试签名用于构建验证，不作为已有用户的升级签名。

## 版本规则

`package.json` 的 version 决定 versionName；`android/app/build.gradle` 的 versionCode 必须逐包递增。当前为 1.0.6 / 240。同名版本若重发不同 APK，也应提高 versionCode 并在说明中明确，避免用户混淆。

## 源码来源记录

本 TV 发布仓库以当前源码快照建立，避免将开发机私有历史带入发布仓库；并非从零原创。直接基础是 whycfawa/folia-android 的 `7d2cc8312ee961b01f08f3585ab6bec5a059a4e7`，完整上游历史见其 GitHub 仓库。原始 Folia、Android 移植者、既有 CONTRIBUTORS 与文件内版权声明均保留，TV 修改由本分支维护。

## 公开前检查

- 核对拟上传的文件与历史范围，确认无私密配置、用户数据、密钥和测试日志。
- 检查依赖与原生桥接的安全风险，记录未解决项；不能仅以搜索不到 Token 就宣称完成安全审计。
- 工作流只提供必要的检查，不继承自动发通知、自动分流 Issue 或发布 Docker 的副作用。
- 静态类型、TV 定向单测与 UI 通过；涉及原生代码时验证 APK 构建与 Android 生命周期。
- 核对包名、版本、签名、APK 校验和、源码标签与 Release 附件一致。
- 核验原作者署名、代码许可、第三方声明和素材权利；不上传个人电视照片、账户截图或测试音频。

## 已完成验证的边界

1.0.4 曾完成类型检查、40 项定向单测、TV UI 用例及 API 33 模拟器方向键/生命周期验证。真实电视的遥控器转发、WebView、第三方音源和性能仍需设备实测。文档整理本身不会改变现有 APK；新增安全修复后应重新构建并重新核对校验和。

## 1.0.6 发布前验证（2026-11-04）

本次针对 Android TV 发布链、安卓原生服务/WebView 边界、源码与 APK 上传内容做专项复核，不将其表述为上游全部 PC 功能的逐行审计或永久无漏洞保证。

- npm audit：0 项已报告漏洞。PWA 构建链的 glob 与 worker 打包依赖已更新，旧 EJS/Jake/Filelist 依赖链已移除。
- deepmerge 官方暂无对应修复版本；本仓库使用保留 MIT 许可的本地修订。它不在 npm 远端包审计范围内，因此另以源码差异复核和 6 项原型污染/兼容回归验证，而不是仅靠 audit 的数字。
- 类型检查、7139 项单元测试（另有 2 项跳过）、24 项 TV UI 用例通过，APK 构建通过。
- 安卓 API 33 专用模拟器已验证本地音频：15 个无/错误会话令牌 GET/HEAD/OPTIONS 请求均拒绝；有效 GET、HEAD、Range、OPTIONS 和目录穿越拒绝检查通过。脚本为 `dev/tv/verifyNativeAudioAccess.mjs`，只使用生成的静音音频，不读取用户音乐。
- 播放主画面短按左/右立即切歌；按住只切一次，防止重复事件连跳。其它页面继续用于导航。
- 源码不含密钥、用户导出、测试日志、签名文件或本机运行数据。Release 仅分发明确标注的 TV 测试 APK 与 SHA-256；签名沿用现有 TV 测试签名。

### 重跑 Android 音频服务验证

在安装了 Android SDK、开启调试的专用测试模拟器上运行（不要直接拿个人主力设备做自动测试）：

```sh
ADB_PATH=/path/to/adb ANDROID_SERIAL=emulator-5580 node dev/tv/verifyNativeAudioAccess.mjs android/app/build/outputs/apk/debug/app-debug.apk
```

脚本创建并清理临时测试音频，不输出会话访问令牌。模拟器验证不替代不同电视品牌的遥控器/HDMI-CEC、WebView、第三方音源和性能实测。
