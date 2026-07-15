/* eslint-disable */
/**
 * Regenerate `src/api/types.ts` from the live OpenAPI spec.
 *
 *   node scripts/gen-api-types.js [specUrl]
 *
 * Defaults to the shared dev server. Requires Node 18+ (global fetch).
 */
const fs = require('fs');
const path = require('path');

const SPEC_URL = process.argv[2] || 'http://3.35.167.122:8080/v3/api-docs';
const OUT = path.join(__dirname, '..', 'src', 'api', 'types.ts');

function tsType(v) {
  if (!v) return 'unknown';
  if (v.$ref) return v.$ref.split('/').pop();
  if (v.allOf && v.allOf.length) return tsType(v.allOf[0]);
  if (v.enum) return v.enum.map((e) => JSON.stringify(e)).join(' | ');
  switch (v.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `${tsType(v.items)}[]`;
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

async function main() {
  const spec = await fetch(SPEC_URL).then((r) => r.json());
  const schemas = (spec.components && spec.components.schemas) || {};
  const names = Object.keys(schemas).sort();

  let out = `/**
 * TypeScript types generated from the Rougether User API v1 OpenAPI spec
 * (${SPEC_URL}). Regenerate with \`npm run gen:api-types\`. Do not edit by hand.
 */

`;
  for (const name of names) {
    const schema = schemas[name];
    const required = new Set(schema.required || []);
    const props = schema.properties || {};
    out += `export type ${name} = {\n`;
    for (const [key, value] of Object.entries(props)) {
      out += `  ${key}${required.has(key) ? '' : '?'}: ${tsType(value)};\n`;
    }
    out += `};\n\n`;
  }

  fs.writeFileSync(OUT, out);
  console.log(`Wrote ${names.length} types to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
