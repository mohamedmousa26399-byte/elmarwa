# Elmarwa chatbot: setup (V16 + chatbot)

This folder is the V16 site with the chatbot already added to all 42 English and Arabic pages. The chat button sits just above the WhatsApp button (right side in English, left side in Arabic).

What the bot knows:
- **Website pages** (English and Arabic) and the **product catalogue** (catalog-data.js, or the live Google Sheet if you fill in catalog-config.js).
- **Catalogue documents** (datasheets, manuals, certificates, OND/PAN files…): these are the only files the bot can send, as Open / Download buttons.
- **Private Drive folder**: documents the bot learns from but never sends or names.

When it can't answer, the visitor fills a short form and the request is emailed to m.moussa@elmarwaenergy.com with the full chat.

The knowledge file is already built from the website and catalogue, so the bot works as soon as step 2 is done. Steps 3 and 4 add the text inside your documents and the private folder.

## 1. Deploy through GitHub (not drag-and-drop)

The chatbot needs a Netlify Function, and Netlify only builds functions from a Git-connected site or the Netlify CLI. Netlify Drop (dragging a folder onto the page) publishes the pages but not the chatbot.

Replace the contents of the `elmarwa` repo with this folder (keep the hidden `.github` folder, it holds the nightly sync), commit and push. Netlify deploys automatically if the site is linked to the repo. If it isn't yet: Netlify → Site configuration → Build & deploy → Link repository → choose `elmarwa`, leave the build command empty and the publish directory as the repo root.

## 2. Netlify settings

1. Create an API key at console.anthropic.com (add billing and set a monthly spend limit).
2. Netlify → Site configuration → Environment variables → add `ANTHROPIC_API_KEY`.
3. Netlify → Forms → make sure form detection is on (your quote form already uses it). After the next deploy a form named `chatbot-handoff` appears.
4. Forms → Form notifications → Add notification → Email notification → form `chatbot-handoff` → `m.moussa@elmarwaenergy.com`.
5. Trigger a redeploy (Deploys → Trigger deploy) so the API key is picked up.

## 3. Google access (lets the bot read inside your documents)

1. console.cloud.google.com → create a project → APIs & Services → Library → enable **Google Drive API**.
2. IAM & Admin → Service Accounts → Create service account (no roles) → Keys → Add key → JSON. Keep the file private.
3. Copy the service account email (ends in `iam.gserviceaccount.com`) and share with it, as **Viewer**:
   - the Drive folder(s) holding the product documents used on the website, and
   - a new folder, for example **"Chatbot - Private"**, for the learn-only documents.
4. Copy the private folder's ID from its address: `drive.google.com/drive/folders/THIS_PART`.

## 4. GitHub secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the whole content of the JSON key |
| `PRIVATE_FOLDER_ID` | ID of "Chatbot - Private" |

Then Actions → "Sync chatbot knowledge" → Run workflow. It reads everything, commits a new `knowledge.json`, and Netlify redeploys. It runs again every night and whenever pages or the catalogue change, so new files in Drive are learned within a day (or instantly with Run workflow).

Scanned PDFs (photos of paper, common for certificates) have no readable text, so the bot only knows their names. That's fine for sending them; for anything it must understand, use text PDFs, Word or Google Docs.

## 5. Test in both languages

- English page: "Send me the Tiger Neo datasheet" → Open / Download buttons.
- Arabic page: "عايز شهادات ألواح جينكو" → Arabic reply with certificate buttons.
- Ask in English on an Arabic page (and the reverse) → reply follows the visitor's language.
- A question only answered in a private document → answer, with no file or document name.
- "What's the price?" or "Do you sell wind turbines?" → the contact form; submit it and check the email arrives.

## Files added to V16

```
chatbot/chat-widget.js, chatbot/chat-widget.css   the chat window (EN/AR)
chatbot-handoff-form.html                        hidden form Netlify needs for the emails
netlify/functions/chat.mjs                       the bot (uses ANTHROPIC_API_KEY)
netlify/functions/knowledge/knowledge.json       what the bot knows (rebuilt by the sync)
scripts/sync-knowledge.mjs, scripts/package.json the sync
.github/workflows/sync-knowledge.yml             nightly sync
netlify.toml                                     functions setting
_redirects                                       3 lines added to keep /netlify, /scripts, /.github private
```

Every page got two lines before `</body>` loading the widget.

Optional Netlify variables: `CHAT_MODEL` (default `claude-sonnet-5-5`), `SEARCH_MODEL` (default `claude-haiku-5-5`).
