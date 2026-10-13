# 内容服务 API v1

服务面向家庭网络，原生客户端共享此协议。所有成功 JSON 响应均使用 UTF-8；失败返回非 2xx 和 `{ "error": "可显示的信息" }`。上游失败不会返回空列表伪装成成功。

| 请求 | 返回 |
| --- | --- |
| `GET /health` | `service: hongguotv`、`version`、`apiVersion: 1`、`upstream: unverified`；只检查进程 |
| `GET /api/home?page=1` | `{ items: Series[], page }` |
| `GET /api/search?q=关键词&page=1` | `{ items: Series[], page }` |
| `GET /api/series/:id` | `Series` 加 `episodes: Episode[]` |
| `GET /api/episodes/:id/play?fresh=1` | `{ path, contentType: video/mp4 }`，媒体路径相对当前服务地址；`fresh=1` 强制重新解析 |
| `GET /api/episodes/:id/stream` | MP4 媒体流，支持单区间 Range、后缀区间、HEAD、Content-Length / Content-Range |

`Series` 字段：`id`、`title`、`cover`、`description`、`badge`、`tags`。
`Episode` 字段：`id`、`number`、`title`。ID 始终保留为字符串。

客户端按 `剧集ID + 分集ID + 播放秒数` 保存续播记录，不保存临时媒体 URL。一次播放错误会重新解析一次；仍失败时显示重试入口。

服务开启 `BRIDGE_TOKEN` 时，JSON 和视频请求均要求 `Authorization: Bearer <口令>`，播放器也必须携带该请求头。当前没有浏览器跨域白名单配置，因此 Web 端需额外适配，不能当作已交付。

输入错误使用 400，口令错误使用 401，不存在的路径使用 404，无效媒体范围使用 416，源站失败使用 502。同时媒体请求限制为 4 个，超出使用 503。服务不接受用户指定的任意代理 URL。

媒体代理按 1 MiB 分块处理并遵守客户端背压；对开放区间返回完整请求范围，而不是只返回首个 1 MiB。元数据 / 视频缓存定时清理并限制数量。源站 URL 和签名材料不输出到客户端错误和服务日志。

服务为首版家庭使用实现。进程内存、长时间稳定性、不同编码的设备兼容性、源站自然过期后的行为及公网环境均需另行验证。
