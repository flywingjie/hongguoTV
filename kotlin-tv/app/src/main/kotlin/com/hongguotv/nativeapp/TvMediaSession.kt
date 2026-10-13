// SPDX-License-Identifier: GPL-3.0-only
package com.hongguotv.nativeapp

import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper

/** Foreground-only session; no background playback service or extra runtime dependency. */
class TvMediaSession(context: Context,onPlay: ()->Unit,onPause: ()->Unit,onSeek: (Long)->Unit,onSkip: (Int)->Unit,onStop: ()->Unit) {
    private val session=MediaSession(context,"HongguoTV").apply {
        setCallback(object: MediaSession.Callback() {
            override fun onPlay()=onPlay.invoke()
            override fun onPause()=onPause.invoke()
            override fun onSeekTo(pos: Long)=onSeek(pos)
            override fun onSkipToNext()=onSkip(1)
            override fun onSkipToPrevious()=onSkip(-1)
            override fun onStop()=onStop.invoke()
        },Handler(Looper.getMainLooper()))
    }
    private var metadataKey=""
    fun update(title: String,episode: Int,duration: Long,position: Long,speed: Float,state: Int,previous: Boolean,next: Boolean) {
        val key="$title/$episode/$duration"
        if(metadataKey!=key) {
            metadataKey=key
            session.setMetadata(MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,title).putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE,title)
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE,"第 ${episode+1} 集")
                .putLong(MediaMetadata.METADATA_KEY_DURATION,duration).build())
        }
        var actions=PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_STOP
        if(duration>0) actions=actions or PlaybackState.ACTION_SEEK_TO
        if(previous) actions=actions or PlaybackState.ACTION_SKIP_TO_PREVIOUS
        if(next) actions=actions or PlaybackState.ACTION_SKIP_TO_NEXT
        session.setPlaybackState(PlaybackState.Builder().setActions(actions).setState(state,position,if(state==PlaybackState.STATE_PLAYING) speed else 0f).build())
        session.isActive=true
    }
    fun deactivate() { session.isActive=false }
    fun release() { session.release() }
}
