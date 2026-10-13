# hongguoTV 0.1.0 首版交付

交付日期：2026-09-21。用途：自家电视侧载安装。客户端采用 React Native TV + TypeScript，内容服务独立部署，后续平台可复用业务模型和服务协议。

## 交付文件

| 文件 | 用途 |
| --- | --- |
| `outputs/hongguotv-0.1.0-android8.apk` | 已签名 Android 安装包，约 26 MiB，内含 JS，不需要 Metro |
| `outputs/hongguotv-0.1.0-source.zip` | 客户端、独立服务、锁文件、测试、构建脚本、文档及第三方许可 |
| `outputs/hongguotv-0.1.0-evidence.zip` | 验证结果、构建日志、APK 信息和模拟器截图 |
| `outputs/hongguotv-0.1.0-docker.zip` | 独立服务源码、Dockerfile、两种 Compose、示例环境变量及部署说明 |
| `outputs/SHA256SUMS` | 交付文件的 SHA-256 校验值 |

下载入口：[GitHub v0.1.0 Release](https://github.com/N3urda/hongguoTV/releases/tag/v0.1.0)。使用电脑或 NAS 容器部署时，直接参阅 [Docker 部署指南](DOCKER.md)。

应用标识为 `com.hongguotv`，版本名 `0.1.0`，版本号 `1`。包内包含 `armeabi-v7a` 和 `arm64-v8a`，最低系统为 Android 8.0 / API 26，targetSdk 为 36。首版使用开发密钥签名，面向个人安装；密钥不随源码包分发。请保留本机 `android/app/debug.keystore`，后续覆盖升级需使用相同密钥。卸载应用会清除本地收藏与观看记录。

## 开始使用

准备一台与电视在同一网络的电脑或 NAS，安装 Node.js 22 或更新版本。解压源码包，在源码目录执行：

```sh
npm ci --prefix server
node server/index.mjs --lan
```

保持终端和设备运行；观看时电脑不能休眠。启动日志会列出局域网地址，通常形如 `http://192.168.1.10:8787`。如有防火墙，允许家庭网络访问该设备的 TCP 8787。

将 APK 通过 U 盘或电视支持的安装方式侧载；已连接 ADB 的设备也可执行：

```sh
adb install -r outputs/hongguotv-0.1.0-android8.apk
```

打开电视上的「红果 TV」，进入「设置」，填入服务地址，选择「连接并保存」。电视中的 `127.0.0.1` 指向电视自身，不能用它访问电脑。若服务配置了 `BRIDGE_TOKEN`，电视中同时填入该口令。Node 不会自动读取 `.env`，环境变量应由 shell 或部署工具传入。

首版需要这个独立服务：内容接入和视频分段处理在 Node 运行，视频流量也经过服务设备。默认监听本机，`--lan` 才开放家庭网络；本版未交付公网访问方案。

## 遥控器与功能

- 推荐、搜索、收藏、最近观看、设置五个入口；支持分页和完整分集选择。
- 方向键移动焦点，确定键执行，返回键退出播放或返回列表。
- 播放保持原比例，竖屏内容两侧留黑；支持暂停、前后跳转 10 秒、上下集和播完自动下一集。
- 播放控制栏空闲约 5 秒后隐藏，按确定或方向键唤出；暂停时保持显示。独立播放 / 暂停键也可使用。
- 收藏和观看记录保存在当前设备；继续观看按分集 ID 恢复位置，不保存会过期的媒体地址。
- 加载失败显示错误；播放器会自动重新解析一次，仍失败时可手动重试。

## 本次验证结果

| 检查 | 结果与证据 |
| --- | --- |
| TypeScript | `npm run typecheck` 通过，见 `outputs/typecheck.log` |
| 自动化测试 | 9 项通过、0 失败；覆盖续播、分页合并、地址校验、媒体范围、多分块输出、鉴权、失败脱敏及并发槽释放，见 `outputs/tests.log` |
| 原生构建 | `assembleRelease` 成功，见 `outputs/build.log` |
| Docker | GitHub Actions 的 AMD64 / ARM64 构建、非 root 容器启动、健康检查、端口映射与鉴权均通过；ARM64 使用 QEMU，见 [运行记录](https://github.com/N3urda/hongguoTV/actions/runs/35563476910) |
| APK | `aapt` 确认 minSdk 26、双 ARM 架构；`apksigner verify` 通过 v2 签名，见 `outputs/apk-info.txt`、`outputs/apk-signature.txt` |
| 真实内容 | 17 项探测通过：首页 24 部；3 部搜索均匹配目标 ID；分集数 86、85、71，均无重复；每部首、中、末集共 9 个 64 KiB 媒体片段均为 206 且 MP4 头有效，见 `outputs/probe.json` |
| 真实解码 | 第一部首集前 10 秒 FFmpeg 解码成功；样本为 HEVC 1080×1920 + AAC，时长 98.1 秒，见 `outputs/media-format.json` |
| Android TV 模拟器 | API 36 ARM64、1920×1080；release APK 安装启动、服务设置、列表与搜索、方向键焦点、详情、收藏、真实视频、暂停、跳转、切集、控制栏隐藏与确定键唤出均已操作验证 |
| 自动下一集 | 第 3 集结束后自动进入第 4 集，观察到第 4 集正常播放至 32 秒，见 `outputs/tv-auto-next.png` |
| 持久化与续播 | 强制停止再启动后收藏仍存在；第 3 集从保存的约 14 秒位置恢复，随后在 17 秒暂停；同签名覆盖安装后设置和记录仍保留，见 `outputs/tv-resume.png` |

接口探测时间为 2026-09-21 11:48（北京时间）；验证使用 macOS、Node 25.8.1、JDK 17 和 Android SDK 36。截图为应用实际运行画面，见证据包。模拟器使用静音启动，未做扬声器声音听测。

## 仍需目标环境验收

- **实际 Android 8.0 电视尚未连接**。API 26 安装下限已写入 APK，但实际电视的硬件解码、遥控器差异、性能和声音仍需确认；32 位 ARM 包已构建，未在 32 位设备运行。
- 连续观看至少 3 集、长时间运行、家庭 Wi-Fi 波动、休眠唤醒、自然过期地址和断网恢复还需在目标电视测试。媒体片段探测不能替代整集观看验收。
- Docker 的 AMD64 / ARM64 构建和容器启动检查已通过，用户实际 NAS 的网络、真实内容与长期运行仍需验收。
- Apple TV 仅有工程骨架，未构建；iOS、移动端和 Web 未交付。业务与服务已分层，新增平台仍需各自适配和验收。
- 内容接入依赖固定提交的第三方非官方实现。本次样本成功不保证平台后续接口持续兼容。

建议接下来直接在目标电视完成「安装 → 连接服务 → 搜索 → 连播 3 集 → 返回续播 → 重启保留收藏」这一轮验收，再决定部署到常开的 NAS 或继续开发第二个平台。

## 源码与复现

源码包不包含 `node_modules`、Android 构建缓存、机器 SDK 路径或签名密钥。开发时在源码根目录运行 `npm ci`、`npm run typecheck`、`npm test`。构建需 JDK 17、Android SDK 36、Build Tools 36.0.0、NDK 27.1.12297006，设置 `JAVA_HOME`、`ANDROID_HOME` 后运行 `npm run build:android`；缺失的开发签名由脚本生成。

React Native TV 已锁定为 `0.81.5-2`，启用新架构；播放器为 `react-native-video 6.19.3`。`.npmrc` 的 `legacy-peer-deps=true` 用于兼容 RN TV 预发布版本号与第三方包的 peer 版本范围，依赖安装由锁文件固定。

代码许可及第三方来源见根目录 `LICENSE` 和 `server/vendor/NOTICE.md`。源代码发布到 [GitHub 仓库](https://github.com/N3urda/hongguoTV)，APK 和交付文件作为 Release 附件提供；安装包和签名密钥不进入 Git 历史。
