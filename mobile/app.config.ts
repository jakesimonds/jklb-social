import { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'jklb (dev)' : 'jklb',
  slug: 'jklb-mobile',
  scheme: 'social.jklb',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1a1a2e',
  },
  ios: {
    supportsTablet: true,
  },
  android: {
    package: IS_DEV ? 'social.jklb.app.dev' : 'social.jklb.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1a1a2e',
    },
    edgeToEdgeEnabled: true,
    softwareKeyboardLayoutMode: 'adjustResize',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-web-browser',
    [
      'expo-image-picker',
      {
        cameraPermission: 'jklb needs camera access to take photos at the end of your session',
      },
    ],
  ],
  extra: {
    router: {},
    eas: {
      projectId: 'd63f0179-5d90-4bfd-9dd0-87c574a047ea',
    },
  },
});
