import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import CityPage from "./pages/CityPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/:city" element={<CityPage />} />
    </Routes>
  );
}
