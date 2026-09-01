import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LatLng } from '../types/geo';

export type RootStackParamList = {
  Login: undefined;
  Map: undefined;
  SpotDetail: { spotId: number };
  SpotRegister: { initialCenter?: LatLng } | undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
