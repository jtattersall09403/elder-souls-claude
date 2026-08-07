#!/usr/bin/env node
// wpn-render-control.mjs — the two controls W1-RENDER is required to pass, and the reason its
// headline numbers mean anything.
//
// ARBITRATION.md §3 / RI-MTH07 (CONSUMPTION). A probe that cannot fail is worse than no probe:
// before trusting the instrument, break the thing it measures on purpose and confirm it goes
// red. This piece is the ninth instance in the project of exactly that failure, so it gets both
// halves, explicitly:
//
//   --mode perturb   Change a weapon class's DECLARED geometry in game/data/weapons/classes.json,
//                    re-launch the browser, and show the DRAWN weapon changed. If the renderer
//                    were drawing a hardcoded box the drawn numbers would not move.
//
//   --mode prefix    Put the renderer back the way it was — position and yaw and nothing else,
//                    one welded actor, the player hidden under a posed camera — re-launch, and
//                    confirm the three weapon screenshots go back to being BYTE-IDENTICAL. This
//                    is the control that proves the three distinct md5s are caused by the fix
//                    and not by, say, three different arena seeds.
//
// Both modes edit real files and BOTH RESTORE THEM IN A `finally`, then verify the restore
// byte-for-byte against a sha256 taken before the edit. If the verification fails the tool
// exits non-zero and says so loudly — a control that leaves the tree modified has cost more
// than it measured.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('wpn-render-control.mjs --mode perturb|prefix');
const mode = String(args.mode || 'perturb');
const ROOT = path.resolve('.');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/** Files this mode edits, with the edit expressed as a string replacement. */
const EDITS = {
  perturb: [{
    file: 'game/data/weapons/classes.json',
    apply(src) {
      const d = JSON.parse(src);
      // CGS: a 2.75 m reach with 1.55 m of edge becomes a 1.10 m reach with 0.25 m of edge.
      // Both are class-level DECLARATIONS that the moveset library solves the blade against.
      d.classes.CGS.reach_m = 1.10;
      d.classes.CGS.hitbox_span_m = 0.25;
      // HLB: 2.85 m polearm becomes a 1.30 m one, edged span 0.75 -> 0.20.
      d.classes.HLB.reach_m = 1.30;
      d.classes.HLB.hitbox_span_m = 0.20;
      return JSON.stringify(d, null, 1);
    },
  }],
  prefix: [
    {
      file: 'game/src/render/renderer.js',
      apply(src) {
        // Restore the two lines the piece replaced: position + yaw, and the visibility gate.
        const from = src.indexOf('    // ---- the player, posed from the fight\'s own rig');
        const to = src.indexOf('    this.syncEntities(sim);', from);
        if (from < 0 || to < 0) throw new Error('prefix: player block not found');
        const old = '    this.playerMesh.position.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);\n'
          + '    this.playerMesh.rotation.y = (sim.player.yaw * Math.PI) / 180;\n'
          + '    this.playerMesh.visible = !c.override;\n';
        let out = src.slice(0, from) + old + src.slice(to);
        // ...and put the enemies back to position + yaw on a welded actor.
        out = out.replace(/      const eb = C && C\.bodyOf[\s\S]*?\n      mesh\.visible = true;\n/,
          '      mesh.position.set(e.pos[0], e.pos[1], e.pos[2]);\n'
          + '      mesh.rotation.y = (e.yaw * Math.PI) / 180;\n'
          + '      mesh.visible = true;\n'
          + '      mesh.scale.y = e.state === \'DEAD\' ? 0.18 : 1;\n');
        return out;
      },
    },
    {
      file: 'game/src/render/scene.js',
      apply(src) {
        return src.replace('const player = makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72);',
          'const player = makeActor(mats, 0x8f9aa6);');
      },
    },
  ],
};

const edits = EDITS[mode];
if (!edits) { console.error('unknown --mode', mode); process.exit(2); }

const backups = [];
let failed = false;
try {
  for (const e of edits) {
    const p = path.join(ROOT, e.file);
    const src = fs.readFileSync(p, 'utf8');
    backups.push({ p, src, sha: sha(p) });
    const next = e.apply(src);
    if (next === src) throw new Error(`edit to ${e.file} changed nothing — the control would be vacuous`);
    fs.writeFileSync(p, next);
    console.log(`[control] patched ${e.file}`);
  }

  const probeArgs = ['tools/harness/wpn-render-probe.mjs', '--shots', '--tag', mode];
  console.log('[control] running probe under mode=' + mode);
  const r = spawnSync('node', probeArgs, { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) { failed = true; console.error('[control] probe exited', r.status); }
} catch (e) {
  failed = true;
  console.error('[control] ERROR', e.message);
} finally {
  for (const b of backups) {
    fs.writeFileSync(b.p, b.src);
    const now = sha(b.p);
    if (now !== b.sha) {
      console.error(`[control] RESTORE FAILED for ${b.p}: ${now} != ${b.sha}`);
      failed = true;
    } else {
      console.log(`[control] restored ${path.relative(ROOT, b.p)} (sha ok)`);
    }
  }
}
process.exit(failed ? 1 : 0);
