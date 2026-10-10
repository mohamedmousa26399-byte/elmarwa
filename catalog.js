/* Elmarwa catalogue: reads the Product Catalogue (live Google Sheet or snapshot)
   and renders products + documents on brand pages and the Downloads page. */
(function () {
  "use strict";

  var BRAND_SLUG = {
    "huawei": "huawei", "huawei fusionsolar": "huawei", "jinko solar": "jinko-solar", "jinko": "jinko-solar",
    "sigenergy": "sigenergy", "invt": "invt", "newmax": "newmax",
    "h.i.s. (hikra)": "his", "h.i.s.": "his", "his": "his", "hikra": "his",
    "suntree": "suntree", "elmarwa": "elmarwa"
  };
  var GROUP_OF = {
    "pv modules": "modules", "on-grid inverters": "inverters", "hybrid inverters": "inverters", "inverters": "inverters",
    "monitoring": "monitoring", "c&i battery": "storage", "home battery": "storage", "batteries": "storage",
    "battery storage": "storage", "solar pump drives": "pumping", "mounting structures": "mounting",
    "dc cables": "cables", "dc protection": "protection"
  };
  var GROUP_NAMES = [["modules", "PV modules"], ["inverters", "Inverters"], ["storage", "Batteries"], ["monitoring", "Monitoring"],
    ["pumping", "Solar pump drives"], ["mounting", "Mounting structures"], ["cables", "DC cables"], ["protection", "DC protection"]];
  var TYPE_ORDER = ["Datasheet", "Product catalogue", "User manual", "Quick guide", "Installation manual", "O&M manual",
    "Unpacking manual", "Unloading manual", "Cleaning manual", "OND file", "PAN file", "Other", "Certificate", "Test report"];
  var PLURAL = { "Datasheet": "Datasheets", "OND file": "PVsyst OND files", "PAN file": "PVsyst PAN files",
    "Certificate": "Certificates", "Test report": "Test reports", "User manual": "User manuals", "Quick guide": "Quick guides",
    "Product catalogue": "Product catalogues", "Other": "Other documents" };
  var ALWAYS_GROUP = { "Certificate": 1, "Test report": 1 };
  var DOWNLOAD_ONLY = { "OND file": 1, "PAN file": 1 };
  var TYPE_FILTERS = [
    ["", "All"], ["datasheets", "Datasheets"], ["manuals", "Manuals & guides"], ["pvsyst", "PVsyst files"],
    ["certificates", "Certificates"], ["reports", "Test reports"], ["other", "Other"]
  ];
  function typeFilter(t) {
    if (t === "Datasheet") return "datasheets";
    if (t === "OND file" || t === "PAN file") return "pvsyst";
    if (t === "Certificate") return "certificates";
    if (t === "Test report") return "reports";
    if (/manual|guide|catalogue/i.test(t)) return "manuals";
    return "other";
  }

  var ICON_DL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 2v8M4.5 7L8 10.5 11.5 7M3 13h10"/></svg>';
  var ICON_OPEN = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 3h4v4M13 3L7.5 8.5M12 9.5V13H3V4h3.5"/></svg>';
  var ICON_DOC = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3h11l6 6v20H8z"/><path d="M19 3v6h6M12 16h9M12 21h9M12 26h6"/></svg>';

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function brandSlug(b) { var k = String(b || "").trim().toLowerCase(); return BRAND_SLUG[k] || slug(k); }
  function groupOf(cat) { return GROUP_OF[String(cat || "").trim().toLowerCase()] || "other"; }
  function driveId(u) {
    if (!u) return "";
    var m = u.match(/\/d\/([\w-]{20,})/) || u.match(/[?&]id=([\w-]{20,})/);
    return m ? m[1] : "";
  }
  function viewUrl(u) { var id = driveId(u); return id ? "https://drive.google.com/file/d/" + id + "/view" : u; }
  function dlUrl(u) { var id = driveId(u); return id ? "https://drive.google.com/uc?export=download&id=" + id : u; }
  function validLink(u) { return !!u && /^https?:\/\//i.test(u) && u.indexOf("EXAMPLE") < 0; }

  // ---------- CSV (for the live Google Sheet) ----------
  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function toObjects(rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) { var o = {}; head.forEach(function (h, i) { o[h] = (r[i] || "").trim(); }); return o; });
  }
  function fromSheet(prodRows, docRows) {
    return {
      products: toObjects(prodRows).filter(function (p) { return p.model; }).map(function (p) {
        return { brand: p.brand, category: p.category, model: p.model, desc: p["short description"] || "" };
      }),
      documents: toObjects(docRows).map(function (d) {
        return { brand: d.brand, model: d.model, type: d.type, name: d["name shown on website"] || d["document name"] || d.type, link: d["drive link"] };
      })
    };
  }
  function normalise(data) {
    var products = (data.products || []).map(function (p) {
      return { brand: p.brand, b: brandSlug(p.brand), category: p.category || "Products", group: groupOf(p.category), model: p.model, desc: p.desc || "" };
    });
    var catOf = {};
    products.forEach(function (p) { catOf[p.b + "|" + p.model] = p; });
    var docs = (data.documents || []).filter(function (d) { return validLink(d.link); }).map(function (d) {
      var b = brandSlug(d.brand), p = catOf[b + "|" + (d.model || "")];
      return { brand: d.brand, b: b, model: d.model || "", type: d.type || "Other", name: d.name || d.type || "Document",
        link: d.link, view: viewUrl(d.link), dl: dlUrl(d.link), group: p ? p.group : "other", category: p ? p.category : "" };
    });
    return { products: products, documents: docs };
  }
  function load() {
    var live = window.CATALOG_LIVE || {};
    var snap = function () { return normalise(window.CATALOG_SNAPSHOT || { products: [], documents: [] }); };
    if (live.products && live.documents && window.fetch) {
      return Promise.all([fetch(live.products), fetch(live.documents)])
        .then(function (r) { if (!r[0].ok || !r[1].ok) throw new Error("sheet"); return Promise.all([r[0].text(), r[1].text()]); })
        .then(function (t) { var d = normalise(fromSheet(parseCSV(t[0]), parseCSV(t[1]))); if (!d.products.length) throw new Error("empty"); return d; })
        .catch(function () { return snap(); });
    }
    return Promise.resolve(snap());
  }

  // ---------- document buttons ----------
  function single(d) {
    if (DOWNLOAD_ONLY[d.type]) {
      return '<span class="dbtn"><a href="' + esc(d.dl) + '" rel="noopener">' + ICON_DL + esc(d.name) + "</a></span>";
    }
    return '<span class="dbtn"><a href="' + esc(d.view) + '" target="_blank" rel="noopener">' + esc(d.name) + "</a>" +
      '<a class="dl" href="' + esc(d.dl) + '" rel="noopener" title="Download" aria-label="Download ' + esc(d.name) + '">' + ICON_DL + "</a></span>";
  }
  function acts(d) {
    var a = "";
    if (!DOWNLOAD_ONLY[d.type]) a += '<a href="' + esc(d.view) + '" target="_blank" rel="noopener">' + ICON_OPEN + "Open</a>";
    a += '<a href="' + esc(d.dl) + '" rel="noopener">' + ICON_DL + "Download</a>";
    return a;
  }
  function group(type, list) {
    return '<details class="docgroup"><summary>' + esc(PLURAL[type] || type + "s") + " (" + list.length + ")</summary><ul class=\"doclist\">" +
      list.map(function (d) { return '<li><span>' + esc(d.name) + '</span><span class="acts">' + acts(d) + "</span></li>"; }).join("") +
      "</ul></details>";
  }
  function docsBlock(list) {
    if (!list.length) return '<p class="none">Documents available on request. <a href="contact.html">Ask us</a>.</p>';
    var byType = {}, types = [];
    list.forEach(function (d) { if (!byType[d.type]) { byType[d.type] = []; types.push(d.type); } byType[d.type].push(d); });
    types.sort(function (a, b) {
      var ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var singles = "", groups = "";
    types.forEach(function (t) {
      var l = byType[t];
      if (l.length === 1 && !ALWAYS_GROUP[t]) singles += single(l[0]);
      else groups += group(t, l);
    });
    return '<div class="docs">' + singles + groups + "</div>";
  }

  // ---------- brand page ----------
  function renderBrand(el, data) {
    var b = el.getAttribute("data-brand");
    var prods = data.products.filter(function (p) { return p.b === b; });
    var docs = data.documents.filter(function (d) { return d.b === b; });
    var general = docs.filter(function (d) { return !d.model; });
    if (!prods.length && !general.length) {
      el.innerHTML = '<p class="none">Model details and documents for this brand are coming soon. <a href="contact.html">Contact us</a> for datasheets and prices.</p>';
      return;
    }
    var cats = [], byCat = {};
    prods.forEach(function (p) { if (!byCat[p.category]) { byCat[p.category] = []; cats.push(p.category); } byCat[p.category].push(p); });
    var html = "";
    if (general.length) {
      html += '<div class="cat-block"><h3 class="cat-title">General documents</h3><div class="models"><article class="model">' +
        "<h4>All " + esc(prods[0] ? prods[0].brand : "") + " products</h4>" + docsBlock(general) + "</article></div></div>";
    }
    cats.forEach(function (c) {
      html += '<div class="cat-block"><h3 class="cat-title">' + esc(c) + ' <span class="count">' + byCat[c].length + "</span></h3><div class=\"models\">";
      byCat[c].forEach(function (p) {
        var mine = docs.filter(function (d) { return d.model === p.model; });
        html += '<article class="model" id="m-' + slug(p.model) + '"><h4>' + esc(p.model) + "</h4>" +
          (p.desc ? '<p class="desc">' + esc(p.desc) + "</p>" : "") + docsBlock(mine) +
          '<a class="quote-link" href="contact.html?model=' + encodeURIComponent(p.model) + '">Request a quote</a></article>';
      });
      html += "</div></div>";
    });
    el.innerHTML = html;
    if (location.hash && location.hash.indexOf("#m-") === 0) {
      var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView();
    }
  }

  // ---------- downloads page ----------
  function renderDownloads(root, data) {
    var fb = root.querySelector("#f-brand"), fc = root.querySelector("#f-cat"), fs = root.querySelector("#f-search");
    var chipsEl = root.querySelector("#f-type"), list = root.querySelector("#docs"), count = root.querySelector("#count");
    var brands = [], seen = {};
    data.products.concat(data.documents).forEach(function (x) { if (x.b && !seen[x.b]) { seen[x.b] = x.brand; brands.push(x.b); } });
    fb.innerHTML = '<option value="">All brands</option>' + brands.map(function (b) { return '<option value="' + esc(b) + '">' + esc(seen[b]) + "</option>"; }).join("");
    var groupsPresent = {};
    data.documents.forEach(function (d) { groupsPresent[d.group] = 1; });
    fc.innerHTML = '<option value="">All products</option>' + GROUP_NAMES.filter(function (g) { return groupsPresent[g[0]]; })
      .map(function (g) { return '<option value="' + g[0] + '">' + g[1] + "</option>"; }).join("");
    var typesPresent = {};
    data.documents.forEach(function (d) { typesPresent[typeFilter(d.type)] = 1; });
    chipsEl.innerHTML = TYPE_FILTERS.filter(function (t) { return !t[0] || typesPresent[t[0]]; }).map(function (t, i) {
      return '<button class="chip" type="button" data-type="' + t[0] + '" aria-pressed="' + (i === 0) + '">' + t[1] + "</button>";
    }).join("");
    var type = "", q = new URLSearchParams(location.search);
    if (q.get("brand")) fb.value = q.get("brand");
    if (q.get("category")) fc.value = q.get("category");
    if (q.get("q")) fs.value = q.get("q");
    if (q.get("type")) {
      type = q.get("type");
      chipsEl.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-type") === type); });
    }
    function render() {
      var term = fs.value.trim().toLowerCase();
      var r = data.documents.filter(function (d) {
        return (!fb.value || d.b === fb.value) && (!fc.value || d.group === fc.value) && (!type || typeFilter(d.type) === type) &&
          (!term || (d.name + " " + d.model + " " + d.brand + " " + d.type).toLowerCase().indexOf(term) >= 0);
      });
      count.textContent = r.length + (r.length === 1 ? " document" : " documents");
      if (!r.length) { list.innerHTML = '<div class="empty">No documents match these filters. <a href="contact.html">Ask us</a> and we\'ll send what you need.</div>'; return; }
      list.innerHTML = r.map(function (d) {
        var title = d.model ? d.model + " – " + d.name : d.name;
        var meta = [d.brand, d.model ? "" : "All products", d.type].filter(Boolean).join(" · ");
        return '<div class="doc">' + ICON_DOC + "<div><h3>" + esc(title) + "</h3><p>" + esc(meta) + '</p></div><div class="acts">' + acts(d) + "</div></div>";
      }).join("");
    }
    fb.onchange = fc.onchange = render;
    fs.oninput = render;
    chipsEl.addEventListener("click", function (e) {
      var c = e.target.closest(".chip"); if (!c) return;
      type = c.getAttribute("data-type");
      chipsEl.querySelectorAll(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x === c); });
      render();
    });
    render();
  }

  // ---------- start ----------
  var brandEls = document.querySelectorAll(".catalogue[data-brand]");
  var dlRoot = document.getElementById("downloads-app");
  if (!brandEls.length && !dlRoot) return;
  load().then(function (data) {
    brandEls.forEach(function (el) { renderBrand(el, data); });
    if (dlRoot) renderDownloads(dlRoot, data);
  });
})();
