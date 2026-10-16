// Builds netlify/functions/knowledge/knowledge.json for the chatbot.
//
// Sources:
//   1. The website's product catalogue (catalog-data.js, or the live Google Sheet if set in
//      catalog-config.js). Its documents are the ONLY files the bot may send to visitors.
//      With Google access, the text inside those files is learned too.
//   2. PRIVATE Drive folder: learned only, never sent or named.
//   3. The website's own pages (English and Arabic).
//
// Env vars (both optional; without them only sources 1 (names only) and 3 are used):
//   GOOGLE_SERVICE_ACCOUNT_JSON  full JSON key of the Google service account
//   PRIVATE_FOLDER_ID            Drive folder ID of learn-only documents
//
// Run from the website root:  node scripts/sync-knowledge.mjs

import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const SITE_DIR = process.env.SITE_DIR || ".";
const OUT = path.join(SITE_DIR, "netlify/functions/knowledge/knowledge.json");
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const SKIP_DIRS = new Set(["node_modules", ".git", ".github", "netlify", "scripts", ".netlify", "images", "docs"]);
const SKIP_PAGES = /(^|\/)(404|thank-you|chatbot-handoff-form)\.html$/;
const NO_TEXT_TYPES = /OND file|PAN file|BTR file/i;

const { GOOGLE_SERVICE_ACCOUNT_JSON, PRIVATE_FOLDER_ID } = process.env;

// ---------- Google Drive (optional) ----------

let drive = null;
if (GOOGLE_SERVICE_ACCOUNT_JSON) {
  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  drive = google.drive({ version: "v3", auth });
} else {
  console.warn("No GOOGLE_SERVICE_ACCOUNT_JSON: indexing catalogue names and website pages only.");
}

async function listFolder(folderId, prefix = "") {
  const out = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files) {
      const p = prefix ? `${prefix} / ${f.name}` : f.name;
      if (f.mimeType === "application/vnd.google-apps.folder") out.push(...(await listFolder(f.id, p)));
      else out.push({ ...f, path: p });
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return out;
}

async function download(fileId) {
  const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

async function exportAs(fileId, mimeType) {
  const res = await drive.files.export({ fileId, mimeType }, { responseType: "arraybuffer" });
  return Buffer.from(res.data).toString("utf8");
}

async function fileToText(f) {
  const name = (f.name || "").toLowerCase();
  const m = f.mimeType || "";
  try {
    if (m === "application/vnd.google-apps.document") return await exportAs(f.id, "text/plain");
    if (m === "application/vnd.google-apps.presentation") return await exportAs(f.id, "text/plain");
    if (m === "application/vnd.google-apps.spreadsheet") return await exportAs(f.id, "text/csv");
    if (m === "application/pdf" || name.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await download(f.id)));
      const { text } = await extractText(pdf, { mergePages: true });
      return text;
    }
    if (name.endsWith(".docx")) {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.extractRawText({ buffer: await download(f.id) });
      return value;
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await download(f.id), { type: "buffer" });
      return wb.SheetNames.map((s) => `Sheet: ${s}\n${XLSX.utils.sheet_to_csv(wb.Sheets[s])}`).join("\n\n");
    }
    if (/\.(txt|md|csv)$/.test(name) || m.startsWith("text/")) return (await download(f.id)).toString("utf8");
  } catch (err) {
    console.warn(`  ! could not read "${f.path || f.name}": ${err.message}`);
  }
  return ""; // images, scanned PDFs etc.: only the name is indexed
}

// ---------- Text helpers ----------

const clean = (t) => t.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

function chunk(text) {
  const t = clean(text);
  if (!t) return [];
  const parts = [];
  let i = 0;
  while (i < t.length) {
    let end = Math.min(i + CHUNK_SIZE, t.length);
    if (end < t.length) {
      const brk = t.lastIndexOf("\n", end);
      if (brk > i + CHUNK_SIZE / 2) end = brk;
    }
    parts.push(t.slice(i, end).trim());
    if (end >= t.length) break;
    i = end - CHUNK_OVERLAP;
  }
  return parts.filter(Boolean);
}

function htmlToText(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ") // navigation menu repeats on every page
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/dt|\/dd|\/summary)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
}

async function findHtml(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await findHtml(p)));
    else if (e.name.endsWith(".html") && !SKIP_PAGES.test(p.replace(/\\/g, "/"))) out.push(p);
  }
  return out;
}

function driveId(link) {
  const m = String(link).match(/\/file\/d\/([\w-]+)/) || String(link).match(/[?&]id=([\w-]+)/);
  return m ? m[1] : null;
}

// ---------- Catalogue (same rules as catalog.js on the website) ----------

function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function toObjects(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
}

async function loadCatalogue() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of ["catalog-config.js", "catalog-data.js"]) {
    try { vm.runInContext(await fs.readFile(path.join(SITE_DIR, f), "utf8"), sandbox); } catch {}
  }
  const live = sandbox.window.CATALOG_LIVE || {};
  if (live.products && live.documents) {
    try {
      const [p, d] = await Promise.all([live.products, live.documents].map((u) => fetch(u).then((r) => r.text())));
      console.log("Using the live Google Sheet catalogue.");
      return {
        products: toObjects(parseCSV(p)).filter((x) => x.model).map((x) => ({
          brand: x.brand, category: x.category, model: x.model, desc: x["short description"] || "",
          category_ar: x["category (ar)"] || "", desc_ar: x["short description (ar)"] || "" })),
        documents: toObjects(parseCSV(d)).map((x) => ({
          brand: x.brand, model: x.model, type: x.type, name: x["name shown on website"] || x["document name"] || x.type,
          link: x["drive link"], name_ar: x["name shown on website (ar)"] || "" })),
      };
    } catch (err) {
      console.warn(`Live sheet failed (${err.message}); using catalog-data.js.`);
    }
  }
  return sandbox.window.CATALOG_SNAPSHOT || { products: [], documents: [] };
}

// ---------- Build ----------

const chunks = [];
const docs = [];
let n = 0;
const add = (kind, source, text, docId) => {
  for (const c of chunk(text)) chunks.push({ id: `c${++n}`, kind, source, ...(docId ? { docId } : {}), text: c });
};

console.log("Reading product catalogue…");
const cat = await loadCatalogue();
for (const p of cat.products || []) {
  add("website", `Product ${p.brand} ${p.model}`,
    `Product: ${p.brand} ${p.model}\nCategory: ${p.category}${p.category_ar ? " / " + p.category_ar : ""}\n` +
    `Description: ${p.desc}${p.desc_ar ? "\nالوصف: " + p.desc_ar : ""}`);
}
for (const d of cat.documents || []) {
  const id = driveId(d.link);
  if (!id || !/^https?:\/\//.test(d.link) || d.link.includes("EXAMPLE")) continue;
  const docId = `D${docs.length + 1}`;
  const doc = {
    id: docId, brand: d.brand || "", model: d.model || "", type: d.type || "Other",
    name: d.name || d.type || "Document", name_ar: d.name_ar || "",
    view: `https://drive.google.com/file/d/${id}/view`,
    download: `https://drive.google.com/uc?export=download&id=${id}`,
  };
  doc.title = [doc.brand, doc.model, doc.type, doc.name, doc.name_ar].filter(Boolean).join(" | ");
  docs.push(doc);

  let text = "";
  if (drive && !NO_TEXT_TYPES.test(doc.type)) {
    try {
      const meta = await drive.files.get({ fileId: id, fields: "id, name, mimeType", supportsAllDrives: true });
      text = await fileToText(meta.data);
    } catch (err) {
      console.warn(`  ! no access to "${doc.title}": ${err.message}`);
    }
  }
  add("public", doc.title, `Document: ${doc.title}\n${text}`, docId);
}
console.log(`  ${cat.products?.length || 0} products, ${docs.length} shareable documents`);

if (drive && PRIVATE_FOLDER_ID) {
  console.log("Reading PRIVATE folder (learn only)…");
  for (const f of await listFolder(PRIVATE_FOLDER_ID)) {
    add("private", f.path, await fileToText(f));
    console.log(`  + ${f.path}`);
  }
}

console.log("Reading website pages…");
for (const file of await findHtml(SITE_DIR)) {
  const html = await fs.readFile(file, "utf8");
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || file;
  const page = "/" + path.relative(SITE_DIR, file).replace(/\\/g, "/");
  add("website", `Website ${page}`, `Website page: ${title} (${page})\n${htmlToText(html)}`);
}

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), chunks, docs }));
console.log(`Done: ${docs.length} shareable documents, ${chunks.length} text chunks -> ${OUT}`);
