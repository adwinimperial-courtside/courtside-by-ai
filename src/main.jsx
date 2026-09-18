import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

const SAME_ORIGIN_FILES_V1 = (() => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (!(/(^|\.)courtside-by-ai\.com$/i.test(h) || h.startsWith("preview--"))) return false;
  const FROM = "https://base44.app/api/apps/";
  const fix = (v) => (typeof v === "string" && v.startsWith(FROM)) ? "/api/apps/" + v.slice(FROM.length) : v;
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (desc && desc.set) {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set(v) { desc.set.call(this, fix(v)); },
    });
  }
  const origSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (this instanceof HTMLImageElement && String(name).toLowerCase() === "src") value = fix(value);
    return origSetAttribute.call(this, name, value);
  };
  return true;
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>,
)