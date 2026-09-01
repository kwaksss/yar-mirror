import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MirrorSpot',
  slug: 'mirror-spot',
  scheme: 'mirrorspot',
  plugins: [
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          '주변 거울샷 스팟을 찾기 위해 현재 위치를 사용합니다.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: '스팟 사진을 등록하기 위해 사진 접근 권한이 필요합니다.',
        cameraPermission: '스팟 사진을 촬영하기 위해 카메라 권한이 필요합니다.',
      },
    ],
  ],
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080',
    kakaoJsKey: process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '',
    kakaoRestApiKey: process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '',
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
  },
});
