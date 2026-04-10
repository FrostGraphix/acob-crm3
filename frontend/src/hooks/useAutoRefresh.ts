import { useEffect, useRef } from "react";

export function useAutoRefresh(callback: () => void, intervalMs = 5 * 60 * 1000) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const id = window.setInterval(() => savedCallback.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}
