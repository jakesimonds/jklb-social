import { useState, useCallback, memo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import type { Post, PostImage, PostVideo, PostExternal, QuotedPost } from '../lib/types';
import { isTenorEmbed, getTenorVideo, extractDomain } from '../lib/post-utils';
import { FullscreenImageViewer } from './FullscreenImageViewer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_MAX_HEIGHT = 250;

interface PostCardProps {
  post: Post;
  compact?: boolean;
}

// --- Image Grid ---

function ImageGrid({ images, onImagePress }: { images: PostImage[]; onImagePress?: (index: number) => void }) {
  if (images.length === 1) {
    const img = images[0];
    const ar = img.aspectRatio;
    const displayWidth = SCREEN_WIDTH - 64; // card padding
    const displayHeight = ar
      ? Math.min((displayWidth / ar.width) * ar.height, IMAGE_MAX_HEIGHT)
      : IMAGE_MAX_HEIGHT;

    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => onImagePress?.(0)}>
        <Image
          source={{ uri: img.fullsize || img.thumb }}
          style={[imgStyles.single, { height: displayHeight }]}
          contentFit="contain"
          accessibilityLabel={img.alt || 'Post image'}
          transition={200}
        />
      </TouchableOpacity>
    );
  }

  // Multi-image: 2x2 grid (max 4 shown)
  const displayed = images.slice(0, 4);
  return (
    <View style={imgStyles.grid}>
      {displayed.map((img, i) => (
        <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => onImagePress?.(i)}>
          <Image
            source={{ uri: img.thumb || img.fullsize }}
            style={imgStyles.gridCell}
            contentFit="cover"
            accessibilityLabel={img.alt || `Image ${i + 1}`}
            transition={200}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const imgStyles = StyleSheet.create({
  single: {
    width: '100%',
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  gridCell: {
    width: (SCREEN_WIDTH - 64 - 4) / 2,
    height: 120,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});

// --- Video Player ---

function VideoEmbed({ video }: { video: PostVideo }) {
  const [isMuted, setIsMuted] = useState(true);
  const ar = video.aspectRatio;
  const displayWidth = SCREEN_WIDTH - 64;
  const displayHeight = ar
    ? Math.min((displayWidth / ar.width) * ar.height, IMAGE_MAX_HEIGHT)
    : IMAGE_MAX_HEIGHT;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => setIsMuted(!isMuted)}
      style={[vidStyles.container, { height: displayHeight }]}
    >
      <Video
        source={{ uri: video.playlist }}
        posterSource={video.thumbnail ? { uri: video.thumbnail } : undefined}
        usePoster={!!video.thumbnail}
        style={vidStyles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping
        isMuted={isMuted}
      />
      {isMuted && (
        <View style={vidStyles.muteIndicator}>
          <Text style={vidStyles.muteText}>🔇</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const vidStyles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  muteIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  muteText: {
    fontSize: 14,
  },
});

// --- Link Preview ---

function LinkPreviewCard({ external }: { external: PostExternal }) {
  const handlePress = useCallback(() => {
    if (external.uri) {
      Linking.openURL(external.uri);
    }
  }, [external.uri]);

  return (
    <TouchableOpacity onPress={handlePress} style={linkStyles.container} activeOpacity={0.7}>
      {external.thumb && (
        <Image
          source={{ uri: external.thumb }}
          style={linkStyles.thumb}
          contentFit="cover"
          transition={200}
        />
      )}
      <View style={linkStyles.info}>
        <Text style={linkStyles.title} numberOfLines={2}>
          {external.title || extractDomain(external.uri)}
        </Text>
        <Text style={linkStyles.domain} numberOfLines={1}>
          {extractDomain(external.uri)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const linkStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  thumb: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  title: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  domain: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
});

// --- Quoted Post ---

function QuotedPostCard({ quote }: { quote: QuotedPost }) {
  return (
    <View style={quoteStyles.container}>
      {/* Author row */}
      <View style={quoteStyles.authorRow}>
        {quote.author.avatar ? (
          <Image
            source={{ uri: quote.author.avatar }}
            style={quoteStyles.avatar}
            transition={200}
          />
        ) : (
          <View style={quoteStyles.avatarPlaceholder}>
            <Text style={quoteStyles.avatarLetter}>
              {quote.author.handle.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={quoteStyles.authorName} numberOfLines={1}>
          {quote.author.displayName || quote.author.handle}
        </Text>
        <Text style={quoteStyles.authorHandle} numberOfLines={1}>
          @{quote.author.handle}
        </Text>
      </View>

      {/* Text */}
      {quote.text ? (
        <Text style={quoteStyles.text}>{quote.text}</Text>
      ) : null}

      {/* Quoted post media */}
      {quote.images && quote.images.length > 0 && (
        <ImageGrid images={quote.images} />
      )}
      {quote.video && <VideoEmbed video={quote.video} />}
      {quote.external && !quote.images?.length && !quote.video && (
        <LinkPreviewCard external={quote.external} />
      )}
    </View>
  );
}

const quoteStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  avatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
  authorName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  authorHandle: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    flexShrink: 1,
  },
  text: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 18,
  },
});

// --- PostCard ---

export const PostCard = memo(function PostCard({ post, compact }: PostCardProps) {
  const [fullscreenImage, setFullscreenImage] = useState<{ images: PostImage[]; index: number } | null>(null);

  if (compact) {
    return (
      <View style={compactStyles.container}>
        {post.author.avatar ? (
          <Image source={{ uri: post.author.avatar }} style={compactStyles.avatar} transition={200} />
        ) : (
          <View style={compactStyles.avatarPlaceholder}>
            <Text style={compactStyles.avatarLetter}>{post.author.handle.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={compactStyles.info}>
          <View style={compactStyles.nameRow}>
            <Text style={compactStyles.displayName} numberOfLines={1}>
              {post.author.displayName || post.author.handle}
            </Text>
            <Text style={compactStyles.handle} numberOfLines={1}>@{post.author.handle}</Text>
          </View>
          {post.text ? (
            <Text style={compactStyles.text} numberOfLines={1}>{post.text}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  const embed = post.embed;
  const images = embed?.images;
  const video = embed?.video;
  const external = embed?.external;
  const quotedPost = embed?.record;

  const isTenor = external ? isTenorEmbed(external) : false;
  const tenorVideo = isTenor && external ? getTenorVideo(external) : null;

  const hasImages = images && images.length > 0;
  const hasVideo = video !== undefined;
  const showLinkPreview = external && !isTenor && !hasImages && !hasVideo;

  return (
    <View style={styles.card}>
      {/* Repost indicator */}
      {post.repostReason && (
        <View style={styles.repostRow}>
          <Text style={styles.repostIndicator}>
            reposted by {post.repostReason.by.displayName || post.repostReason.by.handle}
          </Text>
        </View>
      )}

      {/* Reply indicator */}
      {post.replyParent && (
        <View style={styles.replyRow}>
          <Text style={styles.replyIndicator}>
            ↩ Reply to @{post.replyParent.author.handle}
          </Text>
        </View>
      )}

      {/* Scrollable content area */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {post.text ? (
          <Text style={styles.postText}>{post.text}</Text>
        ) : null}

        {/* Tenor GIF (rendered as video) */}
        {tenorVideo && (
          <VideoEmbed
            video={{
              playlist: tenorVideo.playlist,
              thumbnail: tenorVideo.thumbnail,
              aspectRatio: tenorVideo.aspectRatio,
            }}
          />
        )}

        {/* Native video */}
        {!tenorVideo && hasVideo && video && <VideoEmbed video={video} />}

        {/* Images */}
        {!tenorVideo && hasImages && images && (
          <ImageGrid
            images={images}
            onImagePress={(index) => setFullscreenImage({ images, index })}
          />
        )}

        {/* Link preview (only if no media/tenor) */}
        {showLinkPreview && external && <LinkPreviewCard external={external} />}

        {/* Quoted post */}
        {quotedPost && <QuotedPostCard quote={quotedPost} />}
      </ScrollView>

      {/* Fullscreen image viewer */}
      {fullscreenImage && (
        <FullscreenImageViewer
          images={fullscreenImage.images}
          initialIndex={fullscreenImage.index}
          onClose={() => setFullscreenImage(null)}
        />
      )}
    </View>
  );
});

const compactStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    height: 72,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  handle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    flexShrink: 1,
  },
  text: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
});

const COLORS = {
  navy: '#1a1a2e',
  bg: '#16213e',
  pink: '#e94560',
  cyan: '#0f9b8e',
  yellow: '#f5c542',
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  repostRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  repostIndicator: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontStyle: 'italic',
  },
  replyRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  replyIndicator: {
    fontSize: 12,
    color: COLORS.cyan,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  contentInner: {
    paddingBottom: 16,
  },
  postText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    lineHeight: 24,
  },
});
