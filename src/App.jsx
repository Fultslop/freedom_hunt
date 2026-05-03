import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageContext";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import { TitleBarProvider } from "./theme/TitleBarContext";
import { FontSizeProvider } from "./theme/FontSizeContext";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import EditorLoginPage from "./pages/editor/EditorLoginPage";
import EditorPage from "./pages/editor/EditorPage";
import EditorLocationList from "./pages/editor/EditorLocationList";
import EditorLocationForm from "./pages/editor/EditorLocationForm";
import TitleBar from "./components/TitleBar";
import AppPage from "./pages/AppPage";
import LoginPage from "./pages/LoginPage";
import ProjectPage from "./pages/ProjectPage";
import CityPage from "./pages/CityPage";
import RoutePage from "./pages/RoutePage";
import { useCssVars } from "./hooks/useCssVars";
import "./styles/global.css";

function ThemeBodySync() {
  const { theme } = useTheme();
  useCssVars();
  useEffect(() => {
    document.body.style.background = theme.background;
  }, [theme]);
  return null;
}

export default function App() {
  return (
    <LanguageProvider>
      <FontSizeProvider>
        <ThemeProvider>
          <TitleBarProvider>
            <BrowserRouter>
              <AuthProvider>
                <ThemeBodySync />
                <TitleBar />
                <Routes>
                  <Route path="/" element={<AppPage />} />
                  <Route path="/login/:project" element={<LoginPage />} />
                  <Route
                    path="/:project"
                    element={
                      <ProtectedRoute>
                        <ProjectPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/:project/:city"
                    element={
                      <ProtectedRoute>
                        <CityPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/:project/:city/:route"
                    element={
                      <ProtectedRoute>
                        <RoutePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/editor/login" element={<EditorLoginPage />} />
                  <Route
                    path="/editor"
                    element={
                      <AdminRoute>
                        <EditorPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/editor/locations/:project/:city"
                    element={
                      <AdminRoute>
                        <EditorLocationList />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/editor/locations/:project/:city/new"
                    element={
                      <AdminRoute>
                        <EditorLocationForm />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/editor/locations/:project/:city/edit/:filename"
                    element={
                      <AdminRoute>
                        <EditorLocationForm />
                      </AdminRoute>
                    }
                  />
                </Routes>
              </AuthProvider>
            </BrowserRouter>
          </TitleBarProvider>
        </ThemeProvider>
      </FontSizeProvider>
    </LanguageProvider>
  );
}
