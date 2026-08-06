#!/usr/bin/env python3
"""RI-DLG04 Comparison method, step 1 — the INDEPENDENT reference implementation.

The item is explicit: "Implement the reference in a scratch script from §B/§C *independently
of our code*, then compare against our engine over a randomised sweep." This file is that
scratch script. It is written in a different language from the engine, from the reference
text alone, and it deliberately does not import, read or share a single line with
game/src/sim/dialogue/disposition.js. If the two agree on 100,000 randomised cases, they
agree because the arithmetic is right, not because the same bug is in both.

Emits TSV. Columns:
  case  D  target1  target2  target3  d
plus every input, so a mismatch can be reproduced from the row alone.

    python3 tools/dialogue/disposition-oracle.py --sweep 100000 --out /tmp/oracle.tsv
"""
import argparse, json, math, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE)) if os.path.basename(os.path.dirname(HERE)) == 'tools' else os.path.abspath(os.path.join(HERE, '..', '..'))

# ---- §A GMSTs, read from the shipped data file so the sweep cannot drift from the game ----
with open(os.path.join(ROOT, 'game/data/dialogue/persuasion-gmst.json')) as fh:
    G = json.load(fh)['gmst']

FIELDS = [
    'base', 'crimeMod', 'sameRace', 'pPersonality', 'pLuck', 'pSpeechcraft', 'pMercantile',
    'pLevel', 'pReputation', 'pFatigue', 'pFatigueMax', 'nPersonality', 'nLuck', 'nSpeechcraft',
    'nMercantile', 'nLevel', 'nReputation', 'nFatigue', 'nFatigueMax', 'reaction', 'rank',
    'bounty', 'disease', 'weaponDrawn', 'attacked', 'charm', 'raceReaction', 'upbringing',
    'bribeMod',
]


def fatigue_term(cur, mx):
    """§B fatigueTerm. norm = 1.0 if floor(max)==0 else max(0, cur/max)."""
    norm = 1.0 if math.floor(mx) == 0 else max(0.0, cur / mx)
    return G['fFatigueBase'] - G['fFatigueMult'] * (1 - norm)


def derived_disposition(c):
    """§B derivedDisposition, transcribed line for line."""
    x = c['base'] + c['crimeMod']
    # W1-07 seam: race-reactions.json §application puts raceReaction (and the upbringing term
    # stacked on it) into npc.baseDisposition BEFORE every other term.
    x += c['raceReaction'] + c['upbringing']
    if c['sameRace']:
        x += G['fDispRaceMod']
    x += G['fDispPersonalityMult'] * (c['pPersonality'] - G['fDispPersonalityBase'])
    x += (G['fDispFactionRankMult'] * c['rank'] + G['fDispFactionRankBase']) * G['fDispFactionMod'] * c['reaction']
    x -= G['fDispCrimeMod'] * c['bounty']
    if c['disease']:
        x += G['fDispDiseaseMod']
    if c['weaponDrawn']:
        x += G['fDispWeaponDrawn']
    # RI-DLG09 §C makes fDispAttacking a live term on derivedDisposition.
    if c['attacked']:
        x += G['fDispAttacking']
    x += c['charm']
    return max(0, min(100, int(x)))


def ratings(pers, luck, rep, lvl, speech, merc, fat, fatmax, is_player):
    """§C persuasionRatings."""
    pers_t = pers / G['fPersonalityMod']
    luck_t = luck / G['fLuckMod']
    rep_t = rep * G['fReputationMod']
    lvl_t = lvl * G['fLevelMod']
    ft = fatigue_term(fat, fatmax)
    r1 = (rep_t + luck_t + pers_t + speech) * ft
    if is_player:
        r2 = r1 + lvl_t
        r3 = (merc + luck_t + pers_t) * ft
    else:
        r2 = (lvl_t + rep_t + luck_t + pers_t + speech) * ft
        r3 = (merc + rep_t + luck_t + pers_t) * ft
    return r1, r2, r3


def targets(c):
    """§C attempt(), up to and including target1/2/3. The roll is the caller's."""
    n1, n2, n3 = ratings(c['nPersonality'], c['nLuck'], c['nReputation'], c['nLevel'],
                         c['nSpeechcraft'], c['nMercantile'], c['nFatigue'], c['nFatigueMax'], False)
    p1, p2, p3 = ratings(c['pPersonality'], c['pLuck'], c['pReputation'], c['pLevel'],
                         c['pSpeechcraft'], c['pMercantile'], c['pFatigue'], c['pFatigueMax'], True)
    D = derived_disposition(c)
    d = 1 - 0.02 * abs(D - 50)
    return D, d, d * (p1 - n1 + 50), d * (p2 - n2 + 50), d * (p3 - n3 + 50) + c['bribeMod']


def make_case(rng):
    fatmax = rng.choice([0, 60, 100, 140])
    nfatmax = rng.choice([0, 80, 120])
    return {
        'base': rng.randint(0, 100),
        'crimeMod': rng.choice([0, 0, 0, -10, -25, 5]),
        'sameRace': rng.randint(0, 1),
        'pPersonality': rng.randint(10, 100),
        'pLuck': rng.randint(10, 100),
        'pSpeechcraft': rng.randint(5, 100),
        'pMercantile': rng.randint(5, 100),
        'pLevel': rng.randint(1, 40),
        'pReputation': rng.randint(0, 50),
        'pFatigue': round(rng.uniform(0, 1) * (fatmax or 100), 3),
        'pFatigueMax': fatmax,
        'nPersonality': rng.randint(10, 100),
        'nLuck': rng.randint(10, 100),
        'nSpeechcraft': rng.randint(5, 100),
        'nMercantile': rng.randint(5, 100),
        'nLevel': rng.randint(1, 40),
        'nReputation': rng.randint(0, 50),
        'nFatigue': round(rng.uniform(0, 1) * (nfatmax or 100), 3),
        'nFatigueMax': nfatmax,
        'reaction': rng.randint(-4, 4),
        'rank': rng.randint(0, 9),
        'bounty': rng.choice([0, 0, 50, 400, 1000, 2500]),
        'disease': rng.randint(0, 1),
        'weaponDrawn': rng.randint(0, 1),
        'attacked': rng.randint(0, 1),
        'charm': rng.choice([0, 0, 0, 10, 30]),
        'raceReaction': rng.choice([14, 12, 9, 4, 2, 0, -2, -6, -12, -20, -28, -40]),
        'upbringing': rng.choice([0, 10, 8, -8, -16, 6, 4]),
        'bribeMod': rng.choice([0.0, G['fBribe10Mod'], G['fBribe100Mod'], G['fBribe1000Mod']]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sweep', type=int, default=100000)
    ap.add_argument('--seed', type=int, default=1337)
    ap.add_argument('--out', default='/tmp/oracle.tsv')
    a = ap.parse_args()

    rng = random.Random(a.seed)
    with open(a.out, 'w') as out:
        out.write('\t'.join(['case'] + FIELDS + ['D', 'd', 'target1', 'target2', 'target3']) + '\n')
        for i in range(a.sweep):
            c = make_case(rng)
            D, d, t1, t2, t3 = targets(c)
            row = [str(i)] + [repr(c[f]) for f in FIELDS] + \
                  [str(D), '%.9f' % d, '%.9f' % t1, '%.9f' % t2, '%.9f' % t3]
            out.write('\t'.join(row) + '\n')
    print('oracle: %d cases -> %s (seed %d)' % (a.sweep, a.out, a.seed), file=sys.stderr)


if __name__ == '__main__':
    main()
