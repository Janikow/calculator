"use strict";
const SEARCH = "https://duckduckgo.com/?q=%s";

const $ = (id) => document.getElementById(id);
const msg = $("msg");
const barUrl = $("bar-url");

const { ScramjetController } = $scramjetLoadController();
const scramjet = new ScramjetController({
  files: {
    wasm: "/scram/scramjet.wasm.wasm",
    all: "/scram/scramjet.all.js",
    sync: "/scram/scramjet.sync.js",
  },
});
scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
let frame = null;
let ready = false;

// libcurl loads its WebAssembly lazily; wait until it can actually make a request
async function warmUp() {
  const client = new BareMux.BareClient();
  for (let i = 0; i < 40; i++) {
    try {
      await client.fetch("https://example.com/", { method: "HEAD" });
      return;
    } catch (err) {
      if (!/wasm not loaded/i.test(String(err && err.message))) return; // transport is up
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

function toUrl(input) {
  input = input.trim();
  try { return new URL(input).toString(); } catch {}
  try {
    const u = new URL("https://" + input);
    if (u.hostname.includes(".") && !input.includes(" ")) return u.toString();
  } catch {}
  return SEARCH.replace("%s", encodeURIComponent(input));
}

async function setup() {
  if (!("serviceWorker" in navigator)) {
    throw new Error(location.protocol === "https:" || location.hostname === "localhost"
      ? "This browser doesn't support service workers."
      : "Open this site over https:// so it can start.");
  }
  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
  if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
    await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
  }
  if (!ready) { await warmUp(); ready = true; }
}

async function open(input) {
  if (!input.trim()) { msg.textContent = "Type an address or a search first."; return; }
  msg.textContent = "Starting…";
  try {
    await setup();
  } catch (err) {
    msg.textContent = "Couldn't start the proxy: " + err.message;
    return;
  }
  msg.textContent = "";

  if (!frame) {
    frame = scramjet.createFrame();
    frame.frame.title = "Proxied page";
    $("frame-wrap").appendChild(frame.frame);
    frame.addEventListener("urlchange", (e) => {
      barUrl.value = e.url;
      try { document.title = new URL(e.url).hostname; } catch {}
    });
  }
  const url = toUrl(input);
  barUrl.value = url;
  document.body.classList.add("browsing");
  frame.go(url);
}

$("start-form").addEventListener("submit", (e) => { e.preventDefault(); open($("start-url").value); });
$("bar-form").addEventListener("submit", (e) => { e.preventDefault(); open(barUrl.value); barUrl.blur(); });
$("back").addEventListener("click", () => frame && frame.back());
$("fwd").addEventListener("click", () => frame && frame.forward());
$("reload").addEventListener("click", () => frame && frame.reload());
$("home").addEventListener("click", () => {
  document.body.classList.remove("browsing");
  document.title = "Proxy";
  $("start-url").value = "";
  $("start-url").focus();
});
