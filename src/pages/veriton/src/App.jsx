import React from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import Create from "@/pages/veriton/Create.jsx";
import Library from "@/pages/veriton/Library.jsx";
import Playlists from "@/pages/veriton/Playlists.jsx";
import "./index.css";

export default function VeritonApp() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/*" element={<AppLayout />}>
          <Route index element={<Create />} />
          <Route path="library" element={<Library />} />
          <Route path="playlists" element={<Playlists />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}