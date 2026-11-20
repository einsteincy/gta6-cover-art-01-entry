// Sunset Panels — the entrypoint program for gta6-cover-art-01.
//
// Node 22, standard library only. It takes this repository's app/ (the offline
// cover-maker web app: index.html plus its modules, fonts and sample photos)
// and screenshots/ (the four captures the app's maker took), copies both into
// the output directory, and writes /output/dossier.json with the kit's vendored
// buildDossier, so the judge reads the same files the gate scored.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output; without it the
// program writes to /output. Run it twice and the bytes must match.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// No rmSync here on purpose: the grader runs as an unprivileged user on a
// read-only filesystem, so deleting the output directory itself fails — its
// parent is read-only even though the directory is writable (EACCES). The
// grader always starts from an empty /output, and mkdirSync is a no-op when
// the directory already exists.
mkdirSync(outDir, { recursive: true });

cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps: text_max_bytes shapes the dossier's text; the rest
// refuse an entry the scorer would refuse (more than 4 screenshots or one over
// 256 KiB; more than 993 files in app/ or 48 MiB of app files in all; a path
// under app/ over 1000 bytes). app/ counts beside /output's own cap of 1000
// entries and 64 MiB, shared with screenshots/ and dossier.json.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
