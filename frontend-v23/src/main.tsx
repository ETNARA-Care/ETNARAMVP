import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ToastProvider } from "@/components/ui";
import { DemoStoreProvider } from "@/mocks/DemoStoreContext";
import { AuthProvider } from "@/auth/AuthProvider";
import "@/styles/tokens.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* basename desde import.meta.env.BASE_URL -- coincide con vite.config `base`
       ('/ETNARAMVP/' en build, '/' en dev) sin ningún parche en el workflow. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {/* AuthProvider: sesión REAL contra el backend (Fase 3). */}
          <AuthProvider>
            {/* DemoStoreProvider: datos operacionales MOCK (Fase 2), intencionalmente separados. */}
            <DemoStoreProvider>
              <App />
            </DemoStoreProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
