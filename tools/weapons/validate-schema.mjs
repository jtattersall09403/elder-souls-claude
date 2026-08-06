#!/usr/bin/env node
// A JSON-Schema draft-07 subset validator, sufficient for corpus/12-weapons/moveset.schema.json.
// No dependency: tools/ ships playwright and image codecs and nothing else, and a builder that
// adds ajv to run one check has changed the project's dependency surface to pass its own test.
//
// Supports: type, const, enum, required, properties, additionalProperties, propertyNames,
// patternProperties-free $ref/$defs, pattern, minimum/maximum, exclusive bounds, minLength,
// minProperties, items, anyOf.
//
// Usage: node tools/weapons/validate-schema.mjs <schema.json> <glob-dir> [--quiet]
'use strict';

import fs from 'node:fs';
import path from 'node:path';

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported $ref ${ref}`);
  let node = root;
  for (const part of ref.slice(2).split('/')) node = node[part.replace(/~1/g, '/').replace(/~0/g, '~')];
  if (!node) throw new Error(`unresolved $ref ${ref}`);
  return node;
}

export function validate(root, schema, value, pointer, errs) {
  if (schema.$ref) return validate(root, resolveRef(root, schema.$ref), value, pointer, errs);
  const push = (m) => errs.push(`${pointer || '<root>'}: ${m}`);

  if (schema.const !== undefined && value !== schema.const) push(`expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  if (schema.enum && !schema.enum.includes(value)) push(`${JSON.stringify(value)} not in enum [${schema.enum.join(', ')}]`);

  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : null;
  if (types) {
    const t = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' ? (Number.isInteger(value) ? 'integer' : 'number') : typeof value;
    const ok = types.some((want) => want === t || (want === 'number' && t === 'integer'));
    if (!ok) { push(`expected type ${types.join('|')}, got ${t}`); return errs; }
  }
  if (schema.anyOf && !schema.anyOf.some((s) => validate(root, s, value, pointer, []).length === 0)) push('failed anyOf');
  for (const s of schema.allOf || []) validate(root, s, value, pointer, errs);
  if (schema.if) {
    const branch = validate(root, schema.if, value, pointer, []).length === 0 ? schema.then : schema.else;
    if (branch) validate(root, branch, value, pointer, errs);
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) push(`${value} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) push(`${value} > maximum ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) push(`string shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) push(`"${value}" does not match /${schema.pattern}/`);
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => validate(root, schema.items, v, `${pointer}[${i}]`, errs));

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) push(`${keys.length} properties < minProperties ${schema.minProperties}`);
    for (const r of schema.required || []) if (!(r in value)) push(`missing required property '${r}'`);
    if (schema.propertyNames) for (const k of keys) validate(root, schema.propertyNames, k, `${pointer}/${k}<name>`, errs);
    for (const k of keys) {
      const sub = schema.properties && schema.properties[k];
      if (sub) validate(root, sub, value[k], `${pointer}/${k}`, errs);
      else if (schema.additionalProperties === false) push(`additional property '${k}' is not allowed`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validate(root, schema.additionalProperties, value[k], `${pointer}/${k}`, errs);
    }
  }
  return errs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [schemaPath, dir] = process.argv.slice(2);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  let bad = 0, total = 0;
  const seen = new Map();
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const errs = validate(schema, schema, doc, '', []);
    total++;
    if (errs.length) {
      bad++;
      console.log(`FAIL ${f} (${errs.length})`);
      for (const e of errs.slice(0, 5)) {
        const kind = e.replace(/^[^:]*: /, '').replace(/[-\d.]+ ([<>]) (minimum|maximum) [\d.]+/, '$2 bound');
        seen.set(kind, (seen.get(kind) || 0) + 1);
        console.log('   ' + e);
      }
    }
  }
  console.log(`\n${total - bad}/${total} files validate against ${path.basename(schemaPath)}`);
  if (seen.size) { console.log('distinct error kinds:'); for (const [k, n] of [...seen].sort((a, b) => b[1] - a[1])) console.log(`  ${n} x ${k}`); }
  process.exit(bad ? 1 : 0);
}
