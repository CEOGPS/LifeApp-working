import { useEffect } from "react";

const VERSION = "v23.0";

type Facebook = {
  init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  AppEvents: { logPageView: () => void };
};

declare global {
  interface Window {
    FB?: Facebook;
    fbAsyncInit?: () => void;
  }
}

function savedAppId() {
  const fromEnv = (import.meta.env as { VITE_FACEBOOK_APP_ID?: string }).VITE_FACEBOOK_APP_ID || "";
  if (/^\d{5,}$/.test(fromEnv)) return fromEnv;
  try {
    const data = JSON.parse(localStorage.getItem("lifeos.shell.v1") || "{}") as { keys?: { name?: string; value?: string }[] };
    const row = data.keys?.find((item) => item.name === "Facebook App ID");
    const value = String(row?.value || "").trim();
    if (/^\d{5,}$/.test(value)) return value;
  } catch {
    /* the board is not readable yet */
  }
  return "";
}

function onOwnedSite() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || /(^|\.)ceogps\.com$/i.test(host);
}

function start(appId: string) {
  if (!appId || !window.FB || !onOwnedSite()) return;
  window.FB.init({ appId, cookie: true, xfbml: true, version: VERSION });
  window.FB.AppEvents.logPageView();
}

export function bootFacebook(appId = savedAppId()) {
  if (!onOwnedSite()) return;
  window.fbAsyncInit = () => start(appId || savedAppId());
  const existing = document.getElementById("facebook-jssdk");
  if (existing) {
    start(appId || savedAppId());
    return;
  }
  const script = document.createElement("script");
  script.id = "facebook-jssdk";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = "https://connect.facebook.net/en_US/sdk.js";
  document.body.appendChild(script);
}

export function FacebookSdk() {
  useEffect(() => {
    bootFacebook();
  }, []);
  return <div id="fb-root" />;
}
