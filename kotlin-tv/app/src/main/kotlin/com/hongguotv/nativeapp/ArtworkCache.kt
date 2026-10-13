// SPDX-License-Identifier: GPL-3.0-only
package com.hongguotv.nativeapp

import java.io.File
import java.security.MessageDigest

/** Public artwork only, bounded to 24 MiB. All calls run on the image workers. */
class ArtworkCache(private val directory: File) {
    private fun file(url: String)=File(directory,MessageDigest.getInstance("SHA-256").digest(url.toByteArray()).joinToString("") { "%02x".format(it) })
    @Synchronized fun get(url: String): ByteArray? = runCatching {
        val f=file(url)
        if(!f.isFile || f.length() !in 1..4*1024*1024 || System.currentTimeMillis()-f.lastModified() !in 0..7*24*60*60*1000L) null else f.readBytes()
    }.getOrNull()
    @Synchronized fun put(url: String,bytes: ByteArray) {
        if(bytes.size>4*1024*1024) return
        runCatching {
            directory.mkdirs(); val dest=file(url); val temp=File(directory,"${dest.name}.tmp")
            temp.writeBytes(bytes); if(!temp.renameTo(dest)) temp.delete()
            val files=directory.listFiles().orEmpty().sortedByDescending { it.lastModified() }
            var size=0L
            files.forEachIndexed { index,f -> size+=f.length(); if(size>24*1024*1024 || index>=100) f.delete() }
        }
    }
}
