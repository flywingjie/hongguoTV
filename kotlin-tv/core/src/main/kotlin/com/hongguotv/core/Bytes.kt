// SPDX-License-Identifier: GPL-3.0-only
package com.hongguotv.core

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.bouncycastle.crypto.digests.SM3Digest

internal fun Byte.u() = toInt() and 255
internal fun hex(value: String): ByteArray {
    require(value.length % 2 == 0)
    return ByteArray(value.length / 2) { value.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
}
internal fun ByteArray.hex() = joinToString("") { "%02x".format(it.u()) }
internal fun decode64(s: String): ByteArray = Base64.getDecoder().decode(s.replace('-', '+').replace('_', '/'))
internal fun ByteArray.base64(): String = Base64.getEncoder().encodeToString(this)
internal fun le32(n: Int) = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(n).array()
internal fun be32(n: Int) = ByteBuffer.allocate(4).putInt(n).array()
internal fun le64(n: Long) = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putLong(n).array()
internal fun ByteArray.i32(at: Int, little: Boolean = false) = ByteBuffer.wrap(this, at, 4).order(if (little) ByteOrder.LITTLE_ENDIAN else ByteOrder.BIG_ENDIAN).int
internal fun ByteArray.u32(at: Int) = i32(at).toLong() and 0xffffffffL
internal fun ByteArray.i64(at: Int, little: Boolean = false) = ByteBuffer.wrap(this, at, 8).order(if (little) ByteOrder.LITTLE_ENDIAN else ByteOrder.BIG_ENDIAN).long
internal fun digest(algorithm: String, value: ByteArray): ByteArray = MessageDigest.getInstance(algorithm).digest(value)
internal fun sm3(value: ByteArray): ByteArray = SM3Digest().let { d -> d.update(value, 0, value.size); ByteArray(32).also { d.doFinal(it, 0) } }
internal fun aes(mode: String, key: ByteArray, iv: ByteArray, data: ByteArray): ByteArray = Cipher.getInstance("AES/$mode/NoPadding").run {
    init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv)); doFinal(data)
}
internal fun xor(a: ByteArray, b: ByteArray) = ByteArray(a.size) { (a[it].u() xor b[it % b.size].u()).toByte() }
internal fun rol(v: Int, n: Int) = Integer.rotateLeft(v, n)
internal fun ror(v: Int, n: Int) = Integer.rotateRight(v, n)
