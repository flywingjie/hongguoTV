package com.hongguotv.core

import org.junit.Assert.*
import org.junit.Test
import java.util.Locale

class PlaybackSpeedTest {
    @Test fun invalidSavedSpeedsResetToNormal() {
        for(value in listOf(Float.NaN,Float.POSITIVE_INFINITY,0f,-1f,3f)) {
            assertEquals(1f,PlaybackSpeed.normalize(value))
        }
        assertEquals(1.5f,PlaybackSpeed.normalize(1.5f))
    }

    @Test fun labelsRemainReadableAcrossDeviceLocales() {
        val original=Locale.getDefault()
        try {
            Locale.setDefault(Locale.GERMANY)
            assertEquals("1×",PlaybackSpeed.label(1f))
            assertEquals("1.25×",PlaybackSpeed.label(1.25f))
        } finally { Locale.setDefault(original) }
    }

    @Test fun missingOrUnknownContentPreferenceDefaultsToComic() {
        assertEquals(ContentType.COMIC,ContentType.fromStored(null))
        assertEquals(ContentType.COMIC,ContentType.fromStored("unknown"))
        assertEquals(ContentType.SHORT,ContentType.fromStored("short"))
    }
}
