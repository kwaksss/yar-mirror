module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // 변환 캐시가 없는 CI 에서는 화면 테스트 파일의 첫 렌더가 React Native 모듈을 처음 변환하느라
  // 기본 제한(5초)을 넘긴다. 테스트 자체가 느린 것이 아니므로 제한만 늘린다.
  testTimeout: 30000,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-webview)',
  ],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
};
