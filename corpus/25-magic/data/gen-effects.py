#!/usr/bin/env python3
"""Generates corpus/25-magic/data/effects.json — the RI-MAG02 effect catalogue."""
import json, math, collections

RANGE_MULT = {"self": 0.70, "touch": 0.85, "target": 1.00,
              "projectile": 1.15, "area_at_range": 1.25}
CLASS_MULT = {"CANTRIP": 0.50, "LIGHT": 1.00, "HEAVY": 2.10,
              "GREAT": 4.40, "RITUAL": 1.00}

def focus_base(weight, M, D=0.0, A=0.0, rng="target"):
    raw = weight * (M ** 1.30 + 0.7 * (D ** 0.95) + 0.55 * (M ** 0.80) * (D ** 0.45))
    area = 1 + 0.09 * (A ** 1.25)
    return math.ceil(raw * area * RANGE_MULT[rng] / 10.0)

def cost(weight, M, D=0.0, A=0.0, rng="target", cls="LIGHT"):
    return math.ceil(focus_base(weight, M, D, A, rng) * CLASS_MULT[cls])

# id, name, school, weight, mag_unit, mag_max, dur, area, ranges, tier, geometry,
# in_fight, out_of_fight, utility, traversal, quest, status, note
E = []
def eff(**kw):
    d = {
        "id": kw["id"], "name": kw["name"], "school": kw["school"],
        "skill": {"sorcery": "Sorcery", "root_speech": "Root-Speech",
                  "warding": "Warding", "veiling": "Veiling"}[kw["school"]],
        "governing_attribute": {"sorcery": "INTELLECT", "root_speech": "HIST-BOND",
                                "warding": "WILLPOWER", "veiling": "WILLPOWER"}[kw["school"]],
        "weight": kw["weight"],
        "magnitude": {"unit": kw["mag_unit"], "min": kw.get("mag_min", 1),
                      "max": kw["mag_max"], "output_per_point": kw.get("opp", 1.0)},
        "duration": {"allowed": kw.get("dur", True), "min_s": kw.get("dur_min", 1),
                     "max_s": kw.get("dur_max", 600)},
        "area": {"allowed": kw.get("area", False), "max_r_m": kw.get("area_max", 0)},
        "ranges": kw["ranges"],
        "min_tier": kw["tier"],
        "geometry": kw["geom"],
        "in_fight": kw["inf"],
        "out_of_fight": kw["outf"],
        "utility_class": kw.get("util"),
        "changes_traversal": kw.get("trav", False),
        "changes_quest_resolution": kw.get("quest", False),
        "status_buildup": kw.get("status"),
        "notes": kw["note"],
    }
    if "rulings" in kw:
        d["rulings"] = kw["rulings"]
    E.append(d)

# ---------------------------------------------------------------- SORCERY (14)
eff(id="fire_damage", name="Marshfire", school="sorcery", weight=1.5, mag_unit="point",
    mag_max=200, opp=1.8, dur=True, dur_max=30, area=True, area_max=8,
    ranges=["touch","target","projectile","area_at_range"], tier=1, geom="projectile",
    inf=True, outf=True, util="survival", quest=True,
    status={"kind":"burn","per_contact":10},
    note="Burning sap-resin that sticks and drips. Out of fight: burns off voriplasm, dries a flooded passage, destroys evidence (a quest verb).")
eff(id="frost_damage", name="Saltrime", school="sorcery", weight=1.5, mag_unit="point",
    mag_max=200, opp=1.7, dur=True, dur_max=30, area=True, area_max=8,
    ranges=["touch","target","projectile","area_at_range"], tier=1, geom="projectile",
    inf=True, outf=True, util="traversal", trav=True,
    status={"kind":"frost","per_contact":12},
    note="Stills standing water into a crossable rime plate for the effect's duration. Two marsh routes and one dungeon shortcut use this.")
eff(id="shock_damage", name="Wamasu-arc", school="sorcery", weight=1.4, mag_unit="point",
    mag_max=200, opp=1.8, dur=False, area=True, area_max=6,
    ranges=["touch","target","projectile","area_at_range"], tier=1, geom="projectile",
    inf=True, outf=True, util="access", quest=True,
    status={"kind":"shock","per_contact":8},
    note="Arcs to conductors: standing water, wet chitin, iron. Chain is DETERMINISTIC (nearest N conductors within r, sorted by eid). Opens two Dwemer-analogue mechanisms.")
eff(id="poison_damage", name="Wither", school="sorcery", weight=1.3, mag_unit="point",
    mag_max=150, opp=1.2, dur=True, dur_max=120, area=True, area_max=6,
    ranges=["touch","target","projectile","area_at_range"], tier=1, geom="volume",
    inf=True, outf=False, status={"kind":"rot","per_contact":14},
    note="Lingering volume; ticks on a fixed 12-frame period, never a per-frame roll.")
eff(id="damage_health", name="Unmaking", school="sorcery", weight=2.2, mag_unit="point",
    mag_max=200, opp=2.0, dur=False, area=False,
    ranges=["touch","target","projectile"], tier=2, geom="projectile",
    inf=True, outf=False, note="Unelemental. Ignores elemental resistance, costs more.")
eff(id="drain_health", name="Hollowing", school="sorcery", weight=1.1, mag_unit="point",
    mag_max=400, opp=1.0, dur=True, dur_max=120, area=False,
    ranges=["touch","target"], tier=2, geom="contact",
    inf=True, outf=True, util="access", quest=True,
    note="Temporarily lowers MAX health, not current. Self-cast is the classic breakage: drain your own health to survive a fall or a threshold check, then let it expire. SANCTIONED (RI-MAG03 MB-7).")
eff(id="absorb_health", name="Drinking", school="sorcery", weight=2.6, mag_unit="point",
    mag_max=120, opp=1.0, dur=False, area=False,
    ranges=["touch","target"], tier=3, geom="contact",
    inf=True, outf=False, note="Transfers, never creates. Overheal discarded (RI-CMB08 §B).")
eff(id="soul_trap", name="Root-theft", school="sorcery", weight=3.0, mag_unit="second",
    mag_max=60, opp=1.0, dur=True, dur_max=60, area=False,
    ranges=["touch","target","projectile"], tier=3, geom="projectile",
    inf=True, outf=False, util="economy", quest=True,
    rulings=["Fills a soul gem if the target dies while marked. NEVER yields, reduces or converts sap-debt (S15). Increments the xul_hesh counter. See RI-MAG03 §C."],
    note="`xul-hesh`. The great Argonian obscenity (RI-LOR05 §3). Mechanically fine, politically radioactive.")
eff(id="shatter", name="Bonebreak", school="sorcery", weight=1.9, mag_unit="poise",
    mag_max=120, opp=1.0, dur=False, area=True, area_max=4,
    ranges=["touch","target","projectile","area_at_range"], tier=2, geom="projectile",
    inf=True, outf=True, util="access", quest=True,
    note="Poise damage, zero HP damage. The caster's stagger tool, and the only spell that opens a barred door by breaking it — which is a crime with witnesses.")
eff(id="corrode", name="Souring", school="sorcery", weight=1.2, mag_unit="point",
    mag_max=100, opp=1.0, dur=False, area=False,
    ranges=["touch","target","projectile"], tier=2, geom="projectile",
    inf=True, outf=True, util="access", quest=True,
    note="Destroys item condition. Out of fight: eats through a rusted grate, ruins a contract, spoils a shipment. Disarms an enemy by destroying their weapon (a non-lethal exit).")
eff(id="bind_lesser", name="Call the Small", school="sorcery", weight=2.4, mag_unit="second",
    mag_max=90, opp=1.0, dur=True, dur_max=90, area=False,
    ranges=["self"], tier=2, geom="none",
    inf=True, outf=True, util="access",
    note="A marsh thing unfolds out of the water. Never a portal flash. Ally obeys RI-AI01; counts toward encounter grouping.")
eff(id="bind_greater", name="Call the Deep", school="sorcery", weight=4.2, mag_unit="second",
    mag_max=90, opp=1.0, dur=True, dur_max=90, area=False,
    ranges=["self"], tier=4, geom="none",
    inf=True, outf=True, util="access",
    note="One at a time, game-wide. A second cast dismisses the first.")
eff(id="bound_weapon", name="Chitin-that-is-not", school="sorcery", weight=2.0, mag_unit="second",
    mag_max=300, opp=1.0, dur=True, dur_max=300, area=False,
    ranges=["self"], tier=2, geom="none",
    inf=True, outf=True, util="access",
    rulings=["Fixed frame data and fixed scaling grade. NO upgrade path (RI-PRG08), no grade improvement, weight 0. Strong in R1-R2, obsolete by R4. SANCTIONED early power spike (RI-MAG03 MB-6)."],
    note="Morrowind's exact bargain: free excellence early, a dead end late.")
eff(id="telekinesis", name="Long Hand", school="sorcery", weight=1.8, mag_unit="metre",
    mag_max=25, opp=1.0, dur=True, dur_max=60, area=False,
    ranges=["self"], tier=2, geom="none",
    inf=False, outf=True, util="access", quest=True, trav=True,
    rulings=["Extends interact/steal/lockpick reach. Does NOT extend any hitbox and cannot be used on a hostile inside COMBAT."],
    note="Theft through a window, a lever across a chasm, a lock on the far side of a portcullis. SANCTIONED (RI-MAG03 MB-4).")

# ------------------------------------------------------------ ROOT-SPEECH (13)
eff(id="restore_health", name="Mending", school="root_speech", weight=2.8, mag_unit="point",
    mag_max=400, opp=1.0, dur=True, dur_max=60, area=True, area_max=6,
    ranges=["self","touch","target","area_at_range"], tier=1, geom="none",
    inf=True, outf=True, util="survival",
    rulings=["Does not refill the tithe-gourd and is not refilled by it. A heal cast is a full CANTRIP/LIGHT cast with §B commitment - it is slower than drinking, cheaper in charges, and costs Focus you cannot get back."],
    note="The caster's alternative to RI-CMB08's flask, not a replacement for it.")
eff(id="cure_disease", name="Clean Water", school="root_speech", weight=2.0, mag_unit="tier",
    mag_max=5, opp=1.0, dur=False, area=False,
    ranges=["self","touch","target"], tier=1, geom="none",
    inf=False, outf=True, util="survival", quest=True,
    note="S11's Morrowind half. Curing a named NPC's named disease is a quest resolution in its own right.")
eff(id="cure_poison", name="Draw the Sour", school="root_speech", weight=1.6, mag_unit="tier",
    mag_max=5, opp=1.0, dur=False, area=False,
    ranges=["self","touch","target"], tier=1, geom="none",
    inf=True, outf=True, util="survival", note="Clears rot/poison buildup to zero.")
eff(id="cure_paralysis", name="Loosening", school="root_speech", weight=2.2, mag_unit="tier",
    mag_max=1, opp=1.0, dur=False, area=False,
    ranges=["self","touch","target"], tier=2, geom="none",
    inf=True, outf=True, util="survival",
    note="Cannot be self-cast while paralysed (you cannot act). Exists so a companion or an enchanted item can.")
eff(id="restore_attribute", name="Re-cutting", school="root_speech", weight=2.4, mag_unit="point",
    mag_max=60, opp=1.0, dur=False, area=False,
    ranges=["self","touch","target"], tier=2, geom="none",
    inf=False, outf=True, util="survival",
    note="Restores attribute damage from disease and drain. Never raises an attribute above its true value.")
eff(id="fortify_attribute", name="Swelling", school="root_speech", weight=3.4, mag_unit="point",
    mag_max=40, opp=1.0, dur=True, dur_max=300, area=False,
    ranges=["self","touch","target"], tier=3, geom="none",
    inf=True, outf=True, util="access", quest=True,
    rulings=["Fortified values satisfy SKILL and ATTRIBUTE gates on actions (locks, persuasion, alchemy, traversal, carry). They NEVER satisfy faction rank thresholds, spell-tier attunement requirements, or quest rank gates - those read the BASE value. Fortify buys you an action, never a station."],
    note="The boundary clause above is the whole ruling. See RI-MAG03 §D MB-2/MB-3.")
eff(id="fortify_skill", name="Sure Hand", school="root_speech", weight=3.0, mag_unit="point",
    mag_max=50, opp=1.0, dur=True, dur_max=300, area=False,
    ranges=["self","touch","target"], tier=3, geom="none",
    inf=False, outf=True, util="access", quest=True, trav=True,
    rulings=["Same base-vs-fortified boundary as fortify_attribute. Fortified skill does NOT grant skill progress (RI-PRG03 Cost Gate: it consumed nothing of yours)."],
    note="Fortify Security +30 to open a tier-5 seal you have no business opening. SANCTIONED and must keep working (RI-MAG03 MB-2).")
eff(id="resist_element", name="Thick Hide", school="root_speech", weight=1.7, mag_unit="point", mag_max=28, opp=3.0, dur=True, dur_max=300, area=False,
    ranges=["self","touch","target"], tier=1, geom="none",
    inf=True, outf=True, util="survival", trav=True,
    rulings=["Hard clamp at 85%. No stack of any effects, potions, enchantments or gear may exceed it. Immunity is not purchasable."],
    note="Also the answer to two environmental hazards: the Clay Kilns' flues and the salt-storms.")
eff(id="resist_disease", name="Clean Blood", school="root_speech", weight=1.4, mag_unit="point", mag_max=28, opp=3.0, dur=True, dur_max=600, area=False,
    ranges=["self","touch","target"], tier=1, geom="none",
    inf=False, outf=True, util="survival", trav=True,
    note="Marsh-fever fog (WLD05 element 24) without a mask.")
eff(id="sap_ward", name="Holding the Wound", school="root_speech", weight=5.0, mag_unit="band",
    mag_max=1, opp=1.0, dur=False, area=False,
    ranges=["self"], tier=4, geom="none",
    inf=False, outf=True, util="survival", quest=True,
    rulings=["Lowers sap-taint by exactly one band (RI-LOR05 §4a). Requires a rootkeeper's consent as a quest prerequisite; usable at most 3 times in a playthrough. Argonian PCs cannot cast it - they have no taint - and the Hist notices when a foreigner does."],
    note="The only mechanical answer to the tithe-curse. Deliberately scarce: taint is a cost, not a nuisance.")
eff(id="speak_to_the_dead", name="Asking the Mud", school="root_speech", weight=4.0, mag_unit="hour",
    mag_max=72, opp=1.0, dur=False, area=False,
    ranges=["touch"], tier=3, geom="none",
    inf=False, outf=True, util="knowledge", quest=True,
    rulings=["Returns ONE authored line from the corpse's record - what it was doing when it died. It is an unreliable narrator (RI-LOR06): the corpse may be wrong, and two corpses may disagree. Never returns quest state, never returns a location marker."],
    note="Lore-as-key, cast as a spell. Feeds `requires.knowledge` on quest resolutions.")
eff(id="hist_sight", name="The Tree Points", school="root_speech", weight=3.6, mag_unit="km",
    mag_max=4, opp=1.0, dur=True, dur_max=120, area=False,
    ranges=["self"], tier=3, geom="none",
    inf=False, outf=True, util="knowledge", trav=True, quest=True,
    rulings=["S8 GUARD: emits NO marker, NO compass arrow, NO waypoint. It writes ONE prose journal line in the Hist's idiom giving a direction and a landmark, exactly as an NPC's directions do (RI-WLD06). A HUD marker here is an AR-2 automatic fail."],
    note="Navigation without markers, as a spell. The most easily ruined effect in the catalogue.")
eff(id="mend_item", name="Knitting", school="root_speech", weight=2.6, mag_unit="point",
    mag_max=100, opp=1.0, dur=False, area=False,
    ranges=["self","touch"], tier=2, geom="none",
    inf=False, outf=True, util="economy",
    rulings=["Restores CONDITION only. Cannot raise an item past 100%, cannot repair an item below 10% (that needs a smith), and cannot repair an enchanted item's charge. Repair remains 27% of RI-PRG05's necessary spend for a non-caster; for a caster it converts a gold cost into a Focus cost, which is the trade."],
    note="Must not delete repair from the economy. The 10% floor is the guard.")
eff(id="calm_beast", name="Stillness", school="root_speech", weight=2.8, mag_unit="second",
    mag_max=90, opp=1.0, dur=True, dur_max=90, area=True, area_max=8,
    ranges=["target","projectile","area_at_range"], tier=2, geom="projectile",
    inf=True, outf=True, util="social", quest=True,
    rulings=["Drops a beast out of COMBAT to its leash behaviour (RI-AI01). Works on beasts and mindless things - which S13 exempts from parley - so it is the caster's version of the non-lethal exit ARBITRATION §1 requires."],
    note="Beasts only. Does not work on anything that can speak; use `charm` for those.")

# --------------------------------------------------------------- WARDING (15)
eff(id="open_lock", name="Unbinding", school="warding", weight=1.4, mag_unit="lock_point",
    mag_max=100, opp=1.0, dur=False, area=False,
    ranges=["touch","target","projectile"], tier=1, geom="projectile",
    inf=False, outf=True, util="access", quest=True,
    rulings=["Magnitude 20 x lock tier (RI-PRG03 §6). Tier 5 = magnitude 100 = 48 Focus base = 101 as HEAVY. DETERMINISTIC: at or above the tier's magnitude it always opens; below it, nothing happens and no Focus is spent (the cast is dropped like an under-req attunement). No pick is consumed and Security gains NO skill progress (Cost Gate)."],
    note="The single most quest-relevant effect in the catalogue.")
eff(id="lock_lock", name="Binding", school="warding", weight=1.2, mag_unit="lock_point",
    mag_max=100, opp=1.0, dur=False, area=False,
    ranges=["touch","target"], tier=1, geom="contact",
    inf=False, outf=True, util="access", quest=True,
    note="Locking a door behind you is a real tactic against a non-leashing pursuer, and a real crime against a shopkeeper.")
eff(id="ward_trap", name="Quieting", school="warding", weight=1.5, mag_unit="tier",
    mag_max=5, opp=1.0, dur=False, area=False,
    ranges=["touch","target","projectile"], tier=1, geom="projectile",
    inf=False, outf=True, util="access",
    note="Disarms a trap at range. Deterministic tier check, no roll.")
eff(id="buoyancy", name="Skin of Air", school="warding", weight=2.4, mag_unit="unit",
    mag_max=1, opp=1.0, dur=True, dur_max=300, area=False,
    ranges=["self","touch","target"], tier=2, geom="none",
    inf=True, outf=True, util="traversal", trav=True, quest=True,
    rulings=["Walk on standing water at ordinary speed. Ends instantly on entering COMBAT with anything in the water. Does not work on moving water above Athletics-30 current strength (RI-PRG03 §6) - the marsh's rivers still say no."],
    note="This is a MARSH. Water-walking is the highest-value traversal effect in the game and it re-draws the map.")
eff(id="breathe_water", name="Second Throat", school="warding", weight=1.6, mag_unit="unit",
    mag_max=1, opp=1.0, dur=True, dur_max=600, area=False,
    ranges=["self","touch","target"], tier=1, geom="none",
    inf=False, outf=True, util="traversal", trav=True, quest=True,
    note="Four submerged interiors and one loop-dungeon entrance are gated on this or on an Argonian PC (who has it innately and pays nothing).")
eff(id="feather", name="Lightening", school="warding", weight=1.9, mag_unit="kg",
    mag_max=200, opp=1.0, dur=True, dur_max=300, area=False,
    ranges=["self","touch","target"], tier=1, geom="none",
    inf=True, outf=True, util="access", trav=True,
    rulings=["AR-1 GUARD: equip load is evaluated once, at the frame of a dodge press (RI-CMB01 §C rule 8). Feather CHANGES the equip-load tier, so a feathered caster genuinely rolls LIGHT. This is legal and intended. What is NOT legal is feather altering i-frame counts by any path other than the four declared tiers - the cliff at 30.00%/70.00% must remain a cliff (RI-CMB01 M5)."],
    note="Carry capacity out of fight; roll tier in fight. Both are real and both are measurable.")
eff(id="burden", name="Weighting", school="warding", weight=1.9, mag_unit="kg",
    mag_max=200, opp=1.0, dur=True, dur_max=120, area=False,
    ranges=["touch","target","projectile"], tier=2, geom="projectile",
    inf=True, outf=True, util="access",
    rulings=["On an enemy: moves its equip-load tier, which changes its roll/step distance and recovery per RI-CMB01's table. It NEVER changes the enemy's windup, tracking cutoff, hitbox or telegraph (RI-AI02 is untouchable). A burdened enemy is slower to reposition and exactly as readable."],
    note="The cleanest example in the catalogue of magic reaching into the fight without contaminating it.")
eff(id="slowfall", name="Leaf-Falling", school="warding", weight=2.6, mag_unit="unit",
    mag_max=1, opp=1.0, dur=True, dur_max=120, area=False,
    ranges=["self","touch","target"], tier=1, geom="none",
    inf=True, outf=True, util="traversal", trav=True, quest=True,
    rulings=["Terminal velocity 3.5 m/s; fall damage zero while active. This is the traversal WORKHORSE, not levitation: with -40 m to +420 m of relief (RI-WLD07 §4), descent is the cheap direction and ascent is the expensive one, and that asymmetry is the whole shape of caster traversal."],
    note="2 Focus for 20 s. Deliberately the cheapest useful effect in the game.")
eff(id="levitate", name="Standing Off the Ground", school="warding", weight=9.0, mag_unit="unit",
    mag_max=1, opp=1.0, dur=True, dur_max=180, area=False,
    ranges=["self","touch","target"], tier=4, geom="none",
    inf=False, outf=True, util="traversal", trav=True, quest=True,
    rulings=[
      "TIER 4 (Warding req 65). Not a starting toy.",
      "NEUTRAL BUOYANCY, NOT THRUST. Horizontal drift 1.4 m/s - SLOWER than the 2.0 m/s walk speed S17 fixes. Levitation is a route-opener, never a time-saver, and therefore never competes with the S7 travel network.",
      "ASCENT IS METERED. Climb rate 0.8 m/s and it costs an ADDITIONAL 1.5 Focus per metre of net altitude gained, charged continuously. A 40 m ascent costs 60 Focus on top of the spell. Since Focus never regenerates (RI-MAG01 §A), altitude is bought out of a reservoir you also need to fight with. This is the primary bound and it is arithmetic, not a fence.",
      "AIRBORNE IS DEFENCELESS. While levitating the player is state AIRBORNE: no attack, no cast except slowfall, no block, no roll, no i-frames of any kind. Enemies target normally. TAKING ANY DAMAGE ENDS THE EFFECT - you fall, and a levitating mage without slowfall attuned is a mage who dies. Levitating over hostiles is suicide, not a bypass.",
      "THE CEILING IS DIEGETIC, NEVER AN INVISIBLE WALL. Every interior, every root-tunnel and all 8 Souls-loop dungeons (RI-WLD07 §2) are ENCLOSED - levitation works there and is useless there, because the ceiling is 4 m away. Outdoors, ~70% of the exterior map is under a collidable canopy at 25-40 m. There is no `no_levitation_zone` flag anywhere in the data and a build that adds one fails this item.",
      "ABOVE THE CANOPY THERE ARE HACKWINGS. Flying clear of the canopy puts you in the hackwing layer (WLD05 element 12): a real R5-tier flock aggroes on a fixed timer, and you cannot fight while levitating. Cliff racers made levitating over Vvardenfell miserable by accident; here it is designed.",
      "LOAD-BEARING, NOT TOLERATED. >=6 map routes and >=3 quest resolutions must be reachable only-or-most-easily by levitate/slowfall, asserted by RI-MAG04. An effect that exists and opens nothing has been deleted by neglect."],
    note="The level-design breaker, ruled in rather than out. Bounded by arithmetic, architecture, weather-of-the-air and defencelessness - four independent bounds, none of which is a message telling the player no.")
eff(id="leap", name="Kicking Off", school="warding", weight=1.6, mag_unit="metre",
    mag_max=20, opp=1.0, dur=True, dur_max=30, area=False,
    ranges=["self","touch"], tier=2, geom="none",
    inf=False, outf=True, util="traversal", trav=True,
    rulings=["Jump height only. Forbidden inside COMBAT (dropped input) - a jumping caster would break RI-AI02's spacing assumptions and RI-CMB02's jump-attack frame data at once."],
    note="Pairs with slowfall. Nine map shortcuts are Acrobatics>=45; leap is the second route to all nine (RI-PRG03 method 8's no-lockout rule, satisfied by magic).")
eff(id="shield", name="Second Shell", school="warding", weight=2.2, mag_unit="point",
    mag_max=120, opp=1.0, dur=True, dur_max=180, area=False,
    ranges=["self","touch","target"], tier=1, geom="none",
    inf=True, outf=True, util=None,
    rulings=["Flat damage reduction, applied after RI-CMB05's poise maths and before RI-CMB08's HP accounting. Does NOT grant poise, does NOT grant hyperarmour, does NOT reduce poise damage. A caster who tanks by casting shield still gets staggered on schedule."],
    note="The caster's armour. Deliberately does nothing about stagger, which is what the fight is actually made of.")
eff(id="wall", name="Standing Fire", school="warding", weight=2.6, mag_unit="point",
    mag_max=150, opp=1.4, dur=True, dur_max=60, area=True, area_max=6,
    ranges=["target","area_at_range"], tier=3, geom="volume",
    inf=True, outf=True, util="access",
    rulings=["A persistent volume with a 20-frame ground decal before it goes active (RI-MAG01 §E) and a fixed 12-frame tick. Blocks a corridor; enemies path around it if a path exists and through it if none does - it is terrain to the AI, never an aggro-lock."],
    note="Area denial, and one of the two ways a caster controls a Souls-loop dungeon's chokepoints.")
eff(id="mark", name="Setting the Knot", school="warding", weight=3.0, mag_unit="unit",
    mag_max=1, opp=1.0, dur=False, area=False,
    ranges=["self"], tier=3, geom="none",
    inf=False, outf=True, util="teleport", trav=True,
    rulings=[
      "RITUAL class. 210 frames. Aborts on damage, on COMBAT, on any movement input.",
      "ONE mark exists at a time, game-wide. Setting a new one erases the old one.",
      "Cannot be set indoors, in any of the 8 loop-dungeons, in any boss arena, inside a locked area, or anywhere the player has not already stood outdoors and above ground. Enforced by the placement predicate in RI-TRV02, which OWNS the travel network's rules; this item owns only the effect.",
      "S7/S19 compliant: it is a node in the travel network, not a solvent."],
    note="Half of Morrowind's most beloved pair. The travel agent (RI-TRV02) owns the network detector; this record owns the effect's parameters.")
eff(id="recall", name="Pulling the Knot", school="warding", weight=9.0, mag_unit="hundred_metres",
    mag_max=45, opp=1.0, dur=False, area=False,
    ranges=["self"], tier=3, geom="none",
    inf=False, outf=True, util="teleport", trav=True, quest=True,
    rulings=[
      "RITUAL class. Magnitude is NOT authored - it is COMPUTED at cast time as the straight-line distance to the mark in hundreds of metres. Cost therefore scales with distance: 500 m costs 6 Focus, 4 km costs 77.",
      "This gives the effect a completely diegetic range limit: you cannot recall from further than your Focus reaches, and you cannot get more Focus without resting, and resting is what you were trying to avoid.",
      "Aborts on damage / COMBAT / movement input, so `recall out of a fight` is impossible by construction, not by rule. This is S19's central prohibition and it is enforced by RI-MAG01 §B's RITUAL clock.",
      "Arrives AT THE MARK, which by mark's own predicate is outdoors, above ground and already visited."],
    note="Costs more the further you have gone. That is the entire balance.")
eff(id="intervention", name="Asking the Nearest Root", school="warding", weight=5.0,
    mag_unit="hundred_metres", mag_max=45, opp=1.0, dur=False, area=False,
    ranges=["self"], tier=2, geom="none",
    inf=False, outf=True, util="teleport", trav=True,
    rulings=[
      "RITUAL class, same abort conditions. Magnitude computed as distance to the NEAREST qualifying site, so it is cheap when you are near help and useless when you are not - the inverse of what an escape button would be.",
      "Two variants exist and they go to different networks: `intervention_root` (nearest rootkeeper's shrine) and `intervention_imperial` (nearest Nine Divines chapel - Gideon, Stormhold, Blackrose only). Choosing which one to carry is a faction statement.",
      "Never a HEARTH. HEARTH shrines are checkpoints and level-up stations and are NOT part of the travel network (S7, explicit)."],
    note="The cheap, unreliable, faction-flavoured one. Owned jointly with RI-TRV02.")

# ---------------------------------------------------------------- VEILING (11)
eff(id="invisibility", name="Not-Here", school="veiling", weight=4.4, mag_unit="second",
    mag_max=120, opp=1.0, dur=True, dur_max=120, area=False,
    ranges=["self","touch","target"], tier=3, geom="none",
    inf=True, outf=True, util="access", quest=True,
    rulings=["BREAKS on any of: attacking, casting, interacting with an actor, opening a container, or entering COMBAT. Never affects a hitbox or a hurtbox - an invisible player is hit by exactly the same geometry (AR-1). Against an enemy already in AGGRO it drops alert to SEARCH, never to IDLE: things that have seen you keep looking."],
    note="Total concealment, instantly forfeited. The Souls-legal version of the most abusable effect in Morrowind.")
eff(id="chameleon", name="Bark-Skin", school="veiling", weight=3.2, mag_unit="point", mag_max=27, opp=3.0, dur=True, dur_max=300, area=False,
    ranges=["self","touch","target"], tier=2, geom="none",
    inf=True, outf=True, util="access", quest=True,
    rulings=["Hard clamp at 80%. Multiplies detection RADIUS (RI-PRG03 §6's Sneak term), never detection outcome. Does not break on action. Deliberately weaker than invisibility and deliberately never total: 100% chameleon is Morrowind's single worst breakage and it is closed here by a clamp, not by removal."],
    note="The sustainable stealth effect. Stacks multiplicatively with Sneak and floors at the same 0.40 as Sneak 100.")
eff(id="muffle", name="Soft Foot", school="veiling", weight=1.5, mag_unit="point", mag_max=30, opp=3.0, dur=True, dur_max=300, area=False,
    ranges=["self","touch","target"], tier=1, geom="none",
    inf=False, outf=True, util="access", quest=True,
    note="Kills the sound channel of detection only. The chitin hounds (WLD05 element 20) hunt by ground-vibration and are immune - which is the point of having two channels.")
eff(id="silence", name="Tongue-Tying", school="veiling", weight=3.4, mag_unit="second",
    mag_max=60, opp=1.0, dur=True, dur_max=60, area=True, area_max=6,
    ranges=["touch","target","projectile","area_at_range"], tier=3, geom="projectile",
    inf=True, outf=True, util="access", quest=True,
    rulings=["On an enemy caster: cast inputs are DROPPED, no resource spent, and the caster falls back to its melee move and its non-retreat reposition (which RI-MAG01 §F requires every caster to have). It never freezes the enemy and never removes its telegraphs. On the player: identical, and it must arrive via a buildup meter, never instantly (AP-M4)."],
    note="The anti-caster tool, and a quest verb: silencing a ritual is a resolution.")
eff(id="night_eye", name="Wet Eye", school="veiling", weight=1.3, mag_unit="point", mag_max=25, opp=4.0, dur=True, dur_max=600, area=False,
    ranges=["self","touch","target"], tier=1, geom="none",
    inf=False, outf=True, util="traversal", trav=True,
    rulings=["Raises exposure on the tonemap; it does NOT add lights, does not flatten the scene, and does not defeat the dark-dungeon viewpoint's fidelity metrics (RI-VIS03). A night-eye that turns night into day has broken the art direction (RI-VIS05) to solve a UI problem."],
    note="The marsh at night is genuinely dark and one canonical viewpoint depends on it.")
eff(id="detect_life", name="Warm Water", school="veiling", weight=2.0, mag_unit="metre",
    mag_max=60, opp=1.0, dur=True, dur_max=120, area=False,
    ranges=["self"], tier=2, geom="none",
    inf=False, outf=True, util="knowledge", quest=True,
    rulings=["S8 GUARD: renders living things as diegetic warm smudges in the world at their real positions - NOT icons on a compass, NOT a minimap, NOT through-wall outlines with names. No marker, ever."],
    note="Also the counter to invisible and chameleoned NPCs, which is what makes the Veiling school argue with itself.")
eff(id="detect_key", name="Cold Iron", school="veiling", weight=2.0, mag_unit="metre",
    mag_max=60, opp=1.0, dur=True, dur_max=120, area=False,
    ranges=["self"], tier=2, geom="none",
    inf=False, outf=True, util="knowledge", quest=True,
    note="Keys, enchantments and filled soul gems. The last of those is how you find a xul-hesh operation without being told where it is.")
eff(id="charm", name="Warm Word", school="veiling", weight=2.8, mag_unit="point",
    mag_max=34, opp=3.0, dur=True, dur_max=300, area=False,
    ranges=["touch","target"], tier=1, geom="contact",
    inf=False, outf=True, util="social", quest=True,
    rulings=["Raises disposition by the magnitude for the duration. RI-DLG04 owns disposition; this effect writes into it and nothing else. A charmed NPC's opinion REVERTS when it expires, and any faction/quest state changed while charmed PERSISTS - which is the exploit, and it is sanctioned (RI-MAG03 MB-5)."],
    note="Speechcraft's rival. Cheaper than a bribe (RI-PRG05: 45 + 9/point) above ~20 points, and unlike a bribe it can be witnessed as a crime.")
eff(id="paralyse", name="Stillness of the Deep", school="veiling", weight=5.5, mag_unit="second",
    mag_max=20, opp=1.0, dur=True, dur_max=20, area=True, area_max=4,
    ranges=["touch","target","projectile","area_at_range"], tier=4, geom="projectile",
    inf=True, outf=True, util="access", quest=True,
    rulings=[
      "ON ENEMIES: applies BUILDUP to S11's paralysis meter, never an instant state. Buildup per contact = magnitude x 4; the meter's threshold and decay are RI-CMB05's. A paralysed enemy is a free critical (RI-CMB05 §riposte) and that is the payoff.",
      "ON THE PLAYER: identical model. Any enemy spell that paralyses the player in one contact with no buildup is AP-M4 and an automatic fail.",
      "PARALYSIS IS NON-LETHAL. ARBITRATION §1 names `paralysis` explicitly as a legitimate non-lethal outcome. A paralysed humanoid can be robbed, walked past, or parleyed with when it wears off - it is a fight EXIT, and MUST be usable as one.",
      "Bosses and R5 named enemies have a paralysis resistance that raises the threshold, never an immunity flag. Nothing in this game is immune to a system; things are expensive."],
    note="Morrowind's most notorious effect. Kept, made deterministic, made a meter, and made a legitimate way to end a fight without a corpse.")
eff(id="demoralise", name="Cold Water", school="veiling", weight=2.4, mag_unit="point",
    mag_max=34, opp=3.0, dur=True, dur_max=60, area=True, area_max=8,
    ranges=["touch","target","projectile","area_at_range"], tier=2, geom="projectile",
    inf=True, outf=True, util="social", quest=True,
    rulings=["Drives a target to FLEE (RI-AI01's leash behaviour, forced). It does NOT delete the enemy, does not despawn it, and does not grant its sap-debt. A routed enemy comes back, or does not, and either way the fight ended without a corpse - which is exactly what ARBITRATION §1 requires to exist."],
    note="The caster's disengage. Also how you clear a room you are not allowed to kill anyone in.")
eff(id="frenzy", name="Water's Edge", school="veiling", weight=3.2, mag_unit="point",
    mag_max=34, opp=3.0, dur=True, dur_max=60, area=True, area_max=8,
    ranges=["touch","target","projectile","area_at_range"], tier=3, geom="projectile",
    inf=True, outf=True, util="social", quest=True,
    rulings=[
      "Forces a target to attack the nearest valid actor other than itself, resolved DETERMINISTICALLY by distance then eid. It does not target-lock to the player and it does not make the target invincible.",
      "CRIME ATTRIBUTION: if any actor with line of sight saw the cast (`witnessed_cast`), every consequence of what the frenzied actor does is attributed to the PLAYER - bounty, faction standing, and S10's thread-of-prophecy-severed if the victim was quest-critical. If nobody saw, nobody knows.",
      "SANCTIONED BREAKAGE and it produces permanent unrecoverable world state (RI-MAG03 MB-5)."],
    note="Named for the massacre in CF-006. Frenzying a guard into killing your target is the single most Morrowind thing this catalogue can do and it must keep working.")
eff(id="false_face", name="Borrowed Scale", school="veiling", weight=4.6, mag_unit="second",
    mag_max=300, opp=1.0, dur=True, dur_max=300, area=False,
    ranges=["self"], tier=4, geom="none",
    inf=False, outf=True, util="social", quest=True,
    rulings=[
      "Reads to NPCs as a member of a nominated faction at a nominated rank, for greeting/topic-filter/trespass purposes only (RI-DLG01 §topic filtering).",
      "It does NOT grant faction rank, does NOT satisfy a rank gate (same base-vs-fortified boundary as fortify_attribute), and does NOT survive contact with anyone who KNOWS you - any NPC whose disposition record already names you sees through it instantly and says so.",
      "Breaks on entering COMBAT and on any crime witnessed."],
    note="Infiltration as a spell. Four faction quests have a false_face resolution and all four have a non-magic alternative.")

data = {
    "schema_version": 1,
    "corpus_item": "RI-MAG02",
    "generated_for": "Elder Souls - Black Marsh. Morrowind systems, Souls combat.",
    "provenance": "constructed",
    "note": ("The combinatorial effect list IS the system. Named spells are merely popular "
             "points in this space. Any spell a player can build from these parameters must "
             "work, including ones no designer authored (RI-MAG03 MB-1)."),
    "cost_formula": {
        "focus_base": "ceil( weight * ( M^1.30 + 0.7*D^0.95 + 0.55*M^0.80*D^0.45 ) * (1 + 0.09*A^1.25) * range_mult / 10 )",
        "focus_cost": "ceil( focus_base * class_mult * catalyst_mult * (1 - skill_discount) )",
        "terms": {
            "M": "magnitude in the effect's declared unit",
            "D": "duration in seconds; 0 for instantaneous",
            "A": "area radius in metres; 0 for self/touch/single-target",
            "range_mult": RANGE_MULT,
            "class_mult": CLASS_MULT,
            "catalyst_mult": {"great_staff": 0.80, "rod": 1.00,
                              "enchanted_weapon": 1.15, "none": 1.35},
            "skill_discount": "0.005 * (skill - tier_req), clamped to [0, 0.35] (RI-PRG03 §6)"
        },
        "cross_term_rationale": ("The 0.55*M^0.80*D^0.45 term is the only reason "
                                 "'magnitude 100 for 1 second' is not the dominant strategy. "
                                 "Without it the magnitude and duration axes are separable and "
                                 "the optimal spell is always a 1-second nuke. Removing this term "
                                 "is an automatic fail of RI-MAG03.")
    },
    "tier_bands": [
        {"tier": 1, "focus_base": "<= 12", "skill_req": 0},
        {"tier": 2, "focus_base": "13-30", "skill_req": 25},
        {"tier": 3, "focus_base": "31-65", "skill_req": 45},
        {"tier": 4, "focus_base": "66-120", "skill_req": 65},
        {"tier": 5, "focus_base": ">= 121", "skill_req": 85}
    ],
    "gold_price": {
        "formula": "round( 3.9 * focus_base^1.75 )",
        "anchored_to": ("RI-PRG05 §2 published spell prices: tier-1 220 g, tier-2 900 g, "
                        "tier-3 3400 g, at focus_base 10 / 22 / 48 respectively. "
                        "Fitted exponent 1.75; residuals under 3%."),
        "worked": {"10": 220, "22": 874, "48": 3425, "80": 8346, "140": 22218}
    },
    "hard_rules": [
        "No effect restores Focus. Not one. (RI-MAG01 §A)",
        "No effect has a magnitude RANGE. One magnitude, deterministic. (S1)",
        "No effect has a failure chance, a resist roll, or a proc chance. (S1)",
        "No effect emits a HUD marker, waypoint or compass arrow. (S8, AR-2)",
        "No effect converts, yields, reduces or substitutes for sap-debt. (S15)",
        "No effect grants i-frames.",
        "Fortified/temporary values satisfy ACTION gates, never STATION gates (faction rank, spell-tier attunement, quest rank).",
        "Resist and chameleon clamps (85%, 80%) are global and unstackable-past."
    ],
    "effects": E
}

for e in E:
    m = e["magnitude"]["max"]
    e["reference_cost"] = {
        "at_magnitude": min(m, 20),
        "duration_s": 30 if e["duration"]["allowed"] else 0,
        "focus_base": focus_base(e["weight"], min(m, 20),
                                 30 if e["duration"]["allowed"] else 0,
                                 0, e["ranges"][0] if e["ranges"][0] in RANGE_MULT else "target")
    }

import os
out = "/home/user/elder-souls-claude/corpus/25-magic/data/effects.json"
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(data, open(out, "w"), indent=1)

# ---- report
print("effects:", len(E))
sch = collections.Counter(e["school"] for e in E)
print("by school:", dict(sch))
print("out_of_fight:", sum(1 for e in E if e["out_of_fight"]))
print("changes_traversal:", sum(1 for e in E if e["changes_traversal"]))
print("changes_quest_resolution:", sum(1 for e in E if e["changes_quest_resolution"]))
print("traversal OR quest:", sum(1 for e in E if e["changes_traversal"] or e["changes_quest_resolution"]))
print("in_fight:", sum(1 for e in E if e["in_fight"]))
dmg_or_heal = {"fire_damage","frost_damage","shock_damage","poison_damage","damage_health",
               "drain_health","absorb_health","restore_health"}
print("pure damage/heal:", len(dmg_or_heal), "=> share %.1f%%" % (100*len(dmg_or_heal)/len(E)))
print("ids unique:", len(set(e['id'] for e in E)) == len(E))
print()
print("worked costs:")
for lbl, args in [
  ("Spark-Dart  shock M17 inst projectile CANTRIP", (1.4,17,0,0,"projectile","CANTRIP")),
  ("Marshfire   fire  M40 inst projectile LIGHT",   (1.5,40,0,0,"projectile","LIGHT")),
  ("Great nuke  fire  M80 inst projectile HEAVY",   (1.5,80,0,0,"projectile","HEAVY")),
  ("Great nuke  fire  M80 inst projectile GREAT",   (1.5,80,0,0,"projectile","GREAT")),
  ("Slowfall    D20s  self LIGHT",                  (2.6,1,20,0,"self","LIGHT")),
  ("Levitate    D15s  self LIGHT",                  (9.0,1,15,0,"self","LIGHT")),
  ("Levitate    D60s  self LIGHT",                  (9.0,1,60,0,"self","LIGHT")),
  ("Levitate    D180 self LIGHT",                   (9.0,1,180,0,"self","LIGHT")),
  ("Open t1     M20   touch LIGHT",                 (1.4,20,0,0,"touch","LIGHT")),
  ("Open t5     M100  touch HEAVY",                 (1.4,100,0,0,"touch","HEAVY")),
  ("Recall 500m M5    self RITUAL",                 (9.0,5,0,0,"self","RITUAL")),
  ("Recall 4km  M40   self RITUAL",                 (9.0,40,0,0,"self","RITUAL")),
  ("Paralyse    M4s   projectile LIGHT",            (5.5,4,4,0,"projectile","LIGHT")),
  ("Chameleon   M20(60%) D120 self LIGHT",          (3.2,20,120,0,"self","LIGHT")),
  ("Frenzy      M20(60) D30 target LIGHT",          (3.2,20,30,0,"target","LIGHT")),
  ("Frenzy      M20 D30 A6 area_at_range LIGHT",    (3.2,20,30,6,"area_at_range","LIGHT")),
  ("Balanced    M30 D30 projectile LIGHT",          (1.5,30,30,0,"projectile","LIGHT")),
  ("Restore hp  M60 inst self LIGHT",               (2.8,60,0,0,"self","LIGHT")),
  ("1s nuke M100 D1  projectile LIGHT",             (1.5,100,1,0,"projectile","LIGHT")),
  ("100s M1  D100    projectile LIGHT",             (1.5,1,100,0,"projectile","LIGHT")),
]:
    w,M,D,A,r,c = args
    print("  %-46s base=%4d  cost=%4d  gold=%7d" % (lbl, focus_base(w,M,D,A,r), cost(*args), round(3.9*focus_base(w,M,D,A,r)**1.75)))
