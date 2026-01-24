'use strict'

import { vec2, vec3 } from 'gl-matrix';

const CAMERA_KEYS = new Set(["w", "a", "s", "d", "r", "f", "W", "A", "S", "D", "R", "F"]);

function getMouseButtonName(buttonCode)
{
  let buttonName = null;
  switch (buttonCode)
    {
      case 0:
        buttonName = "primary";
        break;
      case 1:
        buttonName = "wheel";
        break;
      case 2:
        buttonName = "secondary";
        break;
      default:
        buttonName = "unhandled";
  }

  return buttonName;
}

export function initMouseControls(canvas)
{
  let mouse = {
    x: 0,
    y: 0,
    xDelta: 0,
    yDelta: 0,
    scrollDelta: 0,
    move: false,
    down: false,
    up: false, 
    scroll: false,
    downButton: null,
    upButton: null,
    overCanvas: true, // when init to false, only works after first re-entry
  };

  canvas.addEventListener("mouseover", () => {
    mouse.overCanvas = true;
  })

  canvas.addEventListener("mouseout", () => {
    mouse.overCanvas = false;
    mouse.move = false;
    mouse.zoom = false;
    mouse.down = false;
    mouse.up = false;
    mouse.downButton = null;

  })

  canvas.addEventListener("mousemove", (event) => {
    if (!mouse.overCanvas)
      return;

    mouse.move = true

    const mouseXPrev = mouse.x;
    const mouseYPrev = mouse.y;

    mouse.x = event.screenX;
    mouse.y = event.screenY;

    mouse.xDelta = mouse.x - mouseXPrev;
    mouse.yDelta = mouse.y - mouseYPrev;
  });

  canvas.addEventListener("mousedown", (event) => {
    if (!mouse.overCanvas)
      return;

    mouse.down = true;
    mouse.downButton = getMouseButtonName(event.button);
  });

  canvas.addEventListener("mouseup", (event) => {
    if (!mouse.overCanvas)
      return;

    mouse.up = true;
    mouse.upButton = getMouseButtonName(event.button);

    mouse.down = false;
    mouse.downButton = null;
  });

  canvas.addEventListener("wheel", (event) => { 
    if (!mouse.overCanvas)
      return;

    // prevent page scrolling
    event.preventDefault();

    mouse.scroll = true;
    mouse.scrollDelta = event.deltaY;
  })

  return mouse;

}

// NOTE: This can be done using setTimeout, clearTimeout
export function resetMouseControls(mouse)
{
  mouse.move = false;
  mouse.up = false;
  mouse.scroll = false;
  mouse.upButton = null;
}

export function initCameraControls()
{
  return {
    idle: true,
    rotate: false,
    translate: false,
    zoom: false,
    mouseVector: vec2.create(),
    keyboardVector: vec3.create(),
    zoomDirection: null,
  }
}

function keyboardControlsCamera(keyboard)
{
  return keyboard.down.intersection(CAMERA_KEYS).size > 0;
}

export function controlCamera(mouse, keyboard, cameraControls)
{
  cameraControls.idle = !mouse.move && !mouse.down && !mouse.scroll && !keyboardControlsCamera(keyboard)

  if (cameraControls.idle)
    return;

  // rotate
  if (mouse.downButton === "primary" && mouse.move)
  {
    cameraControls.rotate = true;
    vec2.set(cameraControls.mouseVector, mouse.xDelta, -mouse.yDelta);
  }

  // move
  let vector = [0, 0, 0];
  for (const key of keyboard.down)
  {
    switch(key)
    {
      case "w":
      case "W":
        vector[2] -= 1;
        break;
      case "a":
      case "A":
        vector[0] -= 1;
        break;
      case "s":
      case "S":
        vector[2] += 1;
        break;
      case "d":
      case "D":
        vector[0] += 1;
        break;
      case "r":
      case "R":
        vector[1] += 1;
        break;
      case "f":
      case "F":
        vector[1] -= 1;
        break;
      default:
        break;
    }
  }
  vec3.copy(cameraControls.keyboardVector, vector);
  if (vec3.length(cameraControls.keyboardVector) > 0)
    cameraControls.translate = true;

  // zoom
  if (mouse.scroll)
  {
    cameraControls.zoom = true;
    cameraControls.zoomDirection = mouse.scrollDelta < 0 ? "in" : "out";
  }
}

export function resetCameraControls(cameraControls)
{

  cameraControls.rotate = false;
  cameraControls.translate = false;
  cameraControls.zoom = false;

  vec2.zero(cameraControls.mouseVector);
  vec3.zero(cameraControls.keyboardVector);
  cameraControls.zoomDirection = null;
}

export function initKeyboardControls()
{
  let keyboard = {
    down: new Set(),
    up: new Set(),
  };

  document.addEventListener("keydown", (event) => {
    keyboard.down.add(event.key);
  });

  document.addEventListener("keyup", (event) => {
    keyboard.up.add(event.key);
    keyboard.down.delete(event.key);
  });

  return keyboard;
}

export function resetKeyboardControls(keyboard)
{
  keyboard.up.clear();
}

export function initAppControls()
{
  return {
    reloadShaders: false,
    reloadDicom: false,
  };
}

export function controlApp(keyboard, appControls)
{
  if (keyboard.up.has("t"))
    appControls.reloadShaders = true;
  if (keyboard.up.has("T"))
    appControls.reloadDicom = true;
}

export function resetAppControls(appControls)
{
  for (const value in appControls)
    appControls[value] = false;
}
