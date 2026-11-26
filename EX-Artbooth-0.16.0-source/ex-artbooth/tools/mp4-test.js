#!/usr/bin/env node
/* Validates the MP4 container written by app/mp4.js.
 *
 * WebCodecs does not exist in Node, so this cannot test H.264 encoding -- that
 * part is Chromium's. What it does test is the part we wrote: the box layout,
 * the sample table, timing, and chunk offsets. The output is parsed back with
 * mp4box.js, an independent demuxer, so a mistake in our writer cannot hide
 * behind a matching mistake in our reader.
 *
 *   cd /tmp && npm install mp4box
 *   NODE_PATH=/tmp/node_modules node tools/mp4-test.js
 */
const MP4 = require('../app/mp4.js');
const MP4Box = require('mp4box');

const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
};

// A minimal but structurally real AVCDecoderConfigurationRecord: the shape
// WebCodecs hands back in metadata.decoderConfig.description.
function fakeAvcC() {
  const sps = Uint8Array.from([0x67, 0x42, 0xc0, 0x1e, 0xd9, 0x00, 0xf0, 0x11, 0x7e, 0xf0, 0x10, 0x10, 0x10, 0x20]);
  const pps = Uint8Array.from([0x68, 0xcb, 0x83, 0xcb, 0x20]);
  return Uint8Array.from([
    1, sps[1], sps[2], sps[3], 0xff,
    0xe1, (sps.length >> 8) & 0xff, sps.length & 0xff, ...sps,
    1, (pps.length >> 8) & 0xff, pps.length & 0xff, ...pps,
  ]);
}

// Length-prefixed NAL, which is what the 'avc' bitstream format produces.
function fakeSample(byteCount, seed) {
  const payload = new Uint8Array(byteCount - 4);
  for (let i = 0; i < payload.length; i++) payload[i] = (seed * 31 + i * 7) & 0xff;
  const n = payload.length;
  return Uint8Array.from([(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, ...payload]);
}

const TIMESCALE = 90000;
const FPS = 12;
const FRAME_TICKS = TIMESCALE / FPS;          // 7500
const FRAME_COUNT = 24;
const WIDTH = 640;
const HEIGHT = 360;

const muxer = MP4.createMuxer({ width: WIDTH, height: HEIGHT, timescale: TIMESCALE });
muxer.setDescription(fakeAvcC());
const sizes = [];
for (let i = 0; i < FRAME_COUNT; i++) {
  const size = 400 + (i % 5) * 37;            // uneven sizes, like real frames
  sizes.push(size);
  muxer.addSample(fakeSample(size, i), FRAME_TICKS, i % 12 === 0);
}
const file = muxer.finalize();

check('muxer reports every frame', muxer.frameCount === FRAME_COUNT, `${muxer.frameCount}`);
check('file is larger than its payload', file.length > sizes.reduce((a, b) => a + b, 0));

// --- top-level box order, read by hand: a player needs ftyp first ---
function topLevelBoxes(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found = [];
  let at = 0;
  while (at + 8 <= bytes.length) {
    let size = view.getUint32(at);
    const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    if (size === 1) size = Number(view.getBigUint64(at + 8));
    if (size <= 0) break;
    found.push({ type, size, start: at });
    at += size;
  }
  return found;
}
const boxes = topLevelBoxes(file);
check('top-level boxes are ftyp, mdat, moov', boxes.map((b) => b.type).join(',') === 'ftyp,mdat,moov',
  boxes.map((b) => b.type).join(','));
check('boxes exactly span the file', boxes.length > 0 && boxes[boxes.length - 1].start + boxes[boxes.length - 1].size === file.length);

// --- parse it back with mp4box.js ---
const parsed = MP4Box.createFile();
let info = null;
let parseError = null;
let extracted = null;
parsed.onError = (e) => { parseError = e; };
// Extraction has to be requested from onReady, before the samples are parsed.
parsed.onReady = (i) => {
  info = i;
  parsed.setExtractionOptions(i.tracks[0].id, null, { nbSamples: FRAME_COUNT });
  parsed.start();
};
parsed.onSamples = (_id, _user, samples) => { extracted = (extracted || []).concat(samples); };
const copy = file.slice().buffer;
copy.fileStart = 0;
parsed.appendBuffer(copy);
parsed.flush();

check('mp4box.js parses the file without error', !parseError, String(parseError || ''));
check('mp4box.js finds the movie header', Boolean(info));

if (info) {
  const track = info.tracks[0];
  check('exactly one track', info.tracks.length === 1, `${info.tracks.length}`);
  check('track is video', track.type === 'video' || Boolean(track.video), track.type);
  check('codec is reported as AVC', /^avc1/.test(track.codec), track.codec);
  check('dimensions survive', track.video && track.video.width === WIDTH && track.video.height === HEIGHT,
    track.video ? `${track.video.width}x${track.video.height}` : 'none');
  check('timescale survives', track.timescale === TIMESCALE, `${track.timescale}`);
  check('sample count matches', track.nb_samples === FRAME_COUNT, `${track.nb_samples}`);

  const expectedSeconds = FRAME_COUNT / FPS;
  const actualSeconds = track.duration / track.timescale;
  check('duration matches the frame rate', Math.abs(actualSeconds - expectedSeconds) < 0.001,
    `${actualSeconds.toFixed(3)}s vs ${expectedSeconds.toFixed(3)}s expected`);
  const movieSeconds = info.duration / info.timescale;
  check('movie duration agrees with the track', Math.abs(movieSeconds - expectedSeconds) < 0.01,
    `${movieSeconds.toFixed(3)}s`);
}

// --- sample-level: offsets, sizes and keyframes must round-trip ---
if (extracted) {
  check('every sample is extractable', extracted.length === FRAME_COUNT, `${extracted.length}`);
  const sizesMatch = extracted.every((s, i) => s.size === sizes[i]);
  check('sample sizes round-trip', sizesMatch);
  const keys = extracted.filter((s) => s.is_sync).length;
  check('keyframes are flagged', keys === Math.ceil(FRAME_COUNT / 12), `${keys} sync samples`);
  const timingOk = extracted.every((s, i) => s.cts === i * FRAME_TICKS && s.duration === FRAME_TICKS);
  check('sample timing is evenly spaced', timingOk);
  // The bytes a decoder would actually be fed must equal what we put in.
  const first = extracted[0];
  const expectedFirst = fakeSample(sizes[0], 0);
  const sameBytes = Buffer.compare(Buffer.from(first.data), Buffer.from(expectedFirst)) === 0;
  check('sample bytes are byte-identical after a round trip', sameBytes);
} else {
  check('every sample is extractable', false, 'extraction produced nothing');
}

// --- a very slow animation: EX Artbooth allows down to 0.001 fps ---
const slow = MP4.createMuxer({ width: 320, height: 240, timescale: TIMESCALE });
slow.setDescription(fakeAvcC());
const slowTicks = Math.round(TIMESCALE / 0.001);     // 1000 s per frame
for (let i = 0; i < 3; i++) slow.addSample(fakeSample(300, i), slowTicks, i === 0);
const slowFile = slow.finalize();
const slowParsed = MP4Box.createFile();
let slowInfo = null;
slowParsed.onReady = (i) => { slowInfo = i; };
const slowCopy = slowFile.slice().buffer;
slowCopy.fileStart = 0;
slowParsed.appendBuffer(slowCopy);
slowParsed.flush();
const slowSeconds = slowInfo ? slowInfo.tracks[0].duration / slowInfo.tracks[0].timescale : 0;
check('0.001 fps project produces a 3000 s movie', Math.abs(slowSeconds - 3000) < 1, `${slowSeconds.toFixed(0)}s`);

// --- failure modes should be loud, not silent ---
let threw = false;
try { MP4.createMuxer({ width: 10, height: 10 }).finalize(); } catch (e) { threw = /no frames/.test(e.message); }
check('muxing zero frames throws', threw);
threw = false;
try {
  const m = MP4.createMuxer({ width: 10, height: 10 });
  m.addSample(fakeSample(100, 0), 100, true);
  m.finalize();
} catch (e) { threw = /avcC|description/.test(e.message); }
check('muxing without a codec description throws', threw);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
