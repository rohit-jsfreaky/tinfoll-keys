"""
Writes the Playwright runner that pulls already-paid-for takes back out of the
ElevenLabs History tab.

Needed because process-vo.py once mastered stale backups over twelve freshly
recorded lines. The audio itself was never lost — it is still in History — so
this recovers it instead of spending the credits a second time.

Matching is by the opening words of each line, which is what History shows. A
line whose opening is not unique would match the wrong row, so the runner checks
for exactly one match and refuses rather than guess.

Run: python scripts/make-vo-recover.py <id> [<id> ...]
Then point browser_run_code_unsafe at art-raw/vo-recover.mjs
"""

from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LINES = json.loads((ROOT / "art-raw" / "vo-lines.json").read_text(encoding="utf-8"))
OUT = ROOT / "art-raw" / "vo-recover.mjs"
VO = (ROOT / "public" / "vo").as_posix()

ids = sys.argv[1:]
if not ids:
    sys.exit("usage: python scripts/make-vo-recover.py <line-id> [<line-id> ...]")

jobs = []
for i in ids:
    if i not in LINES:
        sys.exit(f"unknown line id: {i}")
    # Enough of the opening to be unique in the history list.
    jobs.append({"id": i, "needle": LINES[i][:55]})

OUT.write_text(
    "async () => {\n"
    f"  const JOBS = {json.dumps(jobs, ensure_ascii=False, indent=2)};\n"
    f'  const DIR = {json.dumps(VO + "/")};\n'
    """
  // Make sure the History tab is the one showing.
  const tab = page.getByRole('tab', { name: 'History' }).first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(2500);
  }

  const done = [];
  for (const job of JOBS) {
    // Search History for this line so the row is definitely rendered.
    const box = page.getByPlaceholder('Search history...').first();
    await box.click();
    await box.fill(job.needle.slice(0, 40));
    await page.waitForTimeout(3000);

    const count = await page.evaluate((needle) => {
      return [...document.querySelectorAll('li')]
        .filter((li) => li.textContent.includes(needle)).length;
    }, job.needle);

    if (count === 0) { done.push({ id: job.id, status: 'not in history' }); continue; }

    // Take the FIRST match. v3 writes two takes per generation and the first
    // row is Generation 1, which is the one the rest of the pipeline expects.
    try {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        page.evaluate((needle) => {
          const li = [...document.querySelectorAll('li')]
            .find((x) => x.textContent.includes(needle));
          const btn = [...li.querySelectorAll('button')]
            .find((b) => b.getAttribute('aria-label') === 'Download');
          if (!btn) throw new Error('no download button on that row');
          btn.click();
        }, job.needle),
      ]);
      await dl.saveAs(DIR + job.id + '.mp3');
      done.push({ id: job.id, status: 'recovered', rows: count });
    } catch (e) {
      done.push({ id: job.id, status: 'failed: ' + e.message.slice(0, 50) });
    }
  }

  const credits = await page.evaluate(() => {
    const m = document.body.innerText.match(/([\\d,]+) credits remaining/);
    return m ? m[1] : null;
  });
  return { done, credits };
}
""",
    encoding="utf-8",
)
print(f"recovering {len(jobs)}: {', '.join(ids)}")
print(f"-> {OUT.relative_to(ROOT)}")
