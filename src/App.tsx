import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import AuthGuard from "@/components/feature/AuthGuard";

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={__BASE_PATH__}>
        <AuthGuard>
          <AppRoutes />
        </AuthGuard>
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;