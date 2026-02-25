let img;
let cam;
let camOn = false;
let camBtn;

let atlas; // pGraphics - texture atlas
let room;  // pGraphics WEBGL
let fileInput;

function preload() {
  img = loadImage("default_img.png");
}

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  initBuffers();

  camBtn = createButton("Use live camera");
  camBtn.mousePressed(() => {
    if (camOn) return;

    cam = createCapture(
      {
        video: { facingMode: { ideal: "environment" } },
        audio: false
      },
      () => {
        camOn = true;

        // iOS/Safari: force inline playback + autoplay
        const v = cam.elt;
        v.setAttribute("playsinline", "");
        v.setAttribute("webkit-playsinline", "");
        v.setAttribute("autoplay", "");
        v.muted = true;

        const p = v.play();
        if (p && p.catch) p.catch(() => { });
      }
    );

    cam.hide();
  });
  camBtn.id("uploadInput");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initBuffers();
}

function initBuffers() {
  const tw = img.width;
  const th = img.height;

  atlas = createGraphics(tw * 3, th * 3);
  atlas.pixelDensity(1);

  room = createGraphics(windowWidth, windowHeight, WEBGL);
  room.pixelDensity(1);
  room.noStroke();
  room.textureMode(NORMAL);

  atlas.clear();

  const sx = 0, sy = 0, sw = img.width, sh = img.height;

  const srcLong = Math.max(sw, sh);
  const dstLong = Math.max(tw, th);
  const s = dstLong / srcLong;

  const dw = sw * s;
  const dh = sh * s;

  const ox = (tw - dw) * 0.5;
  const oy = (th - dh) * 0.5;

  atlas.image(img, tw + ox, th + oy, dw, dh, sx, sy, sw, sh);          // BACK (center)
  atlas.image(img, tw + ox, 0 + oy, dw, dh, sx, sy, sw, sh);           // CEIL (top)
  atlas.image(img, tw + ox, th * 2 + oy, dw, dh, sx, sy, sw, sh);      // FLOOR (bottom)
  atlas.image(img, 0 + ox, th + oy, dw, dh, sx, sy, sw, sh);           // LEFT
  atlas.image(img, tw * 2 + ox, th + oy, dw, dh, sx, sy, sw, sh);      // RIGHT
}

function draw() {
  // Aspect ratio: use camera if ready, otherwise fallback to image
  const imgAspect = (camOn && cam && cam.elt && cam.elt.videoWidth > 0)
    ? (cam.elt.videoWidth / cam.elt.videoHeight)
    : (img.width / img.height);

  // LIVE CAMERA UPDATE: when camera is ready, rebuild atlas from live feed
  if (camOn && cam && cam.elt && cam.elt.videoWidth > 0) {
    const tw = cam.elt.videoWidth;
    const th = cam.elt.videoHeight;

    if (!atlas || atlas.width !== tw * 3 || atlas.height !== th * 3) {
      atlas = createGraphics(tw * 3, th * 3);
      atlas.pixelDensity(1);
    }

    const sx = 0, sy = 0, sw = tw, sh = th;

    const srcLong = Math.max(sw, sh);
    const dstLong = Math.max(tw, th);
    const s = dstLong / srcLong;

    const dw = sw * s;
    const dh = sh * s;

    const ox = (tw - dw) * 0.5;
    const oy = (th - dh) * 0.5;

    atlas.clear();
    atlas.image(cam, tw + ox, th + oy, dw, dh, sx, sy, sw, sh);         // BACK
    atlas.image(cam, tw + ox, 0 + oy, dw, dh, sx, sy, sw, sh);          // CEIL
    atlas.image(cam, tw + ox, th * 2 + oy, dw, dh, sx, sy, sw, sh);     // FLOOR
    atlas.image(cam, 0 + ox, th + oy, dw, dh, sx, sy, sw, sh);          // LEFT
    atlas.image(cam, tw * 2 + ox, th + oy, dw, dh, sx, sy, sw, sh);     // RIGHT
  }

  room.clear();
  room.background(0);

  const w = room.width;
  const h = room.height;

  const S = min(w, h);

  const roomH = S * 1.25;
  const roomW = roomH * imgAspect;
  const roomD = S * 1.60;

  const fov = PI / 3;
  room.perspective(fov, w / h, 1, 5000);
  const camZ = (h * 0.5) / tan(fov * 0.5);
  room.camera(0, 0, camZ, 0, 0, 0, 0, 1, 0);

  room.texture(atlas);

  const hw = roomW * 0.5;
  const hh = roomH * 0.5;
  const hd = roomD * 0.5;

  const uStep = 1 / 3;
  const vStep = 1 / 3;

  const UV = {
    back: { u0: 1 * uStep, v0: 1 * vStep, u1: 2 * uStep, v1: 2 * vStep },
    ceil: { u0: 1 * uStep, v0: 0 * vStep, u1: 2 * uStep, v1: 1 * vStep },
    floor: { u0: 1 * uStep, v0: 2 * vStep, u1: 2 * uStep, v1: 3 * vStep },
    left: { u0: 0 * uStep, v0: 1 * vStep, u1: 1 * uStep, v1: 2 * vStep },
    right: { u0: 2 * uStep, v0: 1 * vStep, u1: 3 * uStep, v1: 2 * vStep },
  };

  room.push();
  room.translate(0, 0, 0);

  // BACK
  room.beginShape(room.QUADS);
  room.vertex(-hw, -hh, -hd, UV.back.u0, UV.back.v0);
  room.vertex(hw, -hh, -hd, UV.back.u1, UV.back.v0);
  room.vertex(hw, hh, -hd, UV.back.u1, UV.back.v1);
  room.vertex(-hw, hh, -hd, UV.back.u0, UV.back.v1);
  room.endShape();

  // FLOOR (depth-lines)
  room.beginShape(room.QUADS);
  room.vertex(-hw, hh, hd, UV.floor.u0, UV.floor.v1);
  room.vertex(hw, hh, hd, UV.floor.u1, UV.floor.v1);
  room.vertex(hw, hh, -hd, UV.floor.u1, UV.floor.v1);
  room.vertex(-hw, hh, -hd, UV.floor.u0, UV.floor.v1);
  room.endShape();

  // CEIL (depth-lines)
  room.beginShape(room.QUADS);
  room.vertex(-hw, -hh, -hd, UV.ceil.u0, UV.ceil.v0);
  room.vertex(hw, -hh, -hd, UV.ceil.u1, UV.ceil.v0);
  room.vertex(hw, -hh, hd, UV.ceil.u1, UV.ceil.v0);
  room.vertex(-hw, -hh, hd, UV.ceil.u0, UV.ceil.v0);
  room.endShape();

  // LEFT (depth-lines)
  room.beginShape(room.QUADS);
  room.vertex(-hw, -hh, hd, UV.left.u0, UV.left.v0);
  room.vertex(-hw, -hh, -hd, UV.left.u0, UV.left.v0);
  room.vertex(-hw, hh, -hd, UV.left.u0, UV.left.v1);
  room.vertex(-hw, hh, hd, UV.left.u0, UV.left.v1);
  room.endShape();

  // RIGHT (depth-lines)
  room.beginShape(room.QUADS);
  room.vertex(hw, -hh, -hd, UV.right.u1, UV.right.v0);
  room.vertex(hw, -hh, hd, UV.right.u1, UV.right.v0);
  room.vertex(hw, hh, hd, UV.right.u1, UV.right.v1);
  room.vertex(hw, hh, -hd, UV.right.u1, UV.right.v1);
  room.endShape();

  room.pop();

  background(0);
  image(room, 0, 0, width, height);
}

function draw() {
  room.clear();
  room.background(0);

  const w = room.width;
  const h = room.height;

  // responzívne rozmery miestnosti
  const S = min(w, h);

  // keep BACK plane aspect = image aspect (prevents stretching)
  const imgAspect = img.width / img.height;

  // choose a responsive height, derive width from aspect
  const roomH = S * 1.25;
  const roomW = roomH * imgAspect;

  // depth can stay tied to S (or tie to roomW/roomH if you prefer)
  const roomD = S * 1.60;

  // perspektíva + kamera
  const fov = PI / 3;
  room.perspective(fov, w / h, 1, 5000);
  const camZ = (h * 0.5) / tan(fov * 0.5);
  room.camera(0, 0, camZ, 0, 0, 0, 0, 1, 0);

  room.texture(atlas);

  const hw = roomW * 0.5;
  const hh = roomH * 0.5;
  const hd = roomD * 0.5;

  // UV helper: atlas je 3x3 tiles
  // tile coords v atlase (0..3), prevedieme na uv (0..1)
  const uStep = 1 / 3;
  const vStep = 1 / 3;

  const UV = {
    back: { u0: 1 * uStep, v0: 1 * vStep, u1: 2 * uStep, v1: 2 * vStep },
    ceil: { u0: 1 * uStep, v0: 0 * vStep, u1: 2 * uStep, v1: 1 * vStep },
    floor: { u0: 1 * uStep, v0: 2 * vStep, u1: 2 * uStep, v1: 3 * vStep },
    left: { u0: 0 * uStep, v0: 1 * vStep, u1: 1 * uStep, v1: 2 * vStep },
    right: { u0: 2 * uStep, v0: 1 * vStep, u1: 3 * uStep, v1: 2 * vStep },
  };

  // posuň miestnosť dozadu
  room.push();
  room.translate(0, 0, 0);

  // BACK (z = -hd)
  room.beginShape(room.QUADS);
  room.vertex(-hw, -hh, -hd, UV.back.u0, UV.back.v0);
  room.vertex(hw, -hh, -hd, UV.back.u1, UV.back.v0);
  room.vertex(hw, hh, -hd, UV.back.u1, UV.back.v1);
  room.vertex(-hw, hh, -hd, UV.back.u0, UV.back.v1);
  room.endShape();

  // FLOOR (y = +hh) depth-lines: keep V constant at BACK seam (z = -hd)
  room.beginShape(room.QUADS);
  room.vertex(-hw, hh, hd, UV.floor.u0, UV.floor.v1);
  room.vertex(hw, hh, hd, UV.floor.u1, UV.floor.v1);
  room.vertex(hw, hh, -hd, UV.floor.u1, UV.floor.v1);
  room.vertex(-hw, hh, -hd, UV.floor.u0, UV.floor.v1);
  room.endShape();

  // CEIL (y = -hh) depth-lines: keep V constant at BACK seam (z = -hd)
  room.beginShape(room.QUADS);
  room.vertex(-hw, -hh, -hd, UV.ceil.u0, UV.ceil.v0);
  room.vertex(hw, -hh, -hd, UV.ceil.u1, UV.ceil.v0);
  room.vertex(hw, -hh, hd, UV.ceil.u1, UV.ceil.v0);
  room.vertex(-hw, -hh, hd, UV.ceil.u0, UV.ceil.v0);
  room.endShape();

  // LEFT (x = -hw) depth-lines: keep U constant at BACK seam (z = -hd)
  room.beginShape(room.QUADS);
  room.vertex(-hw, -hh, hd, UV.left.u0, UV.left.v0);
  room.vertex(-hw, -hh, -hd, UV.left.u0, UV.left.v0);
  room.vertex(-hw, hh, -hd, UV.left.u0, UV.left.v1);
  room.vertex(-hw, hh, hd, UV.left.u0, UV.left.v1);
  room.endShape();

  // RIGHT (x = +hw) depth-lines: keep U constant at BACK seam (z = -hd)
  room.beginShape(room.QUADS);
  room.vertex(hw, -hh, -hd, UV.right.u1, UV.right.v0);
  room.vertex(hw, -hh, hd, UV.right.u1, UV.right.v0);
  room.vertex(hw, hh, hd, UV.right.u1, UV.right.v1);
  room.vertex(hw, hh, -hd, UV.right.u1, UV.right.v1);
  room.endShape();

  room.pop();

  background(0);
  image(room, 0, 0, width, height);
}
