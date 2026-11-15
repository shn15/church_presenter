/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import OperatorDashboard from "./components/Operator/Dashboard";
import ProjectorDisplay from "./components/Projector/Display";
import Gateway from "./components/Gateway";
import { applyUiTheme, getUiTheme, UI_THEME_STORAGE_KEY } from "./lib/themeManager";

export default function App() {
  useEffect(() => {
    applyUiTheme(getUiTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === UI_THEME_STORAGE_KEY) {
        applyUiTheme(getUiTheme());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Gateway />} />
        <Route path="/projector" element={<ProjectorDisplay />} />
        <Route path="/operator" element={<OperatorDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

