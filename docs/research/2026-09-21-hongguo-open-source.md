# 红果接口开源项目调研

调研日期：2026-09-21。目标：为 Android TV 客户端寻找现成的搜索、剧集详情与播放接口实现。

## 结论与验证范围

找到了直接请求红果/番茄平台域名的公开源码，可以作为接口研究起点。优先验证 `woshishiq1/drpys` 的 `红果果[短].js` 和 `zhenyong97/hongguo-downloader` 的 `src/native/hongguo.js`。

本次通过 GitHub API 核对仓库目录、关键源码、许可证元数据和关键文件最近提交；未运行下载器、签名或视频处理代码，未登录红果，也未验证真实视频播放。下列“实现”均指源码中存在对应逻辑，不代表接口目前调用成功或长期稳定。

## 主要候选

### 1. woshishiq1/drpys：优先参考 TV 源的完整调用流程

- [仓库](https://github.com/woshishiq1/drpys)
- [关键源码：红果果[短].js](https://github.com/woshishiq1/drpys/blob/22261adfa31435e3b3ef5a730b8a2a75bcaf1715/spider/js/%E7%BA%A2%E6%9E%9C%E6%9E%9C%5B%E7%9F%AD%5D.js)
- 关键文件最近提交：2026-09-14；GitHub 识别的仓库许可证：GPL-3.0。
- 官网数据用于分类、榜单和详情；App 搜索失败时回退官网搜索。
- 包含视频信息请求、请求签名、清晰度选择及流式播放代理逻辑，依赖 Node 的 crypto、Buffer、axios 和 drpys 运行时。
- 核心入口：`appSearchPage()`、`requestVideoModel()`、`fetchVideoInfo()`，以及规则对象中的“二级”“搜索”“lazy”“proxy_rule”。
- 源码存在固定设备参数；其有效性和运行时依赖需要实测。
- 注意区别：同仓库的 `红果短剧[短].js` 另依赖本地 `hongguo-bridge` 服务，不能只复制该文件就认为播放能力完整。`红果果[短].js` 则将相应处理逻辑放在源文件内。
- 对本项目的价值：优先验证搜索 → 详情 → 选集 → 播放的调用顺序；Android 遥控器界面需要另做。

### 2. zhenyong97/hongguo-downloader：接口代码集中，便于阅读

- [仓库](https://github.com/zhenyong97/hongguo-downloader)
- [关键源码：src/native/hongguo.js](https://github.com/zhenyong97/hongguo-downloader/blob/774e3327498d6f4475cb3e24246ea39a0ce0a2e0/src/native/hongguo.js)
- 关键文件最近提交：2026-09-16；GitHub 识别的仓库许可证：GPL-3.0。
- Electron + React 桌面项目；接口模块直接请求 `api5-normal-sinfonlineb.fqnovel.com`。
- `resolveSeriesId()`：分享链接转剧集 ID。
- `fetchEpisodeList()`：获取剧集与分集列表。
- `fetchPlayUrlSingle()`：获取视频模型，并提取视频地址、加密信息、编码类型。
- 此接口文件重点实现选集和视频信息，不能据此声称它独立实现完整站内搜索。
- 源码包含固定设备与版本参数；预加载接口是否持续接受这些请求，尚未实测。
- 对本项目的价值：接口请求与返回结构很集中，适合与 drpys 交叉验证。

### 3. zhangbaio/hongguo：Python 接口与协议研究资料

- [仓库](https://github.com/zhangbaio/hongguo)
- [关键源码：hongguo.py](https://github.com/zhangbaio/hongguo/blob/2a72690c9954394c9c99b6f6649e8dd5cb5b3884/hongguo.py)
- 关键文件最近提交：2026-07-04；仓库最近推送为 2026-07-14。GitHub 未识别到许可证。
- 可定位 `search()`、`get_episodes()`、`get_video_urls()`、`get_video_tracks()` 等函数。
- 请求流程使用设备配置和签名服务；README 描述了模拟器/App + Frida 的签名方式，不能视为一个无外部依赖的普通 HTTP SDK。
- 对本项目的价值：核对接口字段、搜索分页和分集映射；部署复杂度需单独评估。

### 4. 563617356/hongguo-tv：Apple TV 实现，可参考后端接口划分

- [仓库](https://github.com/563617356/hongguo-tv)
- [关键源码：backend/app.py](https://github.com/563617356/hongguo-tv/blob/295a21d69c4857f3da84dc226bfaeb519c0786cc/backend/app.py)
- 后端关键文件最近提交：2026-08-07；GitHub 未识别到许可证。
- 项目由 Python 后端、Web 页面和 SwiftUI tvOS 客户端组成，目标平台是 Apple TV。
- 后端抓取 `hongguoduanju.com` 页面并解析 `_ROUTER_DATA`，对外提供首页、搜索、详情、单集视频接口。
- 搜索失败会退回对首页内容做本地关键词过滤，因此返回结果并不必然代表完整站内搜索。
- 播放逻辑依赖页面里的 `main_url` / `backup_url`；网页结构和当前播放能力均未实测。
- 对本项目的价值：参考 TV 页面组织和前后端接口划分，不能直接作为 Android TV 工程使用。

## 其他已核对项目

| 项目 | 核对结果 |
| --- | --- |
| [dawei233/hongguo-monorepo](https://github.com/dawei233/hongguo-monorepo) | PC、Android、NAS 多端方案；`nas-backend/hongguo_core.py` 包含搜索、详情、视频信息请求，签名依赖随仓库提供的 liushen 模块；README 表明 Android 端依赖局域网 NAS 后端。GitHub 未识别到许可证。 |
| [gybeyond1/hongguo-dl](https://github.com/gybeyond1/hongguo-dl) | `docker/hongguo_core.py` 存在分集和视频信息请求，使用与 zhenyong97 项目相近的预加载接口及固定设备参数。GitHub 未识别到许可证。 |
| [huangxd-/danmu_api](https://github.com/huangxd-/danmu_api/blob/main/danmu_api/sources/hongguo.js) | 搜索、分集与弹幕请求可参考；其产品目标是弹幕服务，不是完整视频播放客户端。GitHub 识别许可证为 AGPL-3.0。 |
| [ucmao/media-parser](https://github.com/ucmao/media-parser/blob/main/src/parsers/fanqie_parser.py) | 红果模块解析分享/推广页的 HTML，提取视频、封面等字段；不等于提供完整搜索和选集能力。GitHub 识别许可证为 MIT。 |
| [zhangbaio/hongguo-downloader](https://github.com/zhangbaio/hongguo-downloader/blob/main/core/api_client.py) | 客户端调用 `orz.icic.icu` 第三方服务，部分请求传入 key 和 machine_id；没有因此获得红果平台接口的独立实现。 |
| [Erlmo/shortplay](https://github.com/Erlmo/shortplay) | Flutter 播放器；README 明确说明相关签名/密钥算法未开源，需要另外准备接口，不能单靠这个仓库解决内容接入。 |

## 源码中出现的调用路径

以下为源码中观察到的路径，不是红果官方开放 API 文档，也不是已验证可用的请求示例。

| 用途 | 路径 | 证据 |
| --- | --- | --- |
| 搜索 | `GET /reading/bookapi/search/tab/v` | `zhangbaio/hongguo`、`drpys`、`danmu_api` |
| 分集详情 | `POST /novel/player/multi_video_detail/v1/` | `zhangbaio/hongguo`、`danmu_api` |
| 视频模型 | `POST /novel/player/multi_video_model/v1/` | `zhangbaio/hongguo`、`drpys` |
| 分集详情的预加载版本 | `POST /novel/player/multi_video_detail/preload/v1` | `zhenyong97/hongguo-downloader` |
| 视频模型的预加载版本 | `POST /novel/player/multi_video_model/preload/v1` | `zhenyong97/hongguo-downloader` |
| 官网搜索/详情 | `/search/{keyword}`、`/detail?series_id=...` | `drpys` |

## 建议的下一阶段

1. 以 drpys 自包含源和集中式接口模块交叉核对数据模型，先验证一部剧的搜索和选集。
2. 单独核实视频模型返回内容、播放条件、地址有效期及电视播放器兼容性。源码中有加密流处理，因此不能把“取到 URL”等同于“可以直接交给普通播放器”。
3. 真实播放验证后，再决定接口逻辑放入 Android 客户端还是独立服务，并开始遥控器焦点、选集、续播与竖屏显示设计。
4. 如需复用源码，核对选定文件及其依赖的许可证；未识别许可证的候选暂按研究参考处理。
