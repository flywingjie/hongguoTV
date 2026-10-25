# hongguoTV

非官方红果短剧 Android TV 客户端。本项目现**仅包含 Kotlin 原生独立 APK**（`kotlin-tv/`）：安装后联网即可使用，**无需 Node / Docker / 任何本地 bridge 服务**。面向 Android 电视与盒子，遥控器操作。

> 早期版本中的 React Native 客户端、`server/` Node bridge 服务与 Docker 部署方式已全部移除，统一收敛到这一个原生 APK 工程。

> 本项目派生自上游开源项目 [N3urda/hongguoTV](https://github.com/N3urda/hongguoTV)（源码分支 `codex/kotlin-standalone`），在此基础上收敛为单一 Kotlin 原生 TV 工程，并针对红果官方接口变更持续适配。

## 快速开始

- 功能、自动更新、故障排查等完整说明：见 [`kotlin-tv/README.md`](kotlin-tv/README.md)。
- 构建开发版 APK（需 JDK 17 + Android SDK Platform 36 / Build Tools 36.0.0）：

  ```sh
  ./kotlin-tv/gradlew -p kotlin-tv :core:test :app:assembleDebug
  ```

- 正式签名构建（测试 + lint + release APK，产物在 `outputs/`）：

  ```sh
  bash scripts/build-kotlin.sh
  ```

## 目录结构

| 路径 | 说明 |
|---|---|
| `kotlin-tv/` | Kotlin 原生 Android TV 客户端（Gradle 工程，包名 `com.hongguotv.nativeapp`） |
| `scripts/build-kotlin.sh` | 正式构建脚本 |
| `.github/workflows/kotlin-native.yml` | CI：单元测试、`lintDebug`、可安装开发 APK 构建 |

## 说明

- 与红果官方无关联；内容接口为非官方实现，平台变化可能导致失效。
- 项目按 GPL-3.0 提供，见 [`LICENSE`](LICENSE)；`kotlin-tv/` 子工程另有 [`kotlin-tv/NOTICE.md`](kotlin-tv/NOTICE.md)。
