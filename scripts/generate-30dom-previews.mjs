#!/usr/bin/env node

import http from "node:http";
import path from "node:path";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SUBMODULE_ROOT = path.join(ROOT, "30DoM-2025");
const MAPS_CONTENT_ROOT = path.join(ROOT, "src", "content", "maps");
const MAPS_ASSETS_ROOT = path.join(MAPS_CONTENT_ROOT, "assets");
const REPO_OWNER = "urban-data-science-eaamo";
const REPO_NAME = "30DoM-2025";
const REPO_BRANCH = "main";
const BLOB_BASE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${REPO_BRANCH}`;
const MAP_DIR_PATTERN = /^\d{4}-\d{2}-\d{2}\s-\s/;

const CONCURRENCY = 2;
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 900;
const IMAGE_QUALITY = 78;
const execFileAsync = promisify(execFile);

const mapExtensionPriority = ["html", "mp4", "m4v", "webm", "png", "jpg", "jpeg", "gif", "svg", "pdf"];
const analysisPriority = ["DESCRIPTION.md", "README.md", "BLUESKY.md", "map.html", "MAP.html", "interactiveMAP.html", "MAP.pdf", "map.pdf"];

const mediaExtRe = /\.(png|jpe?g|webp|gif|svg|mp4|m4v|webm|html?|pdf)$/i;
const imageExtRe = /\.(png|jpe?g|webp|gif|svg)$/i;
const videoExtRe = /\.(mp4|m4v|webm)$/i;
const htmlExtRe = /\.(html?)$/i;
const pdfExtRe = /\.(pdf)$/i;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function parseCsvLine(input) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  values.push(current.trim());
  return values;
}

function normalizeDate(value) {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [mm, dd, yyyy] = parts;
  if (!mm || !dd || !yyyy) return null;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toBlobUrl(relPath) {
  return `${BLOB_BASE}/${relPath.split("/").map(encodeURIComponent).join("/")}`;
}

function fileTypeFromExt(filePath) {
  if (!filePath) return "none";
  if (videoExtRe.test(filePath)) return "video";
  if (htmlExtRe.test(filePath)) return "html";
  if (pdfExtRe.test(filePath)) return "pdf";
  return "image";
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadSignupMetadata() {
  const signupPath = path.join(SUBMODULE_ROOT, "signup.csv");
  const metadata = new Map();
  if (!(await pathExists(signupPath))) return metadata;

  const csv = await readFile(signupPath, "utf-8");
  const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return metadata;

  const headers = parseCsvLine(lines[0]);
  const idxDate = headers.indexOf("Date");
  const idxTitle = headers.indexOf("Challenge Name");
  const idxMember1 = headers.indexOf("Member 1");
  const idxMember2 = headers.indexOf("Member 2 (optional)");

  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    const date = normalizeDate(row[idxDate] ?? "");
    if (!date) continue;
    const title = (row[idxTitle] ?? "").trim();
    const contributors = [(row[idxMember1] ?? "").trim(), (row[idxMember2] ?? "").trim()].filter(Boolean);
    metadata.set(date, { title, contributors });
  }

  return metadata;
}

function scoreCandidate(filePath) {
  const name = path.basename(filePath).toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  const extPriority = mapExtensionPriority.indexOf(ext);
  const p = extPriority === -1 ? 99 : extPriority;
  const mapNameBoost = name.startsWith("map.") ? 0 : (name.includes("map") ? 1 : 2);
  return p * 10 + mapNameBoost;
}

async function listFilesInDir(dirPath, prefix = "") {
  const items = await readdir(dirPath, { withFileTypes: true });
  return items.filter(i => i.isFile()).map(i => `${prefix}${i.name}`);
}

async function discoverMediaFile(dirName) {
  const root = path.join(SUBMODULE_ROOT, dirName);
  let candidates = [];
  let topFiles = [];
  try {
    topFiles = await listFilesInDir(root);
    candidates.push(...topFiles.filter(name => mediaExtRe.test(name)));
  } catch {
    return undefined;
  }

  for (const nested of ["map", "Map"]) {
    const nestedDir = path.join(root, nested);
    if (await pathExists(nestedDir)) {
      const nestedFiles = await listFilesInDir(nestedDir, `${nested}/`);
      candidates.push(...nestedFiles.filter(name => mediaExtRe.test(name)));
    }
  }

  if (candidates.length === 0) return undefined;

  // Treat GIF-only folders as incomplete submissions for homepage maps.
  const nonGifCandidates = candidates.filter(file => !/\.gif$/i.test(file));
  if (nonGifCandidates.length === 0) return undefined;

  for (const ext of mapExtensionPriority) {
    const exact = nonGifCandidates.find(file => path.basename(file).toLowerCase() === `map.${ext}`);
    if (exact) return `${dirName}/${exact}`;
  }

  const sorted = nonGifCandidates.sort((a, b) => scoreCandidate(a) - scoreCandidate(b));
  return `${dirName}/${sorted[0]}`;
}

async function discoverAnalysisPath(dirName, chosenMediaRelPath) {
  const dirPath = path.join(SUBMODULE_ROOT, dirName);
  for (const candidate of analysisPriority) {
    const fullPath = path.join(dirPath, candidate);
    if (await pathExists(fullPath)) {
      return `${dirName}/${candidate}`;
    }
  }
  return chosenMediaRelPath;
}

function buildPlaceholderSvg(title, date, source) {
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeDate = date.replace(/&/g, "&amp;");
  const safeSource = source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#192a3a"/>
        <stop offset="100%" stop-color="#34516d"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect x="36" y="36" width="${IMAGE_WIDTH - 72}" height="${IMAGE_HEIGHT - 72}" rx="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)"/>
    <text x="72" y="130" font-size="34" font-family="Inter, Arial, sans-serif" fill="#d8e7f5">${safeDate}</text>
    <text x="72" y="210" font-size="54" font-weight="700" font-family="Inter, Arial, sans-serif" fill="#ffffff">${safeTitle}</text>
    <text x="72" y="${IMAGE_HEIGHT - 82}" font-size="30" font-family="Inter, Arial, sans-serif" fill="#d8e7f5">Source: ${safeSource}</text>
  </svg>`;
}

async function writePlaceholderImage(outputPath, title, date, source) {
  const svg = buildPlaceholderSvg(title, date, source);
  await sharp(Buffer.from(svg))
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: IMAGE_QUALITY })
    .toFile(outputPath);
}

async function optimizeImage(inputPath, outputPath) {
  await sharp(inputPath)
    .rotate()
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: IMAGE_QUALITY })
    .toFile(outputPath);
}

async function screenshotLocatorToWebp(page, selectors, outputPath) {
  for (const selector of selectors) {
    const node = page.locator(selector).first();
    try {
      const count = await node.count();
      if (count === 0) continue;
      await node.waitFor({ state: "visible", timeout: 3000 });
      const buffer = await node.screenshot();
      await sharp(buffer)
        .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: IMAGE_QUALITY })
        .toFile(outputPath);
      return true;
    } catch {
      // try next selector
    }
  }
  return false;
}

async function screenshotPageToWebp(page, outputPath) {
  const buffer = await page.screenshot({ fullPage: false });
  await sharp(buffer)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: IMAGE_QUALITY })
    .toFile(outputPath);
}

async function captureHtmlPreview(browser, url, outputPath, dirName) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1020 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => undefined);
    await page.waitForTimeout(6000);
    const selectors = dirName.includes("Urban")
      ? [".wrap", ".map-panel", "body"]
      : [".folium-map", "#map", ".plotly-graph-div", "svg#map", "canvas", "body"];
    const captured = await screenshotLocatorToWebp(page, selectors, outputPath);
    if (!captured) {
      await screenshotPageToWebp(page, outputPath);
    }

    // Some embeds paint late; retry once with longer delay if capture looks blank-like.
    const avgStdDev = await getImageStdDev(outputPath);
    if (avgStdDev < 6) {
      await page.waitForTimeout(5000);
      const recaptured = await screenshotLocatorToWebp(page, selectors, outputPath);
      if (!recaptured) {
        await screenshotPageToWebp(page, outputPath);
      }
    }
  } finally {
    await page.close();
  }
}

async function captureHtmlEmergencyPreview(browser, url, outputPath, dirName) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1020 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(7000);

    const emergencySelectors = dirName.includes("Urban")
      ? [".wrap", ".map-panel", "body"]
      : [".folium-map", "#map", ".plotly-graph-div", "svg#map", "canvas", "body"];

    const captured = await screenshotLocatorToWebp(page, emergencySelectors, outputPath);
    if (!captured) {
      await screenshotPageToWebp(page, outputPath);
    }
  } finally {
    await page.close();
  }
}

async function captureHtmlStaticPreview(browser, url, outputPath, dirName) {
  const context = await browser.newContext({
    viewport: { width: 1360, height: 1020 },
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1200);
    const staticSelectors = dirName.includes("Urban") ? [".wrap", ".map-panel", "body"] : ["body"];
    const captured = await screenshotLocatorToWebp(page, staticSelectors, outputPath);
    if (!captured) {
      await screenshotPageToWebp(page, outputPath);
    }
  } finally {
    await context.close();
  }
}

async function getImageStdDev(outputPath) {
  const stats = await sharp(outputPath).stats();
  return stats.channels.reduce((sum, channel) => sum + channel.stdev, 0) / stats.channels.length;
}

async function capturePdfPreview(browser, url, outputPath) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1020 } });
  try {
    await page.setContent(`<html><body style="margin:0;background:#0f172a"><iframe src="${url}" style="border:0;width:1360px;height:1020px;"></iframe></body></html>`);
    await page.waitForTimeout(1600);
    await screenshotPageToWebp(page, outputPath);
  } finally {
    await page.close();
  }
}

async function rasterizePdfToWebp(localPdfPath, outputPath) {
  const tempStem = path.join(MAPS_ASSETS_ROOT, `.__pdf_tmp_${Date.now()}_${Math.floor(Math.random() * 100000)}`);
  const tempPngPath = `${tempStem}.png`;

  try {
    await execFileAsync("pdftoppm", ["-f", "1", "-singlefile", "-png", localPdfPath, tempStem], {
      cwd: ROOT,
      timeout: 30000,
    });
    await sharp(tempPngPath)
      .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: IMAGE_QUALITY })
      .toFile(outputPath);
  } finally {
    await rm(tempPngPath, { force: true });
  }
}

async function captureVideoPreview(browser, url, outputPath) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1020 } });
  try {
    await page.setContent(`<html><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center"><video id="v" src="${url}" style="width:1280px;height:960px;object-fit:contain" muted playsinline></video></body></html>`);
    await page.waitForTimeout(2200);
    const node = page.locator("#v");
    const buffer = await node.screenshot();
    await sharp(buffer)
      .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: IMAGE_QUALITY })
      .toFile(outputPath);
  } finally {
    await page.close();
  }
}

async function captureImagePreview(browser, url, outputPath) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1020 } });
  try {
    await page.setContent(`<html><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center"><img id="i" src="${url}" style="max-width:1280px;max-height:960px;object-fit:contain"/></body></html>`);
    await page.waitForTimeout(900);
    const node = page.locator("#i");
    const buffer = await node.screenshot();
    await sharp(buffer)
      .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: IMAGE_QUALITY })
      .toFile(outputPath);
  } finally {
    await page.close();
  }
}

async function withTimeout(promise, ms, errorLabel) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${errorLabel} timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function createStaticServer(rootPath) {
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      let reqPath = decodeURIComponent(requestUrl.pathname);
      if (reqPath === "/") reqPath = "/index.html";
      const absPath = path.normalize(path.join(rootPath, reqPath));
      if (!absPath.startsWith(rootPath)) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }

      let targetPath = absPath;
      const fileStats = await stat(targetPath);
      if (fileStats.isDirectory()) {
        targetPath = path.join(targetPath, "index.html");
      }

      const ext = path.extname(targetPath).toLowerCase();
      res.setHeader("Content-Type", mimeTypes[ext] ?? "application/octet-stream");
      createReadStream(targetPath).pipe(res);
    } catch {
      res.statusCode = 404;
      res.end("Not Found");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(true));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to create preview server");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

function markdownList(values) {
  if (!values || values.length === 0) return "[]";
  return `[${values.map(v => JSON.stringify(v)).join(", ")}]`;
}

function mapToMarkdown(item) {
  const analysisUrlLine = item.analysisUrl ? `analysisUrl: ${JSON.stringify(item.analysisUrl)}\n` : "";
  return `---
id: ${JSON.stringify(item.id)}
date: ${item.date}
title: ${JSON.stringify(item.title)}
source: ${JSON.stringify(item.source)}
sourceContributors: ${markdownList(item.sourceContributors)}
${analysisUrlLine}analysisLabel: ${JSON.stringify(item.analysisLabel)}
submissionType: ${item.submissionType}
previewImage: ${JSON.stringify(item.previewImage)}
---
`;
}

async function runWithConcurrency(items, limit, handler) {
  const workers = Array.from({ length: limit }, async () => {
    while (items.length > 0) {
      const next = items.shift();
      if (!next) return;
      await handler(next);
    }
  });
  await Promise.all(workers);
}

async function main() {
  await mkdir(MAPS_CONTENT_ROOT, { recursive: true });
  await mkdir(MAPS_ASSETS_ROOT, { recursive: true });

  // Clean generated map entries and assets before regeneration.
  const existingContent = await readdir(MAPS_CONTENT_ROOT, { withFileTypes: true });
  for (const entry of existingContent) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      await rm(path.join(MAPS_CONTENT_ROOT, entry.name), { force: true });
    }
  }
  await rm(MAPS_ASSETS_ROOT, { recursive: true, force: true });
  await mkdir(MAPS_ASSETS_ROOT, { recursive: true });

  const signupMeta = await loadSignupMetadata();
  const dirs = await readdir(SUBMODULE_ROOT, { withFileTypes: true });
  const challengeDirs = dirs
    .filter(d => d.isDirectory() && MAP_DIR_PATTERN.test(d.name))
    .map(d => d.name)
    .sort((a, b) => b.localeCompare(a));

  const { server, baseUrl } = await createStaticServer(SUBMODULE_ROOT);
  const browser = await chromium.launch({ headless: true });

  let generated = 0;
  let placeholders = 0;
  let htmlShots = 0;
  let skippedNoMedia = 0;

  try {
    const queue = [...challengeDirs];
    await runWithConcurrency(queue, CONCURRENCY, async (dirName) => {
      const [date, ...rest] = dirName.split(" - ");
      const fallbackTitle = rest.join(" - ").trim() || "Map";
      const meta = signupMeta.get(date);
      const title = meta?.title?.trim() || fallbackTitle;
      const contributors = meta?.contributors ?? [];
      const source = contributors.length > 0 ? contributors.join(", ") : "Source unavailable";

      const mediaRelPath = await discoverMediaFile(dirName);
      if (!mediaRelPath) {
        skippedNoMedia += 1;
        return;
      }
      const analysisRelPath = await discoverAnalysisPath(dirName, mediaRelPath);
      const submissionType = fileTypeFromExt(mediaRelPath);

      const slug = slugify(`${date}-${title}`);
      const outputAssetName = `${slug}.webp`;
      const outputAssetPath = path.join(MAPS_ASSETS_ROOT, outputAssetName);

      try {
        const localMediaPath = path.join(SUBMODULE_ROOT, mediaRelPath);
        if (imageExtRe.test(mediaRelPath)) {
          try {
            await optimizeImage(localMediaPath, outputAssetPath);
          } catch {
            const mediaUrl = `${baseUrl}/${mediaRelPath.split("/").map(encodeURIComponent).join("/")}`;
            await withTimeout(captureImagePreview(browser, mediaUrl, outputAssetPath), 22000, "image capture");
          }
        } else if (videoExtRe.test(mediaRelPath)) {
          const mediaUrl = `${baseUrl}/${mediaRelPath.split("/").map(encodeURIComponent).join("/")}`;
          await withTimeout(captureVideoPreview(browser, mediaUrl, outputAssetPath), 30000, "video capture");
        } else if (htmlExtRe.test(mediaRelPath)) {
          const mediaUrl = `${baseUrl}/${mediaRelPath.split("/").map(encodeURIComponent).join("/")}`;
          try {
            await withTimeout(captureHtmlPreview(browser, mediaUrl, outputAssetPath, dirName), 75000, "html capture");
          } catch {
            await withTimeout(captureHtmlEmergencyPreview(browser, mediaUrl, outputAssetPath, dirName), 35000, "html emergency capture");
          }
          if (dirName.includes("Urban")) {
            const stddev = await getImageStdDev(outputAssetPath);
            if (stddev < 6) {
              await withTimeout(captureHtmlStaticPreview(browser, mediaUrl, outputAssetPath, dirName), 30000, "html static capture");
            }
          }
          htmlShots += 1;
        } else if (pdfExtRe.test(mediaRelPath)) {
          try {
            await withTimeout(rasterizePdfToWebp(localMediaPath, outputAssetPath), 30000, "pdf raster");
          } catch {
            const mediaUrl = `${baseUrl}/${mediaRelPath.split("/").map(encodeURIComponent).join("/")}`;
            await withTimeout(capturePdfPreview(browser, mediaUrl, outputAssetPath), 30000, "pdf capture");
          }
        } else {
          await writePlaceholderImage(outputAssetPath, title, date, source);
          placeholders += 1;
        }
      } catch (error) {
        console.warn(`Preview generation failed for ${dirName}:`, error instanceof Error ? error.message : String(error));
        await writePlaceholderImage(outputAssetPath, title, date, source);
        placeholders += 1;
      }

      const analysisUrl = analysisRelPath ? toBlobUrl(analysisRelPath) : undefined;
      const mdPath = path.join(MAPS_CONTENT_ROOT, `${slug}.md`);
      const md = mapToMarkdown({
        id: dirName,
        date,
        title,
        source,
        sourceContributors: contributors,
        analysisUrl,
        analysisLabel: "View analysis",
        submissionType,
        previewImage: `./assets/${outputAssetName}`,
      });
      await writeFile(mdPath, md, "utf-8");
      generated += 1;
    });
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  console.log(`Generated map entries: ${generated}`);
  console.log(`HTML/embed screenshots: ${htmlShots}`);
  console.log(`Placeholder previews: ${placeholders}`);
  console.log(`Skipped (no map media found): ${skippedNoMedia}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
