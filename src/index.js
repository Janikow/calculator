import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));
const PORT = parseInt(process.env.PORT || "8080", 10);
const ACCESS_KEY = process.env.ACCESS_KEY || "";

// ---------- Wisp (carries all proxied HTTP + WebSocket traffic) ----------
logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  allow_private_ips: false,   // never reach Render's internal network
  allow_loopback_ips: false,
  dns_servers: (process.env.DNS_SERVERS || "1.1.1.3,1.0.0.3").split(","),
});

// ---------- Optional access key ----------
const COOKIE = "pxa";
const token = ACCESS_KEY
  ? crypto.createHmac("sha256", ACCESS_KEY).update("proxy-access").digest("hex")
  : "";

function hasAccess(cookieHeader = "") {
  if (!ACCESS_KEY) return true;
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`));
  if (!m || m[1].length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(m[1]), Buffer.from(token));
}

const OPEN_PATHS = new Set(["/login", "/login.html", "/api/login", "/health", "/style.css"]);

// Simple login attempt limiter: 10 tries per 15 minutes per IP
const attempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { n: 0, t: now };
  if (now - rec.t > 15 * 60 * 1000) { rec.n = 0; rec.t = now; }
  rec.n++;
  attempts.set(ip, rec);
  return rec.n > 10;
}

// ---------- HTTP server ----------
const fastify = Fastify({
  trustProxy: true,
  serverFactory: (handler) =>
    createServer()
      .on("request", (req, res) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        handler(req, res);
      })
      .on("upgrade", (req, socket, head) => {
        if (!req.url.endsWith("/wisp/") || !hasAccess(req.headers.cookie)) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          return socket.destroy();
        }
        wisp.routeRequest(req, socket, head);
      }),
});

fastify.addHook("onRequest", async (req, reply) => {
  const path = req.url.split("?")[0];
  if (OPEN_PATHS.has(path) || hasAccess(req.headers.cookie)) return;
  if (req.method === "GET" && (path === "/" || path.endsWith(".html"))) {
    return reply.redirect("/login");
  }
  return reply.code(401).send("Access key required");
});

fastify.get("/health", async () => "ok");
fastify.get("/login", (req, reply) => reply.sendFile("login.html"));

fastify.post("/api/login", async (req, reply) => {
  if (!ACCESS_KEY) return { ok: true };
  if (tooManyAttempts(req.ip)) return reply.code(429).send({ ok: false, error: "Too many attempts. Wait 15 minutes and try again." });
  const key = String(req.body?.key || "");
  const a = crypto.createHash("sha256").update(key).digest();
  const b = crypto.createHash("sha256").update(ACCESS_KEY).digest();
  if (!crypto.timingSafeEqual(a, b)) return reply.code(401).send({ ok: false, error: "That key isn't right." });
  attempts.delete(req.ip);
  reply.header("Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}`);
  return { ok: true };
});

fastify.register(fastifyStatic, { root: publicPath, decorateReply: true });
fastify.register(fastifyStatic, { root: scramjetPath, prefix: "/scram/", decorateReply: false });
fastify.register(fastifyStatic, { root: libcurlPath, prefix: "/libcurl/", decorateReply: false });
fastify.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });

fastify.setNotFoundHandler((req, reply) =>
  reply.code(404).type("text/plain").send("Not found. Go back to the home page and try again."));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => { await fastify.close(); process.exit(0); });
}

fastify.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`Proxy running on port ${PORT}${ACCESS_KEY ? " (access key on)" : " (no access key set)"}`);
});
