let cam;
let atlas; // pGraphics - texture atlas
let room;  // pGraphics WEBGL
let saveBtn;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Start camera immediately (no default image)
  cam = createCapture({
    video: { facingMode: { ideal: "environment" } },
    audio: false
  });

  // iOS/Safari: force inline playback + autoplay attempt
  const v = cam.elt;
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
  v.setAttribute("autoplay", "");
  v.muted = true;

  const p = v.play();
  if (p && p.catch) p.catch(() => { });

  cam.hide();

  // Save button (saves what you see)
  saveBtn = createButton("Save frame");
  saveBtn.id("saveFrame");
  saveBtn.mousePressed(() => {
    saveCanvas("frame", "png");
  });
  saveBtn.id("saveButton");

  initRoom();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initRoom();
}

function initRoom() {
  room = createGraphics(windowWidth, windowHeight, WEBGL);
  room.pixelDensity(1);
  room.noStroke();
  room.textureMode(NORMAL);
}

function draw() {
  // Camera readiness check
  const camReady =
    cam &&
    cam.elt &&
    (cam.elt.readyState >= 2) &&
    ((cam.elt.videoWidth > 0 && cam.elt.videoHeight > 0) || (cam.width > 0 && cam.height > 0));

  // If camera isn't ready yet, show neutral background (no other UI)
  if (!camReady) {
    background(40);
    return;
  }

  const tw = cam.elt.videoWidth || cam.width;
  const th = cam.elt.videoHeight || cam.height;

  // Ensure atlas matches camera resolution
  if (!atlas || atlas.width !== tw * 3 || atlas.height !== th * 3) {
    atlas = createGraphics(tw * 3, th * 3);
    atlas.pixelDensity(1);
  }

  // Build atlas from live camera (uniform scale by long edge)
  const sx = 0, sy = 0, sw = tw, sh = th;

  const srcLong = Math.max(sw, sh);
  const dstLong = Math.max(tw, th);
  const s = dstLong / srcLong;

  const dw = sw * s;
  const dh = sh * s;

  const ox = (tw - dw) * 0.5;
  const oy = (th - dh) * 0.5;

  atlas.clear();
  atlas.image(cam, tw + ox, th + oy, dw, dh, sx, sy, sw, sh);      // BACK
  atlas.image(cam, tw + ox, 0 + oy, dw, dh, sx, sy, sw, sh);      // CEIL
  atlas.image(cam, tw + ox, th * 2 + oy, dw, dh, sx, sy, sw, sh);      // FLOOR
  atlas.image(cam, 0 + ox, th + oy, dw, dh, sx, sy, sw, sh);      // LEFT
  atlas.image(cam, tw * 2 + ox, th + oy, dw, dh, sx, sy, sw, sh);      // RIGHT

  // Render room
  room.clear();
  room.background(0);

  const w = room.width;
  const h = room.height;

  const S = min(w, h);

  // Keep BACK plane aspect = camera aspect
  const camAspect = tw / th;

  const roomH = S * 1.25;
  const roomW = roomH * camAspect;
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
