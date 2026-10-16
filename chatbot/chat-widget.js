// Elmarwa chat widget. Add to every page, before </body>:
//   <link rel="stylesheet" href="/chatbot/chat-widget.css">
//   <script src="/chatbot/chat-widget.js" defer></script>
(() => {
  const html = document.documentElement;
  const LANG = (html.lang || "").toLowerCase().startsWith("ar") || html.dir === "rtl" ? "ar" : "en";

  const T = {
    en: {
      title: "Elmarwa assistant",
      sub: "Products, datasheets and certificates",
      hello: "Hello! Ask me about our products, or request a datasheet, manual, certificate or .OND file.",
      placeholder: "Type your question…",
      typing: "Looking that up…",
      open: "Open",
      download: "Download",
      name: "Your name",
      email: "Email",
      phone: "Phone / WhatsApp",
      request: "Your request",
      sendReq: "Send to technical team",
      sending: "Sending…",
      needContact: "Please enter your name and an email or phone number.",
      badEmail: "Please enter a valid email address.",
      sent: "Thank you. Your request has been sent to our technical team, and they will contact you soon.",
      sendFail: "The request could not be sent. Please email info@elmarwaenergy.com or call +201006254040.",
      error: "Something went wrong. Please try again in a moment.",
      openChat: "Open chat",
      close: "Close chat",
      sendMsg: "Send message",
    },
    ar: {
      title: "مساعد المروة",
      sub: "المنتجات والنشرات الفنية والشهادات",
      hello: "مرحبًا! اسألني عن منتجاتنا، أو اطلب نشرة فنية أو دليل استخدام أو شهادة أو ملف OND.",
      placeholder: "اكتب سؤالك…",
      typing: "جارٍ البحث…",
      open: "فتح",
      download: "تحميل",
      name: "الاسم",
      email: "البريد الإلكتروني",
      phone: "الهاتف / واتساب",
      request: "طلبك",
      sendReq: "إرسال إلى الفريق الفني",
      sending: "جارٍ الإرسال…",
      needContact: "من فضلك اكتب اسمك وبريدك الإلكتروني أو رقم هاتفك.",
      badEmail: "من فضلك اكتب بريدًا إلكترونيًا صحيحًا.",
      sent: "شكرًا لك. تم إرسال طلبك إلى فريقنا الفني وسيتواصلون معك قريبًا.",
      sendFail: "تعذر إرسال الطلب. من فضلك راسلنا على info@elmarwaenergy.com أو اتصل على ‎+201006254040.",
      error: "حدث خطأ. من فضلك حاول مرة أخرى بعد قليل.",
      openChat: "فتح المحادثة",
      close: "إغلاق المحادثة",
      sendMsg: "إرسال",
    },
  }[LANG];

  const ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  const root = document.createElement("div");
  root.id = "em-chat";
  root.dir = LANG === "ar" ? "rtl" : "ltr";
  root.innerHTML = `
    <div class="em-panel" hidden role="dialog" aria-label="${T.title}">
      <div class="em-head">
        <div class="em-head-text"><strong>${T.title}</strong><span>${T.sub}</span></div>
        <button class="em-close" aria-label="${T.close}">${ICON_X}</button>
      </div>
      <div class="em-log" aria-live="polite"></div>
      <div class="em-input">
        <textarea rows="1" placeholder="${T.placeholder}" aria-label="${T.placeholder}" maxlength="1000"></textarea>
        <button class="em-btn em-send" aria-label="${T.sendMsg}">${ICON_SEND}</button>
      </div>
    </div>
    <button class="em-launcher" aria-label="${T.openChat}" aria-expanded="false">${ICON_CHAT}</button>`;
  document.body.appendChild(root);

  const panel = root.querySelector(".em-panel");
  const log = root.querySelector(".em-log");
  const input = root.querySelector(".em-input textarea");
  const sendBtn = root.querySelector(".em-send");
  const launcher = root.querySelector(".em-launcher");
  const history = [];
  let busy = false;
  let greeted = false;

  function toggle(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    if (open) {
      if (!greeted) { addBot(T.hello); greeted = true; }
      input.focus();
    }
  }
  launcher.addEventListener("click", () => toggle(panel.hidden));

  // "Ask Our Bot" menu item (and any link with data-open-chat or #ask-bot) opens the chat
  document.addEventListener("click", (e) => {
    const link = e.target.closest && e.target.closest('[data-open-chat], a[href$="#ask-bot"]');
    if (!link) return;
    e.preventDefault();
    toggle(true);
  });
  if (location.hash === "#ask-bot") toggle(true);
  root.querySelector(".em-close").addEventListener("click", () => toggle(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) toggle(false); });

  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function format(text) {
    const lines = esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").split("\n");
    let out = "", inList = false;
    for (const l of lines) {
      const m = l.match(/^\s*[-•*]\s+(.*)/);
      if (m) { if (!inList) { out += "<ul>"; inList = true; } out += `<li>${m[1]}</li>`; continue; }
      if (inList) { out += "</ul>"; inList = false; }
      out += l.trim() ? `${l}<br>` : "<br>";
    }
    if (inList) out += "</ul>";
    return out.replace(/(<br>)+$/, "");
  }

  function scroll() { log.scrollTop = log.scrollHeight; }

  function addUser(text) {
    const el = document.createElement("div");
    el.className = "em-msg user";
    el.textContent = text;
    log.appendChild(el); scroll();
  }

  function addBot(text) {
    const el = document.createElement("div");
    el.className = "em-msg bot";
    el.innerHTML = format(text);
    log.appendChild(el); scroll();
  }

  function addDocs(docs) {
    if (!docs || !docs.length) return;
    const wrap = document.createElement("div");
    wrap.className = "em-docs";
    for (const d of docs) {
      const card = document.createElement("div");
      card.className = "em-doc";
      card.innerHTML = `
        <div class="em-doc-title">${esc(d.title)}</div>
        <div class="em-doc-path">${esc(d.subtitle || "")}</div>
        <div class="em-doc-actions">
          <a href="${esc(d.view)}" target="_blank" rel="noopener">${T.open}</a>
          <a class="em-dl" href="${esc(d.download)}" target="_blank" rel="noopener">${T.download}</a>
        </div>`;
      wrap.appendChild(card);
    }
    log.appendChild(wrap); scroll();
  }

  function addHandoffForm(lastQuestion) {
    const form = document.createElement("form");
    form.className = "em-form";
    form.noValidate = true;
    form.innerHTML = `
      <label>${T.name}<input name="name" autocomplete="name" required></label>
      <label>${T.email}<input name="email" type="email" autocomplete="email" dir="ltr"></label>
      <label>${T.phone}<input name="phone" type="tel" autocomplete="tel" dir="ltr"></label>
      <label>${T.request}<textarea name="request"></textarea></label>
      <p class="em-hp"><label>Leave empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <div class="em-err" role="alert"></div>
      <button class="em-btn" type="submit">${T.sendReq}</button>`;
    const f = (n) => form.elements.namedItem(n);
    f("request").value = lastQuestion;
    const err = form.querySelector(".em-err");
    form.addEventListener("input", () => { err.textContent = ""; });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = f("name").value.trim();
      const email = f("email").value.trim();
      const phone = f("phone").value.trim();
      if (!name || (!email && !phone)) { err.textContent = T.needContact; return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = T.badEmail; return; }

      const btn = form.querySelector("button");
      btn.disabled = true; btn.textContent = T.sending;
      const transcript = history.map((m) => `${m.role === "user" ? "Visitor" : "Bot"}: ${m.content}`).join("\n\n");
      const data = new URLSearchParams({
        "form-name": "chatbot-handoff",
        "bot-field": f("bot-field").value,
        name, email, phone,
        request: f("request").value.trim(),
        transcript,
        page: location.href,
        language: LANG,
      });
      try {
        const res = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: data.toString() });
        if (!res.ok) throw new Error(res.status);
        form.remove();
        addBot(T.sent);
      } catch {
        btn.disabled = false; btn.textContent = T.sendReq;
        err.textContent = T.sendFail;
      }
    });
    log.appendChild(form); scroll();
    f("name").focus();
  }

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true;
    input.value = ""; input.style.height = "42px";
    addUser(text);
    history.push({ role: "user", content: text });

    const typing = document.createElement("div");
    typing.className = "em-typing";
    typing.textContent = T.typing;
    log.appendChild(typing); scroll();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-10), lang: LANG }),
      });
      const data = await res.json();
      typing.remove();
      if (!data.answer) throw new Error("empty");
      addBot(data.answer);
      history.push({ role: "assistant", content: data.answer });
      addDocs(data.documents);
      if (data.status === "handoff") addHandoffForm(text);
    } catch {
      typing.remove();
      addBot(T.error);
    } finally {
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener("input", () => {
    input.style.height = "42px";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
  });
})();
