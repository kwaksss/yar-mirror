jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'mirrorspot://redirect'),
  ResponseType: { Code: 'code' },
  AuthRequest: jest.fn(),
}));
