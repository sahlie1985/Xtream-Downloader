import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import xt from "./xtream.js";
import fetch from "node-fetch";
import { URL as NodeURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev", {
  skip: (req) => req.path.startsWith("/api") && req.method === "POST",
}));

function reqCreds(req) {
  const { baseUrl, username, password } = req.body || {};
  if (!baseUrl || !username || !password) {
    const err = new Error("Missing baseUrl, username or password");
    err.status = 400;
    throw err;
  }
  return { baseUrl, username, password };
}

app.post("/api/account", async (req, res, next) => {
  try {
    const creds = reqCreds(req);
    const data = await xt.getAccountInfo(creds);
    res.json({ user_info: data.user_info, server_info: data.server_info });
  } catch (e) { next(e); }
});

app.post("/api/live/categories", async (req, res, next) => {
  try { res.json(await xt.getLiveCategories(reqCreds(req))); } catch (e) { next(e); }
});
app.post("/api/live/streams", async (req, res, next) => {
  try {
    const creds = reqCreds(req);
    const { category_id } = req.body || {};
    const [cats, streams] = await Promise.all([
      xt.getLiveCategories(creds),
      xt.getLiveStreams(creds),
    ]);
    const filtered = category_id ? streams.filter(s => String(s.category_id) === String(category_id)) : streams;
    res.json({ categories: cats, streams: filtered });
  } catch (e) { next(e); }
});

app.post("/api/vod/categories", async (req, res, next) => {
  try { res.json(await xt.getVodCategories(reqCreds(req))); } catch (e) { next(e); }
});
app.post("/api/vod/streams", async (req, res, next) => {
  try {
    const creds = reqCreds(req);
    const { category_id } = req.body || {};
    const [cats, streams] = await Promise.all([
      xt.getVodCategories(creds),
      xt.getVodStreams(creds),
    ]);
    const filtered = category_id ? streams.filter(s => String(s.category_id) === String(category_id)) : streams;
    res.json({ categories: cats, streams: filtered });
  } catch (e) { next(e); }
});

app.post("/api/series/categories", async (req, res, next) => {
  try { res.json(await xt.getSeriesCategories(reqCreds(req))); } catch (e) { next(e); }
});
app.post("/api/series/list", async (req, res, next) => {
  try {
    const creds = reqCreds(req);
    const { category_id } = req.body || {};
    const [cats, series] = await Promise.all([
      xt.getSeriesCategories(creds),
      xt.getSeriesList(creds),
    ]);
    const filtered = category_id ? series.filter(s => String(s.category_id) === String(category_id)) : series;
    res.json({ categories: cats, series: filtered });
  } catch (e) { next(e); }
});

app.post("/api/stream/url", (req, res, next) => {
  try {
    const { baseUrl, username, password, kind = "live", id, format = "mpegts" } = req.body || {};
    if (!baseUrl || !username || !password || !id) {
      const err = new Error("Missing baseUrl, username, password or id");
      err.status = 400; throw err;
    }
    const ext = format === "hls" ? "m3u8" : "ts";
    const url = xt.buildStreamUrl(baseUrl, kind === "movie" || kind === "series" ? kind : "live", username, password, id, ext);
    res.json({ url, vlc: `vlc://${url}` });
  } catch (e) { next(e); }
});

app.post("/api/m3u", async (req, res, next) => {
  try {
    const creds = reqCreds(req);
    const { scope = "all", output = "mpegts" } = req.body || {};

    const [liveCats, liveStreams, vodCats, vodStreams] = await Promise.all([
      xt.getLiveCategories(creds),
      xt.getLiveStreams(creds),
      xt.getVodCategories(creds),
      xt.getVodStreams(creds),
    ]);
    const catIndex = (arr) => Object.fromEntries(arr.map(c => [String(c.category_id), c]));
    const liveCatById = catIndex(liveCats || []);
    const vodCatById = catIndex(vodCats || []);

    const entries = [];
    if (scope === "all" || scope === "live") {
      for (const s of liveStreams || []) entries.push(xt.mapLiveToEntry(creds.baseUrl, creds.username, creds.password, output === "hls" ? "hls" : "mpegts", s, liveCatById));
    }
    if (scope === "all" || scope === "vod") {
      for (const s of vodStreams || []) entries.push(xt.mapVodToEntry(creds.baseUrl, creds.username, creds.password, output === "hls" ? "hls" : "mpegts", s, vodCatById));
    }

    const m3u = xt.buildM3U({ title: `Xtream ${scope}`, entries });
    res.setHeader("Content-Type", "application/x-mpegURL");
    res.setHeader("Content-Disposition", `attachment; filename="xtream_${scope}.m3u"`);
    res.send(m3u);
  } catch (e) { next(e); }
});

app.post("/api/one.m3u", (req, res, next) => {
  try {
    const { baseUrl, username, password, kind = "live", id, name = "Stream", output = "mpegts" } = req.body || {};
    if (!baseUrl || !username || !password || !id) {
      const err = new Error("Missing baseUrl, username, password or id");
      err.status = 400; throw err;
    }
    const url = xt.buildStreamUrl(baseUrl, kind === "movie" || kind === "series" ? kind : "live", username, password, id, output === "hls" ? "m3u8" : "ts");
    const m3u = xt.buildM3U({ title: name, entries: [xt.toM3UEntry({ name, url })] });
    res.setHeader("Content-Type", "application/x-mpegURL");
    res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9]+/gi, "_")}.m3u"`);
    res.send(m3u);
  } catch (e) { next(e); }
});

app.post("/api/xmltv", async (req, res, next) => {
  try {
    const { baseUrl, username, password } = req.body || {};
    if (!baseUrl || !username || !password) {
      const err = new Error("Missing baseUrl, username or password");
      err.status = 400; throw err;
    }
    const url = xt.buildXmltvUrl(baseUrl, username, password);
    const response = await fetch(url);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/xml");
    res.setHeader("Content-Disposition", `attachment; filename="guide.xml"`);
    response.body.pipe(res);
  } catch (e) { next(e); }
});

// Simple HLS proxy to bypass CORS and rewrite manifests
app.get("/api/proxy/hls", async (req, res, next) => {
  try {
    const target = req.query.url;
    if (!target || !/^https?:\/\//i.test(target)) {
      const err = new Error("Missing or invalid url"); err.status = 400; throw err;
    }
    const u = new NodeURL(target);
    const upstream = await fetch(target, {
      headers: {
        // forward some headers for better compatibility
        "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
        "accept": req.headers["accept"] || "*/*",
        "range": req.headers["range"] || undefined,
        "accept-encoding": req.headers["accept-encoding"] || undefined,
        "referer": u.origin,
      },
    });
    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).send(await upstream.text());
      return;
    }
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    // If manifest, rewrite URIs to go back through proxy
    const isManifest = /application\/(vnd\.apple\.mpegurl|x-mpegURL)|\.m3u8(\b|$)/i.test(contentType) || /\.m3u8(\?|$)/i.test(target);
    if (isManifest) {
      const text = await upstream.text();
      const base = new NodeURL(target);
      const proxyPrefix = "/api/proxy/hls?url=";
      const out = text.split(/\r?\n/).map(line => {
        if (!line || line.startsWith("#")) return line;
        try {
          const abs = new NodeURL(line, base).toString();
          return proxyPrefix + encodeURIComponent(abs);
        } catch {
          return line;
        }
      }).join("\n");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.send(out);
      return;
    }
    // Otherwise stream bytes (segments, keys, etc.)
    res.setHeader("Content-Type", contentType);
    // Pass through partial content headers if present
    for (const h of ["content-length","accept-ranges","content-range","cache-control","expires","last-modified"]) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.status(upstream.status);
    upstream.body.pipe(res);
  } catch (e) { next(e); }
});

// Serve static frontend
app.use(express.static(path.join(__dirname, "../public")));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`Xtream Viewer listening on http://localhost:${PORT}`);
});
