import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FlatList, Text, useWindowDimensions, View } from "react-native";
import { Series } from "../../domain/model";
import { Button, Card, Notice, palette } from "../components";
import { restoredIndex } from "./layout";

export type GridPosition = { id?: string; index: number };
export type GridHandle = { top: () => void };
export const TVGrid = forwardRef<
  GridHandle,
  {
    items: Series[];
    width: number;
    position: GridPosition;
    restore: boolean;
    onFocus: () => void;
    onOpen: (item: Series) => void;
    empty: string;
    busy?: boolean;
    error?: string;
    more?: boolean;
    loadMore?: () => void;
  }
>(function TVGrid(
  {
    items,
    width,
    position,
    restore,
    onFocus,
    onOpen,
    empty,
    busy,
    error,
    more,
    loadMore,
  },
  ref
) {
  const { fontScale } = useWindowDimensions();
  const cols = Math.max(2, Math.min(5, Math.floor(width / 160)));
  const cardWidth = width / cols - 12;
  const coverHeight = Math.round((cardWidth - 14) * 1.05);
  const titleHeight = Math.ceil(48 * fontScale);
  const rowHeight = coverHeight + titleHeight + 36;
  const [viewport, setViewport] = useState(rowHeight);
  const list = useRef<FlatList<Series>>(null);
  const initial = useRef(
    restoredIndex(
      items.map((i) => i.id),
      position.id,
      position.index
    )
  ).current;
  const restoring = useRef(restore);
  const focusIndex = useRef(initial);
  const pageStart = useRef<number | undefined>(undefined);
  const nodes = useRef(new Map<string, View>());
  function reveal(index: number) {
    list.current?.scrollToOffset({
      offset: Math.floor(index / cols) * rowHeight,
      animated: false,
    });
  }
  function restoreFocus() {
    if (!restoring.current || !items.length) return;
    reveal(focusIndex.current);
    const node = nodes.current.get(items[focusIndex.current]?.id);
    if (node) {
      node.requestTVFocus();
      restoring.current = false;
    }
  }
  useEffect(() => {
    if (pageStart.current !== undefined && items.length > pageStart.current) {
      focusIndex.current = pageStart.current;
      pageStart.current = undefined;
      restoring.current = true;
      requestAnimationFrame(restoreFocus);
    }
  }, [items.length]);
  useImperativeHandle(ref, () => ({
    top: () => list.current?.scrollToOffset({ offset: 0, animated: false }),
  }));
  return (
    <View
      style={{ flex: 1, overflow: "hidden" }}
      onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
    >
      <FlatList
        ref={list}
        key={cols}
        style={{ height: viewport }}
        data={items}
        numColumns={cols}
        keyExtractor={(item) => item.id}
        removeClippedSubviews={false}
        initialNumToRender={cols * 3}
        windowSize={7}
        initialScrollIndex={
          restore && items.length ? Math.floor(initial / cols) : undefined
        }
        getItemLayout={(_, index) => ({
          index,
          length: rowHeight,
          offset: rowHeight * index,
        })}
        onLayout={(event) => {
          requestAnimationFrame(restoreFocus);
        }}
        onContentSizeChange={() => requestAnimationFrame(restoreFocus)}
        contentContainerStyle={{
          paddingBottom: Math.max(12, viewport - rowHeight),
          flexGrow: 1,
        }}
        renderItem={({ item, index }) => (
          <View style={{ height: rowHeight }}>
            <Card
              ref={(node) => {
                if (node) {
                  nodes.current.set(item.id, node);
                  if (restoring.current && index === focusIndex.current)
                    requestAnimationFrame(restoreFocus);
                } else nodes.current.delete(item.id);
              }}
              item={item}
              width={cardWidth}
              coverHeight={coverHeight}
              titleHeight={titleHeight}
              preferred={restore && index === initial}
              onPress={() => onOpen(item)}
              onFocus={() => {
                position.id = item.id;
                position.index = index;
                onFocus();
                // Native focus scrolling only ensures partial visibility. Align the entire row.
                requestAnimationFrame(() => reveal(index));
              }}
            />
          </View>
        )}
        ListEmptyComponent={
          <Notice
            message={busy ? "正在寻找好故事…" : error || empty}
            busy={busy}
            retry={error ? loadMore : undefined}
          />
        }
        ListFooterComponent={
          items.length && loadMore ? (
            <View style={{ alignItems: "center", padding: 12, gap: 8 }}>
              {!!error && (
                <Text style={{ color: palette.muted, fontSize: 16 }}>
                  {error}
                </Text>
              )}
              <Button
                label={
                  busy
                    ? "正在加载…"
                    : error
                    ? "重试加载"
                    : more
                    ? "加载更多"
                    : "已经到底了"
                }
                onPress={() => {
                  if (busy || (!more && !error)) return;
                  pageStart.current = items.length;
                  loadMore();
                }}
                onFocus={() => {
                  onFocus();
                  list.current?.scrollToEnd({ animated: false });
                }}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
});
