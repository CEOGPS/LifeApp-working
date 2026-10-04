import React from "react";
import { Link2, KeyRound, ShieldCheck, RefreshCw, MoreVertical, Trash2, AlertCircle, CheckCircle2, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ServiceCard({ integration, onConnect, onRotate, onDisconnect, onDelete }) {
  const isConnected = integration.status === "connected";
  const isError = integration.status === "error";
  const isOauth = integration.connection_type === "oauth_pkce";

  return (
    <div className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${integration.icon_color} text-white shadow-sm`}>
            <span className="text-base font-bold tracking-tight">
              {integration.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{integration.name}</h3>
            <div className="mt-0.5 flex items-center gap-1.5">
              {isOauth ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600">
                  <Link2 className="h-3 w-3" /> OAuth PKCE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <KeyRound className="h-3 w-3" /> API Key
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {integration.popular && !isConnected && !isError && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> Popular
            </span>
          )}
          {isConnected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </span>
          )}
          {isError && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
              <AlertCircle className="h-3 w-3" /> Error
            </span>
          )}
          {!isConnected && !isError && (
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Disconnected
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500">
        {integration.description || "No description provided."}
      </p>

      {integration.rotation_enabled && isConnected && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>
            Auto-rotates every {integration.rotation_frequency_days}d
            {integration.last_rotated && (
              <> · last {formatDistanceToNow(new Date(integration.last_rotated), { addSuffix: true })}</>
            )}
          </span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {!isConnected ? (
          <button
            onClick={() => onConnect(integration)}
            className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Connect
          </button>
        ) : (
          <>
            <button
              onClick={() => onRotate(integration)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Rotate Key
            </button>
            <button
              onClick={() => onDisconnect(integration)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Disconnect
            </button>
          </>
        )}
        {integration.is_custom && (
          <button
            onClick={() => onDelete(integration)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}