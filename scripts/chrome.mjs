// Which Chromium the checks launch: $CHROME if set, the preinstalled one in
// Claude's cloud sandbox if present, otherwise Playwright's own download
// (run `npx playwright install chromium` once).
import { existsSync } from 'node:fs';

export const chromePath = () =>
  process.env.CHROME ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
