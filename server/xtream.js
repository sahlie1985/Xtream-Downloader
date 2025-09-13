import fetch from "node-fetch";
import { URL, URLSearchParams } from "url";

function normalizeBaseUrl(input) {
  if (!input) throw new Error("Missing baseUrl");
  let url = String(input).trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  // Remove trailing slashes
  url = url.replace(/\/+$/, "");
  return url;
}

function buildPlayerApiUrl(baseUrl, username, password, extraParams = {}) {
  const root = normalizeBaseUrl(baseUrl);
  const u = new URL("player_api.php", root + "/");
  const params = new URLSearchParams({ username, password, ...extraParams });
  u.search = params.toString();
  return u.toString();
}

function buildXmltvUrl(baseUrl, username, password) {
  const root = normalizeBaseUrl(baseUrl);
  const u = new URL("xmltv.php", root + "/");
  const params = new URLSearchParams({ username, password });
  u.search = params.toString();
  return u.toString();
}

function buildStreamUrl(baseUrl, kind, username, password, id, format) {
  const root = normalizeBaseUrl(baseUrl);
  const safeKind = kind === "movie" || kind === "series" ? kind : "live";
  const ext = format === "m3u8" ? ".m3u8" : ".ts";
  const path = `${safeKind}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(String(id))}${ext}`;
  return `${root}/${path}`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, redirect: "follow" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getAccountInfo({ baseUrl, username, password }) {
  const url = buildPlayerApiUrl(baseUrl, username, password);
  return fetchJson(url);
}

async function getLiveCategories({ baseUrl, username, password }) {
  const url = buildPlayerApiUrl(baseUrl, username, password, { action: "get_live_categories" });
  return fetchJson(url);
}

async function getLiveStreams({ baseUrl, username, password }) {
  const url = buildPlayerApiUrl(baseUrl, username, password, { action: "get_live_streams" });
  return fetchJson(url);
}

async function getVodCategories({ baseUrl, username, password }) {
  const url = buildPlayerApiUrl(baseUrl, username, password, { action: "get_vod_categories" });
  return fetchJson(url);
}

async function getVodStreams({ baseUrl, username, password }) {
  const url = buildPlayerApiUrl(baseUrl, username, password, { action: "get_vod_streams" });
  return fetchJson(url);
}

async function getSeriesCategories({ baseUrl, username, password }) {
  const url = buildPlayerApiUrl(baseUrl, username, password, { action: "get_series_categories" });
  return fetchJson(url);
}

async function getSeriesList({ baseUrl, username, password }) {
  const url = buildPlayerApiUrl(baseUrl, username, password, { action: "get_series" });
  return fetchJson(url);
}

async function getShortEpg({ baseUrl, username, password, stream_id, limit = 50 }) {
  const url = buildPlayerApiUrl(baseUrl, username, password, { action: "get_short_epg", stream_id, limit });
  return fetchJson(url);
}

function toM3UEntry({ name, url, tvgId = "", tvgName = "", tvgLogo = "", groupTitle = "" }) {
  const attrs = [
    tvgId ? `tvg-id=\"${tvgId}\"` : null,
    tvgName ? `tvg-name=\"${tvgName}\"` : null,
    tvgLogo ? `tvg-logo=\"${tvgLogo}\"` : null,
    groupTitle ? `group-title=\"${groupTitle}\"` : null,
  ].filter(Boolean).join(" ");
  return `#EXTINF:-1 ${attrs},${name}\n${url}`;
}

function buildM3U({ title = "Xtream Playlist", entries }) {
  const header = `#EXTM3U x-tvg-url=\"\" name=\"${title}\"`; // x-tvg-url empty by default
  return [header, ...entries].join("\n");
}

function mapLiveToEntry(baseUrl, username, password, outputFormat, item, categoriesById) {
  const name = item.name || item.stream_display_name || `Live ${item.stream_id}`;
  const url = buildStreamUrl(baseUrl, "live", username, password, item.stream_id, outputFormat === "hls" ? "m3u8" : "ts");
  const tvgLogo = item.stream_icon || "";
  const groupTitle = categoriesById?.[String(item.category_id)]?.category_name || "Live";
  return toM3UEntry({ name, url, tvgLogo, groupTitle });
}

function mapVodToEntry(baseUrl, username, password, outputFormat, item, categoriesById) {
  const name = item.name || item.title || `VOD ${item.stream_id || item.id}`;
  // VOD path uses movie
  const url = buildStreamUrl(baseUrl, "movie", username, password, item.stream_id || item.id, outputFormat === "hls" ? "m3u8" : "ts");
  const tvgLogo = item.stream_icon || item.cover || "";
  const groupTitle = categoriesById?.[String(item.category_id)]?.category_name || "VOD";
  return toM3UEntry({ name, url, tvgLogo, groupTitle });
}

export default {
  normalizeBaseUrl,
  buildPlayerApiUrl,
  buildXmltvUrl,
  buildStreamUrl,
  getAccountInfo,
  getLiveCategories,
  getLiveStreams,
  getVodCategories,
  getVodStreams,
  getSeriesCategories,
  getSeriesList,
  getShortEpg,
  toM3UEntry,
  buildM3U,
  mapLiveToEntry,
  mapVodToEntry,
};
