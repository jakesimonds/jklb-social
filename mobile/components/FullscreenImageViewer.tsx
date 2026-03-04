import { useState, useCallback, useRef } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity, Pressable,
  Dimensions, FlatList, ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import type { PostImage } from '../lib/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FullscreenImageViewerProps {
  images: PostImage[];
  initialIndex: number;
  onClose: () => void;
}

export function FullscreenImageViewer({ images, initialIndex, onClose }: FullscreenImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderImage = useCallback(({ item }: { item: PostImage }) => (
    <Pressable style={fStyles.imagePage} onPress={onClose}>
      <Image
        source={{ uri: item.fullsize || item.thumb }}
        style={fStyles.fullImage}
        contentFit="contain"
        transition={200}
        accessibilityLabel={item.alt || 'Fullscreen image'}
      />
    </Pressable>
  ), [onClose]);

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  }), []);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={fStyles.overlay}>
        {/* Header: close button + counter */}
        <View style={fStyles.header}>
          <TouchableOpacity onPress={onClose} style={fStyles.closeButton} hitSlop={12}>
            <Text style={fStyles.closeText}>✕</Text>
          </TouchableOpacity>
          {images.length > 1 && (
            <Text style={fStyles.counter}>
              {currentIndex + 1} / {images.length}
            </Text>
          )}
        </View>

        {/* Image carousel */}
        <FlatList
          ref={flatListRef}
          data={images}
          renderItem={renderImage}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />

        {/* Dot indicators */}
        {images.length > 1 && (
          <View style={fStyles.dots}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[fStyles.dot, i === currentIndex && fStyles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const fStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  counter: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  imagePage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 160, // Leave room for header + dots
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: 'white',
  },
});
