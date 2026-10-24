import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ToastProvider } from "@/components/ui";
import { DemoStoreProvider } from "@/mocks/DemoStoreContext";
import { AuthProvider } from "@/auth/AuthProvider";
import "@/styles/tokens.css";
import "@/styles/admin-theme.css";
import "@/styles/platform-theme.css";

const queryClient = new QueryClient();

// Phase 12.5: copia de la app en el teléfono para abrir sin señal (solo el
// programa; ningún dato de pacientes pasa por el service worker).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  });
}

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
