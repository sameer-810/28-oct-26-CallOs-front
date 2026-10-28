import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";

/**
 * Tab screens stay mounted, so a query on one never refetches when you come
 * back to it. This refetches on every return — skipping the first focus,
 * which the query's own mount fetch already covers.
 */
export function useRefreshOnFocus(refetch: () => unknown) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
