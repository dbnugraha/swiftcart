import { useCallback, useEffect, useState } from "react";

import { api, errorMessage } from "@/lib/api";

type State<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * One GET, with abort-on-unmount and a retry.
 *
 * The result is stored WITH the path it came from, and the visible value is
 * derived from that pairing — so navigating to a different product can never
 * show the previous one's data, not even for a frame. Clearing state in an
 * effect instead would leave exactly that gap.
 */
export function useResource<T>(path: string | null) {
  const [loaded, setLoaded] = useState<{ path: string; data: T } | null>(null);
  const [failure, setFailure] = useState<{ path: string; message: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const isCurrent = loaded !== null && loaded.path === path;
  const hasFailed = failure !== null && failure.path === path;

  const state: State<T> = {
    data: isCurrent ? loaded.data : null,
    error: hasFailed ? failure.message : null,
    isLoading: path !== null && !isCurrent && !hasFailed,
  };

  useEffect(() => {
    if (!path || isCurrent || hasFailed) return;

    const controller = new AbortController();

    api
      .get<T>(path, { signal: controller.signal })
      .then((data) => setLoaded({ path, data }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setFailure({ path, message: errorMessage(error) });
        }
      });

    return () => controller.abort();
  }, [path, isCurrent, hasFailed, reloadKey]);

  const retry = useCallback(() => {
    setFailure(null);
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, retry };
}
