package com.hongguotv.core

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class LatestWriteQueueTest {
    @Test fun `close drains latest values for every partition without caller serialization`() {
        val committed = mutableListOf<Map<String, Int>>()
        val caller = Thread.currentThread()
        var writeThread: Thread? = null
        val queue = LatestWriteQueue<String, Int>("test-library", 60_000, write = {
            writeThread = Thread.currentThread(); committed += it; true
        })
        queue.submit(mapOf("progress" to 1, "favorites" to 5))
        queue.submit(mapOf("progress" to 2))
        queue.close()
        assertTrue(queue.awaitClosed(5, TimeUnit.SECONDS))
        assertEquals(listOf(mapOf("progress" to 2, "favorites" to 5)), committed)
        assertNotSame(caller, writeThread)
    }

    @Test fun `flush executes pending writes before coalescing delay`() {
        val committed = CountDownLatch(1)
        val queue = LatestWriteQueue<String, Int>("test-library", 60_000, write = { committed.countDown(); true })
        queue.submit(mapOf("progress" to 1))
        queue.flush()
        assertTrue(committed.await(5, TimeUnit.SECONDS))
        queue.close()
        assertTrue(queue.awaitClosed(5, TimeUnit.SECONDS))
    }

    @Test fun `failed in flight old checkpoint never replaces newer value during close`() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val committed = mutableListOf<Map<String, Int>>()
        var attempts = 0
        val queue = LatestWriteQueue<String, Int>("test-library", 60_000, write = { values ->
            attempts++
            if (attempts == 1) {
                entered.countDown()
                check(release.await(5, TimeUnit.SECONDS))
                false
            } else { committed += values; true }
        })
        queue.submit(mapOf("progress" to 1, "favorites" to 8))
        queue.flush()
        assertTrue(entered.await(5, TimeUnit.SECONDS))
        queue.submit(mapOf("progress" to 2))
        queue.close()
        release.countDown()
        assertTrue(queue.awaitClosed(5, TimeUnit.SECONDS))
        assertEquals(listOf(mapOf("progress" to 2, "favorites" to 8)), committed)
    }
}
