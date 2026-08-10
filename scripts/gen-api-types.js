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

// 스펙 주소도 공용 환경 단일 출처를 따른다 (#738).
const SPEC_URL = process.argv[2] || require('../src/config/shared-endpoints.json').openApiSpec;
const OUT = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(__dirname, '..', 'src', 'api', 'types.ts');

/**
 * 스펙이 nullable을 표기하지 않지만 서버가 실제로 null을 보내는 필드 (#733).
 * 생성기가 매번 덮어써 수동 패치가 조용히 사라지던 자리 — 여기 한 곳에 모아
 * 재생성 때마다 다시 붙인다. 서버 스펙에 nullable이 표기되면 항목을 지운다.
 */
const NULLABLE_OVERRIDES = {
  CategoryResponse: {
    houseId: '미연동은 null (#578).',
  },
  MemberRoomSummary: {
    room: '방을 아직 만들지 않은 구성원은 null — 기본 빈 방으로 렌더.',
  },
  RoutineLogResponse: {
    houseMissionContribution: 'null이면 미연동/스킵(이미 기여·비활성·과거 등) (#578).',
  },
  RoutineResponse: {
    houseMissionId: '미연동 루틴은 null로 온다.',
  },
  RoutineUpdateRequest: {
    repeatDays: 'null은 "지우기" — WEEKLY→DAILY 전환.',
    scheduledTime: 'null은 "지우기" — 알람 해제.',
    endsOn: 'null은 "지우기" — 종료일 해제.',
    houseMissionId: '미연동은 null.',
  },
};

function tsType(v, includeNull = true) {
  if (!v) return 'unknown';
  const nullable =
    includeNull &&
    (v.nullable === true ||
      (Array.isArray(v.type) && v.type.includes('null')) ||
      [...(v.oneOf || []), ...(v.anyOf || [])].some((part) => part.type === 'null'));
  const variants = [...(v.oneOf || []), ...(v.anyOf || [])].filter((part) => part.type !== 'null');
  const value = variants.length === 1 ? variants[0] : v;
  const type = Array.isArray(value.type)
    ? value.type.find((entry) => entry !== 'null')
    : value.type;

  let result;
  if (value.$ref) result = value.$ref.split('/').pop();
  else if (value.allOf && value.allOf.length) result = tsType(value.allOf[0], false);
  else if (value.enum) result = value.enum.map((e) => JSON.stringify(e)).join(' | ');
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
    const overrides = NULLABLE_OVERRIDES[name] || {};
    for (const [key, value] of Object.entries(props)) {
      let type = tsType(value);
      // 스펙 미표기 nullable을 다시 붙인다 — 이미 `| null`이면 건드리지 않는다.
      if (overrides[key] && !type.endsWith('| null')) {
        out += `  // 스펙 미표기 nullable (#733): ${overrides[key]}\n`;
        type = `${type} | null`;
      }
      out += `  ${key}${required.has(key) ? '' : '?'}: ${type};\n`;
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

module.exports = { tsType, NULLABLE_OVERRIDES };
