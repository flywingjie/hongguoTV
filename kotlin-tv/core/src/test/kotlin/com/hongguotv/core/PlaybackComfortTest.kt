package com.hongguotv.core

import org.junit.Assert.*
import org.junit.Test

class PlaybackComfortTest {
    @Test fun `time limit uses elapsed clock and fires once including paused time`() {
        var now=100L; val timer=SleepTimer { now }
        timer.afterMinutes(15); now+=899999
        assertFalse(timer.poll()); assertEquals("1 分钟后",timer.label())
        now++; assertTrue(timer.poll()); assertFalse(timer.active); assertFalse(timer.poll())
    }
    @Test fun `episode limit only consumes ends and replacing or cancelling disarms it`() {
        var now=0L; val timer=SleepTimer { now }
        timer.afterEpisodes(3); now=1000000
        assertFalse(timer.poll()); assertFalse(timer.episodeEnded()); assertFalse(timer.episodeEnded())
        assertTrue(timer.episodeEnded()); assertFalse(timer.episodeEnded())
        timer.afterEpisodes(5); timer.afterMinutes(1); assertEquals(0,timer.episodesLeft)
        timer.cancel(); now+=60000; assertFalse(timer.poll())
        timer.afterMinutes(1); timer.afterEpisodes(1); now+=60000
        assertFalse(timer.poll()); assertTrue(timer.episodeEnded())
    }
    @Test fun `elapsed timer also wins at episode transition`() {
        var now=0L; val timer=SleepTimer { now }; timer.afterMinutes(1); now=60000
        assertTrue(timer.episodeEnded()); assertFalse(timer.active)
        assertTrue(runCatching { timer.afterMinutes(0) }.isFailure)
        assertTrue(runCatching { timer.afterEpisodes(11) }.isFailure)
        assertEquals(VideoFrameMode.FIT,VideoFrameMode.fromStored("unknown"))
    }
}
