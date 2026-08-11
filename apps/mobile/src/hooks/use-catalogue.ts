import { useCallback, useEffect, useRef, useState } from "react";

import type { Page, Product, ProductSort } from "@swiftcart/shared";

import { api, errorMessage } from "@/lib/api";

const PAGE_SIZE = 20;

export type CatalogueFilters = {
  search: string;
  category: string | null;
  sort: ProductSort;
};

/**
 * Paged catalogue with search, category and sort.
 *
 * The concurrency rules here are load-bearing:
 *
 *  - `inFlight` is the only re-entrancy lock.
 *  - Every request carries a `requestId`; a response whose id is stale is
 *    DISCARDED. Without that, typing "lap" then "laptop" can have the slower
 *    "lap" response land last and overwrite the correct results.
 *  - One mount-scoped AbortController, aborted on unmount, never recreated.
 */
export function useCatalogue() {
  const [filters, setFilters] = useState<CatalogueFilters>({
    search: "",
    category: null,
    sort: "name-asc",
  });

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: "replace" | "append", active: CatalogueFilters) => {
      if (inFlight.current) return;
      inFlight.current = true;

      const id = ++requestId.current;
      const signal = abortRef.current?.signal;
      const offset = mode === "replace" ? 0 : items.length;

      const query = new URLSearchParams({
        sort: active.sort,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (active.search.trim()) query.set("search", active.search.trim());
      if (active.category) query.set("category", active.category);

      try {
        const page = await api.get<Page<Product>>(`/products?${query}`, { signal });

        // A newer request has been issued since this one started; its answer is
        // the correct one, so drop this.
        if (id !== requestId.current) return;

        setItems((previous) => (mode === "replace" ? page.items : [...previous, ...page.items]));
        setTotal(page.total);
        setHasMore(page.hasMore);
        setError(null);
      } catch (cause) {
        if (signal?.aborted || id !== requestId.current) return;
        setError(errorMessage(cause));
      } finally {
        inFlight.current = false;
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
          setIsRefreshing(false);
        }
      }
    },
    [items.length],
  );

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    return () => controller.abort();
  }, []);

  // Refetch from the top whenever the query changes. Debounced so typing a
  // search term doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setIsLoading(true);
        void load("replace", filters);
      },
      filters.search ? 300 : 0,
    );

    return () => clearTimeout(timer);
    // `load` changes with items.length, which would re-run this on every page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.category, filters.sort]);

  const loadMore = () => {
    if (inFlight.current || !hasMore || error) return;
    setIsLoadingMore(true);
    void load("append", filters);
  };

  const refresh = () => {
    if (inFlight.current) return;
    setIsRefreshing(true);
    void load("replace", filters);
  };

  const retry = () => {
    if (inFlight.current) return;
    setError(null);
    setIsLoading(true);
    void load("replace", filters);
  };

  return {
    items,
    total,
    hasMore,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    filters,
    setSearch: (search: string) => setFilters((f) => ({ ...f, search })),
    setCategory: (category: string | null) => setFilters((f) => ({ ...f, category })),
    setSort: (sort: ProductSort) => setFilters((f) => ({ ...f, sort })),
    loadMore,
    refresh,
    retry,
  };
}
