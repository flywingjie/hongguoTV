# 漫剧筛选与倍速验证记录

2026-09-22，基于 `codex/kotlin-standalone` 的 `7601b25`。本次修改尚未作为正式版本发布。

## 功能

- 推荐 / 搜索切换漫剧、短剧，首次默认漫剧，持久化选择。切换清除旧类型结果及页码，收藏和历史保留。
- 漫剧首页使用真实漫剧热播榜；搜索使用专用 tab 19，不向真人短剧回退。官网缺少内嵌 JSON 时解析已渲染卡片，确认路由和页码后使用。
- 搜索携带服务端游标，按类型和关键词隔离。漫剧游标失效时提示并刷新第一页，避免重复翻页。
- 播放菜单提供 0.75 / 1 / 1.25 / 1.5 / 1.75 / 2×。选择即时应用并保存，暂停状态不变；换集、重试和播放器重建沿用保存值，取消保持原值和按钮焦点。

## 验证结果

- 22 项 JVM 测试通过。网页格式兼容、游标传递与过期场景均先通过失败测试复现，再修复通过。
- `:app:lintDebug`、`:app:lintRelease`：0 error，各 11 warning（包含既有 UI 文案 / API 使用建议）。Debug 和 Release R8 混淆构建成功。
- 真实 Kotlin 联网探测：漫剧首页第 1、2 页各 20 条，重复 0；漫剧「修仙」搜索第 1 页 20 条、第 2 页 19 条，重复 0；详情 152 集；1080P 视频头部 1 MiB 和尾部 64 KiB 分段读取成功。
- Android TV API 34 ARM64 模拟器实测：默认漫剧、短剧切换及重启保留、漫剧搜索和结果返回输入框、进入详情、真实视频播放、倍速选择与取消、暂停状态、换集及重启保留倍速。21 项交互证据断言通过，AndroidRuntime / HongguoTV / ExoPlayer 错误日志为空。
- 选择 1.5× 后实测 8.08 秒，视频从 00:07 前进到 00:19，计时结果约 1.484×（UI 进度按秒显示）。
- 1080p、默认字号及 1.5 倍字号截图检查：两行播放菜单、六档倍速弹窗及取消按钮均可见；选择或取消后焦点恢复到倍速按钮。
- `tools/verify-comic-speed-evidence.py` 可复核 `outputs/comic-speed/` 中 XML / 计时证据；PNG 仍需人工检查文字与布局。

实体 Android 8.0 电视、音频输出、长时间播放和不同解码芯片尚未验证。模拟器使用无音频模式，不能由本次结果推断音频表现。

## 本地测试包

- 文件：`outputs/hongguotv-native-comic-speed-test.apk`，2,582,421 字节。
- SHA-256：`cf63ae941db4755a7c25e154931df0226f2088fedc722b640e885ca40c0c53e8`。
- 通过 Release 混淆构建，使用本地 Android Debug 开发签名完成构建及安装验证；它不是正式发布签名，不能覆盖不同签名的正式 APK。正式发布时必须配置原发布密钥。
- 当前版本元数据仍为 0.2.1 / versionCode 2；正式发布前再统一升级版本和发布说明。此前已发布的 0.2.1 包不包含本次改动。

复现构建：

```sh
./kotlin-tv/gradlew -p kotlin-tv :core:test :app:lintDebug :app:assembleDebug
./kotlin-tv/gradlew -p kotlin-tv :core:run --args=--comic
python3 kotlin-tv/tools/verify-comic-speed-evidence.py outputs/comic-speed
```

Release 校验通过构建环境指定开发密钥，仅用于本地验证，没有更改仓库的正式签名配置。
