// ReplyComposer — Inline reply/quote composer (NOT a Modal)
// Renders as a regular View inside CardStack's compose layout.
// Parent controls visibility via composeMode state.

import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  // Native module not available in this dev build — image features disabled
}
import type { Post } from '../lib/types';

interface ReplyComposerProps {
  mode: 'reply' | 'quote';
  targetPost: Post;
  onSubmit: (text: string, imageUri?: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ReplyComposer({ mode, targetPost, onSubmit, isSubmitting }: ReplyComposerProps) {
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Auto-focus when composer appears
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const pickImage = async () => {
    if (!ImagePicker) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    if (!ImagePicker) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() || isSubmitting) return;
    await onSubmit(text, imageUri ?? undefined);
    setText('');
    setImageUri(null);
  };

  return (
    <View style={styles.container}>
      {/* Mode label */}
      <Text style={styles.modeLabel}>
        {mode === 'reply' ? 'Reply to ' : 'Quote '}
        <Text style={styles.handleText}>@{targetPost.author.handle}</Text>
      </Text>

      {/* Image buttons + preview (hidden if native module unavailable) */}
      <View style={styles.imageRow}>
        {ImagePicker && (
          <>
            <TouchableOpacity onPress={pickImage} style={styles.imageButton}>
              <Text style={styles.imageButtonText}>🖼️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} style={styles.imageButton}>
              <Text style={styles.imageButtonText}>📷</Text>
            </TouchableOpacity>
          </>
        )}
        {imageUri && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: imageUri }} style={styles.previewThumb} />
            <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeImage}>
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Text input */}
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        placeholder={mode === 'reply' ? 'Write your reply...' : 'Add your thoughts...'}
        placeholderTextColor="rgba(255,255,255,0.3)"
        style={styles.input}
        multiline
        autoFocus
      />

      {/* Footer: char count + send button */}
      <View style={styles.footer}>
        <Text style={styles.charCount}>{text.length} / 300</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!text.trim() || isSubmitting}
          style={[styles.sendButton, (!text.trim() || isSubmitting) && styles.sendButtonDisabled]}
        >
          <Text style={styles.sendButtonText}>
            {isSubmitting ? 'Sending...' : mode === 'reply' ? 'Reply' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
    borderTopWidth: 2,
    borderTopColor: '#e94560',
    padding: 16,
  },
  modeLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: 12,
  },
  handleText: {
    color: '#0f9b8e',
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  imageButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  imageButtonText: {
    fontSize: 18,
  },
  imagePreview: {
    position: 'relative',
    marginLeft: 4,
  },
  previewThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  removeImage: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#e94560',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  charCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  sendButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});
