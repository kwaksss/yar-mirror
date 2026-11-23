import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LatLng } from '../types/geo';

export type RootStackParamList = {
  Login: undefined;
  /** focus: 지도를 이 좌표로 옮긴다. 스팟 등록 직후 등록한 위치를 보여 줄 때 쓴다. */
  Map: { focus?: LatLng } | undefined;
  SpotDetail: { spotId: number };
  SpotRegister: { initialCenter?: LatLng } | undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
