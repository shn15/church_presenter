/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import OperatorDashboard from "./components/Operator/Dashboard";
import ProjectorDisplay from "./components/Projector/Display";
import Gateway from "./components/Gateway";

export default function App() {
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

