import { useCallback, useState } from 'react';

/**
 * Spinner state for pull-to-refresh only. Binding RefreshControl to background loading flags
 * makes iOS show the spinner on mount and leaves a gap above the content.
 */
export function usePullRefresh(task: () => unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await task();
    } finally {
      setRefreshing(false);
    }
  }, [task]);
  return { refreshing, onRefresh };
}
