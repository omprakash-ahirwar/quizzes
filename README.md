# Quizora — a CSV-powered quiz app for GitHub Pages

A static quiz app (HTML + CSS + vanilla JavaScript modules, no build step, no dependencies).
Quizzes and results are plain CSV files you can open in Excel or Google Sheets.

- **`index.html`** — participant page: pick one of up to 5 published quizzes, enter a name, answer, see your score and a full review.
- **`admin.html`** — quiz studio: build quizzes by hand, import them from CSV, publish up to 5, and review results.

## Run locally

ES modules and `fetch()` need a web server (opening the file with `file://` won't work):

```bash
cd quiz-app
python3 -m http.server 8000      # or: npx serve .
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this folder to a repository (the files should be at the repo root, or in `/docs`).
2. GitHub → **Settings → Pages → Build and deployment → Deploy from a branch** → `main` / `(root)`.
3. Visit `https://<user>.github.io/<repo>/`. The `.nojekyll` file makes Pages serve every file as-is.

## How publishing works

GitHub Pages is read-only hosting, so the browser can't write files to your repo. The studio
keeps your library in the browser (localStorage) and hands you the CSV to commit:

1. **Build** or **Import** quizzes in the studio.
2. **Publish** tab → put up to 5 quizzes into slots → **Open preview** to check.
3. **Download quizzes.csv** → upload it to `data/quizzes.csv` in the repo (GitHub web UI: *data → Add file → Upload files*).
4. Pages redeploys in about a minute; everyone now sees the new quizzes.

The studio's first visit seeds its library from the live `data/quizzes.csv`, so editing what's live is easy.
Use **Back up whole library** to keep drafts safe outside the browser.

> The studio page isn't password-protected (a static site can't keep secrets). Participants can't
> change the live quizzes, though: only a commit to the repo can. If you'd rather not advertise the
> studio, remove the "Studio" link from `index.html`.

## CSV formats

### `data/quizzes.csv` — one row per question

| column | required | notes |
|---|---|---|
| `quiz_id` | for multi-quiz files | rows with the same id form one quiz |
| `quiz_title` | yes* | *or typed in the importer |
| `quiz_description` | | shown on the quiz tile |
| `time_limit_min` | | `0` or blank = no limit |
| `slot` | | `1`–`5` = published position; blank = not published |
| `question` | yes | |
| `question_type` | | `single` → radio buttons, `multiple` → checkboxes. Blank = `multiple` when `correct` lists several letters, otherwise `single` |
| `option_a` … `option_d` | A and B | C and D are optional (true/false works) |
| `correct` | yes | `A`–`D` (also `1`–`4` or the exact option text). For a **multiple-answer** question list every correct letter: `A;C` (also accepts `A|C`, `AC`, or `"A,C"`) |
| `explanation` | | shown in the review after submitting |
| `points` | | defaults to `1` |

### Single-answer and multiple-answer questions

Every question has a type:

| type | participants see | `correct` | scoring |
|---|---|---|---|
| `single` | radio buttons (pick one) | exactly one letter, e.g. `B` | points if the one choice is right |
| `multiple` | checkboxes (pick any) | one or more letters, e.g. `A;C` | points only if the exact set is chosen |

```csv
question,question_type,option_a,option_b,option_c,option_d,correct,points
Which tag links a stylesheet?,single,<style>,<link>,<css>,<script>,B,1
Which of these are CSS units?,multiple,px,rem,kg,vh,A;B;D,2
```

- In the studio, use the **Single answer / Multiple answers** switch on each question; the correct-answer
  markers change between radio buttons and checkboxes to match.
- A `multiple` question may have just one correct option ("select all that apply" with one right answer).
- A `single` question with several correct letters is reported as an error on import.

Quote any value containing a comma, e.g. `"Rivers, states and landmarks"`. See `data/template.csv`.

### `results.csv` — one row per attempt

`result_id, submitted_at, quiz_id, quiz_title, participant, score, max_score, percent, correct_count, question_count, duration_sec, answers`

`answers` is compact: `1:B|2:AC|3:-` (question number : chosen letter(s), `-` = skipped).
Every attempt is saved in the participant's browser and they can download their own row.
In the studio's **Results** tab you can import any number of these files (try `data/results-sample.csv`),
see per-quiz averages and top scorers, filter, and download a merged `results.csv`.

## Collecting results centrally (optional)

To receive every result automatically, point `RESULTS_ENDPOINT` in `js/config.js` at a
Google Apps Script web app that appends to a Sheet:

```js
// Extensions → Apps Script in a Google Sheet, then Deploy → New deployment → Web app (access: Anyone)
function doPost(e) {
  const rows = Utilities.parseCsv(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(rows[0]); // header
  rows.slice(1).forEach((r) => sheet.appendRow(r));
  return ContentService.createTextOutput('ok');
}
```

Paste the deployment URL into `RESULTS_ENDPOINT`. Download the Sheet as CSV whenever you want a `results.csv`.

## Project structure

```
index.html                participant page shell
admin.html                studio page shell
css/
  theme.css               design tokens (colours, fonts), base styles, backdrop
  components.css          buttons, fields, panels, pills, tables, toasts
  quiz.css                participant screens
  admin.css               studio screens
data/
  quizzes.csv             LIVE quizzes (what visitors see)
  template.csv            starter file for the importer
  results-sample.csv      example results to try the Results tab
js/
  config.js               app name, 5-quiz limit, CSV columns, storage keys, results endpoint
  core/                   generic helpers, no app knowledge
    csv.js                CSV parse/stringify (quotes, commas, newlines, BOM)
    dom.js                h() element builder, mount()
    storage.js            safe localStorage JSON
    toast.js              status messages
    files.js              download / read files, slugify, uid
  models/                 data shapes + CSV mapping
    quiz.js               Quiz/Question factories, validation, CSV ↔ quizzes
    result.js             scoring, CSV ↔ results
  services/               where data lives
    quizRepository.js     live CSV fetch, studio library, publish slots, export
    resultRepository.js   save/list/import/export results, optional endpoint
  ui/
    quizBits.js           shared quiz glyph, meta pills, slot colour theme
  pages/
    play/                 participant page: main.js controller + one file per screen
      listView.js  introView.js  playerView.js  resultView.js
    studio/               studio page: main.js controller + one file per tab
      builderTab.js  importTab.js  publishTab.js  resultsTab.js
```

Dependencies flow one way: `pages → services → models → core` (and everything may read `config.js`).

## Customising

- **Name / limit / colours:** `js/config.js` (`APP.name`, `APP.maxPublished`, `SLOT_THEMES`) and the tokens at the top of `css/theme.css`. Update the brand text in the two HTML files too.
- **Keyboard:** participants can press A–D (or 1–4) to answer, Enter / → for next, ← for back.
- **Deep link to a quiz:** `index.html?quiz=<quiz_id>`.
