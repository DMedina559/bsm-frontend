import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000,
      gcTime: 300000,
      retry: (count, error) =>
        count < 2 &&
        error?.name !== "AbortError" &&
        error?.name !== "TimeoutError" &&
        (!error?.status || error.status >= 500),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
