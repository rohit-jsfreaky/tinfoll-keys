"""
Writes the Playwright runner that generates a batch of case photos in ChatGPT.

The browser sandbox has no filesystem — no require, no import, no process — so a
runner cannot read the prompt list itself. But browser_run_code_unsafe accepts a
`filename`, so the prompts are baked into a generated .mjs file here and the tool
loads that instead of the whole thing being pasted through a tool call.

Each image is downloaded the moment it appears. An earlier batch ran for thirty
minutes, produced four images and saved none of them when the tool timed out.

Run: python scripts/make-shot-runner.py <start> <count>
     e.g. python scripts/make-shot-runner.py 0 5
Then point browser_run_code_unsafe at art-raw/shot-runner.mjs
"""

from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROMPTS = ROOT / "art-raw" / "shot-prompts.json"
OUT = ROOT / "art-raw" / "shot-runner.mjs"
SAVE_TO = (ROOT / "art-raw" / "shots").as_posix()

start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
count = int(sys.argv[2]) if len(sys.argv) > 2 else 5

prompts: dict[str, str] = json.loads(PROMPTS.read_text(encoding="utf-8"))
ids = list(prompts)[start : start + count]
jobs = [{"id": i, "text": prompts[i]} for i in ids]

(ROOT / "art-raw" / "shots").mkdir(parents=True, exist_ok=True)

OUT.write_text(
    "async () => {\n"
    f"  const JOBS = {json.dumps(jobs, ensure_ascii=False, indent=2)};\n"
    f'  const DIR = {json.dumps(SAVE_TO + "/")};\n'
    """
  const countImgs = () => page.evaluate(() =>
    new Set([...document.querySelectorAll('main img[src^="http"]')].map((i) => i.src)
      .filter((s) => s.includes('estuary'))).size);

  const newestImg = () => page.evaluate(() => {
    const all = [...document.querySelectorAll('main img[src^="http"]')].map((i) => i.src)
      .filter((s) => s.includes('estuary'));
    return all[all.length - 1] || null;
  });

  const busy = () => page.evaluate(() => !!document.querySelector('[data-testid="stop-button"]'));

  const done = [];
  for (const job of JOBS) {
    const before = await countImgs();

    await page.locator('#prompt-textarea').click();
    await page.keyboard.insertText(job.text);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');

    // Up to ten minutes for one image, then move on rather than lose the batch.
    let ok = false;
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(5000);
      if ((await countImgs()) > before && !(await busy())) { ok = true; break; }
    }
    if (!ok) { done.push({ id: job.id, status: 'timed out' }); continue; }

    await page.waitForTimeout(2500);
    const url = await newestImg();
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 90000 }),
      page.evaluate((u) => {
        const a = document.createElement('a');
        a.href = u; a.download = 'shot.png';
        document.body.appendChild(a); a.click(); a.remove();
      }, url),
    ]);
    await dl.saveAs(DIR + job.id + '.png');
    done.push({ id: job.id, status: 'saved' });
  }
  return done;
}
""",
    encoding="utf-8",
)
print(f"runner for {len(ids)}: {', '.join(ids)}")
print(f"-> {OUT.relative_to(ROOT)}")
