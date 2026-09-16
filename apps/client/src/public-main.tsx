import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import PublicReportPage from "@/pages/public/PublicReportPage";

/**
 * A second entry point, for the one screen a member of the public sees.
 *
 * The patient page used to be a route inside the staff application, which
 * meant a patient scanning a QR downloaded the whole thing -- the shell, the
 * dashboard, every eagerly imported reception screen and the authenticated API
 * layer -- before anything at all appeared. On the mobile data these patients
 * actually have, that was half a minute of blank screen, and it looked exactly
 * like a broken link.
 *
 * Splitting the entry costs the staff app nothing and leaves the patient with
 * a bundle that carries only their own page. Vercel rewrites /r/* here.
 *
 * There is deliberately no Redux store: three fetch calls need none, and its
 * absence means there is structurally no staff token to attach by accident and
 * no auth state a failure here could clobber.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/r/:token" element={<PublicReportPage />} />
          {/*
                          Anything else that lands on this entry is a link that
                          was mistyped or truncated in transit. The page says so
                          itself, rather than redirecting into the staff app.
                        */}
          <Route path="*" element={<PublicReportPage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
);
