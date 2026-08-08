/* eslint-disable */
/**
 * Regenerate `src/api/types.ts` from the live OpenAPI spec.
 *
 *   node scripts/gen-api-types.js [specUrl] [outputPath]
 *
 * Defaults to the shared dev server. Requires Node 18+ (global fetch).
 */
const fs = require('fs');
const path = require('path');
const sharedEndpoints = require('../src/config/shared-endpoints.json');

const SPEC_URL = process.argv[2] || sharedEndpoints.openApiSpec;
const OUT = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(__dirname, '..', 'src', 'api', 'types.ts');

function tsType(v, includeNull = true) {
  if (!v) return 'unknown';
  const nullable =
    includeNull &&
    (v.nullable === true ||
      (Array.isArray(v.type) && v.type.includes('null')) ||
      [...(v.oneOf || []), ...(v.anyOf || [])].some((part) => part.type === 'null'));
  const variants = [...(v.oneOf || []), ...(v.anyOf || [])].filter((part) => part.type !== 'null');
  const value = variants.length === 1 ? variants[0] : v;
  const types = Array.isArray(value.type) ? value.type.filter((entry) => entry !== 'null') : null;
  const type = types ? types[0] : value.type;

  let result;
  if (value.$ref) result = value.$ref.split('/').pop();
  else if (value.allOf && value.allOf.length) result = tsType(value.allOf[0], false);
  else if (value.enum) result = value.enum.map((e) => JSON.stringify(e)).join(' | ');
  else if (types && types.length > 1)
    result = [...new Set(types.map((entry) => tsType({ ...value, type: entry }, false)))].join(
      ' | ',
    );
  else
    switch (type) {
      case 'string':
        result = 'string';
        break;
      case 'integer':
      case 'number':
        result = 'number';
        break;
      case 'boolean':
        result = 'boolean';
        break;
      case 'array': {
        const itemType = tsType(value.items);
        result = itemType.includes(' | ') ? `(${itemType})[]` : `${itemType}[]`;
        break;
      }
      case 'object':
        result = 'Record<string, unknown>';
        break;
      default:
        result = 'unknown';
    }
  return nullable ? `${result} | null` : result;
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

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { tsType };
