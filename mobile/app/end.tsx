// End screen — photo capture + caption + share flow
// Opens camera on mount, shows post screen after photo is taken
// Posts to jklb.social community account via CF function, optionally cross-posts to personal

import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/AuthContext';
import { postToCommunity } from '../lib/community';
import { clearCameraActive } from './index';
let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  // Native module not available in this dev build
}


const CAPTIONS = [
  'Look where I am',
  'Look at this',
  'Check this out',
  'Felt cute',
] as const;

type ShareTarget = 'community' | 'both';

export default function EndScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, agent } = useAuth();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);
  const [caption, setCaption] = useState<string>(CAPTIONS[0]);
  const [showCaptionPicker, setShowCaptionPicker] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget>('community');
  const [isSharing, setIsSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [includeUsername, setIncludeUsername] = useState(true);

  const hasLaunched = useRef(false);

  // Open camera on mount
  useEffect(() => {
    if (hasLaunched.current) return;
    hasLaunched.current = true;
    openCamera();
  }, []);

  const openCamera = async () => {
    console.log('[END] openCamera called, ImagePicker:', !!ImagePicker);
    if (!ImagePicker) {
      // No native module — can't use camera
      return;
    }

    try {
      console.log('[END] launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      console.log('[END] camera result:', JSON.stringify(result, null, 2));

      if (result.canceled || !result.assets[0]) {
        console.log('[END] camera cancelled, going back');
        clearCameraActive();
        router.back();
        return;
      }

      const asset = result.assets[0];
      console.log('[END] photo dims:', asset.width, asset.height, 'uri:', asset.uri);
      setImageUri(asset.uri);
      if (asset.width && asset.height) {
        setImageDims({ width: asset.width, height: asset.height });
      }
    } catch (err) {
      console.error('[END] camera error:', err);
    }
  };

  const handleRetake = () => {
    setImageUri(null);
    setImageDims(null);
    hasLaunched.current = false;
    openCamera();
  };

  const handleShare = async () => {
    if (!imageUri || !profile) return;

    setIsSharing(true);

    try {
      // Always post to community account
      const communityResult = await postToCommunity(imageUri, caption, profile.handle, imageDims, includeUsername);
      if (!communityResult.ok) {
        Alert.alert('Share failed', communityResult.error || 'Could not post to jklb.social');
        setIsSharing(false);
        return;
      }

      // Optionally also post to personal account
      if (shareTarget === 'both' && agent) {
        try {
          const imgResponse = await fetch(imageUri);
          const imgBlob = await imgResponse.blob();
          const uint8 = new Uint8Array(await imgBlob.arrayBuffer());
          const upload = await agent.uploadBlob(uint8, { encoding: 'image/jpeg' });

          await agent.post({
            text: caption,
            embed: {
              $type: 'app.bsky.embed.images',
              images: [{
                alt: caption,
                image: upload.data.blob,
                ...(imageDims && { aspectRatio: { width: imageDims.width, height: imageDims.height } }),
              }],
            },
          });
        } catch (err) {
          console.error('Personal post failed:', err);
          // Community post succeeded — don't block on personal post failure
        }
      }

      setIsSharing(false);
      setShared(true);
      setTimeout(() => { clearCameraActive(); router.back(); }, 1200);
    } catch (err) {
      console.error('Share failed:', err);
      Alert.alert('Share failed', err instanceof Error ? err.message : 'Something went wrong');
      setIsSharing(false);
    }
  };

  // Camera not available — show fallback
  if (!ImagePicker) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>Camera requires a new app build</Text>
          <TouchableOpacity onPress={() => { clearCameraActive(); router.back(); }} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Waiting for camera result
  if (!imageUri) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>Opening camera...</Text>
        </View>
      </View>
    );
  }

  // Success state
  if (shared) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.fallback}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>Shared!</Text>
        </View>
      </View>
    );
  }

  // Post screen — photo preview + caption + share toggle
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom || 16 }]}>
      {/* Header with close button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { clearCameraActive(); router.back(); }}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share a photo</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Photo preview */}
      <View style={styles.previewContainer}>
        <Image source={{ uri: imageUri }} style={styles.preview} contentFit="contain" contentPosition="center" />
      </View>

      {/* Caption picker */}
      <View style={styles.section}>
        <Text style={styles.label}>Caption</Text>
        <TouchableOpacity
          onPress={() => setShowCaptionPicker(!showCaptionPicker)}
          style={styles.captionSelector}
        >
          <Text style={styles.captionText}>{caption}</Text>
          <Text style={styles.captionChevron}>{showCaptionPicker ? '▴' : '▾'}</Text>
        </TouchableOpacity>

        {showCaptionPicker && (
          <View style={styles.captionOptions}>
            {CAPTIONS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => { setCaption(c); setShowCaptionPicker(false); }}
                style={[styles.captionOption, caption === c && styles.captionOptionActive]}
              >
                <Text style={[styles.captionOptionText, caption === c && styles.captionOptionTextActive]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Share target toggle */}
      <View style={styles.section}>
        <Text style={styles.label}>Share to</Text>
        <TouchableOpacity
          onPress={() => setShareTarget('community')}
          style={styles.radioRow}
        >
          <View style={[styles.radio, shareTarget === 'community' && styles.radioActive]}>
            {shareTarget === 'community' && <View style={styles.radioDot} />}
          </View>
          <Text style={styles.radioLabel}>jklb.social only</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShareTarget('both')}
          style={styles.radioRow}
        >
          <View style={[styles.radio, shareTarget === 'both' && styles.radioActive]}>
            {shareTarget === 'both' && <View style={styles.radioDot} />}
          </View>
          <Text style={styles.radioLabel}>jklb.social + my account</Text>
        </TouchableOpacity>

        <Text style={styles.autoDeleteNote}>
          jklb.social posts auto-delete in 48 hours
        </Text>
      </View>

      {/* Username toggle */}
      <View style={styles.section}>
        <TouchableOpacity
          onPress={() => setIncludeUsername(!includeUsername)}
          style={styles.radioRow}
        >
          <View style={[styles.radio, includeUsername && styles.radioActive]}>
            {includeUsername && <View style={styles.radioDot} />}
          </View>
          <Text style={styles.radioLabel}>Share my username</Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity onPress={handleRetake} style={styles.retakeButton}>
          <Text style={styles.retakeButtonText}>📸 Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleShare}
          disabled={isSharing}
          style={[styles.shareButton, isSharing && styles.shareButtonDisabled]}
        >
          <Text style={styles.shareButtonText}>
            {isSharing ? 'Sharing...' : 'Share'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },

  // Fallback / loading
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },

  // Success
  successIcon: { fontSize: 48, color: '#00bcd4', marginBottom: 12 },
  successText: { color: 'white', fontSize: 20, fontWeight: '700' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: { color: 'rgba(255,255,255,0.6)', fontSize: 20, fontWeight: '600', width: 32 },
  headerTitle: { color: 'white', fontWeight: 'bold', fontSize: 18 },

  // Photo preview
  previewContainer: {
    flex: 1,
    maxHeight: 360,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  preview: {
    width: '100%',
    height: '100%',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Caption picker
  captionSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  captionText: { color: 'white', fontSize: 15 },
  captionChevron: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  captionOptions: {
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  captionOption: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  captionOptionActive: {
    backgroundColor: 'rgba(233,69,96,0.15)',
  },
  captionOptionText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  captionOptionTextActive: { color: 'white', fontWeight: '600' },

  // Radio buttons
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: '#e94560',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e94560',
  },
  radioLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  autoDeleteNote: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 'auto',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
  },
  retakeButtonText: { color: 'white', fontSize: 15, fontWeight: '600' },
  shareButton: {
    flex: 1,
    backgroundColor: '#e94560',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
  },
  shareButtonDisabled: { opacity: 0.5 },
  shareButtonText: { color: 'white', fontSize: 15, fontWeight: '700' },
});
