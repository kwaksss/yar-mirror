import type { AuthStatus } from '../auth/AuthContext';
import type { RootStackParamList } from './types';

/** A session restored from SecureStore skips Login entirely on boot. */
export function initialRouteFor(status: AuthStatus): keyof RootStackParamList {
  return status === 'authenticated' ? 'Map' : 'Login';
}
