# 低配电视性能与简洁交互审查

审查日期：2026-09-22。基于 Kotlin TV 0.6.0，提交 `1ec7bd2327b9574e4bdf956569efd21bcf9a83c7`。

本轮检查了当前源代码、0.6.0 已保存的截图与验证记录，并对照 Android 官方性能建议。没有修改应用代码、重跑构建或启动模拟器。下面明确区分代码中确定存在的工作量、算术示例与尚待设备测量的收益。

结论：下一版应围绕“少占内存、焦点立即响应、播放请求优先、少按几次键”收敛。已有原生 View、独立 APK、封面缓存、分组选集和预加载可以继续使用。

## 1. 优先解除离场页面的引用

**代码事实**：`base()` 和播放入口仅把旧页面从根容器移除。进入详情、播放后，Activity 的 `nav`、`typeButtons`、`selectionPreview`、`homeScreen`、`favoriteBadges` 等字段没有随离场清空；它们只在下一次 `showCatalog()` 中清理。

例如 `Activity.nav → 导航按钮 → top → 旧页面容器`、`Activity.selectionPreview → body → 旧页面容器`，都会保留旧视图树。首页还通过 `HomeScreen.cards / rows / coverLoads` 保留卡片与图片。直接进入播放时，详情页也可能由 `pageBody` 保留。

**影响**：已经浏览的封面会与视频缓冲、解码资源同时驻留。这是可确认的过长持有，不等于已经证明无限泄漏或发生 OOM。12 MiB 的 LruCache 只限制缓存自身，不能限制仍由 ImageView 引用的图片。

**算术示例，非实测**：100 张 360×640、ARGB_8888 封面，仅像素就是约 87.9 MiB，尚未算 View、GPU 纹理和播放器。

**建议**：统一处理页面离场，解除 View 引用与请求订阅，只保留轻量数据、滚动位置和焦点 key；低内存通知时收缩非必要图片缓存。避免对仍在显示的 Bitmap 手动 recycle。

证据：[MainActivity.kt:170](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:170)、[MainActivity.kt:231](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:231)、[MainActivity.kt:532](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:532)、[MainActivity.kt:609](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:609)、[HomeScreen.kt:53](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/HomeScreen.kt:53)。

## 2. 列表按可见区域创建，轻操作局部更新

**代码事实**：首页是 ScrollView 加横向 LinearLayout，所有条目一次创建。代码允许的最大规模是接着看 8、收藏更新 20、稍后看 100、热门 30，共 158 张卡，卡片及容器约 660 个 View。收藏页最多 500 张卡，卡片和行容器约 2600 个 View；历史最多 200 张卡。

首页只延迟图片加载，没有回收已浏览卡片；收藏、历史页会为整页所有卡片提交封面任务。收藏、加入稍后看、隐藏推荐还会调用 `showCatalog()` 重建整个页面。删除当前卡后，旧 key 失效，首页回落到第一张卡。

**建议**：首页每行保留 8～12 项加“查看全部”；完整收藏、历史采用 RecyclerView 或有界分页。收藏标记与进度就地更新，删除后落在相邻卡，保持其他行的横向位置。

复用列表需要一起调整当前依赖所有 View ID 均已存在的焦点逻辑：按数据 key 保存焦点，离屏目标先滚动到位，再恢复焦点。不能只换容器而忽略遥控器行为。

证据：[MainActivity.kt:348](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:348)、[MainActivity.kt:415](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:415)、[MainActivity.kt:448](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:448)、[HomeScreen.kt:68](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/HomeScreen.kt:68)、[HomeScreen.kt:111](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/HomeScreen.kt:111)。

## 3. 本地数据保留内存索引，消除主线程重复整表解析

**代码事实**：

- 每次移动卡片焦点，`selectionStatus()` 都重新读取并解析历史、收藏、稍后看；历史还重新排序。容量上限分别是 200、500、100 条。
- 播放 tick 每超过 5 秒调用保存进度，在主线程解析、排序历史，再把最多 200 条记录重新序列化。暂停、换集、退出也会保存。
- `favoriteUpdate(id)` 每次都解析完整的收藏更新 JSON。500 收藏、500 更新条目时，一次收藏筛选就会做 500 次整表解析，而不是解析一次再查询。
- 每检查一部收藏，`refreshFavoriteLabels()` 会遍历所有收藏角标。因为这些 View 引用在进入播放时没有清理，从收藏进入播放后，后台检查仍可能更新已离屏的整页角标。

**建议**：启动时在后台读取一次本地库，构建按 ID 查询的内存快照；单条变化更新索引。持久化采用单一后台写入者并合并重复请求，保留暂停、切集、退出时的重要进度保存。第一轮不必为了此事引入数据库或整套新框架，也不必直接延长进度保存间隔。

`SharedPreferences.apply()` 是异步写盘；这里确定处于主线程的是 JSON 解析、排序和序列化。官方另说明，未完成的 apply 写入可能在组件生命周期转换时阻塞主线程，不能把异步调用等同于完全没有退出阶段成本。[SharedPreferences 官方说明](https://developer.android.com/reference/android/content/SharedPreferences)

证据：[Library.kt:25](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/Library.kt:25)、[Library.kt:48](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/Library.kt:48)、[Library.kt:65](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/Library.kt:65)、[MainActivity.kt:139](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:139)、[MainActivity.kt:403](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:403)、[MainActivity.kt:455](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:455)。

## 4. 取消已经过时的网络工作，让当前播放优先

**代码事实**：通用工作池固定 3 个线程，图片工作池 2 个线程。`work()` 只在返回结果时比较 generation，任务入队或网络执行期间没有取消；封面任务只在开始执行前判断 generation，已发出的请求不会随页面离场取消。普通网络请求单次 callTimeout 为 45 秒。

快速进入 A、返回、进入 B，或连续切集时，旧详情和旧播放解析仍占线程。播放地址解析包含两个串行请求，再读取视频索引。两个旧页面的慢封面也可能占满图片线程，当前页面的封面只能排队。同一 URL 尚未完成时没有合并请求。

**建议**：按页面、播放意图保存 Future 和对应 HTTP Call；离场时取消相应任务、清理未执行队列。焦点附近图片优先、重复 URL 合并；播放请求拥有独立优先级。不要取消共享 HTTP 客户端的所有请求，以免误伤当前视频。

证据：[MainActivity.kt:37](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:37)、[MainActivity.kt:177](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:177)、[MainActivity.kt:202](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:202)、[ContentRepository.kt:27](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/core/src/main/kotlin/com/hongguotv/core/ContentRepository.kt:27)、[ContentRepository.kt:126](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/core/src/main/kotlin/com/hongguotv/core/ContentRepository.kt:126)。

## 5. 播放期间减少无关后台工作

**代码事实**：`onResume()` 启动收藏检查，进入播放时未停止。它会串行抓取收藏剧的完整详情以检查集数，最多扫描 500 部；前台播放、下一集预加载与该扫描可以同时进行。虽然检查有一小时有效期和连续失败停止，但首次或过期时仍存在这一工作量。

HUD 隐藏时，tick 仍每秒格式化播放文本和更新进度；MediaSession 也每秒重新构造状态。Activity 后台时 tick 未主动停止。

**建议**：播放时暂停收藏扫描，回目录后恢复；只更新可见角标。HUD 可见时才按秒刷新，MediaSession 在播放状态、seek、倍速、集数变化时更新。后台停止无用 tick，但保留前台定时停止所需的计时，不破坏现有睡眠功能。

证据：[FavoriteMonitor.kt:19](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/FavoriteMonitor.kt:19)、[MainActivity.kt:715](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:715)、[MainActivity.kt:937](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:937)、[TvMediaSession.kt:36](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/TvMediaSession.kt:36)。

## 6. 预加载时机与两分钟有效期需要协调

**代码事实**：当前 READY 后约 3 秒、已缓冲至少 5 秒就尝试准备下一集；准备结果完成后只有 120 秒有效。`prefetchedFor` 相同就不再重做，过期后也不会主动刷新。

**可确认场景**：假设开播第 5 秒完成预加载，第 180 秒换集，准备结果已存在 175 秒，`take()` 会丢弃它并走普通解析。这是逻辑示例，不代表真实节目时长分布。中途长时间暂停也有同样问题。

**建议**：依据剩余播放时长与倍速，把自动连播预加载安排在预计片尾前 20～30 秒附近；可用短时手动切集路径补充。网络、缓冲条件继续生效；过期允许重新准备，但应有次数或时间限制。不要只扩大 TTL 或预加载更多集。

证据：[MainActivity.kt:660](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:660)、[PreparedSlot.kt:7](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/core/src/main/kotlin/com/hongguotv/core/PreparedSlot.kt:7)。

## 7. 换集复用播放器，需要先补真正首帧测量

**代码事实**：每次换集都会保存进度、release ExoPlayer、解绑 PlayerView、移除界面，再创建新的 PlayerView 和 ExoPlayer。现有换集计时从保存和 release 之后才开始，到 STATE_READY 为止。

因此旧版“149～175 ms”样本不是用户按键到新画面的黑屏时长，也漏掉旧播放器释放和保存进度。不能据此承诺低配电视换集已经足够快。

**建议**：先记录换集意图到首次渲染帧的完整时间，再尝试同一观看会话复用 PlayerView、Surface 和 ExoPlayer，仅替换 MediaSource。真正退出播放时仍释放资源。旧芯片解码器、异常恢复、清晰度切换和音频焦点需回归；不作为未经实机验证的“无缝切换”承诺。

证据：[MainActivity.kt:594](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:594)、[MainActivity.kt:623](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:623)、[MainActivity.kt:634](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:634)、[MainActivity.kt:877](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:877)。

## 8. 首页减占位，焦点变化不牵动卡片尺寸

**代码与截图事实**：首页常驻导航、内容类型、快捷操作说明、标题、元信息和两行简介。0.6.0 已有 720p／1.5 倍字体截图中，首屏只显示接着看这一行。预览标题只设置 maxLines=2，没有固定高度；一行、两行标题切换可能改变货架高度，进而触发遍历所有卡片的 `fitArtwork()`。

**建议**：常驻预览收敛为“剧名＋集数／观看进度”，预留稳定高度；完整简介放详情。操作提示首次展示或按菜单查看。焦点边框立即响应，必要的较长文本待停留后刷新。同一行左右移动时避免反复提交纵向滚动。保留远距离可读字号，不靠缩小文字腾空间。

证据：[HomeScreen.kt:18](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/HomeScreen.kt:18)、[HomeScreen.kt:85](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/HomeScreen.kt:85)、[HomeScreen.kt:119](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/HomeScreen.kt:119)、[已有 720p 大字体截图](/Users/lu.ziyong/Github/hongguoTV/outputs/kotlin-0.6.0/final-tv/60-final-large-home.png)。

## 9. 统一续播与返回，缩短选集路径

| 操作 | 当前路径 | 建议路径 |
| --- | --- | --- |
| 最近观看卡确认 | 详情 → 再确认播放 | 直接续播，详情保留在快捷菜单 |
| 管理记录中的“继续观看” | 实际仍调用默认进入详情 | 与首页继续观看一致 |
| 从首页直接续播后退出 | 固定返回详情 | 返回进入播放前的卡片和位置 |
| 播放中向下 | 打开 3 排 9 按钮菜单，焦点在暂停 | 直接打开已有选集面板 |
| 播放中低频设置 | 与暂停、上下集同处大面板 | 菜单键及一个可见“更多”入口进入 |
| 移除稍后看 | 重建首页，可能跳首卡 | 更新当前行，焦点留在相邻卡 |

遥控器不能假定都有菜单键，低频设置应仍有可见入口。已有确认暂停、左右快进退、20 集分组和跳转集数可以保留，不需要再造一套复杂导航。

证据：[MainActivity.kt:365](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:365)、[MainActivity.kt:523](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:523)、[MainActivity.kt:794](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:794)、[MainActivity.kt:887](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:887)。

## 10. 图片按实际显示尺寸处理，设备档位自动调整

当前封面按最长边 640 统一降采样，内存缓存统一 12 MiB；代码未根据 `isLowRamDevice()` 分档，也没有 `onTrimMemory` 收缩策略。尺寸上限已存在，图片解码也已在后台，不应描述为没有任何限制。

建议按卡面和详情所需尺寸分别生成缓存；必要时裁切为实际显示比例，避免小横图长期持有整张高分辨率竖图。缓存 key 应包含目标尺寸和变换，避免影响详情质量。低内存设备自动缩小图片预算与预加载范围；具体数值由测量确定，不让用户面对一堆技术开关。已有清晰度选择继续尊重用户设置。

Android 官方建议使用 `ActivityManager.isLowRamDevice()` 识别受限设备、按资源条件调整图片和媒体占用，并在转场后解除不再需要的对象引用；这些方向与本轮发现一致。[Android TV 内存优化指南](https://developer.android.com/training/tv/playback/memory)

证据：[MainActivity.kt:138](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:138)、[MainActivity.kt:192](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/MainActivity.kt:192)。

## 后续测量后再决定的项目

解密路径每个块和样本存在数组复制、BigInteger 和 Cipher 对象创建；顺序视频读取采用多次 Range 请求。这些都是可定位的分配或网络开销，但没有低配设备 CPU／分配采样，不能判定其为当前主瓶颈。应先完成上面的确定性减负，再决定是否改动解密、顺序读取或缓冲策略；改动必须覆盖随机 seek、跨块和加密子样本。现有播放缓冲目标是 12 MiB，不能把它当整个播放器内存上限，也不宜直接继续缩短缓冲而增加卡顿。

证据：[VideoDataSource.kt:27](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/app/src/main/kotlin/com/hongguotv/nativeapp/VideoDataSource.kt:27)、[RemoteVideo.kt:55](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/core/src/main/kotlin/com/hongguotv/core/RemoteVideo.kt:55)、[MediaCrypto.kt:134](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/core/src/main/kotlin/com/hongguotv/core/MediaCrypto.kt:134)。

## 建议实施与验收顺序

| 批次 | 工作 | 验收重点 |
| --- | --- | --- |
| 第一批：确定性减负 | 页面引用释放；Library 索引与后台持久化；取消过期请求；播放暂停收藏扫描 | 焦点不解析整库；播放不刷新离屏列表；进度不丢；新播放不等待旧请求超时 |
| 第二批：简洁与规模控制 | 首页精简；收藏／历史复用或分页；局部更新；续播返回一致；向下选集 | 720p 大字体；连续方向键；移除当前卡；深滚动往返后焦点与位置保持 |
| 第三批：首帧与连播 | 完整首帧计时；预加载时机；播放器复用 | 同一节目、清晰度、网络下比较按键到首帧，观察黑屏、声音、掉帧与异常恢复 |

数据规模至少覆盖轻量库与容量较大的库，例如 20／200 条历史、20／500 条收藏、0／100 条稍后看。极限容量是压力场景，不应冒充用户的真实记录数量。

必须补的设备指标：冷启动到可操作首屏；连续遥控移动的帧耗时与输入响应；按键到首帧；连续浏览、播放、返回至少 20 次后的内存趋势；播放掉帧与 GC；弱网下快速切换请求的取消情况。报告分清 Java／Native／Graphics 内存，不以 APK 大小或单一缓存数字代替运行占用。

已有 0.6.0 数据来自 Android TV API 36 模拟器：缓存启动 298～406 ms（Activity 到内容布局回调）；预加载换集 149～175 ms（部分换集路径到 READY）。这些可作旧版参考，不是 Android 8 低配实体电视的验收结果，也不能据此承诺改进百分比。建议用同一台实体电视、同一组节目完成前后对照。[现有发布验证说明](/Users/lu.ziyong/Github/hongguoTV/kotlin-tv/RELEASE_0.6.0.md)

列表复用、减少不必要布局和图片上传也符合 Android 官方渲染性能建议。[Slow rendering](https://developer.android.com/topic/performance/issues/render)
