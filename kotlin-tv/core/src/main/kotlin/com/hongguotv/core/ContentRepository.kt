// SPDX-License-Identifier: GPL-3.0-only
package com.hongguotv.core

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import org.json.JSONArray
import java.io.IOException
import java.util.concurrent.TimeUnit

internal fun JSONArray.objects() = (0 until length()).mapNotNull { optJSONObject(it) }
internal fun JSONObject.str(key: String) = if (isNull(key)) "" else optString(key, "").trim()
internal fun cleanUrl(s: String) = s.replace("\\/","/").replace("\\u002F","/",ignoreCase=true).replace("\\u0026","&").replace("&amp;","&")
data class Series(val id: String, val title: String, val cover: String = "", val description: String = "", val badge: String = "", val tags: String = "") {
    fun toJson() = JSONObject().put("id",id).put("title",title).put("cover",cover).put("description",description).put("badge",badge).put("tags",tags)
    companion object { fun fromJson(o: JSONObject) = Series(o.str("id"),o.str("title"),o.str("cover"),o.str("description"),o.str("badge"),o.str("tags")) }
}
data class Detail(val series: Series, val episodes: List<String>)
data class RankPosition(val rank: Int?, val heat: String)
data class ComicRanking(val positions: Map<String,RankPosition>, val totalPages: Int, val updatedText: String)
data class CatalogPage(val items: List<Series>, val hasMore: Boolean, val ranking: ComicRanking? = null)
data class StreamInfo(val url: String, val key: ByteArray?, val quality: String)
class SearchSessionExpiredException: IOException("搜索结果已过期，请从第 1 页重新搜索")

class ContentRepository(val http: OkHttpClient = OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(30,TimeUnit.SECONDS).callTimeout(45,TimeUnit.SECONDS).connectionSpecs(listOf(okhttp3.ConnectionSpec.MODERN_TLS, okhttp3.ConnectionSpec.COMPATIBLE_TLS)).build(), private val clock: () -> Long = System::currentTimeMillis, private val loadIdentity: () -> Pair<String,String>? = { null }, private val saveIdentity: (String, String) -> Unit = { _, _ -> }) {
    private val signer = Signer()
    private val site = "https://hongguoduanju.com"
    // waligora 0.5.9 逆向结论：multi_video_model 取播放地址不再走 X-Gorgon/X-Argus 签名，
    // 只需 version_code=73532 + 随机 19 位 device_id/iid + 正确 host/参数（PlayerRequestProfile 方案）。
    private fun newPlayerId(): String = run { val r=java.security.SecureRandom(); val sb=StringBuilder("1"); repeat(18){ sb.append(r.nextInt(10)) }; sb.toString() }
    // 优先读持久化身份；没有则生成并回存（重启后保持稳定，抗服务端风控）。
    private val playerIdentity: Pair<String,String> by lazy {
        loadIdentity() ?: run { val a=newPlayerId(); val b=newPlayerId(); saveIdentity(a,b); a to b }
    }
    private val playerDeviceId: String get() = playerIdentity.first
    private val playerIid: String get() = playerIdentity.second
    private fun playerModelUrl(): String = "https://api5-normal-sinfonlineb.fqnovel.com/novel/player/multi_video_model/v1/?aid=8662&app_name=novelread&version_code=73532&version_name=7.3.5.32&manifest_version_code=73532&update_version_code=73532&channel=update_64&device_platform=android&os=android&ssmix=a&device_type=25053RT47C&device_brand=Redmi&language=zh&os_api=36&os_version=16&resolution=1280*2772&dpi=520&ac=wifi&device_id=$playerDeviceId&iid=$playerIid"
    private fun playerPost(url: String, body: ByteArray): String {
        val request = Request.Builder().url(url)
            .header("User-Agent", VendorConstants.PLAYER_UA)
            .header("Accept", "application/json")
            .header("x-xs-from-web", "0")
            .header("sdk-version", "2")
            .header("Accept-Encoding", "identity")
            .post(body.toRequestBody("application/json; charset=utf-8".toMediaType()))
        return retryExecute({ http.newCall(request.build()) }) { response ->
            if(!response.isSuccessful) throw IOException("播放接口请求失败（HTTP ${response.code}）")
            val rb=response.body ?: throw IOException("播放接口响应为空")
            String(rb.byteStream().readBytes(), Charsets.UTF_8).also { if(it.isBlank()) throw IOException("播放接口响应为空") }
        }
    }
    private data class SearchCursor(val searchId: String, val passback: String, val offset: Int?, val updatedAt: Long)
    private val searchCursors=linkedMapOf<Triple<ContentType,String,Int>,SearchCursor>()
    private fun retryable(e: IOException): Boolean {
        val m=(e.message?:"unknown").lowercase()
        return m.contains("502")||m.contains("503")||m.contains("504")||m.contains("timeout")||m.contains("timed out")||m.contains("unable to resolve")||m.contains("connection reset")||m.contains("connect failed")||m.contains("failed to connect")
    }
    private fun <T> retryExecute(callFactory: () -> okhttp3.Call, block: (okhttp3.Response) -> T): T {
        var last: IOException? = null
        var i = 0
        while (i < 3) {
            try { return RequestScope.execute(callFactory(), block) }
            catch (e: IOException) {
                last = e
                if (i == 2 || !retryable(e)) throw e
                try { Thread.sleep(400L * (i + 1)) } catch (ie: InterruptedException) { throw e }
                i++
            }
        }
        throw last ?: IOException("请求失败")
    }
    private fun text(url: String, signed: Signer.Request? = null): String {
        val request = Request.Builder().url(url).header("User-Agent",VendorConstants.VIDEO_UA).header("Accept-Language","zh-CN,zh;q=0.9")
        signed?.headers?.forEach { (k,v) -> request.header(k,v) }
        signed?.body?.let { request.post(it.toRequestBody("application/json; charset=utf-8".toMediaType())) }
        return retryExecute({ http.newCall(request.build()) }) { response ->
            if (!response.isSuccessful) throw IOException("内容请求失败（HTTP ${response.code}）")
            val body = response.body ?: throw IOException("内容响应为空")
            if (body.contentLength() > 16*1024*1024) throw IOException("内容响应过大")
            val input=body.byteStream(); val out=java.io.ByteArrayOutputStream(); val buffer=ByteArray(8192)
            while(out.size()<=16*1024*1024) { val n=input.read(buffer); if(n<0) break; out.write(buffer,0,n) }; val bytes=out.toByteArray()
            if(bytes.size > 16*1024*1024) throw IOException("内容响应过大")
            String(bytes,Charsets.UTF_8).also { if(it.length<100) throw IOException("内容响应为空或过短(${it.length})") }
        }
    }
    private fun router(url: String) = extractRouter(text(url)).getJSONObject("loaderData")
    private fun card(item: JSONObject): Series {
        val o=item.optJSONObject("video_data") ?: item
        val count=o.optInt("episode_cnt",o.optJSONObject("series_episode_info")?.optInt("episode_cnt",0) ?: 0)
        val tags=o.optJSONArray("tags") ?: o.optJSONArray("category_list") ?: JSONArray()
        return Series(o.str("series_id"),o.str("series_name").ifEmpty { o.str("series_title").ifEmpty { item.str("name") } },cleanUrl(o.str("series_cover")),o.str("series_intro"),o.str("episode_right_text").ifEmpty { if(count>0) "全 ${count} 集" else "" },(0 until minOf(tags.length(),5)).joinToString(" · ") { tags.optJSONObject(it)?.str("name") ?: tags.optString(it) })
    }
    private fun valid(rows: List<Series>) = rows.filter { it.id.matches(Regex("[0-9]{1,30}")) && it.title.isNotBlank() }.distinctBy { it.id }
    fun warmup() {
        Thread {
            // 预热并把排行榜拉入缓存：首次进入即命中缓存，不用干等慢请求
            runCatching { for(i in 0 until 4){ try { if(comicRanking(1).items.isNotEmpty()) break } catch(_: Exception) {} } }
            // 预热 fqnovel（multi_video_model 首连）
            runCatching {
                for(i in 0 until 6) {
                    try { http.newCall(Request.Builder().url("https://api5-normal-sinfonlineb.fqnovel.com/").header("User-Agent",VendorConstants.PLAYER_UA).build()).execute().use { }; break } catch(_: Exception) {}
                    try { Thread.sleep(700) } catch(_: Exception) {}
                }
            }
        }.start()
    }
    private val rankingCache = linkedMapOf<Int, Pair<Long,CatalogPage>>()
    private var lastReqAt = 0L
    private fun throttle() { val wait=lastReqAt+1200-clock(); if(wait>0) Thread.sleep(wait); lastReqAt=clock() }
    fun comicRanking(page: Int = 1): CatalogPage {
        require(page in 1..100)
        synchronized(rankingCache){ rankingCache[page]?.takeIf { clock()-it.first<600000 } }?.let { return it.second }
        throttle()
        return try {
            ComicRank.parse(text("$site/rank/hot-comic-drama?page=$page"),page).also { r -> synchronized(rankingCache){ rankingCache[page]=clock() to r; if(rankingCache.size>10) rankingCache.remove(rankingCache.keys.first()) } }
        } catch (e: IOException) {
            synchronized(rankingCache){ rankingCache[page]?.second } ?: throw e
        }
    }
    fun home(page: Int = 1, type: ContentType = ContentType.SHORT): CatalogPage {
        require(page in 1..100)
        if(type==ContentType.COMIC) return comicRanking(page)
        val data=router("$site/category?tab=1&sort_type=1"+if(page>1) "&page=$page" else "")
        val section=data.optJSONObject("category_page") ?: data.optJSONObject("category_$") ?: throw IOException("首页数据结构已变化")
        val rows=section.optJSONArray("recommendList") ?: section.optJSONObject("categoryData")?.optJSONArray("recommendList") ?: throw IOException("首页数据暂不可用")
        val items=valid(rows.objects().map(::card))
        val lastPage=section.optJSONObject("pagination")?.optInt("totalPages",100) ?: 100
        return CatalogPage(items,items.isNotEmpty() && page<minOf(lastPage,100))
    }
    // waligora 同款：免签名 novelfm bookmall 搜索 API（快），替代慢的 hongguoduanju 搜索页；失败回退原逻辑
    private fun novelfmSearch(keyword: String, type: ContentType): CatalogPage {
        val tabType = if (type == ContentType.COMIC) 13 else 10
        val body = JSONObject().put("limit", 20).put("offset", 0).put("query", keyword)
            .put("search_ctx_info", "")
            .put("search_entrance", JSONObject().put("type", 1).put("tab_type", 39).put("default_tab_type", 10).put("bottom_type", 1).put("search_tab_id", tabType).toString())
            .put("search_id", "").put("sub_tab_type", 31).put("tab_type", tabType).toString().toByteArray()
        val url = "https://api5-sinfonlinea.novelfm.com/novelfm/bookmall/search/page/v1/?device_platform=android&aid=3040&manifest_version_code=628&update_version_code=62832"
        val text = retryExecute({ http.newCall(Request.Builder().url(url)
            .header("Content-Type", "application/json").header("Accept", "application/json")
            .header("User-Agent", "HongguoTV-MetadataValidation/0.1")
            .post(body.toRequestBody("application/json; charset=utf-8".toMediaType())).build()) }) { response ->
            if (!response.isSuccessful) throw IOException("目录服务暂不可用（HTTP ${response.code}）")
            val s = response.body?.string() ?: throw IOException("目录响应为空")
            if (s.isBlank()) throw IOException("目录响应为空")
            s
        }
        val data = JSONObject(text)
        if (data.optInt("code", -1) != 0) throw IOException("目录服务暂无结果")
        val searchData = data.optJSONObject("data")?.optJSONArray("search_data") ?: throw IOException("目录数据不完整")
        val out = mutableListOf<Series>()
        collectBooks(searchData, out, mutableSetOf())
        return CatalogPage(valid(out), false)
    }
    private fun collectBooks(node: Any?, out: MutableList<Series>, seen: MutableSet<String>, depth: Int = 0) {
        if (node == null || depth > 16) return
        when (node) {
            is JSONObject -> {
                if (node.has("book_id") && node.has("book_name")) {
                    val id = node.optString("book_id"); val name = node.optString("book_name")
                    if (id.matches(Regex("[0-9]{8,24}")) && name.isNotBlank() && seen.add(id)) {
                        val count = (node.opt("chapter_number")?.takeIf { it != JSONObject.NULL }?.toString()?.takeIf { it.isNotEmpty() }) ?: node.opt("serial_count")?.toString()?.takeIf { it.isNotEmpty() } ?: "0"
                        val intro = node.optString("abstract", "")
                        val cover = cleanUrl(node.optString("thumb_url", node.optString("thumb_pic", "")))
                        out.add(Series(id, name, cover, intro, if (count != "0" && count.isNotEmpty()) "全 $count 集" else "", node.optString("tags", "").take(300)))
                    }
                } else node.keys().forEach { k -> collectBooks(node.opt(k), out, seen, depth + 1) }
            }
            is JSONArray -> for (i in 0 until node.length()) collectBooks(node.opt(i), out, seen, depth + 1)
        }
    }
    fun search(keyword: String, page: Int = 1, type: ContentType = ContentType.SHORT): CatalogPage {
        require(keyword.isNotBlank() && keyword.length<=80 && page in 1..100)
        // The website search does not constrain content type. Never use it for comics.
        if(page==1) { try { return novelfmSearch(keyword, type) } catch(_: Exception) {} }
        if(type==ContentType.COMIC) return appSearch(keyword,page,type)
        try { val result=appSearch(keyword,page,type); if(result.items.isNotEmpty() || !result.hasMore) return result } catch (e: Exception) { if(e is SearchSessionExpiredException) throw e; /* Website fallback for short dramas only. */ }
        val data=router("$site/search/${Signer.encode(keyword)}?page=$page")
        val section=data.optJSONObject("search_(keyword)/page") ?: data.optJSONObject("search_page") ?: throw IOException("搜索数据暂不可用")
        val rows=section.optJSONArray("searchList") ?: throw IOException("搜索数据结构已变化")
        val items=valid(rows.objects().map(::card))
        return CatalogPage(items,items.isNotEmpty() && page<100)
    }
    private fun appSearch(keyword: String, page: Int, type: ContentType): CatalogPage {
        val values=VendorConstants.device.toMutableMap()
        for(k in listOf("version_code","manifest_version_code","update_version_code","pv_player")) values[k]="72232"
        values["version_name"]="7.2.2.32"
        values.putAll(linkedMapOf("query" to keyword,"count" to "20","offset" to ((page-1)*20).toString(),"tab_type" to type.searchTab.toString(),"bookshelf_search_plan" to "4","use_correct" to "true","user_is_login" to "0"))
        val cursor=synchronized(searchCursors) {
            val now=clock()
            searchCursors.entries.removeAll { now-it.value.updatedAt>300000 || (page==1 && it.key.first==type && it.key.second==keyword) }
            searchCursors[Triple(type,keyword,page-1)]
        }
        if(type==ContentType.COMIC && page>1 && cursor==null) throw SearchSessionExpiredException()
        cursor?.let {
            if(it.searchId.isNotBlank()) values["search_id"]=it.searchId
            if(it.passback.isNotBlank()) values["passback"]=it.passback
            it.offset?.takeIf { offset -> offset>=0 }?.let { offset -> values["offset"]=offset.toString() }
        }
        val signed=signer.sign("https://api5-normal-sinfonlinea.fqnovel.com/reading/bookapi/search/tab/v",values)
        val data=JSONObject(text(signed.url,signed))
        if(data.optInt("code",-1)!=0) throw IOException("搜索接口暂不可用")
        val tabs=data.optJSONArray("search_tabs") ?: data.optJSONObject("data")?.optJSONArray("search_tabs") ?: throw IOException("搜索格式异常")
        val tab=tabs.objects().firstOrNull { it.optInt("tab_type")==type.searchTab } ?: throw IOException("${type.label}搜索暂不可用")
        val list=mutableListOf<Series>()
        for(cell in (tab.optJSONArray("data") ?: JSONArray()).objects()) {
            val cells=mutableListOf(cell)
            runCatching { JSONObject(cell.str("lynx_data")).optJSONArray("cell_data")?.objects() }.getOrNull()?.let { cells.addAll(it) }
            for(row in cells) {
                val video=row.optJSONArray("video_data")?.objects()?.firstOrNull() ?: continue
                val id=video.str("series_id").ifEmpty { row.str("book_id").ifEmpty { row.str("search_result_id") } }
                val title=row.optJSONObject("search_high_light")?.optJSONObject("title")?.str("text").orEmpty().ifEmpty { video.str("title").ifEmpty { row.str("cell_name") } }
                val count=video.optInt("episode_cnt")
                list+=Series(id,title,cleanUrl(video.str("cover").ifEmpty { video.str("cover_url") }),video.str("video_desc"),if(count>0) "全 $count 集" else video.str("rec_text"),video.str("sub_title"))
            }
        }
        synchronized(searchCursors) {
            searchCursors[Triple(type,keyword,page)]=SearchCursor(tab.str("search_id"),tab.str("passback"),tab.str("next_offset").toIntOrNull(),clock())
            while(searchCursors.size>100) searchCursors.remove(searchCursors.keys.first())
        }
        return CatalogPage(valid(list),tab.optBoolean("has_more",false) && page<100)
    }
    fun detail(id: String): Detail {
        require(id.matches(Regex("[0-9]{1,30}")))
        val o=router("$site/detail?series_id=$id").optJSONObject("detail_page")?.optJSONObject("seriesDetail") ?: throw IOException("剧集详情暂不可用")
        val raw=o.optJSONArray("vid_list") ?: throw IOException("分集暂不可用")
        val episodes=(0 until raw.length()).map { raw.getString(it) }
        if(episodes.isEmpty() || episodes.any { !it.matches(Regex("[0-9]{1,30}")) } || episodes.distinct().size!=episodes.size) throw IOException("分集数据异常")
        return Detail(card(o).copy(id=id),episodes)
    }
    fun stream(id: String, maxQuality: Int = 1080): StreamInfo {
        require(id.matches(Regex("[0-9]{1,30}")))
        val payload="""{"biz_param":{"detail_page_version":0,"device_level":3,"disable_digg_stat":false,"need_all_video_definition":true,"need_mp4_align":false,"use_os_player":false,"use_server_dns":false,"video_platform":1024},"mixed_video_id_map":{"1":["$id"]}}""".toByteArray()
        val data=JSONObject(playerPost(playerModelUrl(),payload))
        val code=data.optInt("Code",data.optInt("code",0))
        if(code!=0) throw IOException("播放接口暂不可用（code=$code）")
        val map=data.optJSONObject("data") ?: throw IOException("播放信息为空")
        val entry=map.optJSONObject(id) ?: map.keys().asSequence().mapNotNull { map.optJSONObject(it) }.firstOrNull() ?: throw IOException("播放信息为空")
        val model=entry.optJSONObject("video_model") ?: JSONObject(entry.str("video_model"))
        val raw=model.opt("fallback_api")
        val fallback=when(raw) { is JSONObject -> raw.str("fallback_api"); is JSONArray -> raw.optString(0); else -> runCatching { JSONObject(raw.toString()).str("fallback_api") }.getOrDefault(raw.toString()) }
        if(!fallback.startsWith("https://")) throw IOException("播放地址格式异常")
        val info=JSONObject(text(fallback)).optJSONObject("video_info")?.optJSONObject("data") ?: throw IOException("没有播放资源")
        val videoList=info.optJSONObject("video_list") ?: throw IOException("没有可用清晰度")
        // ByteVC2 resources can expose playable audio but no video track in Android's MP4 extractor.
        // Keep missing legacy codec labels usable, but never select a known incompatible variant.
        val rows=videoList.keys().asSequence().mapNotNull { k -> videoList.optJSONObject(k)?.let { k to it } }.filter {
            it.second.str("main_url").isNotEmpty() && it.second.str("codec_type").lowercase() !in setOf("bytevc2","bvc2")
        }.map { (k,o) -> Triple(qualityNumber(o.str("quality_desc").ifEmpty { o.str("height").ifEmpty { o.str("vheight").ifEmpty { o.str("quality").ifEmpty { k } } } }),k,o) }.sortedByDescending { it.first }.toList()
        val selected=rows.firstOrNull { it.first<=maxQuality } ?: rows.lastOrNull() ?: throw IOException("没有电视可播放的清晰度，请稍后再试或选择其他剧集")
        val item=selected.third; var url=cleanUrl(item.str("main_url")); val seed=info.str("key_seed")
        if(seed.isNotEmpty()) url=MediaCrypto.decryptUrl(url,decode64(seed))
        if(!url.startsWith("https://") && !url.startsWith("http://")) throw IOException("播放地址无效")
        val key=item.str("spade_a").takeIf { it.isNotEmpty() }?.let(MediaCrypto::deriveKey)
        val quality=if(selected.first>0) "${selected.first}P"+(if(selected.first>maxQuality) "（兼容资源）" else "") else "自动"
        return StreamInfo(url,key,quality)
    }
    companion object {
        fun extractRouter(html: String): JSONObject {
            val marker=html.indexOf("_ROUTER_DATA"); if(marker<0) throw IOException("页面没有内容数据")
            val first=html.indexOf('{',marker); if(first<0) throw IOException("页面数据格式错误")
            var depth=0; var quoted=false; var escaped=false
            for(i in first until html.length) {
                val ch=html[i]
                if(quoted) { if(escaped) escaped=false else if(ch=='\\') escaped=true else if(ch=='"') quoted=false; continue }
                when(ch) { '"' -> quoted=true; '{','[' -> depth++; '}',']' -> { depth--; if(depth==0) return JSONObject(html.substring(first,i+1)) } }
            }
            throw IOException("页面数据不完整")
        }
        fun qualityNumber(value: String): Int = Regex("2160|1440|1080|720|576|540|480|360").find(value)?.value?.toInt() ?: mapOf("1920" to 1080,"1280" to 720,"1024" to 576,"854" to 480,"640" to 360)[value] ?: value.toIntOrNull() ?: 0
    }
}
