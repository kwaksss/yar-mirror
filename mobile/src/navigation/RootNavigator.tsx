import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { MapScreen } from '../screens/MapScreen';
import { SpotDetailScreen } from '../screens/SpotDetailScreen';
import { SpotRegisterScreen } from '../screens/SpotRegisterScreen';
import { HeaderBackButton } from './HeaderBackButton';
import { initialRouteFor } from './routing';
import type { RootStackParamList } from './types';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.paper,
    card: colors.paper,
    text: colors.ink,
    border: colors.line,
  },
};

const screenOptions: NativeStackNavigationOptions = {
  headerShadowVisible: false,
  headerTitleAlign: 'center',
  headerTintColor: colors.ink,
  headerTitleStyle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: colors.paper },
};

export function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator initialRouteName={initialRouteFor(status)} screenOptions={screenOptions}>
        {status === 'authenticated' ? (
          <Stack.Group>
            <Stack.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="SpotDetail"
              component={SpotDetailScreen}
              // 지도 미리보기 시트를 끌어 올린 흐름을 이어서 아래에서 올라온다. 뒤로가기는 사진 위 버튼.
              options={{ headerShown: false, animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="SpotRegister"
              component={SpotRegisterScreen}
              options={({ navigation }) => ({
                title: '스팟 등록',
                // 기본 뒤로가기 아이콘 이미지는 웹 배포본에서 깨지므로 직접 그린 버튼을 쓴다.
                headerLeft: () => <HeaderBackButton navigation={navigation} />,
              })}
            />
          </Stack.Group>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
