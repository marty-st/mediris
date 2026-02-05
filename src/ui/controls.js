'use strict'

import { vec2, vec3 } from 'gl-matrix';

/* CONSTANTS */

const CAMERA_KEYS = new Set(["w", "a", "s", "d", "r", "f", "W", "A", "S", "D", "R", "F"]);

/**/

/* ----------------------------------------------------- */
/* MOUSE CONTROLS -------------------------------------- */
/* ----------------------------------------------------- */

/**
 * Converts event button code into a human-readable string.
 * @param {*} buttonCode browser mouse event code 
 * @returns string representing a mouse button
 */
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

/**
 * Creates a state object that tracks events for mouse input.
 * @param {*} canvas HTML canvas element
 * @returns a `mouse` object, contains mouse coordinates, pressed button, and other states 
 */
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

/**
 * Resets the frame-dynamic states of `mouse`. 
 * @param {*} mouse state object for mouse controls
 */
// NOTE: This can be done using setTimeout, clearTimeout but won't be synced
// with the render loop
export function resetMouseControls(mouse)
{
  mouse.move = false;
  mouse.up = false;
  mouse.scroll = false;
  mouse.upButton = null;
}

/* ----------------------------------------------------- */
/* KEYBOARD CONTROLS ----------------------------------- */
/* ----------------------------------------------------- */

/**
 * Creates a state object that tracks events for keyboard input.
 * @returns a `keyboard` object, contains sets of pressed and released keys  
 */
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

/**
 * Resets the frame-dynamic states of `keyboard`. 
 * @param {*} keyboard state object for keyboard controls
 */
export function resetKeyboardControls(keyboard)
{
  keyboard.up.clear();
}

/* ----------------------------------------------------- */
/* CAMERA CONTROLS ------------------------------------- */
/* ----------------------------------------------------- */

/**
 * Creates a state object that stores values for user camera movement.
 * @returns `cameraControls` object, contains mouse & keyboard movement vectors, state booleans, etc.
 */
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

/**
 * Determines whether camera-controlling keys are pressed or held.
 * @param {*} keyboard state object for keyboard controls
 * @returns `true` if any of the camera-controlling keys are pressed
 */
function keyboardControlsCamera(keyboard)
{
  return keyboard.down.intersection(CAMERA_KEYS).size > 0;
}

/**
 * Reads states of the `mouse` and `keyboard` objects and sets `cameraControls` accordingly, so 
 * that it can be used to update the WebGL camera object.
 * @param {*} mouse state object for mouse controls
 * @param {*} keyboard state object for keyboard controls
 * @param {*} cameraControls state object for camera controls
 */
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

/**
 * Resets the frame-dynamic states of `cameraControls`. 
 * @param {*} cameraControls state object for camera controls
 */
export function resetCameraControls(cameraControls)
{

  cameraControls.rotate = false;
  cameraControls.translate = false;
  cameraControls.zoom = false;

  vec2.zero(cameraControls.mouseVector);
  vec3.zero(cameraControls.keyboardVector);
  cameraControls.zoomDirection = null;
}

/* ----------------------------------------------------- */
/* APPLICATION CONTROLS -------------------------------- */
/* ----------------------------------------------------- */

/**
 * Creates a state object that stores values for general user control 
 * of the application.
 * @returns `appControls` object
 */
export function initAppControls()
{
  return {
    reloadShaders: false,
    reloadDicom: false,
  };
}

/**
 * Reads states of the `keynoard` object and sets `appControls` accordingly, so 
 * that it can be used in the application update loop.
 * @param {*} keyboard state object for keyboard controls
 * @param {*} appControls state object for application controls
 */
export function controlApp(keyboard, appControls)
{
  if (keyboard.up.has("t"))
    appControls.reloadShaders = true;
  if (keyboard.up.has("T"))
    appControls.reloadDicom = true;
}

/**
 * Resets the frame-dynamic states of `appControls`. 
 * @param {*} appControls state object for application controls
 */
export function resetAppControls(appControls)
{
  for (const value in appControls)
    appControls[value] = false;
}
