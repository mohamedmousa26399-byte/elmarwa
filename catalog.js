/* Elmarwa catalogue: reads the Product Catalogue (live Google Sheet or snapshot)
   and renders products + documents on brand pages and the Downloads page. */
(function () {
  "use strict";

  var AR = (document.documentElement.lang || "").slice(0, 2) === "ar";
  var ROOT = window.SITE_ROOT || "";
  var T = AR ? {
    general: "مستندات عامة", allOf: "كل منتجات ", onRequest: 'المستندات متاحة عند الطلب. <a href="contact.html">اسألنا</a>.',
    quote: "اطلب عرض سعر", open: "فتح", download: "تحميل", allBrands: "كل العلامات", allProducts: "كل المنتجات",
    soon: 'تفاصيل الموديلات ومستنداتها لهذه العلامة متاحة قريبًا. <a href="contact.html">تواصل معنا</a> للحصول على الداتا شيت والأسعار.',
    none: 'لا توجد مستندات مطابقة لهذه الاختيارات. <a href="contact.html">اسألنا</a> وسنرسل لك ما تحتاجه.',
    count: function (n) { return "عدد المستندات: " + n; }, more: function (n) { return "عرض المزيد (المتبقي: " + n + ")"; },
    allProductsMeta: "كل المنتجات"
  } : {
    general: "General documents", allOf: "All ", onRequest: 'Documents available on request. <a href="contact.html">Ask us</a>.',
    quote: "Request a quote", open: "Open", download: "Download", allBrands: "All brands", allProducts: "All products",
    soon: 'Model details and documents for this brand are coming soon. <a href="contact.html">Contact us</a> for datasheets and prices.',
    none: 'No documents match these filters. <a href="contact.html">Ask us</a> and we\'ll send what you need.',
    count: function (n) { return n + (n === 1 ? " document" : " documents"); }, more: function (n) { return "Show more (" + n + " remaining)"; },
    allProductsMeta: "All products"
  };
  var BRAND_AR = { "huawei": "هواوي فيوجن سولار", "jinko-solar": "جينكو سولار", "sigenergy": "سيجنرجي", "invt": "إنفيت",
    "newmax": "نيوماكس", "his": "إتش آي إس (هيكرا)", "suntree": "سنتري", "elmarwa": "المروة" };
  var TYPE_AR = { "Datasheet": "داتا شيت", "OND file": "ملف OND", "PAN file": "ملف PAN", "User manual": "دليل المستخدم", "Quick guide": "الدليل السريع",
    "Installation manual": "دليل التركيب", "O&M manual": "دليل التشغيل والصيانة", "Unpacking manual": "تعليمات الفك والتخزين",
    "Unloading manual": "دليل التفريغ", "Cleaning manual": "دليل التنظيف", "Certificate": "شهادة", "Product catalogue": "كتالوج المنتجات", "Other": "أخرى" };
  var CAT_AR = { "On-grid inverters": "إنفرترات متصلة بالشبكة", "Hybrid inverters": "إنفرترات هجينة", "Monitoring": "المراقبة",
    "C&I battery": "بطاريات المنشآت التجارية والصناعية", "Home battery": "بطاريات منزلية", "PV modules": "ألواح شمسية", "Batteries": "بطاريات",
    "Solar pump drives": "إنفرترات الطلمبات الشمسية", "Mounting structures": "هياكل تثبيت الألواح", "DC cables": "كابلات التيار المستمر (DC)", "DC protection": "حمايات التيار المستمر (DC)" };
  function brandName(slug, fallback) { return AR && BRAND_AR[slug] ? BRAND_AR[slug] : fallback; }
  function typeName(t) { return AR && TYPE_AR[t] ? TYPE_AR[t] : t; }
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
  var GROUP_NAMES = AR ? [["modules", "ألواح شمسية"], ["inverters", "إنفرترات"], ["storage", "بطاريات"], ["monitoring", "المراقبة"],
    ["pumping", "إنفرترات الطلمبات الشمسية"], ["mounting", "هياكل تثبيت الألواح"], ["cables", "كابلات التيار المستمر (DC)"], ["protection", "حمايات التيار المستمر (DC)"]]
    : [["modules", "PV modules"], ["inverters", "Inverters"], ["storage", "Batteries"], ["monitoring", "Monitoring"],
    ["pumping", "Solar pump drives"], ["mounting", "Mounting structures"], ["cables", "DC cables"], ["protection", "DC protection"]];
  var TYPE_ORDER = ["Datasheet", "Product catalogue", "User manual", "Quick guide", "Installation manual", "O&M manual",
    "Unpacking manual", "Unloading manual", "Cleaning manual", "OND file", "PAN file", "Other", "Certificate", "Test report"];
  var PLURAL = AR ? { "Datasheet": "داتا شيت", "OND file": "ملفات PVsyst OND", "PAN file": "ملفات PVsyst PAN", "Certificate": "الشهادات",
    "Test report": "تقارير الاختبار", "User manual": "أدلة المستخدم", "Quick guide": "الأدلة السريعة", "Product catalogue": "كتالوجات المنتجات",
    "Installation manual": "أدلة التركيب", "O&M manual": "أدلة التشغيل والصيانة", "Other": "مستندات أخرى" } : { "Datasheet": "Datasheets", "OND file": "PVsyst OND files", "PAN file": "PVsyst PAN files",
    "Certificate": "Certificates", "Test report": "Test reports", "User manual": "User manuals", "Quick guide": "Quick guides",
    "Product catalogue": "Product catalogues", "Other": "Other documents" };
  var ALWAYS_GROUP = { "Certificate": 1, "Test report": 1 };
  var DOWNLOAD_ONLY = { "OND file": 1, "PAN file": 1 };
  var TYPE_FILTERS = AR ? [["", "الكل"], ["datasheets", "داتا شيت"], ["manuals", "الأدلة"], ["pvsyst", "ملفات PVsyst"],
    ["certificates", "الشهادات"], ["reports", "تقارير الاختبار"], ["other", "أخرى"]]
    : [["", "All"], ["datasheets", "Datasheets"], ["manuals", "Manuals & guides"], ["pvsyst", "PVsyst files"],
    ["certificates", "Certificates"], ["reports", "Test reports"], ["other", "Other"]];
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
  var ICON_PH = '<svg class="ph" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="7" y="9" width="34" height="30" rx="3"/><path d="M7 32l9-9 7 7 6-6 12 12"/><circle cx="31" cy="18" r="3"/></svg>';
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
  function photoUrl(f) {
    f = String(f || "").trim();
    if (!f) return "";
    if (/^https?:\/\//i.test(f) || f.indexOf("/") >= 0) return f;
    return ROOT + "images/products/" + f;
  }
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
        return { brand: p.brand, category: p.category, model: p.model, desc: p["short description"] || "", photo: p.photo || "",
          category_ar: p["category (ar)"] || "", desc_ar: p["short description (ar)"] || "" };
      }),
      documents: toObjects(docRows).map(function (d) {
        return { brand: d.brand, model: d.model, type: d.type, name: d["name shown on website"] || d["document name"] || d.type, link: d["drive link"],
          name_ar: d["name shown on website (ar)"] || "" };
      })
    };
  }
  function normalise(data) {
    var products = (data.products || []).map(function (p) {
      var b = brandSlug(p.brand);
      return { brand: brandName(b, p.brand), b: b, category: (AR && (p.category_ar || CAT_AR[p.category])) || p.category || "Products", catKey: p.category,
        group: groupOf(p.category), model: p.model, desc: (AR && p.desc_ar) || p.desc || "", photo: photoUrl(p.photo) };
    });
    var catOf = {};
    products.forEach(function (p) { catOf[p.b + "|" + p.model] = p; });
    var docs = (data.documents || []).filter(function (d) { return validLink(d.link); }).map(function (d) {
      var b = brandSlug(d.brand), p = catOf[b + "|" + (d.model || "")];
      return { brand: brandName(b, d.brand), b: b, model: d.model || "", type: d.type || "Other", name: (AR && d.name_ar) || d.name || d.type || "Document",
        link: d.link, view: viewUrl(d.link), dl: dlUrl(d.link), group: p ? p.group : "other", category: p ? p.category : "", photo: p ? p.photo : "" };
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
      '<a class="dl" href="' + esc(d.dl) + '" rel="noopener" title="' + T.download + '" aria-label="' + T.download + " " + esc(d.name) + '">' + ICON_DL + "</a></span>";
  }
  function acts(d) {
    var a = "";
    if (!DOWNLOAD_ONLY[d.type]) a += '<a href="' + esc(d.view) + '" target="_blank" rel="noopener">' + ICON_OPEN + T.open + "</a>";
    a += '<a href="' + esc(d.dl) + '" rel="noopener">' + ICON_DL + T.download + "</a>";
    return a;
  }
  function group(type, list) {
    return '<details class="docgroup"><summary>' + esc(PLURAL[type] || type + "s") + " (" + list.length + ")</summary><ul class=\"doclist\">" +
      list.map(function (d) { return '<li><span>' + esc(d.name) + '</span><span class="acts">' + acts(d) + "</span></li>"; }).join("") +
      "</ul></details>";
  }
  function docsBlock(list) {
    if (!list.length) return '<p class="none">' + T.onRequest + "</p>";
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
      el.innerHTML = '<p class="none">' + T.soon + "</p>";
      return;
    }
    var cats = [], byCat = {};
    prods.forEach(function (p) { if (!byCat[p.category]) { byCat[p.category] = []; cats.push(p.category); } byCat[p.category].push(p); });
    var html = "";
    if (general.length) {
      html += '<div class="cat-block"><h3 class="cat-title">' + T.general + '</h3><div class="models"><article class="model model-general">' +
        "<h4>" + T.allOf + esc(prods[0] ? prods[0].brand : "") + (AR ? "" : " products") + "</h4>" + docsBlock(general) + "</article></div></div>";
    }
    cats.forEach(function (c) {
      html += '<div class="cat-block"><h3 class="cat-title">' + esc(c) + ' <span class="count">' + byCat[c].length + "</span></h3><div class=\"models\">";
      byCat[c].forEach(function (p) {
        var mine = docs.filter(function (d) { return d.model === p.model; });
        html += '<article class="model' + (p.photo ? " has-photo" : "") + '" id="m-' + slug(p.model) + '">' +
          '<div class="model-photo">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="' + esc(p.model) + '" loading="lazy" decoding="async">' : ICON_PH) + "</div>" +
          '<div class="model-body"><h4>' + esc(p.model) + "</h4>" +
          (p.desc ? '<p class="desc">' + esc(p.desc) + "</p>" : "") + docsBlock(mine) +
          '<a class="quote-link" href="contact.html?model=' + encodeURIComponent(p.model) + '">' + T.quote + "</a></div></article>";
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
    var seen = {}, brandOrder = [];
    data.products.concat(data.documents).forEach(function (x) { if (x.b && !seen[x.b]) { seen[x.b] = x.brand; brandOrder.push(x.b); } });
    var type = "", q = new URLSearchParams(location.search);
    var want = { brand: q.get("brand") || "", cat: q.get("category") || "" };
    if (q.get("q")) fs.value = q.get("q");
    if (q.get("type")) type = q.get("type");

    // Each list only offers choices that exist for the other selections:
    // Brand "Jinko Solar" -> Product shows "PV modules" only; Product "Batteries" -> Brand shows battery brands only.
    function fillSelect(sel, allLabel, options, current) {
      sel.innerHTML = '<option value="">' + allLabel + "</option>" +
        options.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + "</option>"; }).join("");
      sel.value = options.some(function (o) { return o[0] === current; }) ? current : "";
    }
    function refreshFilters() {
      var b = fb.value || want.brand, c = fc.value || want.cat;
      want = { brand: "", cat: "" };
      var forBrand = data.documents.filter(function (d) { return !b || d.b === b; });
      var groups = {}; forBrand.forEach(function (d) { groups[d.group] = 1; });
      fillSelect(fc, T.allProducts, GROUP_NAMES.filter(function (g) { return groups[g[0]]; }), c);
      var forCat = data.documents.filter(function (d) { return !fc.value || d.group === fc.value; });
      var bs = {}; forCat.forEach(function (d) { bs[d.b] = 1; });
      fillSelect(fb, T.allBrands, brandOrder.filter(function (x) { return bs[x]; }).map(function (x) { return [x, seen[x]]; }), b);
      var types = {};
      data.documents.forEach(function (d) {
        if ((!fb.value || d.b === fb.value) && (!fc.value || d.group === fc.value)) types[typeFilter(d.type)] = 1;
      });
      if (type && !types[type]) type = "";
      chipsEl.innerHTML = TYPE_FILTERS.filter(function (t) { return !t[0] || types[t[0]]; }).map(function (t) {
        return '<button class="chip" type="button" data-type="' + t[0] + '" aria-pressed="' + (t[0] === type) + '">' + t[1] + "</button>";
      }).join("");
    }
    refreshFilters();
    var PAGE = 30, shown = PAGE;
    function render(more) {
      if (!more) shown = PAGE;
      var term = fs.value.trim().toLowerCase();
      var r = data.documents.filter(function (d) {
        return (!fb.value || d.b === fb.value) && (!fc.value || d.group === fc.value) && (!type || typeFilter(d.type) === type) &&
          (!term || (d.name + " " + d.model + " " + d.brand + " " + d.type).toLowerCase().indexOf(term) >= 0);
      });
      count.textContent = T.count(r.length);
      if (!r.length) { list.innerHTML = '<div class="empty">' + T.none + "</div>"; return; }
      var total = r.length; r = r.slice(0, shown);
      list.innerHTML = r.map(function (d) {
        var title = d.model ? d.model + " – " + d.name : d.name;
        var meta = [d.brand, d.model ? "" : T.allProductsMeta, typeName(d.type)].filter(Boolean).join(" · ");
        var thumb = d.photo ? '<span class="doc-thumb"><img src="' + esc(d.photo) + '" alt="" loading="lazy" decoding="async"></span>' : ICON_DOC;
        return '<div class="doc">' + thumb + "<div><h3>" + esc(title) + "</h3><p>" + esc(meta) + '</p></div><div class="acts">' + acts(d) + "</div></div>";
      }).join("") + (total > shown ? '<div class="more-row"><button type="button" class="btn btn-line" id="more">' + T.more(total - shown) + "</button></div>" : "");
      var mb = document.getElementById("more");
      if (mb) mb.onclick = function () { shown += PAGE; render(true); };
    }
    fb.onchange = fc.onchange = function () { refreshFilters(); render(); };
    fs.oninput = function () { render(); };
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
