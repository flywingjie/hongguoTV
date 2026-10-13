# Kotlin 独立 APK · 0.2.1

本分支把电视应用重构为 Kotlin 原生应用，内容接入和分段媒体处理均在 APK 内完成。安装后联网即可使用，不再要求用户部署内容服务。原 React Native 工程和 Docker 服务保留在仓库中，原生版不依赖它们。

## 交付

- 分支：`codex/kotlin-standalone`
- 发布：`kotlin-v0.2.1`
- APK：`hongguotv-kotlin-0.2.1-android8.apk`
- 包名：`com.hongguotv.nativeapp`；最低 API 26，目标 API 36。
- 大小：2,497,307 字节；无 JNI、Node、JS 或 React Native 运行时。
- 使用独立发布签名，可与旧版并存；两者本机收藏/历史不互通。
- APK SHA-256：`b83aebc10a3e1e790c5b729d835ffa9ac7490d2bce4d07fd56605952853b0e74`
- 发布证书 SHA-256：`3579f7a8a91bbbc44688db60fb16a5561921784af23fa92f39b849086d76ca98`

## 0.2.1 修复

- 展开、收起简介原地更新内容和按钮，连续按确认不会把焦点切到播放按钮。
- 清晰度、自动连播开关原地更新，焦点保持在当前选项。
- 卡片标题、集数和行高按实际字体测量；同行卡片等高、集数底部对齐，放大字号不再切掉第二行字形。
- versionCode 升到 2，使用与 0.2.0 相同的签名，支持直接覆盖安装。

## 功能

推荐、搜索、分页、详情、20 集分组、本地收藏和最多 200 条观看记录。播放器保持画面比例，支持暂停、前后跳转、上下集、自动连播和断点续播；可设置 720P / 1080P 上限。返回后恢复当前剧集、卡片及页码；退到后台保存进度、释放播放器，返回时保持暂停。

电视界面使用原生焦点体系，主要内容保留 5% 安全边距。首页五列，聚焦行完整滚入视口，详情默认聚焦开始/继续观看。搜索结果与输入框之间可通过方向键往返。

## 本版验证

- 本地 `:core:test :app:lintRelease :app:assembleRelease` 成功；未变更的 7 个 JVM 测试复用 Gradle 检查结果。Lint 无 error，10 个非阻断 warning。GitHub CI 另行构建 Debug APK 并执行测试、lint。
- 签名校验通过，API 26 最低版本配置不变；用 `adb install -r` 从 0.2.0 覆盖安装成功，已有第 104 集观看记录保留。
- 最终签名 APK 在 Android TV API 36 ARM64 模拟器复测，保留 23 组截图与 UIAutomator XML；27 项交互证据断言通过。
- 两类设置反复切换、简介连续展开/收起保持焦点；720p / 1080p 默认字号以及 720p 的 1.3 / 1.5 倍字号布局通过截图检查。文字过长时正常显示省略号，不切掉字形；同一行卡片和底部集数对齐。
- 大字号列表上下滚动和详情返回恢复原卡片及滚动位置。第 104 集真实 1080P 播放、暂停、快进 10 秒、末集禁用下一集和返回恢复焦点通过。
- 本轮 AndroidRuntime:E、HongguoTV:W、ExoPlayerImplInternal:E 日志为空。显示尺寸、密度与字号在验证后恢复默认值，清晰度 1080P、自动连播开启。

验证包中的 `tv/interaction-assertions.json` 列出每条检查；可用 `python3 kotlin-tv/tools/verify-interaction-evidence.py <解压后的tv目录>` 复核 XML 证据。字形裁切仍需配合截图目视检查，脚本不代替视觉验收。

这不等于 Android 8.0 实体电视验收。Android 8 芯片解码、实际音频输出、实体遥控器、真实 4K 和长时间连续播放仍需目标设备验证。内容平台接口或签名规则变化可能要求更新 APK。

## 维护

参考 [README.md](README.md) 构建。发布密钥保存在发布机器本地，配置通过忽略的 `keystore.properties` 或环境变量读取，不提交到仓库。以后更新这个包名需保留同一发布密钥。GitHub CI 构建开发签名 APK；正式发布 APK 使用上述独立发布密钥在本机构建。

协议移植来源、许可证及完整代码交付见 [NOTICE.md](NOTICE.md)。
