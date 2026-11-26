/* EX Artbooth - colour management for export.
 *
 * Canvas always hands us sRGB pixels. This module converts them to a chosen
 * destination RGB profile with real matrix maths, applies a rendering intent
 * and optional black point compensation, builds a valid ICC v2 profile for the
 * destination, and embeds that profile in the exported PNG or JPEG so other
 * applications interpret the file correctly.
 */
(function (global) {
  'use strict';

  /* ---------------- profile definitions ---------------- */

  // Primaries and white points are the published chromaticities for each space.
  const PROFILES = {
    srgb: {
      id: 'srgb',
      name: 'sRGB IEC61966-2.1',
      short: 'sRGB',
      red: [0.6400, 0.3300], green: [0.3000, 0.6000], blue: [0.1500, 0.0600],
      white: [0.3127, 0.3290],
      trc: 'srgb',
      copyright: 'Public Domain',
    },
    'display-p3': {
      id: 'display-p3',
      name: 'Display P3',
      short: 'Display P3',
      red: [0.6800, 0.3200], green: [0.2650, 0.6900], blue: [0.1500, 0.0600],
      white: [0.3127, 0.3290],
      trc: 'srgb',
      copyright: 'Public Domain',
    },
    'adobe-rgb': {
      id: 'adobe-rgb',
      name: 'Adobe RGB (1998) compatible',
      short: 'Adobe RGB',
      red: [0.6400, 0.3300], green: [0.2100, 0.7100], blue: [0.1500, 0.0600],
      white: [0.3127, 0.3290],
      trc: 563 / 256, // 2.19921875, the gamma the Adobe RGB spec encodes as u8Fixed8
      copyright: 'Public Domain',
    },
    prophoto: {
      id: 'prophoto',
      name: 'ProPhoto RGB compatible',
      short: 'ProPhoto',
      red: [0.734699, 0.265301], green: [0.159597, 0.840403], blue: [0.036598, 0.000105],
      white: [0.345704, 0.358540], // D50
      trc: 1.8,
      copyright: 'Public Domain',
    },
  };

  const INTENTS = { perceptual: 0, relative: 1, saturation: 2, absolute: 3 };

  const D50 = [0.9642, 1.0, 0.8249];

  /* ---------------- small matrix helpers ---------------- */

  const mul = (a, b) => {
    const out = new Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
      }
    }
    return out;
  };

  const apply = (m, v) => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];

  function invert(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    return [
      (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
      (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
      (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
    ];
  }

  const whiteXYZ = (xy) => [xy[0] / xy[1], 1, (1 - xy[0] - xy[1]) / xy[1]];

  // RGB -> XYZ matrix for a set of primaries, scaled so RGB(1,1,1) = the white point.
  function rgbToXYZMatrix(profile) {
    const { red, green, blue } = profile;
    const m = [
      red[0] / red[1], green[0] / green[1], blue[0] / blue[1],
      1, 1, 1,
      (1 - red[0] - red[1]) / red[1], (1 - green[0] - green[1]) / green[1], (1 - blue[0] - blue[1]) / blue[1],
    ];
    const s = apply(invert(m), whiteXYZ(profile.white));
    return [
      m[0] * s[0], m[1] * s[1], m[2] * s[2],
      m[3] * s[0], m[4] * s[1], m[5] * s[2],
      m[6] * s[0], m[7] * s[1], m[8] * s[2],
    ];
  }

  const BRADFORD = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
  const BRADFORD_INV = invert(BRADFORD);

  // Von Kries style chromatic adaptation in the Bradford cone space.
  function adaptationMatrix(srcWhite, dstWhite) {
    const s = apply(BRADFORD, srcWhite);
    const d = apply(BRADFORD, dstWhite);
    const scale = [d[0] / s[0], 0, 0, 0, d[1] / s[1], 0, 0, 0, d[2] / s[2]];
    return mul(BRADFORD_INV, mul(scale, BRADFORD));
  }

  /* ---------------- tone response curves ---------------- */

  const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const linearToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

  const encodeTRC = (profile, v) => {
    if (v <= 0) return 0;
    if (v >= 1) return 1;
    return profile.trc === 'srgb' ? linearToSrgb(v) : Math.pow(v, 1 / profile.trc);
  };

  /* ---------------- ICC profile reader ---------------- */

  // Reads matrix/TRC RGB and grayscale profiles, which covers every RGB working
  // space. LUT-based profiles (CMYK and most printer profiles) need a full CMM
  // with A2B tables; those are reported as unsupported instead of approximated.
  function parseICC(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 132) return { error: 'tooShort' };
    if (String.fromCharCode(bytes[36], bytes[37], bytes[38], bytes[39]) !== 'acsp') return { error: 'notIcc' };
    const space = String.fromCharCode(bytes[16], bytes[17], bytes[18], bytes[19]).trim();
    const tagCount = view.getUint32(128);
    const tags = {};
    for (let i = 0; i < tagCount; i++) {
      const base = 132 + i * 12;
      if (base + 12 > bytes.length) break;
      const name = String.fromCharCode(bytes[base], bytes[base + 1], bytes[base + 2], bytes[base + 3]);
      tags[name] = { offset: view.getUint32(base + 4), size: view.getUint32(base + 8) };
    }

    const readXYZ = (name) => {
      const tag = tags[name];
      if (!tag) return null;
      const o = tag.offset;
      return [view.getInt32(o + 8) / 65536, view.getInt32(o + 12) / 65536, view.getInt32(o + 16) / 65536];
    };

    // Returns a function mapping device value 0..1 to linear light 0..1.
    const readCurve = (name) => {
      const tag = tags[name];
      if (!tag) return null;
      const o = tag.offset;
      const type = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
      if (type === 'curv') {
        const count = view.getUint32(o + 8);
        if (count === 0) return (v) => v;
        if (count === 1) {
          const gamma = view.getUint16(o + 12) / 256;
          return (v) => Math.pow(Math.max(0, v), gamma);
        }
        const table = new Float64Array(count);
        for (let i = 0; i < count; i++) table[i] = view.getUint16(o + 12 + i * 2) / 65535;
        return (v) => {
          const x = Math.max(0, Math.min(1, v)) * (count - 1);
          const i = x | 0;
          const f = x - i;
          return table[i] * (1 - f) + table[Math.min(count - 1, i + 1)] * f;
        };
      }
      if (type === 'para') {
        const fn = view.getUint16(o + 8);
        const p = [];
        const counts = { 0: 1, 1: 3, 2: 4, 3: 5, 4: 7 };
        const n = counts[fn];
        if (n === undefined) return null;
        for (let i = 0; i < n; i++) p.push(view.getInt32(o + 12 + i * 4) / 65536);
        const [g, a, b, c, d, e, f] = p;
        if (fn === 0) return (v) => Math.pow(Math.max(0, v), g);
        if (fn === 1) return (v) => (v >= -b / a ? Math.pow(a * v + b, g) : 0);
        if (fn === 2) return (v) => (v >= -b / a ? Math.pow(a * v + b, g) + c : c);
        if (fn === 3) return (v) => (v >= d ? Math.pow(a * v + b, g) : c * v);
        return (v) => (v >= d ? Math.pow(a * v + b, g) + e : c * v + f);
      }
      return null;
    };

    const readDesc = () => {
      const tag = tags.desc;
      if (!tag) return 'Loaded profile';
      const o = tag.offset;
      const type = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
      if (type === 'desc') {
        const count = view.getUint32(o + 8);
        let out = '';
        for (let i = 0; i < count - 1; i++) out += String.fromCharCode(bytes[o + 12 + i]);
        return out.trim() || 'Loaded profile';
      }
      if (type === 'mluc') {
        const len = view.getUint32(o + 20);
        const off = view.getUint32(o + 24);
        let out = '';
        for (let i = 0; i < len; i += 2) out += String.fromCharCode(view.getUint16(o + off + i));
        return out.trim() || 'Loaded profile';
      }
      return 'Loaded profile';
    };

    if (tags.A2B0 && !(tags.rXYZ && tags.gXYZ && tags.bXYZ) && !tags.kTRC) {
      return { error: 'lutProfile', space };
    }

    const name = readDesc();
    const white = readXYZ('wtpt') || whiteXYZ([0.3457, 0.3585]);
    const blackXYZ = readXYZ('bkpt') || [0, 0, 0];

    if (space === 'GRAY') {
      const curve = readCurve('kTRC');
      if (!curve) return { error: 'unsupported', space };
      // A grey profile reproduces the D50 PCS white scaled by the tone curve.
      const toXYZ = [D50[0], 0, 0, D50[1], 0, 0, D50[2], 0, 0];
      return { name, space: 'GRAY', toXYZ, decode: [curve, curve, curve], white, black: blackXYZ, gray: true };
    }

    const r = readXYZ('rXYZ');
    const g = readXYZ('gXYZ');
    const b = readXYZ('bXYZ');
    const rc = readCurve('rTRC');
    const gc = readCurve('gTRC');
    const bc = readCurve('bTRC');
    if (!r || !g || !b || !rc || !gc || !bc) return { error: tags.A2B0 ? 'lutProfile' : 'unsupported', space };
    const toXYZ = [r[0], g[0], b[0], r[1], g[1], b[1], r[2], g[2], b[2]];
    return { name, space: 'RGB', toXYZ, decode: [rc, gc, bc], white, black: blackXYZ };
  }

  // Numerically invert a decode curve so we can encode linear light back to
  // device values for an arbitrary loaded profile.
  function inverseCurve(decode) {
    const N = 2048;
    const samples = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) samples[i] = decode(i / N);
    const monotonic = samples[N] >= samples[0];
    return (target) => {
      if (!(target > 0)) return 0;
      if (target >= 1) return 1;
      let lo = 0;
      let hi = N;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        const v = samples[mid];
        if (monotonic ? v < target : v > target) lo = mid; else hi = mid;
      }
      const a = samples[lo];
      const b = samples[hi];
      const f = Math.abs(b - a) < 1e-12 ? 0 : (target - a) / (b - a);
      return Math.max(0, Math.min(1, (lo + f) / N));
    };
  }

  /** Describe a destination in one shape, whether built in or loaded from disk. */
  function destinationFor(options) {
    const custom = options.customProfile;
    if (custom && custom.parsed && !custom.parsed.error) {
      const p = custom.parsed;
      return {
        id: 'custom',
        name: p.name,
        short: p.name,
        toXYZd50: p.toXYZ,
        encode: p.decode.map(inverseCurve),
        white: p.white,
        black: p.black,
        gray: Boolean(p.gray),
        icc: custom.bytes,
      };
    }
    const profile = PROFILES[options.profile] || PROFILES.srgb;
    const white = whiteXYZ(profile.white);
    const toXYZd50 = mul(adaptationMatrix(white, D50), rgbToXYZMatrix(profile));
    const encode = (v) => encodeTRC(profile, v);
    return {
      id: profile.id,
      name: profile.name,
      short: profile.short,
      toXYZd50,
      encode: [encode, encode, encode],
      white,
      black: [0, 0, 0],
      gray: false,
      icc: null,
    };
  }

  /* ---------------- the conversion itself ---------------- */

  const SRGB_WHITE = whiteXYZ(PROFILES.srgb.white);
  const SRGB_TO_XYZ = rgbToXYZMatrix(PROFILES.srgb);
  const BRADFORD_D65_D50 = adaptationMatrix(SRGB_WHITE, D50);

  function conversionPlan(options) {
    const intent = options.intent || 'relative';
    const dest = destinationFor(options);
    // Everything meets in the D50 profile connection space.
    let toPCS = mul(BRADFORD_D65_D50, SRGB_TO_XYZ);
    if (intent === 'absolute') {
      // Absolute colorimetric re-references the source colours to the
      // destination's own media white instead of adapting white to white, so a
      // destination with a different white point shows a deliberate cast.
      const srcAbs = apply(BRADFORD_D65_D50, SRGB_WHITE);
      const dstAbs = apply(BRADFORD_D65_D50, dest.white);
      const ratio = [
        srcAbs[0] / dstAbs[0], 0, 0,
        0, srcAbs[1] / dstAbs[1], 0,
        0, 0, srcAbs[2] / dstAbs[2],
      ];
      toPCS = mul(ratio, toPCS);
    }
    const matrix = mul(invert(dest.toXYZd50), toPCS);
    const sameWhite = Math.abs(dest.white[0] - SRGB_WHITE[0]) < 1e-4
      && Math.abs(dest.white[2] - SRGB_WHITE[2]) < 1e-4;
    return { dest, matrix, intent, sameWhite };
  }

  // Bring an out-of-gamut linear colour back inside [0,1] according to intent.
  function gamutMap(rgb, intent) {
    const lo = Math.min(rgb[0], rgb[1], rgb[2]);
    const hi = Math.max(rgb[0], rgb[1], rgb[2]);
    if (lo >= -1e-9 && hi <= 1 + 1e-9) return { rgb, clipped: false };

    if (intent === 'perceptual') {
      // Desaturate towards the colour's own luminance until it fits. This keeps
      // differences between neighbouring out-of-gamut colours instead of
      // flattening them all onto the gamut surface.
      const y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      const luma = Math.min(1, Math.max(0, y));
      let f = 1;
      for (let i = 0; i < 3; i++) {
        const v = rgb[i];
        if (v > 1) f = Math.min(f, (1 - luma) / (v - luma));
        else if (v < 0) f = Math.min(f, luma / (luma - v));
      }
      if (!isFinite(f) || f < 0) f = 0;
      return { rgb: rgb.map((v) => clamp01(luma + (v - luma) * f)), clipped: true };
    }

    if (intent === 'saturation') {
      // Keep hue and the ratios between channels, so saturation survives and
      // lightness is given up instead.
      const base = rgb.map((v) => Math.max(v, 0));
      const peak = Math.max(base[0], base[1], base[2]);
      return { rgb: (peak > 1 ? base.map((v) => v / peak) : base).map(clamp01), clipped: true };
    }

    // relative and absolute colorimetric: hard clip to the gamut boundary
    return { rgb: rgb.map(clamp01), clipped: true };
  }

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /**
   * Convert ImageData in place from sRGB to the destination.
   * Returns honest statistics about what the conversion actually did.
   */
  function convertImageData(imageData, opts) {
    const options = opts || {};
    const grayscale = Boolean(options.grayscale);
    const plan = conversionPlan(options);
    const dest = plan.dest;
    const intent = plan.intent;

    // Black point compensation scales linear light so the source black lands on
    // the destination's own black instead of being clipped to zero. Display
    // profiles declare a black of zero, where the maths is an identity; many
    // print and scanner profiles declare a real black, where it matters.
    const destBlackY = Math.max(0, Math.min(0.5, dest.black ? dest.black[1] : 0));
    const bpcActive = Boolean(options.blackPoint) && destBlackY > 1e-6;

    const decode = new Float64Array(256);
    for (let i = 0; i < 256; i++) decode[i] = srgbToLinear(i / 255);

    // Cache each destination encode curve on a fine grid.
    const STEPS = 4096;
    const luts = dest.encode.map((fn) => {
      const lut = new Float64Array(STEPS + 1);
      for (let i = 0; i <= STEPS; i++) lut[i] = fn(i / STEPS);
      return lut;
    });
    const encodeWith = (lut, v) => {
      if (v <= 0) return 0;
      if (v >= 1) return 255;
      const x = v * STEPS;
      const i = x | 0;
      const f = x - i;
      return (lut[i] * (1 - f) + lut[Math.min(STEPS, i + 1)] * f) * 255;
    };

    const m = plan.matrix;
    const data = imageData.data;
    const total = data.length / 4;
    let clippedPixels = 0;
    let changedPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      let r = decode[data[i]];
      let g = decode[data[i + 1]];
      let b = decode[data[i + 2]];

      if (grayscale) {
        // Luminance in linear light: the colorimetrically correct grey.
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = g = b = y;
      }

      let out = [
        m[0] * r + m[1] * g + m[2] * b,
        m[3] * r + m[4] * g + m[5] * b,
        m[6] * r + m[7] * g + m[8] * b,
      ];

      if (bpcActive) out = out.map((v) => destBlackY + v * (1 - destBlackY));

      const mapped = gamutMap(out, intent);
      if (mapped.clipped) clippedPixels++;

      const nr = Math.round(encodeWith(luts[0], mapped.rgb[0]));
      const ng = Math.round(encodeWith(luts[1], mapped.rgb[1]));
      const nb = Math.round(encodeWith(luts[2], mapped.rgb[2]));
      if (nr !== data[i] || ng !== data[i + 1] || nb !== data[i + 2]) changedPixels++;
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }

    return { clippedPixels, changedPixels, total, dest, intent, bpcActive, grayscale };
  }

  /**
   * Convert a small sample of the image so the dialog can state what the
   * current settings will really do before the user commits.
   */
  function previewStats(imageData, options) {
    const copy = { data: new Uint8ClampedArray(imageData.data) };
    return convertImageData(copy, options);
  }

  /* ---------------- ICC v2 profile writer ---------------- */

  const sig = (s) => [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)];
  const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const u16 = (n) => [(n >>> 8) & 255, n & 255];
  const s15f16 = (v) => u32(Math.round(v * 65536) >>> 0 & 0xffffffff);

  function xyzType(v) {
    return [...sig('XYZ '), ...u32(0), ...s15f16(v[0]), ...s15f16(v[1]), ...s15f16(v[2])];
  }

  function curveType(profile) {
    if (profile.trc === 'srgb') {
      // Sample the piecewise sRGB curve; a single gamma cannot represent it.
      // An ICC curve maps the DEVICE value to linear light, so this table holds
      // the decoding direction, not the encoding one.
      const n = 1024;
      const bytes = [...sig('curv'), ...u32(0), ...u32(n)];
      for (let i = 0; i < n; i++) {
        const v = srgbToLinear(i / (n - 1));
        bytes.push(...u16(Math.max(0, Math.min(65535, Math.round(v * 65535)))));
      }
      return bytes;
    }
    // u8Fixed8 gamma in a one-entry curve
    return [...sig('curv'), ...u32(0), ...u32(1), ...u16(Math.round(profile.trc * 256))];
  }

  function descType(text) {
    const ascii = text.replace(/[^\x20-\x7e]/g, '?');
    const bytes = [...sig('desc'), ...u32(0), ...u32(ascii.length + 1)];
    for (let i = 0; i < ascii.length; i++) bytes.push(ascii.charCodeAt(i));
    bytes.push(0);
    bytes.push(...u32(0));          // unicode language code
    bytes.push(...u32(0));          // unicode count
    bytes.push(...u16(0));          // scriptcode code
    bytes.push(0);                  // scriptcode count
    for (let i = 0; i < 67; i++) bytes.push(0); // macintosh description
    return bytes;
  }

  function textType(text) {
    const bytes = [...sig('text'), ...u32(0)];
    for (let i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 0x7f);
    bytes.push(0);
    return bytes;
  }

  function sf32Type(matrix) {
    const bytes = [...sig('sf32'), ...u32(0)];
    matrix.forEach((v) => bytes.push(...s15f16(v)));
    return bytes;
  }

  /** Build a valid ICC v2 display profile for one of our destinations. */
  function buildICC(profileId, renderingIntent) {
    const profile = PROFILES[profileId] || PROFILES.srgb;
    const white = whiteXYZ(profile.white);
    const chad = adaptationMatrix(white, D50);
    const toXYZ = rgbToXYZMatrix(profile);
    // Colorants must be stored adapted to the D50 profile connection space.
    const adapted = mul(chad, toXYZ);
    const colorant = (col) => [adapted[col], adapted[3 + col], adapted[6 + col]];

    const curve = curveType(profile);
    const tags = [
      ['desc', descType(profile.name)],
      // ICC v2 practice (as in the HP/Microsoft sRGB profile) is to store the
      // real, unadapted media white here and carry the D50 adaptation in chad.
      // Absolute colorimetric conversions depend on this being the true white.
      ['wtpt', xyzType(white)],
      ['bkpt', xyzType([0, 0, 0])],
      ['rXYZ', xyzType(colorant(0))],
      ['gXYZ', xyzType(colorant(1))],
      ['bXYZ', xyzType(colorant(2))],
      ['rTRC', curve],
      ['gTRC', curve],
      ['bTRC', curve],
      ['chad', sf32Type(chad)],
      ['cprt', textType(profile.copyright)],
    ];

    // Identical TRC tags share one copy of the data, as real profiles do.
    const headerSize = 128;
    const tableSize = 4 + tags.length * 12;
    let offset = headerSize + tableSize;
    const entries = [];
    const blobs = [];
    const seen = new Map();
    tags.forEach(([name, data]) => {
      const key = data === curve ? 'curve' : name;
      if (seen.has(key)) {
        entries.push([name, seen.get(key).offset, seen.get(key).size]);
        return;
      }
      const padded = data.length + ((4 - (data.length % 4)) % 4);
      entries.push([name, offset, data.length]);
      seen.set(key, { offset, size: data.length });
      blobs.push({ offset, data, padded });
      offset += padded;
    });

    const size = offset;
    const out = new Uint8Array(size);
    const write = (pos, arr) => { out.set(arr, pos); };

    write(0, u32(size));
    write(4, u32(0));                       // preferred CMM
    write(8, u32(0x02100000));              // version 2.1
    write(12, sig('mntr'));
    write(16, sig('RGB '));
    write(20, sig('XYZ '));
    const now = new Date();
    write(24, [...u16(now.getUTCFullYear()), ...u16(now.getUTCMonth() + 1), ...u16(now.getUTCDate()),
      ...u16(now.getUTCHours()), ...u16(now.getUTCMinutes()), ...u16(now.getUTCSeconds())]);
    write(36, sig('acsp'));
    write(40, u32(0));                      // platform
    write(44, u32(0));                      // flags
    write(48, u32(0));                      // manufacturer
    write(52, u32(0));                      // model
    write(56, u32(0)); write(60, u32(0));   // attributes
    write(64, u32(INTENTS[renderingIntent] === undefined ? 1 : INTENTS[renderingIntent]));
    write(68, [...s15f16(D50[0]), ...s15f16(D50[1]), ...s15f16(D50[2])]);
    write(80, u32(0));                      // creator

    write(headerSize, u32(tags.length));
    entries.forEach(([name, tagOffset, tagSize], index) => {
      const base = headerSize + 4 + index * 12;
      write(base, sig(name));
      write(base + 4, u32(tagOffset));
      write(base + 8, u32(tagSize));
    });
    blobs.forEach((blob) => write(blob.offset, blob.data));
    return out;
  }

  /* ---------------- embedding the profile in files ---------------- */

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // zlib stream using stored (uncompressed) deflate blocks. A profile is ~1 KB,
  // so the lost compression is irrelevant and this needs no dependencies and no
  // async CompressionStream.
  function zlibStore(bytes) {
    const blocks = [];
    let a = 1;
    let b = 0;
    for (let i = 0; i < bytes.length; i++) {
      a = (a + bytes[i]) % 65521;
      b = (b + a) % 65521;
    }
    blocks.push(0x78, 0x01);
    for (let pos = 0; pos < bytes.length || pos === 0; pos += 65535) {
      const chunk = bytes.subarray(pos, Math.min(pos + 65535, bytes.length));
      const final = pos + 65535 >= bytes.length ? 1 : 0;
      blocks.push(final, chunk.length & 255, (chunk.length >>> 8) & 255,
        ~chunk.length & 255, (~chunk.length >>> 8) & 255);
      for (let i = 0; i < chunk.length; i++) blocks.push(chunk[i]);
      if (final) break;
    }
    blocks.push((b >>> 8) & 255, b & 255, (a >>> 8) & 255, a & 255);
    return new Uint8Array(blocks);
  }

  function embedPngProfile(png, icc) {
    const keyword = 'ICC profile';
    const payload = new Uint8Array(keyword.length + 2 + zlibStore(icc).length);
    const compressed = zlibStore(icc);
    for (let i = 0; i < keyword.length; i++) payload[i] = keyword.charCodeAt(i);
    payload[keyword.length] = 0;      // null separator
    payload[keyword.length + 1] = 0;  // compression method: deflate
    payload.set(compressed, keyword.length + 2);

    const chunk = new Uint8Array(payload.length + 12);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, payload.length);
    chunk.set([0x69, 0x43, 0x43, 0x50], 4); // "iCCP"
    chunk.set(payload, 8);
    view.setUint32(chunk.length - 4, crc32(chunk.subarray(4, chunk.length - 4)));

    const out = [];
    out.push(png.subarray(0, 8)); // signature
    let pos = 8;
    let inserted = false;
    while (pos + 8 <= png.length) {
      const len = new DataView(png.buffer, png.byteOffset + pos, 4).getUint32(0);
      const type = String.fromCharCode(png[pos + 4], png[pos + 5], png[pos + 6], png[pos + 7]);
      const end = pos + 12 + len;
      // Drop any colour chunks that would contradict the profile we embed.
      const drop = type === 'iCCP' || type === 'sRGB' || type === 'gAMA' || type === 'cHRM';
      if (!drop) out.push(png.subarray(pos, end));
      if (type === 'IHDR') { out.push(chunk); inserted = true; }
      pos = end;
      if (type === 'IEND') break;
    }
    if (!inserted) return png;
    let size = 0;
    out.forEach((part) => { size += part.length; });
    const result = new Uint8Array(size);
    let at = 0;
    out.forEach((part) => { result.set(part, at); at += part.length; });
    return result;
  }

  function embedJpegProfile(jpeg, icc) {
    const header = 'ICC_PROFILE\0';
    const CHUNK = 65519 - header.length - 2;
    const count = Math.max(1, Math.ceil(icc.length / CHUNK));
    const segments = [];
    for (let i = 0; i < count; i++) {
      const part = icc.subarray(i * CHUNK, Math.min((i + 1) * CHUNK, icc.length));
      const len = part.length + header.length + 2 + 2;
      const seg = new Uint8Array(len + 2);
      seg[0] = 0xff; seg[1] = 0xe2;
      seg[2] = (len >>> 8) & 255; seg[3] = len & 255;
      for (let c = 0; c < header.length; c++) seg[4 + c] = header.charCodeAt(c);
      seg[4 + header.length] = i + 1;
      seg[5 + header.length] = count;
      seg.set(part, 6 + header.length);
      segments.push(seg);
    }

    // Insert after SOI and any APP0/JFIF block.
    let pos = 2;
    while (pos + 4 <= jpeg.length && jpeg[pos] === 0xff && jpeg[pos + 1] === 0xe0) {
      pos += 2 + ((jpeg[pos + 2] << 8) | jpeg[pos + 3]);
    }
    let size = jpeg.length;
    segments.forEach((seg) => { size += seg.length; });
    const out = new Uint8Array(size);
    out.set(jpeg.subarray(0, pos), 0);
    let at = pos;
    segments.forEach((seg) => { out.set(seg, at); at += seg.length; });
    out.set(jpeg.subarray(pos), at);
    return out;
  }

  /* ---------------- data URL plumbing ---------------- */

  function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const binary = global.atob ? global.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function bytesToDataUrl(bytes, mime) {
    let binary = '';
    const STEP = 0x8000;
    for (let i = 0; i < bytes.length; i += STEP) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + STEP));
    }
    const base64 = global.btoa ? global.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return `data:${mime};base64,${base64}`;
  }

  /**
   * Embed an ICC profile into an exported data URL. Pass `customBytes` to embed
   * a profile the user loaded from disk; its rendering intent header field is
   * updated to the intent actually used.
   */
  function tagDataUrl(dataUrl, mime, profileId, intent, customBytes) {
    try {
      let icc;
      if (customBytes && customBytes.length > 68) {
        icc = new Uint8Array(customBytes);
        const code = INTENTS[intent] === undefined ? 1 : INTENTS[intent];
        icc[64] = 0; icc[65] = 0; icc[66] = 0; icc[67] = code;
      } else {
        icc = buildICC(profileId, intent);
      }
      const bytes = dataUrlToBytes(dataUrl);
      const tagged = mime === 'image/jpeg' ? embedJpegProfile(bytes, icc) : embedPngProfile(bytes, icc);
      return bytesToDataUrl(tagged, mime);
    } catch (err) {
      console.warn('Could not embed the colour profile:', err);
      return dataUrl;
    }
  }

  /**
   * Plain-language, measured description of what the current settings will do.
   * `stats` comes from previewStats() on a small sample of the real image, so
   * the numbers describe this image rather than a generic claim.
   */
  function describe(options, stats) {
    const dest = destinationFor(options);
    const lines = [];
    const sameWhite = Math.abs(dest.white[0] - SRGB_WHITE[0]) < 1e-4
      && Math.abs(dest.white[2] - SRGB_WHITE[2]) < 1e-4;

    if (dest.id === 'srgb' && !options.grayscale) {
      lines.push('Pixel values stay exactly as they are; the sRGB profile is embedded so other apps read them correctly.');
    } else {
      lines.push(`Pixels are converted from sRGB to ${dest.short}, and that profile is embedded in the file.`);
    }

    if (stats) {
      const pct = (n) => `${((n / Math.max(1, stats.total)) * 100).toFixed(1)}%`;
      if (stats.clippedPixels > 0) {
        lines.push(`${pct(stats.clippedPixels)} of this image falls outside ${dest.short}, so the rendering intent changes those pixels.`);
      } else {
        lines.push(`No part of this image falls outside ${dest.short}, so all four rendering intents give identical pixels here.`);
      }
    }

    if (options.intent === 'absolute' && !sameWhite) {
      lines.push('Absolute colorimetric keeps the source white point rather than adapting it, so expect a visible cast.');
    }

    const blackY = dest.black ? dest.black[1] : 0;
    if (blackY > 1e-6) {
      lines.push(options.blackPoint
        ? `Black point compensation is mapping black onto this profile's own black (Y = ${blackY.toFixed(4)}).`
        : `This profile declares a black point of Y = ${blackY.toFixed(4)}; turn compensation on to map black onto it.`);
    } else {
      lines.push('This profile declares a black point of zero, so black point compensation changes nothing for it.');
    }

    return lines.join(' ');
  }

  global.ExColor = {
    PROFILES, INTENTS, convertImageData, previewStats, buildICC, tagDataUrl, describe,
    conversionPlan, parseICC, destinationFor, rgbToXYZMatrix, adaptationMatrix,
    dataUrlToBytes, bytesToDataUrl,
  };
}(typeof window !== 'undefined' ? window : globalThis));
