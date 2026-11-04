# TV 构建、签名与发布

## 发布内容

代码遵循根目录 AGPL-3.0；保留 LICENSE、THIRD-PARTY-NOTICES.md、CONTRIBUTORS.md 和上游来源。Release 应包含版本说明、测试范围、已知限制、APK 的 SHA-256，以及与该 APK 对应的源码提交/标签。

当前 1.0.4 是电视实测版本，尚不宣称适配所有品牌。网页、桌面、Docker 等继承模块保留用于上游结构兼容，不代表本分支为这些平台独立发布安装包。

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

`package.json` 的 version 决定 versionName；`android/app/build.gradle` 的 versionCode 必须逐包递增。当前为 1.0.5 / 239。同名版本若重发不同 APK，也应提高 versionCode 并在说明中明确，避免用户混淆。

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

## 当前公开准备状态（2026-11-04）

仓库先保持私有。1.0.5 已修复本地音频服务的会话鉴权和路径边界，保留独立静态复核与定向测试；类型检查、7133 项单元测试及 24 项 TV UI 用例通过。依赖检查从 34 项降到 10 项（8 中、2 低，0 高、0 严重），剩余项属于 PWA/workbox 构建工具链，尚需兼容性及实际可达性核对。未完成全仓逐文件安全审计，也未完成新鉴权音频服务的电视端协议集成验证，因此此状态不表示“安全审核全部通过”，暂不公开或发布正式 APK。

依赖整改移除了没有脚本/代码调用的旧 @capacitor/assets 图标生成工具（既有图标保留），更新兼容范围内的依赖、qs，并将 get-uri 的 basic-ftp 限定到修复版本 6.2.5。该跨主版本的间接依赖覆盖已检查 get-uri 使用的 Client 方法及目录解析接口；未声称完成真实 FTP 服务集成测试。避免使用不加区分的 npm audit fix --force。
