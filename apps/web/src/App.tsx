import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Watches } from "@/pages/Watches";
import { WatchDetail } from "@/pages/WatchDetail";
import { History } from "@/pages/History";
import { LanguageProvider } from "@/i18n/context";
import { ApiError } from "@/lib/api";
import { setTokenDialog } from "@/lib/auth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  // A rejected write opens the token dialog; pages still show the error text.
  mutationCache: new MutationCache({
    onError: (e) => {
      if (e instanceof ApiError && e.isAuth) setTokenDialog(true);
    },
  }),
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="watches" element={<Watches />} />
              <Route path="watches/:id" element={<WatchDetail />} />
              <Route path="history" element={<History />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
