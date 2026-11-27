import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bundledSchedule, parseSchedule, type Show } from '@/lib/schedule';
import { scheduleCacheKey, supabase } from '@/lib/supabase';

export function useSchedule() {
  const [shows, setShows] = useState<Show[]>(bundledSchedule);
  const [offline, setOffline] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;

    const refresh = async () => {
      request = new AbortController();
      const currentRequest = request;
      const timeout = setTimeout(() => currentRequest.abort(), 10000);
      try {
        const { data, error } = await client.from('shows')
          .select('id,name,day,time,icon')
          .eq('active', true)
          .order('sort_order')
          .order('id')
          .abortSignal(currentRequest.signal);
        if (error) throw error;
        const next = parseSchedule(data);
        if (cancelled) return;
        setShows(next);
        setOffline(false);
        try {
          await AsyncStorage.setItem(scheduleCacheKey, JSON.stringify(next));
        } catch (error) {
          console.warn('[Schedule] Unable to save offline schedule:', error);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[Schedule] Unable to refresh schedule:', error);
          setOffline(true);
        }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) timer = setTimeout(refresh, 60000);
      }
    };

    const start = async () => {
      try {
        const cached = await AsyncStorage.getItem(scheduleCacheKey);
        if (cached !== null && !cancelled) setShows(parseSchedule(JSON.parse(cached)));
      } catch (error) {
        if (!cancelled) console.warn('[Schedule] Unable to read offline schedule:', error);
      }
      if (!cancelled) void refresh();
    };
    void start();
    return () => {
      cancelled = true;
      request?.abort();
      if (timer) clearTimeout(timer);
    };
  }, []));

  return { shows, offline };
}
