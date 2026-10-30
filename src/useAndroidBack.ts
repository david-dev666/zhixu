import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

export type AppPage = 'home' | 'quiz' | 'review' | 'settings';

export function useAndroidBack(page: AppPage, navigate: (page: AppPage) => void) {
    useEffect(() => {
        if (Platform.OS !== 'android') return;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (page === 'home') return false;
            navigate('home');
            return true;
        });
        return () => subscription.remove();
    }, [page, navigate]);
}
