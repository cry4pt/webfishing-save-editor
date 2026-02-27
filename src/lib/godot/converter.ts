import type { GodotType } from './codec';

// Safe numeric conversion that preserves 0 (unlike `Number(x) || 0` which treats 0 as falsy)
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SaveData = Record<string, any>;

export function astToJS(node: GodotType): unknown {
  if (!node) return null;
  switch (node._t) {
    case 'nil': return null;
    case 'bool': return node.v;
    case 'int': case 'float': return node.v;
    case 'string': return node.v;
    case 'vector2': return { __type: 'Vector2', x: node.v.x, y: node.v.y };
    case 'color': return { __type: 'Color', ...node.v };
    case 'dict': {
      const obj: Record<string, unknown> = {};
      for (const [k, val] of node.v) {
        obj[String(astToJS(k))] = astToJS(val);
      }
      return obj;
    }
    case 'array': return node.v.map(astToJS);
    case 'pool_byte': case 'pool_int': case 'pool_real': return [...node.v];
    case 'pool_string': return [...node.v];
    default: return node.v;
  }
}

export function jsToAST(value: unknown, template?: GodotType): GodotType {
  if (template && template._t) {
    switch (template._t) {
      case 'nil': return { _t: 'nil', v: null };
      case 'bool': return { _t: 'bool', v: !!value };
      case 'int': return { _t: 'int', v: Math.round(toNumber(value)), _64: template._64 };
      case 'float': return { _t: 'float', v: toNumber(value), _64: template._64 };
      case 'string': return { _t: 'string', v: String(value ?? '') };
      case 'vector2': {
        const v = value as { x?: number; y?: number } | null;
        return { _t: 'vector2', v: { x: v?.x ?? 0, y: v?.y ?? 0 } };
      }
      case 'color': {
        const v = value as { r?: number; g?: number; b?: number; a?: number } | null;
        return { _t: 'color', v: { r: v?.r ?? 0, g: v?.g ?? 0, b: v?.b ?? 0, a: v?.a ?? 1 } };
      }
      case 'dict': {
        if (typeof value !== 'object' || value === null) return template;
        const entries: [GodotType, GodotType][] = [];
        const templateMap = new Map<string | number, [GodotType, GodotType]>();
        for (const [k, v] of template.v) {
          templateMap.set(astToJS(k) as string | number, [k, v]);
        }
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
          const parsedKey: string | number = /^\d+$/.test(key) ? parseInt(key) : key;
          const tmpl = templateMap.get(parsedKey) || templateMap.get(key);
          const kAST = tmpl ? tmpl[0] : guessAST(parsedKey);
          const vAST = tmpl ? jsToAST(val, tmpl[1]) : guessAST(val);
          entries.push([kAST, vAST]);
        }
        return { _t: 'dict', v: entries };
      }
      case 'array': {
        if (!Array.isArray(value)) return template;
        const elTmpl = template.v.length > 0 ? template.v[0] : undefined;
        return { _t: 'array', v: value.map(el => jsToAST(el, elTmpl)) };
      }
      case 'pool_byte': return { _t: 'pool_byte', v: Array.isArray(value) ? value : [] };
      case 'pool_int': return { _t: 'pool_int', v: Array.isArray(value) ? value.map(Number) : [] };
      case 'pool_real': return { _t: 'pool_real', v: Array.isArray(value) ? value.map(Number) : [] };
      case 'pool_string': return { _t: 'pool_string', v: Array.isArray(value) ? value.map(String) : [] };
      default: return guessAST(value);
    }
  }
  return guessAST(value);
}

function guessAST(value: unknown): GodotType {
  if (value === null || value === undefined) return { _t: 'nil', v: null };
  if (typeof value === 'boolean') return { _t: 'bool', v: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value) && Math.abs(value) < 0x7FFFFFFF) return { _t: 'int', v: value };
    return { _t: 'float', v: value };
  }
  if (typeof value === 'string') return { _t: 'string', v: value };
  if (Array.isArray(value)) return { _t: 'array', v: value.map(guessAST) };
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.__type === 'Vector2') return { _t: 'vector2', v: { x: Number(obj.x), y: Number(obj.y) } };
    if (obj.__type === 'Color') return { _t: 'color', v: { r: Number(obj.r), g: Number(obj.g), b: Number(obj.b), a: Number(obj.a) } };
    const entries: [GodotType, GodotType][] = Object.entries(obj).map(([k, v]) => {
      const pk: string | number = /^\d+$/.test(k) ? parseInt(k) : k;
      return [guessAST(pk), guessAST(v)];
    });
    return { _t: 'dict', v: entries };
  }
  return { _t: 'nil', v: null };
}
