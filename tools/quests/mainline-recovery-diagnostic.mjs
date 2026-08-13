#!/usr/bin/env node
// W1-19 focused production-input diagnostic for a resumed route checkpoint.
// It observes the flask commitment and then asks ordinary locomotion to move the body. It does
// not write player state, progress, topics, reveals, entities, weather, or quest state.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
mainline-recovery-diagnostic.mjs --resume-state <checkpoint.json> --out <report.json>
  [--flasks 3] [--chromium <executable>]
`;

const args = parseArgs();
if (wantsHelp(args) || !args['resume-state'] || !args.out) usage(USAGE);
const resumePath = path.resolve(String(args['resume-state']));
const outPath = path.resolve(String(args.out));
const stateBytes = fs.readFileSync(resumePath);
const resumeState = JSON.parse(stateBytes.toString('utf8'));
const flasks = Number(args.flasks || 3);
if (!Number.isInteger(flasks) || flasks < 1 || flasks > 6) usage(USAGE);

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 180000) });
let report;
try {
  report = await handle.page.evaluate(async ({ resumeState, flasks }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    H.restoreState(resumeState);
    H.setRenderRate(0);
    H.stepFrames(2);

    const snapshot = (label) => {
      const combat = H.getCombatState();
      const player = combat.player || {};
      const where = H.whereAmI();
      const input = H.getInputState();
      const move = player.move || null;
      return {
        label,
        frame: combat.frame,
        player: {
          state: player.state,
          anim: player.anim,
          anim_frame: player.anim_frame,
          move: move ? { id: move.id, kind: move.kind, total: move.total } : null,
          move_remaining_frames: move ? Math.max(0, Number(move.total) - Number(player.anim_frame || 0)) : 0,
          actionable_at: player.actionable_at,
          hp: player.hp,
          hp_max: player.hp_max,
          estus: player.estus,
          pos: player.pos,
          yaw_deg: player.yaw_deg,
          speed_mps: player.speed_mps,
          move_dir_deg: player.move_dir_deg,
          stagger_until: player.stagger_until,
          parried_until: player.parried_until,
          pending_reaction: player.pending_reaction,
          dead: player.dead,
          hitstop: player.hitstop,
          hitstop_until: player.hitstop_until,
          controller: player.controller,
        },
        input: {
          held: input.held,
          pressed: input.pressed,
          released: input.released,
          pending_press: input.pendingPress,
          pending_release: input.pendingRelease,
          move: input.move,
          buffered_action: input.buffered,
          buffered_at_frame: input.bufferedAtFrame,
          dropped_inputs: input.droppedInputs,
          pipeline_drops: input.pipelineDrops,
          buffer_misses: input.bufferMisses,
          mode: input.mode,
        },
        stats: H.getPlayerStats(),
        traversal: H.getTraversalReport().observed,
        death: H.getDeathState(),
        ui: H.getUIState(),
        conversation: H.getConversationState(),
        where,
        collision_at_pose: H.solidAt(where.pos[0], where.pos[1] + 0.9, where.pos[2]),
      };
    };

    const traces = [];
    H.clearInputs();
    H.stepFrames(2);
    const initial = snapshot('initial-stable');
    for (let i = 0; i < flasks; i++) {
      const samples = [snapshot('before')];
      H.queueInputs([{ f: 0, move: [0, 0], press: ['use_item'] }, { f: 2, release: ['use_item'] }]);
      samples.push(snapshot('queued-before-step'));
      H.stepFrames(1); samples.push(snapshot('press-latched'));
      H.stepFrames(1); samples.push(snapshot('held'));
      H.stepFrames(1); samples.push(snapshot('release-latched'));
      H.stepFrames(39); samples.push(snapshot('startup-frame-42'));
      H.stepFrames(1); samples.push(snapshot('active-frame-43'));
      H.stepFrames(61); samples.push(snapshot('active-frame-104'));
      H.stepFrames(1); samples.push(snapshot('recovery-frame-105'));
      H.stepFrames(25); samples.push(snapshot('committed-frame-130'));
      H.stepFrames(1); samples.push(snapshot('actionable-frame-131'));
      H.clearInputs(); samples.push(snapshot('after-clear-before-step'));
      H.stepFrames(2); samples.push(snapshot('after-clear-two-fixed-steps'));

      // Prove the same saved body can locomote after recovery using only the ordinary movement
      // axis. This is intentionally part of the disposable diagnostic, not a checkpoint save.
      const moveStart = H.whereAmI().pos.slice();
      const bodies = H.listEntities().filter((e) => e.pos && e.eid !== 'player');
      const candidates = [];
      for (let k = 0; k < 24; k++) {
        const angle = k * Math.PI / 12;
        const target = [moveStart[0] + Math.sin(angle) * 2, moveStart[2] + Math.cos(angle) * 2];
        let clearance = Infinity;
        for (let s = 1; s <= 8; s++) {
          const x = moveStart[0] + (target[0] - moveStart[0]) * s / 8;
          const z = moveStart[2] + (target[1] - moveStart[2]) * s / 8;
          const c = H.solidAt(x, moveStart[1] + 0.9, z);
          if (c.solid || Number(c.distance_m) < 0.48) { clearance = -1; break; }
          clearance = Math.min(clearance, Number(c.distance_m));
        }
        if (clearance < 0) continue;
        const bodyClearance = bodies.reduce((m, e) => Math.min(m,
          Math.hypot(target[0] - e.pos[0], target[1] - e.pos[2])), Infinity);
        candidates.push({ target, clearance, body_clearance_m: bodyClearance });
      }
      candidates.sort((a, b) => Math.min(b.clearance, b.body_clearance_m)
        - Math.min(a.clearance, a.body_clearance_m));
      const selected = candidates[0] || { target: [moveStart[0] + 2, moveStart[2]], clearance: null, body_clearance_m: null };
      const movementFrames = [];
      let walked = null;
      for (let f = 0; f < 360; f++) {
        walked = H.walkPath([selected.target], {
          fromCurrent: true, speed: 'walk', maxFrames: 1, stuckAbort: 180,
          arrive_m: 0.2, lookahead_m: 0.25, survival: false, defensive: false,
        });
        const now = H.whereAmI().pos;
        const distance = Math.hypot(now[0] - moveStart[0], now[2] - moveStart[2]);
        if (f < 24 || f % 30 === 29 || distance > 0.2) movementFrames.push(snapshot(`locomotion-frame-${f + 1}`));
        if (distance > 0.2) break;
      }
      H.clearInputs();
      H.stepFrames(2);
      const moveEnd = H.whereAmI().pos.slice();
      traces.push({
        flask: i + 1,
        samples,
        locomotion: {
          start: moveStart,
          end: moveEnd,
          selected,
          walk: walked,
          frames: movementFrames,
          distance_m: Math.hypot(moveEnd[0] - moveStart[0], moveEnd[2] - moveStart[2]),
          after: snapshot('after-locomotion-probe'),
        },
      });
    }

    const final = snapshot('final');
    const rows = traces.map((t) => {
      const before = t.samples.find((s) => s.label === 'before');
      const pressed = t.samples.find((s) => s.label === 'press-latched');
      const committed = t.samples.find((s) => s.label === 'committed-frame-130');
      const actionable = t.samples.find((s) => s.label === 'actionable-frame-131');
      const cleared = t.samples.find((s) => s.label === 'after-clear-two-fixed-steps');
      return {
        flask: t.flask,
        estus_delta: before.player.estus - pressed.player.estus,
        began_heal: pressed.player.move?.id === 'heal' && pressed.player.anim_frame === 1,
        declared_commitment_observed: committed.player.move?.id === 'heal'
          && committed.player.anim_frame === 130 && committed.player.move_remaining_frames === 0,
        actionable_on_131: actionable.player.move === null && actionable.player.state === 'IDLE',
        no_buffered_repeat: t.samples.every((s) => !s.input.buffered_action),
        no_modal_surface_opened: t.samples.every((s) => !s.ui.dialogue_surface?.open),
        inputs_cleared: cleared.input.held.length === 0 && cleared.input.pressed.length === 0
          && cleared.input.pending_press.length === 0 && cleared.input.pending_release.length === 0,
        locomotion_distance_m: t.locomotion.distance_m,
        locomotion_restored: t.locomotion.distance_m > 0.2,
        no_death_or_respawn: t.samples.every((s) => !s.death.dead && !(s.death.respawns > 0)),
      };
    });
    return {
      schema: 'elder-souls/mainline-recovery-diagnostic@1',
      harness_version: H.version,
      declaration: { heal_total_frames: 130, startup: [1, 42], active: [43, 104], recovery: [105, 130] },
      method: 'resume genuine H.saveState; production use_item edges; fixed steps; production movement axis; read-only observations',
      forbidden_actions_used: [],
      initial,
      traces,
      rows,
      final,
      pass: rows.length === flasks && rows.every((r) => r.estus_delta === 1 && r.began_heal
        && r.declared_commitment_observed && r.actionable_on_131 && r.no_buffered_repeat
        && r.no_modal_surface_opened
        && r.inputs_cleared && r.locomotion_restored && r.no_death_or_respawn),
    };
  }, { resumeState, flasks });
} catch (error) {
  writeJson(outPath.replace(/\.json$/i, '') + '-browser-failure.json', {
    error: String(error?.message || error),
    stack: String(error?.stack || ''),
    browser_connected: handle.browser.isConnected(),
    page_closed: handle.page.isClosed(),
    page_errors: handle.errors,
    console_tail: handle.console.slice(-30),
  });
  throw error;
} finally {
  await handle.close();
}

report.input = {
  file: path.relative(process.cwd(), resumePath).split(path.sep).join('/'),
  sha256: crypto.createHash('sha256').update(stateBytes).digest('hex'),
  bytes: stateBytes.length,
};
writeJson(outPath, report);
console.log(JSON.stringify({ out: outPath, input: report.input, rows: report.rows, pass: report.pass }, null, 2));
process.exitCode = report.pass ? 0 : 1;
