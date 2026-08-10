// W1-13 r5: deterministic save/load and delete-the-fix probe for the death-held award clock.
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, writeJson, gitInfo } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const out = { schema: 'w1-13/r5-save-clock@1', git: gitInfo(), checks: {} };
let browser;
try {
  browser = await launchGame({ width: 320, height: 240 });
  out.checks = await browser.page.evaluate(() => {
    const H = window.__HARNESS;
    H.loadState('default'); H.setRenderRate(0); H.stepFrames(2);
    H.setTimeOfDay(4.8); H.stepFrames(2);
    for (let i = 0; i < 20; i++) {
      H.damagePlayer(100000, { stagger: false }); H.stepFrames(1);
      let guard = 0;
      while (H.getDeathState().surface_active && guard++ < 400) H.stepFrames(1);
    }
    const award = (id) => {
      const before = H.getDeathState().souls_held;
      const p = H.saveState().pose.pos;
      H.spawn('inf_trash', p[0] + 4, p[2] + 4, { as: id }); H.stepFrames(2);
      H.killEntity(id); H.stepFrames(20);
      return H.getDeathState().souls_held - before;
    };
    const saved = H.saveState();
    const beforeEnv = H.getEnvironment();
    const beforeAward = award('before-save');
    H.restoreState(JSON.parse(JSON.stringify(saved))); H.stepFrames(1);
    const afterEnv = H.getEnvironment();
    const afterAward = award('after-save');
    const cut = JSON.parse(JSON.stringify(saved));
    delete cut.clock.award_frames;
    H.restoreState(cut); H.stepFrames(1);
    const cutEnv = H.getEnvironment();
    const cutAward = award('cut-save');
    return {
      saved_award_frames: saved.clock.award_frames,
      before: { env: beforeEnv, award: beforeAward },
      after: { env: afterEnv, award: afterAward },
      delete_fix: { env: cutEnv, award: cutAward },
      exact_round_trip: Number.isInteger(saved.clock.award_frames)
        && beforeAward === afterAward
        && Math.abs(beforeEnv.award_time_of_day - afterEnv.award_time_of_day) < 0.001,
      control_goes_red: cutAward !== afterAward,
    };
  });
  out.pass = out.checks.exact_round_trip && out.checks.control_goes_red;
} finally {
  if (browser) await browser.close();
}
await writeJson(args.out || 'reports/runs/W1-13-R5/save-clock.json', out);
if (!out.pass) process.exitCode = 1;
