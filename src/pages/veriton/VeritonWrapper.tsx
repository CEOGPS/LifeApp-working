// Embeds Music Einstein (Veriton) inside the LifeOS router. No second app. No login.
import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Music } from "lucide-react";

const VeritonAppLayout = lazy(() => import("./src/components/AppLayout.jsx").then(m => ({ default: m.default as React.ComponentType<any> })));
const VeritonCreate = lazy(() => import("./src/pages/Create.jsx").then(m => ({ default: m.default as React.ComponentType<any> })));
const VeritonLibrary = lazy(() => import("./src/pages/Library.jsx").then(m => ({ default: m.default as React.ComponentType<any> })));
const VeritonPlaylists = lazy(() => import("./src/pages/Playlists.jsx").then(m => ({ default: m.default as React.ComponentType<any> })));
const VeritonDashboard = lazy(() => import("./src/pages/Dashboard.jsx").then(m => ({ default: m.default as React.ComponentType<any> })));
const VeritonVideoStudio = lazy(() => import("./src/pages/VideoStudio.tsx").then(m => ({ default: m.default as React.ComponentType<any> })));
const VeritonTrackDetail = lazy(() => import("./src/pages/TrackDetail.jsx").then(m => ({ default: m.default as React.ComponentType<any> })));

export default function VeritonWrapper() {
  return (
    <PanelLayout
      title="Music Einstein"
      subtitle="AI music and video studio"
      icon={<Music className="text-sky-400" />}
    >
      <div className="h-full min-h-[70vh] overflow-auto">
        <Suspense fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          </div>
        }>
          <Routes>
            <Route element={<VeritonAppLayout />}>
              <Route index element={<VeritonDashboard />} />
              <Route path="dashboard" element={<VeritonDashboard />} />
              <Route path="create" element={<VeritonCreate />} />
              <Route path="library" element={<VeritonLibrary />} />
              <Route path="playlists" element={<VeritonPlaylists />} />
              <Route path="video-studio" element={<VeritonVideoStudio />} />
              <Route path="track/:id" element={<VeritonTrackDetail />} />
            </Route>
          </Routes>
        </Suspense>
      </div>
    </PanelLayout>
  );
}
