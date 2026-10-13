# 漫剧筛选与播放倍速实施计划

**目标：** Kotlin 原生版默认浏览漫剧，支持类型切换与可记忆的播放倍速。

**架构：** `core` 负责真实分类数据和解析，`Library` 保存偏好，`MainActivity` 增加类型切换、倍速单选与焦点恢复；保持原有播放生命周期。

**技术：** Kotlin、OkHttp、JSONObject、Android View、Media3。

- [x] 为 `ContentRepository` 增加请求级测试：漫剧榜单页码、tab 19 搜索、空结果、不跨类型回退；为榜单解析加入当前 `mergeLoaderData` 与旧 `r` 样本。
- [x] 新建 `ContentType.kt`、`PlaybackSpeed.kt`、`ComicRank.kt`；修改 `ContentRepository.kt`，保留短剧兼容入口，以平台真实页数判断末页。
- [x] `Library.kt` 保存类型（默认漫剧）和倍速（默认 1）；读取时校验持久化值。
- [x] `MainActivity.kt` 在推荐 / 搜索加入类型按钮；切换清空旧缓存并捕获请求时的类型，第一行卡片可返回类型选择；添加双行播放菜单和倍速单选框，创建每个播放器时应用保存速度。
- [x] 执行 `:core:test :app:lintDebug :app:assembleDebug`；运行联网探测与可用模拟器上的实际交互检查；更新 README 的入口、倍速说明与验证边界。

验证命令：`./kotlin-tv/gradlew -p kotlin-tv :core:test :app:lintDebug :app:assembleDebug --console=plain`。具体本机 SDK/JDK 通过环境变量指定，下载产物放在忽略的 `outputs/`。

结果：22 项 JVM 测试通过；Debug / Release lint 均无 error；两种 APK 构建通过。联网验证分类和搜索两页无重复、详情及真实 1080P 分段读取。Android TV API 34 模拟器通过默认漫剧、类型切换和持久化、倍速选择 / 取消 / 暂停 / 换集 / 重启、1.5 倍字号检查；倍速 8.08 秒前进约 12 秒。正式发布密钥未配置，测试 APK 使用开发签名。
