import { Link } from "react-router-dom";
import { Home, Search, AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6 flex items-center gap-2">
        <AlertTriangle size={18} />
        <div>
          <h2 className="text-lg font-semibold">Page Not Found</h2>
          <p className="text-sm text-white/60">The page you're looking for doesn't exist</p>
        </div>
      </div>
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-white/20" />
        <h1 className="text-2xl font-bold mb-2">404</h1>
        <p className="text-white/60 mb-6">
          Sorry, we couldn't find the page you're looking for. It might have been moved
          or doesn't exist.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            to="/dashboard"
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Home size={16} /> Back to Dashboard
          </Link>
          <Link
            to="/omnisearch"
            className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Search size={16} /> Search
          </Link>
        </div>
      </div>
    </div>
  );
}