import { useEffect } from "react";

declare global {
  interface Window {
    ApiConfig?: { Url: string };
    BrowserType?: string;
    ReceiptWidth?: string;
    ReceiptPadding?: string;
    __referenceMirrorBootPromise?: Promise<void>;
    __referenceMirrorAssetsLoaded?: boolean;
  }
}

const REFERENCE_ASSET_BASE = "/reference-mirror";
const REFERENCE_RUNTIME_SCRIPT = `(function(c){function e(e){for(var u,d,h=e[0],k=e[1],t=e[2],r=0,b=[];r<h.length;r++)d=h[r],f[d]&&b.push(f[d][0]),f[d]=0;for(u in k)Object.prototype.hasOwnProperty.call(k,u)&&(c[u]=k[u]);o&&o(e);while(b.length)b.shift()();return a.push.apply(a,t||[]),n()}function n(){for(var c,e=0;e<a.length;e++){for(var n=a[e],u=!0,d=1;d<n.length;d++){var h=n[d];0!==f[h]&&(u=!1)}u&&(a.splice(e--,1),c=k(k.s=n[0]))}return c}var u={},d={runtime:0},f={runtime:0},a=[];function h(c){return k.p+"static/js/"+({\"chunk-commons\":\"chunk-commons\"}[c]||c)+"."+{\"chunk-04f9004a\":\"19127dce\",\"chunk-05a99c67\":\"3b6aa675\",\"chunk-107fdb58\":\"908ca36e\",\"chunk-16301c8a\":\"c5f2312d\",\"chunk-9c0ed7d2\":\"97bce3b4\",\"chunk-2d0c119a\":\"8be1106b\",\"chunk-2d2105d3\":\"a0b8ae96\",\"chunk-2d230a36\":\"3bacb3a1\",\"chunk-2d230fe7\":\"50b874d0\",\"chunk-4ea1cc5e\":\"97575adb\",\"chunk-556562e8\":\"6b2b11cf\",\"chunk-commons\":\"1ace1a9b\",\"chunk-0006a343\":\"55f59ba3\",\"chunk-00d54f96\":\"0da57883\",\"chunk-02b779f6\":\"7c33f6e8\",\"chunk-0382f20f\":\"2262c8b6\",\"chunk-04f44e4e\":\"c0a091b1\",\"chunk-06d12352\":\"6b193c52\",\"chunk-0adefe4a\":\"48beaa1f\",\"chunk-0ea91b08\":\"d1203e1d\",\"chunk-19775cee\":\"ccde1203\",\"chunk-18049805\":\"d6a60d6f\",\"chunk-1aadd822\":\"8aef37bc\",\"chunk-230622c7\":\"f0f98eb9\",\"chunk-26adcc6c\":\"6b0a6899\",\"chunk-2881b530\":\"e0483d08\",\"chunk-2e9b1764\":\"86ebbb3a\",\"chunk-2ecd4be3\":\"b759983f\",\"chunk-3069adef\":\"eded0c86\",\"chunk-33fbec47\":\"d6b98245\",\"chunk-34109b44\":\"7025c4d4\",\"chunk-343a9dde\":\"53c1e4c4\",\"chunk-38dda224\":\"b852aa2c\",\"chunk-39307c78\":\"2e69c612\",\"chunk-3a7dc8d8\":\"e843acca\",\"chunk-4160b87f\":\"461319cf\",\"chunk-42de714a\":\"dffbde68\",\"chunk-447c6a46\":\"0bc39613\",\"chunk-46dbbf5d\":\"e6a8c90e\",\"chunk-492a32ac\":\"5fa3d6ef\",\"chunk-499e966d\":\"fc36d943\",\"chunk-4c1b3bf0\":\"ca4b90af\",\"chunk-4dd5ec40\":\"7182dd56\",\"chunk-4f63c9dc\":\"eb640ead\",\"chunk-54985034\":\"c85425c9\",\"chunk-55591b74\":\"ffb6233d\",\"chunk-59738ee8\":\"7702a034\",\"chunk-59bf1c11\":\"3822dab6\",\"chunk-62de7e10\":\"38888c6a\",\"chunk-6436f19e\":\"00b53b2c\",\"chunk-680650c1\":\"3693e65a\",\"chunk-6a87a69e\":\"58f976de\",\"chunk-6ac1878c\":\"ea5649d2\",\"chunk-6ac7aa5b\":\"0f0b2ae7\",\"chunk-6e87ca78\":\"0f51cb33\",\"chunk-03110abb\":\"a7c0359b\",\"chunk-07f1f19e\":\"dac5eb08\",\"chunk-16ed4256\":\"25d5697a\",\"chunk-2a7da0fc\":\"f8fb1917\",\"chunk-4bfd92bd\":\"254eb999\",\"chunk-5e348a24\":\"b316312a\",\"chunk-67720b5d\":\"97f8da92\",\"chunk-875cedd4\":\"8b7cccbe\",\"chunk-9f655b0a\":\"1beeb869\",\"chunk-d965677c\":\"ec28885d\",\"chunk-70b9cc6c\":\"3747f239\",\"chunk-82388f1c\":\"072130c6\",\"chunk-8a88f446\":\"70e00cff\",\"chunk-8b071366\":\"402c2938\",\"chunk-d1d912b4\":\"e9428d8c\",\"chunk-91c33bd2\":\"1d367cda\",\"chunk-98bafe0c\":\"9c7d0e09\",\"chunk-ba288fd4\":\"66d3c886\",\"chunk-bd218c26\":\"67c22d3f\",\"chunk-c0b735ee\":\"eeed96e6\",\"chunk-c4650078\":\"a926cca7\",\"chunk-ca443326\":\"aa582b7e\",\"chunk-dc02871c\":\"34ef63cd\",\"chunk-e0093e6a\":\"e9b417cc\",\"chunk-e99af5e2\":\"25e1cdf2\",\"chunk-f505f45a\":\"6804aafa\",\"chunk-fb0a46ca\":\"80e1134c\",\"chunk-53379ef8\":\"520504d0\",\"chunk-58293907\":\"3b0bc5d0\"}[c]+".js"}function k(e){if(u[e])return u[e].exports;var n=u[e]={i:e,l:!1,exports:{}};return c[e].call(n.exports,n,n.exports,k),n.l=!0,n.exports}k.e=function(c){var e=[],n={"chunk-04f9004a":1,"chunk-05a99c67":1,"chunk-9c0ed7d2":1,"chunk-4ea1cc5e":1,"chunk-556562e8":1,"chunk-commons":1,"chunk-492a32ac":1};d[c]?e.push(d[c]):0!==d[c]&&n[c]&&e.push(d[c]=new Promise((function(e,n){for(var u="static/css/"+({\"chunk-commons\":\"chunk-commons\"}[c]||c)+"."+{"chunk-04f9004a":"d67af3d6","chunk-05a99c67":"d0296c60","chunk-107fdb58":"31d6cfe0","chunk-16301c8a":"31d6cfe0","chunk-9c0ed7d2":"713c40b3","chunk-2d0c119a":"31d6cfe0","chunk-2d2105d3":"31d6cfe0","chunk-2d230a36":"31d6cfe0","chunk-2d230fe7":"31d6cfe0","chunk-4ea1cc5e":"3705999e","chunk-556562e8":"b043920c","chunk-commons":"7b9a837a","chunk-0006a343":"31d6cfe0","chunk-00d54f96":"31d6cfe0","chunk-02b779f6":"31d6cfe0","chunk-0382f20f":"31d6cfe0","chunk-04f44e4e":"31d6cfe0","chunk-06d12352":"31d6cfe0","chunk-0adefe4a":"31d6cfe0","chunk-0ea91b08":"31d6cfe0","chunk-19775cee":"31d6cfe0","chunk-18049805":"31d6cfe0","chunk-1aadd822":"31d6cfe0","chunk-230622c7":"31d6cfe0","chunk-26adcc6c":"31d6cfe0","chunk-2881b530":"31d6cfe0","chunk-2e9b1764":"31d6cfe0","chunk-2ecd4be3":"31d6cfe0","chunk-3069adef":"31d6cfe0","chunk-33fbec47":"31d6cfe0","chunk-34109b44":"31d6cfe0","chunk-343a9dde":"31d6cfe0","chunk-38dda224":"31d6cfe0","chunk-39307c78":"31d6cfe0","chunk-3a7dc8d8":"31d6cfe0","chunk-4160b87f":"31d6cfe0","chunk-42de714a":"31d6cfe0","chunk-447c6a46":"31d6cfe0","chunk-46dbbf5d":"31d6cfe0","chunk-492a32ac":"d861cc75","chunk-499e966d":"31d6cfe0","chunk-4c1b3bf0":"31d6cfe0","chunk-4dd5ec40":"31d6cfe0","chunk-4f63c9dc":"31d6cfe0","chunk-54985034":"31d6cfe0","chunk-55591b74":"31d6cfe0","chunk-59738ee8":"31d6cfe0","chunk-59bf1c11":"31d6cfe0","chunk-62de7e10":"31d6cfe0","chunk-6436f19e":"31d6cfe0","chunk-680650c1":"31d6cfe0","chunk-6a87a69e":"31d6cfe0","chunk-6ac1878c":"31d6cfe0","chunk-6ac7aa5b":"31d6cfe0","chunk-6e87ca78":"31d6cfe0","chunk-03110abb":"31d6cfe0","chunk-07f1f19e":"31d6cfe0","chunk-16ed4256":"31d6cfe0","chunk-2a7da0fc":"31d6cfe0","chunk-4bfd92bd":"31d6cfe0","chunk-5e348a24":"31d6cfe0","chunk-67720b5d":"31d6cfe0","chunk-875cedd4":"31d6cfe0","chunk-9f655b0a":"31d6cfe0","chunk-d965677c":"31d6cfe0","chunk-70b9cc6c":"31d6cfe0","chunk-82388f1c":"31d6cfe0","chunk-8a88f446":"31d6cfe0","chunk-8b071366":"31d6cfe0","chunk-d1d912b4":"31d6cfe0","chunk-91c33bd2":"31d6cfe0","chunk-98bafe0c":"31d6cfe0","chunk-ba288fd4":"31d6cfe0","chunk-bd218c26":"31d6cfe0","chunk-c0b735ee":"31d6cfe0","chunk-c4650078":"31d6cfe0","chunk-ca443326":"31d6cfe0","chunk-dc02871c":"31d6cfe0","chunk-e0093e6a":"31d6cfe0","chunk-e99af5e2":"31d6cfe0","chunk-f505f45a":"31d6cfe0","chunk-fb0a46ca":"31d6cfe0","chunk-53379ef8":"31d6cfe0","chunk-58293907":"31d6cfe0"}[c]+".css",f=k.p+u,a=document.getElementsByTagName("link"),h=0;h<a.length;h++){var t=a[h],r=t.getAttribute("data-href")||t.getAttribute("href");if("stylesheet"===t.rel&&(r===u||r===f))return e()}var b=document.getElementsByTagName("style");for(h=0;h<b.length;h++){t=b[h],r=t.getAttribute("data-href");if(r===u||r===f)return e()}var o=document.createElement("link");o.rel="stylesheet",o.type="text/css",o.onload=e,o.onerror=function(e){var u=e&&e.target&&e.target.src||f,a=new Error("Loading CSS chunk "+c+" failed.\\n("+u+")");a.request=u,delete d[c],o.parentNode.removeChild(o),n(a)},o.href=f;var i=document.getElementsByTagName("head")[0];i.appendChild(o)})).then((function(){d[c]=0})));var u=f[c];if(0!==u)if(u)e.push(u[2]);else{var a=new Promise((function(e,n){u=f[c]=[e,n]}));e.push(u[2]=a);var t,r=document.createElement("script");r.charset="utf-8",r.timeout=120,k.nc&&r.setAttribute("nonce",k.nc),r.src=h(c),t=function(e){r.onerror=r.onload=null,clearTimeout(b);var n=f[c];if(0!==n){if(n){var u=e&&("load"===e.type?"missing":e.type),d=e&&e.target&&e.target.src,a=new Error("Loading chunk "+c+" failed.\\n("+u+": "+d+")");a.type=u,a.request=d,n[1](a)}f[c]=void 0}};var b=setTimeout((function(){t({type:"timeout",target:r})}),12e4);r.onerror=r.onload=t,document.head.appendChild(r)}return Promise.all(e)},k.m=c,k.c=u,k.d=function(c,e,n){k.o(c,e)||Object.defineProperty(c,e,{enumerable:!0,get:n})},k.r=function(c){"undefined"!==typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(c,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(c,"__esModule",{value:!0})},k.t=function(c,e){if(1&e&&(c=k(c)),8&e)return c;if(4&e&&"object"===typeof c&&c&&c.__esModule)return c;var n=Object.create(null);if(k.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:c}),2&e&&"string"!=typeof c)for(var u in c)k.d(n,u,function(e){return c[e]}.bind(null,u));return n},k.n=function(c){var e=c&&c.__esModule?function(){return c["default"]}:function(){return c};return k.d(e,"a",e),e},k.o=function(c,e){return Object.prototype.hasOwnProperty.call(c,e)},k.p="/reference-mirror/",k.oe=function(c){throw console.error(c),c};var t=window["webpackJsonp"]=window["webpackJsonp"]||[],r=t.push.bind(t);t.push=e,t=t.slice();for(var b=0;b<t.length;b++)e(t[b]);var o=r;n()})([]);`;

interface ReferenceMirrorPageProps {
  pageTitle: string;
  referenceHash: string;
}

function ensureReferenceStylesheet(href: string) {
  const existing = document.querySelector(`link[data-reference-href="${href}"]`);
  if (existing) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.referenceHref = href;
  document.head.appendChild(link);
}

function loadReferenceScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-reference-src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.referenceSrc = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${src}`)),
      { once: true },
    );
    document.body.appendChild(script);
  });
}

function ensureReferenceInlineScript(id: string, text: string) {
  const existing = document.querySelector(`script[data-reference-inline="${id}"]`);
  if (existing) {
    return;
  }

  const script = document.createElement("script");
  script.dataset.referenceInline = id;
  script.text = text;
  document.body.appendChild(script);
}

function configureReferenceGlobals() {
  window.ApiConfig = { Url: "" };

  let browserType = "Chrome";
  let receiptWidth = "60mm";
  let receiptPadding = "8mm";
  const userAgent = navigator.userAgent;

  if (userAgent.includes("Firefox")) {
    browserType = "Firefox";
    receiptWidth = "49mm";
    receiptPadding = "2mm";
  }

  if (userAgent.includes("Chrome")) {
    browserType = "Chrome";
    receiptWidth = "60mm";
    receiptPadding = "8mm";
  }

  window.BrowserType = browserType;
  window.ReceiptWidth = receiptWidth;
  window.ReceiptPadding = receiptPadding;
}

/**
 * Fetches the real upstream JWT from Beverly and sets it as the `token` cookie.
 * The old AMR reference app reads the `token` cookie to determine if it has a
 * valid session. Without this, it would show its own login screen.
 *
 * Falls back to a timestamp placeholder if the endpoint is unavailable
 * (e.g. if the user has no upstream session), so the reference app can at
 * least boot and show its own login rather than crashing.
 */
async function bridgeReferenceSession() {
  window.localStorage.setItem("lastActivityTime", String(Date.now()));

  try {
    const response = await fetch("/api/user/upstream-token", {
      method: "GET",
      credentials: "include",
    });

    if (response.ok) {
      const envelope = await response.json() as { code: number; result?: { token?: string } };
      const upstreamToken = envelope.result?.token;

      if (typeof upstreamToken === "string" && upstreamToken.trim().length > 0) {
        // Set the real upstream JWT as the `token` cookie the AMR app expects.
        document.cookie = `token=${upstreamToken}; path=/; SameSite=Lax`;
        return;
      }
    }
  } catch {
    // Network error — fall through to placeholder.
  }

  // Fallback: set a non-empty placeholder so the reference app doesn't crash on
  // cookie absence. It will still redirect to its own login in this case.
  const existingToken = document.cookie
    .split(";")
    .find((part) => part.trim().startsWith("token="));

  if (!existingToken) {
    document.cookie = `token=reference-mirror-${Date.now()}; path=/; SameSite=Lax`;
  }
}

function applyReferenceHash(referenceHash: string) {
  const currentHash = window.location.hash.trim();

  // If the app has been redirected to its own login, push back to the target.
  if (
    currentHash === "#/login" ||
    currentHash.toLowerCase().startsWith("#/login?") ||
    currentHash === "#/auth-redirect" ||
    currentHash.toLowerCase().startsWith("#/auth-redirect?") ||
    currentHash.length === 0 ||
    currentHash === "#" ||
    currentHash === "#/"
  ) {
    window.location.hash = referenceHash;
  }
}

async function bootReferenceMirrorApp() {
  if (!window.__referenceMirrorBootPromise) {
    window.__referenceMirrorBootPromise = (async () => {
      configureReferenceGlobals();

      // Fetch and set the real upstream token BEFORE the reference app boots
      // so it finds a valid session cookie on its first auth check.
      await bridgeReferenceSession();

      ensureReferenceStylesheet(`${REFERENCE_ASSET_BASE}/static/css/chunk-libs.f22c819a.css`);
      ensureReferenceStylesheet(`${REFERENCE_ASSET_BASE}/static/css/app.e3f005e0.css`);
      await loadReferenceScript(`${REFERENCE_ASSET_BASE}/static/js/chunk-elementUI.5ead3f0c.js`);
      await loadReferenceScript(`${REFERENCE_ASSET_BASE}/static/js/chunk-libs.e467f7d2.js`);
      ensureReferenceInlineScript("reference-runtime", REFERENCE_RUNTIME_SCRIPT);
      await loadReferenceScript(`${REFERENCE_ASSET_BASE}/static/js/app.11575024.js`);
      window.__referenceMirrorAssetsLoaded = true;
    })();
  }

  return window.__referenceMirrorBootPromise;
}

export function ReferenceMirrorPage({ pageTitle, referenceHash }: ReferenceMirrorPageProps) {
  useEffect(() => {
    document.title = pageTitle;

    // Apply the target hash immediately in case the page was opened with none.
    applyReferenceHash(referenceHash);

    void bootReferenceMirrorApp().then(() => {
      // After the app boots, give it a moment to run its router before correcting.
      window.setTimeout(() => applyReferenceHash(referenceHash), 50);
      window.setTimeout(() => applyReferenceHash(referenceHash), 500);
      window.setTimeout(() => applyReferenceHash(referenceHash), 1500);
    });

    // Catch any post-boot auth redirects the reference app initiates on its own.
    const onHashChange = () => {
      applyReferenceHash(referenceHash);
    };
    window.addEventListener("hashchange", onHashChange);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [pageTitle, referenceHash]);

  return <div id="app" style={{ minHeight: "100vh", background: "#f4f4f4" }} />;
}

export default ReferenceMirrorPage;
