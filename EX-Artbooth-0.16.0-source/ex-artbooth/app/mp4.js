/* MP4 muxer for EX Artbooth animation export.
 *
 * WebCodecs gives us an encoded H.264 bitstream but no container, so this
 * writes the MP4 boxes around it. It is deliberately small: one video track,
 * one chunk, 32-bit offsets. That covers animation exports (minutes, not
 * hours) without pulling in ffmpeg, which would add roughly 80 MB to an app
 * whose whole point is being small.
 *
 * Layout: ftyp | mdat (all samples) | moov (index). mdat is written before
 * moov so sample offsets are known by the time the index is built.
 *
 * Loaded as a plain script in the app (window.ExArtboothMP4) and as a module
 * in tools/mp4-test.js, so the container logic can be tested in Node where
 * there is no WebCodecs.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ExArtboothMP4 = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MOVIE_TIMESCALE = 1000;

  function str(text) {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
    return out;
  }
  function u8(...values) { return new Uint8Array(values); }
  function u16(value) { return new Uint8Array([(value >> 8) & 0xff, value & 0xff]); }
  function u32(value) {
    const v = value >>> 0;
    return new Uint8Array([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);
  }
  function u64(value) {
    const high = Math.floor(value / 4294967296);
    return concat(u32(high), u32(value >>> 0));
  }
  function concat(...parts) {
    let length = 0;
    parts.forEach((part) => { length += part.length; });
    const out = new Uint8Array(length);
    let at = 0;
    parts.forEach((part) => { out.set(part, at); at += part.length; });
    return out;
  }
  // size + fourcc + payload
  function box(type, ...payload) {
    const body = concat(...payload);
    return concat(u32(body.length + 8), str(type), body);
  }
  // version + flags, then payload
  function fullBox(type, version, flags, ...payload) {
    return box(type, u8(version, (flags >> 16) & 0xff, (flags >> 8) & 0xff, flags & 0xff), ...payload);
  }

  const UNITY_MATRIX = concat(
    u32(0x00010000), u32(0), u32(0),
    u32(0), u32(0x00010000), u32(0),
    u32(0), u32(0), u32(0x40000000)
  );

  /**
   * @param {object} opts
   * @param {number} opts.width  pixel width
   * @param {number} opts.height pixel height
   * @param {number} [opts.timescale] media timescale (ticks per second)
   */
  function createMuxer(opts) {
    const width = Math.max(1, Math.round(opts.width));
    const height = Math.max(1, Math.round(opts.height));
    const timescale = Math.max(1, Math.round(opts.timescale || 90000));
    const samples = [];     // { size, duration, isKey }
    const chunks = [];      // Uint8Array payloads, concatenated into mdat
    let description = null; // AVCDecoderConfigurationRecord from WebCodecs
    let totalBytes = 0;

    function setDescription(bytes) {
      if (bytes) description = new Uint8Array(bytes);
    }

    /**
     * @param {Uint8Array} data     one encoded frame (AVC sample format)
     * @param {number} duration     how long it shows, in timescale ticks
     * @param {boolean} isKey       true for an IDR / keyframe
     */
    function addSample(data, duration, isKey) {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      chunks.push(bytes);
      totalBytes += bytes.length;
      samples.push({
        size: bytes.length,
        duration: Math.max(1, Math.round(duration)),
        isKey: Boolean(isKey)
      });
    }

    // time-to-sample, run-length encoded
    function sttsPayload() {
      const entries = [];
      samples.forEach((sample) => {
        const last = entries[entries.length - 1];
        if (last && last.delta === sample.duration) last.count += 1;
        else entries.push({ count: 1, delta: sample.duration });
      });
      const parts = [u32(entries.length)];
      entries.forEach((entry) => { parts.push(u32(entry.count), u32(entry.delta)); });
      return concat(...parts);
    }

    function stssPayload() {
      const keys = [];
      samples.forEach((sample, index) => { if (sample.isKey) keys.push(index + 1); });
      const parts = [u32(keys.length)];
      keys.forEach((key) => parts.push(u32(key)));
      return concat(...parts);
    }

    function stszPayload() {
      const parts = [u32(0), u32(samples.length)];
      samples.forEach((sample) => parts.push(u32(sample.size)));
      return concat(...parts);
    }

    function avcCBox() {
      if (!description) throw new Error('MP4 muxer: missing avcC decoder description');
      return box('avcC', description);
    }

    function avc1Box() {
      const compressor = new Uint8Array(32); // fixed 32-byte Pascal string
      return box('avc1',
        u8(0, 0, 0, 0, 0, 0), u16(1),                 // reserved, data_reference_index
        u16(0), u16(0), u32(0), u32(0), u32(0),       // pre_defined / reserved
        u16(width), u16(height),
        u32(0x00480000), u32(0x00480000),             // 72 dpi
        u32(0), u16(1),                               // reserved, frame_count
        compressor,
        u16(0x0018), u16(0xffff),                     // depth, pre_defined = -1
        avcCBox());
    }

    function stblBox() {
      return box('stbl',
        box('stsd', u8(0, 0, 0, 0), u32(1), avc1Box()),
        fullBox('stts', 0, 0, sttsPayload()),
        fullBox('stss', 0, 0, stssPayload()),
        // one chunk holding every sample
        fullBox('stsc', 0, 0, u32(1), u32(1), u32(samples.length), u32(1)),
        fullBox('stsz', 0, 0, stszPayload()),
        fullBox('stco', 0, 0, u32(1), u32(0)));       // offset patched in finalize()
    }

    function finalize() {
      if (!samples.length) throw new Error('MP4 muxer: no frames were encoded');

      const mediaDuration = samples.reduce((sum, sample) => sum + sample.duration, 0);
      const movieDuration = Math.round((mediaDuration / timescale) * MOVIE_TIMESCALE);

      const minf = box('minf',
        fullBox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
        box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))),
        stblBox());

      const mdia = box('mdia',
        fullBox('mdhd', 0, 0, u32(0), u32(0), u32(timescale), u32(mediaDuration), u16(0x55c4), u16(0)),
        fullBox('hdlr', 0, 0, u32(0), str('vide'), u32(0), u32(0), u32(0), str('VideoHandler\0')),
        minf);

      const trak = box('trak',
        fullBox('tkhd', 0, 7, u32(0), u32(0), u32(1), u32(0), u32(movieDuration),
          u32(0), u32(0), u16(0), u16(0), u16(0), u16(0), UNITY_MATRIX,
          u32(width * 65536), u32(height * 65536)),
        mdia);

      const moov = box('moov',
        fullBox('mvhd', 0, 0, u32(0), u32(0), u32(MOVIE_TIMESCALE), u32(movieDuration),
          u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0), UNITY_MATRIX,
          u32(0), u32(0), u32(0), u32(0), u32(0), u32(0), u32(2)),
        trak);

      const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));

      // mdat needs a 64-bit size once the payload passes 4 GB.
      const large = totalBytes + 8 > 0xfffffffe;
      const mdatHeader = large
        ? concat(u32(1), str('mdat'), u64(totalBytes + 16))
        : concat(u32(totalBytes + 8), str('mdat'));

      const dataStart = ftyp.length + mdatHeader.length;

      // Patch stco now that the real offset is known. The chunk offset is the
      // last 4 bytes of the stco box, which is the last box inside stbl.
      const stcoTail = findStcoOffsetPosition(moov);
      writeU32(moov, stcoTail, dataStart);

      return concat(ftyp, mdatHeader, ...chunks, moov);
    }

    // Locate the chunk-offset field inside the built moov so it can be patched.
    function findStcoOffsetPosition(moov) {
      const marker = str('stco');
      for (let i = moov.length - 4; i >= 0; i--) {
        if (moov[i] === marker[0] && moov[i + 1] === marker[1]
          && moov[i + 2] === marker[2] && moov[i + 3] === marker[3]) {
          // stco: type(4) version+flags(4) entry_count(4) then the offset
          return i + 4 + 4 + 4;
        }
      }
      throw new Error('MP4 muxer: stco box not found');
    }

    function writeU32(target, at, value) {
      const v = value >>> 0;
      target[at] = (v >>> 24) & 0xff;
      target[at + 1] = (v >>> 16) & 0xff;
      target[at + 2] = (v >>> 8) & 0xff;
      target[at + 3] = v & 0xff;
    }

    return {
      setDescription,
      addSample,
      finalize,
      get frameCount() { return samples.length; },
      get byteLength() { return totalBytes; }
    };
  }

  return { createMuxer, MOVIE_TIMESCALE };
}));
