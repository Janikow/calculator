# Scramjet Proxy (Render-ready)

A full web proxy built on [Scramjet](https://github.com/MercuryWorkshop/scramjet) by Mercury Workshop.
A service worker rewrites pages in your browser, and all traffic (including WebSockets) is tunneled
to this server over [Wisp](https://github.com/MercuryWorkshop/wisp-js). That means logins, cookies,
live chat, and many web games keep working, unlike simple URL-rewriting proxies.

## Run locally

```bash
npm install
npm start
# open http://localhost:8080
```

Needs Node 20 or newer. Service workers only run on `https://` or `localhost`.

## Deploy on Render

1. Push this folder to a GitHub repo.
2. In Render: **New → Blueprint**, pick the repo. It reads `render.yaml`.
3. Render generates a random `ACCESS_KEY` for you. Find it under the service's **Environment** tab
   (or replace it with your own). Visitors must enter it once; a cookie keeps them signed in for 30 days.
   To run it with no key, delete the `ACCESS_KEY` variable.

## Settings (environment variables)

| Variable      | What it does                                                              |
|---------------|---------------------------------------------------------------------------|
| `ACCESS_KEY`  | Password for the proxy. Leave unset to make it open to anyone.             |
| `DNS_SERVERS` | DNS used for proxied sites. Default `1.1.1.3,1.0.0.3` (Cloudflare with malware and adult-content filtering). Use `1.1.1.1,1.0.0.1` for unfiltered. |

## Good to know

- Render's free tier sleeps after ~15 minutes idle; the first visit can take up to a minute.
- Free Render instances share datacenter IPs, so Google, YouTube and some other sites may show CAPTCHAs or block you.
- Requests to private and internal network addresses are blocked.
- This uses Scramjet 1.1, the version the official Scramjet-App currently ships. The console may suggest upgrading to v2; that's expected.

## Credits and license

Scramjet, bare-mux, libcurl-transport and wisp-js are by Mercury Workshop. This server and interface are
modeled on the official [Scramjet-App](https://github.com/MercuryWorkshop/Scramjet-App), which is AGPL-3.0;
keep this repo public if you host it for others.
