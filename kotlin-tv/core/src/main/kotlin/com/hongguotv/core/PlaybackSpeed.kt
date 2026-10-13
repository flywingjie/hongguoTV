// SPDX-License-Identifier: GPL-3.0-only
package com.hongguotv.core

object PlaybackSpeed {
    val options = listOf(0.75f,1f,1.25f,1.5f,1.75f,2f)
    fun normalize(value: Float) = value.takeIf { it in options } ?: 1f
    fun label(value: Float) = value.toString().removeSuffix(".0")+"×"
}
