"""
Writes the Playwright runner that records Cal's lines in ElevenLabs.

Credits are real money and a re-record buys nothing, so this is built to never
generate the same line twice:

  - any line whose mp3 already exists in public/vo is skipped before the browser
    is even opened;
  - the runner clears the box with the app's own Clear text button and then
    checks the character counter equals the length of the line before pressing
    generate. Ctrl+A does NOT clear that editor — it appends underneath, and one
    early take went out with an unrelated paragraph stuck to the front of it;
  - it downloads Generation 1 specifically. Eleven v3 always produces two takes
    for one charge, and "Download latest" hands back the second.

If the box does not hold exactly what was meant, the runner stops the whole
batch rather than spending a credit on a guess.

Run: python scripts/make-vo-runner.py [max]
Then point browser_run_code_unsafe at art-raw/vo-runner.mjs
"""

from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LINES = ROOT / "art-raw" / "vo-lines.json"
VO = ROOT / "public" / "vo"
OUT = ROOT / "art-raw" / "vo-runner.mjs"

limit = int(sys.argv[1]) if len(sys.argv) > 1 else 99

lines: dict[str, str] = json.loads(LINES.read_text(encoding="utf-8"))
todo = [{"id": k, "text": v} for k, v in lines.items() if not (VO / f"{k}.mp3").exists()][:limit]
skipped = [k for k in lines if (VO / f"{k}.mp3").exists()]

if not todo:
    print("nothing to record — every line already has an mp3")
    raise SystemExit(0)

OUT.write_text(
    "async () => {\n"
    f"  const JOBS = {json.dumps(todo, ensure_ascii=False, indent=2)};\n"
    f'  const DIR = {json.dumps((VO.as_posix()) + "/")};\n'
    """
  const charCount = () => page.evaluate(() => {
    const m = document.body.innerText.match(/([\\d,]+) \\/ 5,000/);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
  });
  const credits = () => page.evaluate(() => {
    const m = document.body.innerText.match(/([\\d,]+) credits remaining/);
    return m ? m[1] : null;
  });
  // Always Generation 1. v3 makes two takes for one charge and the bottom bar's
  // "Download latest" gives you the second one.
  const downloadGen1 = () => page.evaluate(() => {
    const label = [...document.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && e.textContent.trim() === 'Generation 1' && e.closest('main'),
    );
    if (!label) return false;
    const btn = [...label.parentElement.querySelectorAll('button')]
      .find((b) => (b.getAttribute('aria-label') || '') === 'Download');
    if (!btn) return false;
    btn.click();
    return true;
  });

  if (!page.url().includes('/speech-synthesis/')) {
    await page.goto('https://elevenlabs.io/app/speech-synthesis/text-to-speech');
    await page.waitForTimeout(7000);
  }

  const before = await credits();
  const editor = page.locator('[contenteditable="true"]').first();
  const done = [];

  for (const job of JOBS) {
    const clear = page.getByRole('button', { name: 'Clear text' }).first();
    if (await clear.isVisible().catch(() => false)) {
      await clear.click();
      await page.waitForTimeout(900);
    }
    if ((await charCount()) !== 0) { done.push({ id: job.id, status: 'STOPPED - box not empty' }); break; }

    await editor.click();
    await page.keyboard.insertText(job.text);
    await page.waitForTimeout(900);

    const n = await charCount();
    if (n !== job.text.length) {
      done.push({ id: job.id, status: `STOPPED - box has ${n} chars, wanted ${job.text.length}` });
      break;
    }

    await page.getByRole('button', { name: /Generate speech|Regenerate speech/ }).first().click();

    let ok = false;
    for (let i = 0; i < 90; i++) {
      await page.waitForTimeout(2000);
      const dis = await page.getByRole('button', { name: 'Download latest' })
        .first().isDisabled().catch(() => true);
      if (!dis) { ok = true; break; }
    }
    if (!ok) { done.push({ id: job.id, status: 'no audio' }); continue; }

    await page.waitForTimeout(2500);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 90000 }),
      downloadGen1(),
    ]);
    await dl.saveAs(DIR + job.id + '.mp3');
    done.push({ id: job.id, status: 'saved', chars: job.text.length });
  }

  return { creditsBefore: before, creditsAfter: await credits(), done };
}
""",
    encoding="utf-8",
)

chars = sum(len(j["text"]) for j in todo)
print(f"to record: {len(todo)} lines, {chars} characters (= {chars} credits)")
if skipped:
    print(f"skipping {len(skipped)} already recorded: {', '.join(skipped)}")
print(f"-> {OUT.relative_to(ROOT)}")
