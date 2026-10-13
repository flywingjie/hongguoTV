package com.hongguotv.core

import org.junit.Assert.*
import org.junit.Test

class ViewingToolsTest {
    @Test fun `jump validates the exact range without clamping`() {
        assertEquals(0,EpisodeTarget.parse("1",536)); assertEquals(535,EpisodeTarget.parse("536",536))
        for(value in listOf("0","537","-1","1.5","1e2","999999999999999","")) assertNull(value,EpisodeTarget.parse(value,536))
        assertNull(EpisodeTarget.parse("1",0)); assertEquals(103,EpisodeTarget.parse(" 0104 ",536))
    }
    @Test fun `search history is bounded deduplicated and keeps content types distinct`() {
        var rows=emptyList<RecentSearch>()
        repeat(30) { rows=SearchHistory.remember(rows,"词$it",ContentType.COMIC) }
        assertEquals(20,rows.size); assertEquals("词29",rows.first().query)
        rows=SearchHistory.remember(rows," 词15 ",ContentType.COMIC)
        assertEquals("词15",rows.first().query); assertEquals(1,rows.count { it.query=="词15" })
        rows=SearchHistory.remember(rows,"词15",ContentType.SHORT)
        assertEquals(2,rows.count { it.query=="词15" }); assertEquals(ContentType.SHORT,rows.first().type)
        assertEquals(rows,SearchHistory.decode(SearchHistory.encode(rows)))
        assertEquals(rows,SearchHistory.remember(rows," ",ContentType.COMIC))
        assertEquals(rows,SearchHistory.remember(rows,"x".repeat(81),ContentType.COMIC))
    }
    @Test fun `corrupt search history is recoverable and invalid entries are discarded`() {
        assertTrue(SearchHistory.decode("broken json").isEmpty())
        val rows=SearchHistory.decode("""[null,{"query":"","type":"comic"},{"query":"a","type":"unknown"},{"query":"a","type":"comic"},{"query":"a","type":"comic"}]""")
        assertEquals(listOf(RecentSearch("a",ContentType.COMIC)),rows)
    }
}
