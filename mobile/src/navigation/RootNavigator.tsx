import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { MapScreen } from '../screens/MapScreen';
import { SpotDetailScreen } from '../screens/SpotDetailScreen';
import { SpotRegisterScreen } from '../screens/SpotRegisterScreen';
import { initialRouteFor } from './routing';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRouteFor(status)}>
        {status === 'authenticated' ? (
          <Stack.Group>
            <Stack.Screen name="Map" component={MapScreen} options={{ title: '거울샷 스팟' }} />
            <Stack.Screen
              name="SpotDetail"
              component={SpotDetailScreen}
              options={{ title: '스팟 상세' }}
            />
            <Stack.Screen
              name="SpotRegister"
              component={SpotRegisterScreen}
              options={{ title: '스팟 등록' }}
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
