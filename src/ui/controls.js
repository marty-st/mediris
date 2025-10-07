'use strict'

import { vec2 } from 'gl-matrix';

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

export function initMouseControls()
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
  };

  document.addEventListener("mousemove", (event) => {
    mouse.move = true

    const mouseXPrev = mouse.x;
    const mouseYPrev = mouse.y;

    mouse.x = event.screenX;
    mouse.y = event.screenY;

    mouse.xDelta = mouse.x - mouseXPrev;
    mouse.yDelta = mouse.y - mouseYPrev;
  });

  document.addEventListener("mousedown", (event) => {
    mouse.down = true;
    mouse.downButton = getMouseButtonName(event.button);
  });

  document.addEventListener("mouseup", (event) => {
    mouse.up = true;
    mouse.upButton = getMouseButtonName(event.button);

    mouse.down = false;
    mouse.downButton = null;
  });

  document.addEventListener("wheel", (event) => { 
    mouse.scroll = true;
    mouse.scrollDelta = event.deltaY;
  })

  return mouse;

}

export function initCameraControls()
{
  return {
    move: false,
    zoom: false,
    moveVector: vec2.create(),
    zoomDirection: null,
  }
}

export function controlCamera(mouse, cameraControls)
{
  if (!mouse.move && !mouse.down && !mouse.scroll)
    return;

  // move
  if (mouse.downButton === "primary")
  {
    cameraControls.move = true;
    vec2.set(cameraControls.moveVector, mouse.xDelta, -mouse.yDelta);
  }

  // zoom
  if (mouse.scroll)
  {
    console.log("mouse scrolling");
    cameraControls.zoom = true;
    cameraControls.zoomDirection = mouse.scrollDelta < 0 ? "in" : "out";
  }
}

// NOTE: This can be done using setTimeout, clearTimeout
export function resetMouseControls(mouse)
{
  mouse.move = false;
  mouse.up = false;
  mouse.scroll = false;
  mouse.upButton = null;
}

export function resetCameraControls(cameraControls)
{

  cameraControls.move = false;
  cameraControls.zoom = false;

  vec2.zero(cameraControls.moveVector);
  cameraControls.zoomDirection = null;
}
