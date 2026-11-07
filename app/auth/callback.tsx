import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    let mounted = true;

    const completeAuth = async (url: string | null) => {
      if (!url) {
        if (mounted) setMessage('No confirmation link was received.');
        return;
      }

      try {
        const parsedUrl = new URL(url);
        const code = parsedUrl.searchParams.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const hash = parsedUrl.hash.replace(/^#/, '');
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (!access_token || !refresh_token) {
            throw new Error('The confirmation link does not contain valid session details.');
          }

          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) throw error;
        }

        if (mounted) {
          setMessage('Email confirmed successfully. Opening your account...');
          setTimeout(() => router.replace('/'), 1500);
        }
      } catch (error: any) {
        if (mounted) {
          setMessage(error.message || 'Email verification failed.');
        }
      }
    };

    Linking.getInitialURL().then(completeAuth);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      completeAuth(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 20, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}
