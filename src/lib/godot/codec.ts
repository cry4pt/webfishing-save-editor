// Godot 3.x Binary Variant Type IDs
export const GD = {
  NIL: 0, BOOL: 1, INT: 2, REAL: 3, STRING: 4,
  VECTOR2: 5, RECT2: 6, VECTOR3: 7, TRANSFORM2D: 8,
  PLANE: 9, QUAT: 10, AABB: 11, BASIS: 12, TRANSFORM: 13,
  COLOR: 14, NODE_PATH: 15, RID: 16, OBJECT: 17,
  DICTIONARY: 18, ARRAY: 19,
  POOL_BYTE_ARRAY: 20, POOL_INT_ARRAY: 21, POOL_REAL_ARRAY: 22,
  POOL_STRING_ARRAY: 23, POOL_VECTOR2_ARRAY: 24,
  POOL_VECTOR3_ARRAY: 25, POOL_COLOR_ARRAY: 26,
  FLAG_64: 0x10000
} as const;

export type GodotType =
  | { _t: 'nil'; v: null }
  | { _t: 'bool'; v: boolean }
  | { _t: 'int'; v: number; _64?: boolean }
  | { _t: 'float'; v: number; _64?: boolean }
  | { _t: 'string'; v: string }
  | { _t: 'vector2'; v: { x: number; y: number } }
  | { _t: 'rect2'; v: { x: number; y: number; w: number; h: number } }
  | { _t: 'vector3'; v: { x: number; y: number; z: number } }
  | { _t: 'color'; v: { r: number; g: number; b: number; a: number } }
  | { _t: 'dict'; v: [GodotType, GodotType][] }
  | { _t: 'array'; v: GodotType[] }
  | { _t: 'pool_byte'; v: number[] }
  | { _t: 'pool_int'; v: number[] }
  | { _t: 'pool_real'; v: number[] }
  | { _t: 'pool_string'; v: string[] }
  | { _t: 'nodepath'; v: string }
  | { _t: 'transform2d'; v: number[] }
  | { _t: 'plane'; v: number[] }
  | { _t: 'quat'; v: number[] }
  | { _t: 'aabb'; v: number[] }
  | { _t: 'basis'; v: number[] }
  | { _t: 'transform'; v: number[] }
  | { _t: 'rid'; v: null }
  | { _t: 'object'; v: null };

export class GodotReader {
  private buf: ArrayBuffer;
  private view: DataView;
  private pos: number;

  constructor(buffer: ArrayBuffer) {
    this.buf = buffer;
    this.view = new DataView(buffer);
    this.pos = 0;
  }

  private u32(): number { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  private i32(): number { const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  private i64(): number {
    const lo = this.view.getUint32(this.pos, true);
    const hi = this.view.getInt32(this.pos + 4, true);
    this.pos += 8;
    const value = hi * 0x100000000 + lo;
    if (!Number.isSafeInteger(value)) {
      console.warn(`[codec] 64-bit integer at offset ${this.pos - 8} exceeds safe range: ${value}`);
    }
    return value;
  }
  private f32(): number { const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  private f64(): number { const v = this.view.getFloat64(this.pos, true); this.pos += 8; return v; }
  private str(): string {
    const len = this.u32();
    const bytes = new Uint8Array(this.buf, this.pos, len);
    this.pos += len;
    this.pos += (4 - (len % 4)) % 4;
    return new TextDecoder().decode(bytes);
  }
  private floats(n: number): number[] {
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(this.f32());
    return vals;
  }

  variant(): GodotType {
    const tf = this.u32();
    const type = tf & 0xFFFF;
    const flags = tf >> 16;

    switch (type) {
      case GD.NIL: return { _t: 'nil', v: null };
      case GD.BOOL: return { _t: 'bool', v: this.u32() !== 0 };
      case GD.INT:
        return flags & 1
          ? { _t: 'int', v: this.i64(), _64: true }
          : { _t: 'int', v: this.i32() };
      case GD.REAL:
        return flags & 1
          ? { _t: 'float', v: this.f64(), _64: true }
          : { _t: 'float', v: this.f32() };
      case GD.STRING: return { _t: 'string', v: this.str() };
      case GD.VECTOR2: return { _t: 'vector2', v: { x: this.f32(), y: this.f32() } };
      case GD.RECT2: return { _t: 'rect2', v: { x: this.f32(), y: this.f32(), w: this.f32(), h: this.f32() } };
      case GD.VECTOR3: return { _t: 'vector3', v: { x: this.f32(), y: this.f32(), z: this.f32() } };
      case GD.COLOR: return { _t: 'color', v: { r: this.f32(), g: this.f32(), b: this.f32(), a: this.f32() } };
      case GD.DICTIONARY: {
        const count = this.u32() & 0x7FFFFFFF;
        const entries: [GodotType, GodotType][] = [];
        for (let i = 0; i < count; i++) {
          const k = this.variant();
          const val = this.variant();
          entries.push([k, val]);
        }
        return { _t: 'dict', v: entries };
      }
      case GD.ARRAY: {
        const count = this.u32() & 0x7FFFFFFF;
        const arr: GodotType[] = [];
        for (let i = 0; i < count; i++) arr.push(this.variant());
        return { _t: 'array', v: arr };
      }
      case GD.POOL_BYTE_ARRAY: {
        const count = this.u32();
        const arr = Array.from(new Uint8Array(this.buf, this.pos, count));
        this.pos += count;
        this.pos += (4 - (count % 4)) % 4;
        return { _t: 'pool_byte', v: arr };
      }
      case GD.POOL_INT_ARRAY: {
        const count = this.u32();
        const arr: number[] = [];
        for (let i = 0; i < count; i++) arr.push(this.i32());
        return { _t: 'pool_int', v: arr };
      }
      case GD.POOL_REAL_ARRAY: {
        const count = this.u32();
        const arr: number[] = [];
        for (let i = 0; i < count; i++) arr.push(this.f32());
        return { _t: 'pool_real', v: arr };
      }
      case GD.POOL_STRING_ARRAY: {
        const count = this.u32();
        const arr: string[] = [];
        for (let i = 0; i < count; i++) arr.push(this.str());
        return { _t: 'pool_string', v: arr };
      }
      case GD.NODE_PATH: {
        const header = this.u32();
        if (header & 0x80000000) {
          const nameCount = header & 0x7FFFFFFF;
          const subCount = this.u32();
          const absFlags = this.u32();
          const names: string[] = [];
          for (let i = 0; i < nameCount; i++) names.push(this.str());
          const subs: string[] = [];
          for (let i = 0; i < subCount; i++) subs.push(this.str());
          const abs = absFlags & 1 ? '/' : '';
          return { _t: 'nodepath', v: abs + names.join('/') + (subs.length ? ':' + subs.join(':') : '') };
        }
        return { _t: 'nodepath', v: this.str() };
      }
      case GD.TRANSFORM2D: return { _t: 'transform2d', v: this.floats(6) };
      case GD.PLANE: return { _t: 'plane', v: this.floats(4) };
      case GD.QUAT: return { _t: 'quat', v: this.floats(4) };
      case GD.AABB: return { _t: 'aabb', v: this.floats(6) };
      case GD.BASIS: return { _t: 'basis', v: this.floats(9) };
      case GD.TRANSFORM: return { _t: 'transform', v: this.floats(12) };
      case GD.RID: return { _t: 'rid', v: null };
      case GD.OBJECT: return { _t: 'object', v: null };
      default:
        throw new Error(`Unknown Godot variant type ${type} at offset ${this.pos - 4}`);
    }
  }
}

export class GodotWriter {
  private chunks: ArrayBuffer[] = [];
  private _size = 0;

  private push(bytes: ArrayBuffer) { this.chunks.push(bytes); this._size += bytes.byteLength; }
  private u32(v: number) { const b = new ArrayBuffer(4); new DataView(b).setUint32(0, v >>> 0, true); this.push(b); }
  private i32(v: number) { const b = new ArrayBuffer(4); new DataView(b).setInt32(0, v, true); this.push(b); }
  private i64(v: number) {
    if (!Number.isSafeInteger(v)) {
      console.warn(`[codec] Writing 64-bit integer with precision loss: ${v}`);
    }
    const b = new ArrayBuffer(8);
    const dv = new DataView(b);
    dv.setUint32(0, v & 0xFFFFFFFF, true);
    dv.setInt32(4, Math.floor(v / 0x100000000), true);
    this.push(b);
  }
  private f32(v: number) { const b = new ArrayBuffer(4); new DataView(b).setFloat32(0, v, true); this.push(b); }
  private f64(v: number) { const b = new ArrayBuffer(8); new DataView(b).setFloat64(0, v, true); this.push(b); }
  private str(s: string) {
    const encoded = new TextEncoder().encode(s);
    this.u32(encoded.length);
    const buf = new ArrayBuffer(encoded.length);
    new Uint8Array(buf).set(encoded);
    this.push(buf);
    const pad = (4 - (encoded.length % 4)) % 4;
    if (pad > 0) this.push(new ArrayBuffer(pad));
  }

  variant(node: GodotType) {
    if (!node) { this.u32(GD.NIL); return; }
    switch (node._t) {
      case 'nil': this.u32(GD.NIL); break;
      case 'bool': this.u32(GD.BOOL); this.u32(node.v ? 1 : 0); break;
      case 'int':
        if (node._64) { this.u32(GD.INT | GD.FLAG_64); this.i64(node.v); }
        else { this.u32(GD.INT); this.i32(node.v); }
        break;
      case 'float':
        if (node._64) { this.u32(GD.REAL | GD.FLAG_64); this.f64(node.v); }
        else { this.u32(GD.REAL); this.f32(node.v); }
        break;
      case 'string': this.u32(GD.STRING); this.str(node.v); break;
      case 'vector2': this.u32(GD.VECTOR2); this.f32(node.v.x); this.f32(node.v.y); break;
      case 'rect2': this.u32(GD.RECT2); this.f32(node.v.x); this.f32(node.v.y); this.f32(node.v.w); this.f32(node.v.h); break;
      case 'vector3': this.u32(GD.VECTOR3); this.f32(node.v.x); this.f32(node.v.y); this.f32(node.v.z); break;
      case 'color': this.u32(GD.COLOR); this.f32(node.v.r); this.f32(node.v.g); this.f32(node.v.b); this.f32(node.v.a); break;
      case 'dict':
        this.u32(GD.DICTIONARY); this.u32(node.v.length);
        for (const [k, val] of node.v) { this.variant(k); this.variant(val); }
        break;
      case 'array':
        this.u32(GD.ARRAY); this.u32(node.v.length);
        for (const el of node.v) this.variant(el);
        break;
      case 'pool_byte':
        this.u32(GD.POOL_BYTE_ARRAY); this.u32(node.v.length);
        { const buf = new ArrayBuffer(node.v.length); new Uint8Array(buf).set(node.v); this.push(buf); }
        { const pad = (4 - (node.v.length % 4)) % 4; if (pad) this.push(new ArrayBuffer(pad)); }
        break;
      case 'pool_int':
        this.u32(GD.POOL_INT_ARRAY); this.u32(node.v.length);
        for (const n of node.v) this.i32(n);
        break;
      case 'pool_real':
        this.u32(GD.POOL_REAL_ARRAY); this.u32(node.v.length);
        for (const n of node.v) this.f32(n);
        break;
      case 'pool_string':
        this.u32(GD.POOL_STRING_ARRAY); this.u32(node.v.length);
        for (const s of node.v) this.str(s);
        break;
      case 'nodepath': {
        this.u32(GD.NODE_PATH);
        const s = String(node.v || '');
        const abs = s.startsWith('/');
        const clean = abs ? s.slice(1) : s;
        const [pathPart, ...subParts] = clean.split(':');
        const names = pathPart ? pathPart.split('/') : [];
        this.u32(names.length | 0x80000000);
        this.u32(subParts.length);
        this.u32(abs ? 1 : 0);
        for (const n of names) this.str(n);
        for (const n of subParts) this.str(n);
        break;
      }
      case 'transform2d': this.u32(GD.TRANSFORM2D); for (const v of node.v) this.f32(v); break;
      case 'plane': this.u32(GD.PLANE); for (const v of node.v) this.f32(v); break;
      case 'quat': this.u32(GD.QUAT); for (const v of node.v) this.f32(v); break;
      case 'aabb': this.u32(GD.AABB); for (const v of node.v) this.f32(v); break;
      case 'basis': this.u32(GD.BASIS); for (const v of node.v) this.f32(v); break;
      case 'transform': this.u32(GD.TRANSFORM); for (const v of node.v) this.f32(v); break;
      case 'rid': this.u32(GD.RID); break;
      case 'object': this.u32(GD.OBJECT); this.u32(0); break;
    }
  }

  toBuffer(): ArrayBuffer {
    const result = new Uint8Array(this._size);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    return result.buffer;
  }
}

// Parse Godot store_var file format: [u32 length][variant data]
export function parseStoreVar(buffer: ArrayBuffer): GodotType {
  const dv = new DataView(buffer);
  const len = dv.getUint32(0, true);
  const reader = new GodotReader(buffer.slice(4, 4 + len));
  return reader.variant();
}

// Serialize to Godot store_var file format
export function serializeStoreVar(ast: GodotType): ArrayBuffer {
  const w = new GodotWriter();
  w.variant(ast);
  const variantBuf = w.toBuffer();
  const final = new ArrayBuffer(4 + variantBuf.byteLength);
  new DataView(final).setUint32(0, variantBuf.byteLength, true);
  new Uint8Array(final).set(new Uint8Array(variantBuf), 4);
  return final;
}
