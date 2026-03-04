// ProfileHeader — Cover photo (banner) + square profile pic + author info
// Banner fills the entire header as a background. Avatar is square (jklb style, never circle).

import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Avatar size — square, roughly 1/4 of screen width
const AVATAR_SIZE = Math.round(SCREEN_WIDTH / 4);

interface ProfileHeaderProps {
  bannerUri?: string;
  avatarUri?: string;
  displayName?: string;
  handle: string;
}

export function ProfileHeader({ bannerUri, avatarUri, displayName, handle }: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Banner — fills entire container as background */}
      {bannerUri ? (
        <Image
          source={{ uri: bannerUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.bannerFallback]} />
      )}

      {/* Profile picture — SQUARE, centered */}
      <View style={styles.avatarWrapper}>
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]} />
        )}
      </View>

      {/* Author info — displayName + handle */}
      <View style={styles.authorRow}>
        {displayName ? (
          <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
        ) : null}
        <Text style={styles.handle} numberOfLines={1}>@{handle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  bannerFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  avatarWrapper: {
    borderWidth: 2,
    borderColor: '#1a1a2e',
    overflow: 'hidden',
    // SQUARE — no borderRadius
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    // SQUARE — no borderRadius
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 4,
  },
  displayName: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  handle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    flexShrink: 1,
  },
});
