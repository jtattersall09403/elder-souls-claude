// W1-30 Package 2: the fail-closed vocabulary shared by world construction paths.
// Values here are production controls, not labels: Province consumes flora scale/lean/layering,
// interiors consume structural grammar, and places publish a governed identity census.
'use strict';

export const REGION_ART = Object.freeze({
  blackwood:{terrain:'root-hummocks',flora:[1.18,1.08,.92],lean:1.12,depth:'closed-welkynd-vault'},
  'clay-moor':{terrain:'kiln-shelves',flora:[.72,.94,1.22],lean:.42,depth:'low-scrub-open-haze'},
  'crimson-coast':{terrain:'tidal-ridges',flora:[.56,1.34,1.08],lean:1.35,depth:'red-kelp-sea-fins'},
  'deep-marshes':{terrain:'drowned-hollows',flora:[1.30,1.42,.74],lean:.88,depth:'root-vault-reed-depth'},
  'eastern-rootlands':{terrain:'sap-fan-rises',flora:[1.08,1.18,.86],lean:.72,depth:'luminous-fan-corridor'},
  hive:{terrain:'wax-cell-mounds',flora:[.84,1.26,1.38],lean:.25,depth:'comb-tower-layers'},
  'marauders-coast':{terrain:'wreck-dunes',flora:[1.02,.88,1.24],lean:1.55,depth:'prow-mangrove-gantries'},
  'salt-hills':{terrain:'salt-tusks',flora:[.68,.72,1.36],lean:.48,depth:'bleached-tusk-horizon'},
  'stone-forest':{terrain:'basalt-steps',flora:[1.42,.62,.78],lean:.08,depth:'column-reed-parallax'},
  'stone-wastes':{terrain:'wind-shells',flora:[.46,.58,1.18],lean:1.68,depth:'sparse-shell-distance'},
  thornmarsh:{terrain:'thorn-islands',flora:[1.20,1.38,.96],lean:1.44,depth:'hook-arch-thickets'},
  'valus-ridge':{terrain:'cliff-buttresses',flora:[1.36,.76,1.12],lean:1.22,depth:'cloud-root-verticals'},
  'western-rootlands':{terrain:'braided-channels',flora:[1.12,1.24,.88],lean:.96,depth:'causeway-root-layers'},
});

export const SETTLEMENT_ART = Object.freeze({
  archon:{grammar:'terraced-kiln',support:'clay-ribs',trim:'dye-resin',imperial:false},
  blackrose:{grammar:'root-stockade',support:'prison-buttress',trim:'chitin-bars',imperial:false},
  gideon:{grammar:'imperial-grid-broken-by-roots',support:'ordered-stone-piers',trim:'metal-course',imperial:true},
  helstrom:{grammar:'shell-pier-market',support:'walking-root-piles',trim:'bone-lashings',imperial:false},
  lilmoth:{grammar:'reed-dome-tidal-court',support:'splayed-reed-bundles',trim:'shell-rings',imperial:false},
  soulrest:{grammar:'harbour-rib',support:'salt-bone-arches',trim:'bleached-timber',imperial:false},
  stormhold:{grammar:'root-bridge-tiers',support:'stone-root-buttress',trim:'legion-resin',imperial:true},
  thorn:{grammar:'spiral-palisade',support:'needle-thorn-brace',trim:'black-resin',imperial:false},
});

export const PLACE_ART = Object.freeze({
  barge_hold:'prison-barge-ribs', writ_house:'gideon-imperial-record-house',
  market:'helstrom-shell-pier-market', street:'stormhold-legion-root-street',
  well:'rootlands-living-well-graph',
});

export const CREATURE_ART = Object.freeze({
  // Numeric fields are deliberately renderer-facing.  Changing any one changes a mesh transform,
  // primitive, or material; `tools/render/w1-30-package2.mjs` rejects label-only records.
  saxhleel:{silhouette:'scaled-snout-tail-asymmetry',scale:[.94,1.06,1],shape:'crest-tail',colour:0x47735c,roughness:.62},
  humanoid:{silhouette:'equipment-led-regional-silhouette',scale:[1,1,1],shape:'mantle-pack',colour:0x786b55,roughness:.78},
  beast:{silhouette:'low-forward-chitin-root-silhouette',scale:[1.38,.68,1.62],shape:'carapace-horns',colour:0x47382b,roughness:.48},
  undead:{silhouette:'salt-bone-broken-joints',scale:[.78,1.14,.82],shape:'ribs-spikes',colour:0xc4bfa7,roughness:.92},
});

export function regionArt(id) {
  const v=REGION_ART[id]; if(!v) throw new Error(`W1-30 unknown region art id '${id}'`); return v;
}
export function settlementArt(id) {
  const v=SETTLEMENT_ART[id]; if(!v) throw new Error(`W1-30 unknown settlement art id '${id}'`); return v;
}
export function placeArt(id) {
  const v=PLACE_ART[id]; if(!v) throw new Error(`W1-30 unknown place art id '${id}'`); return v;
}
export function creatureArt(id) {
  const v=CREATURE_ART[id]; if(!v) throw new Error(`W1-30 unknown creature art id '${id}'`); return v;
}
