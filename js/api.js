import { CONFIG } from "./config.js";

function callApi(action, payload = {}) {
  return new Promise((resolve, reject) => {
    if (
      !CONFIG.APPS_SCRIPT_URL ||
      CONFIG.APPS_SCRIPT_URL.includes("PASTE_")
    ) {
      reject(new Error("尚未設定 Google Apps Script 網址"));
      return;
    }

    const callbackName =
      "__sopCallback_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2);

    const script = document.createElement("script");
    const token = localStorage.getItem("sop_id_token") || "";

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("API 連線逾時"));
    }, 20000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();

      if (!data || data.ok === false) {
        reject(new Error(data?.message || "API 讀取失敗"));
        return;
      }

      resolve(data);
    };

    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("token", token);
    url.searchParams.set("payload", JSON.stringify(payload));
    url.searchParams.set("callback", callbackName);

    script.src = url.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error("無法連線至 Apps Script"));
    };

    document.body.appendChild(script);
  });
}

export const api = {
  getIndex: () => callApi("getIndex"),
  getDoc: (url) => callApi("getDoc", { url }),
  getDatabase: (url) => callApi("getDatabase", { url }),
  search: (keyword) => callApi("search", { keyword }),
};
