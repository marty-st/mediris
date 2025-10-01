'use strict'

import { vec3, mat4, glMatrix } from 'gl-matrix';

/**
 * Initializes the camera object. Contains values used in shader programs
 * @param {*} viewport object containing width and height attributes
 * @returns camera object
 */
export function initCamera(viewport)
{
  let initialCamera = {
    FOV: 60,
    minFOV: 10,
    maxFOV: 90,
    zoomStep: 2,
    nearPlane: 1, 
    farPlane: 1000,
    // shader uniforms
    u_eye_position: vec3.fromValues(-3, 2, -3),
    u_view_inv: mat4.create(),
    u_projection_inv: mat4.create(),
  };

  updateViewInverseMatrix(initialCamera, initialCamera.u_eye_position);

  updateProjectionInverseMatrix(initialCamera, viewport, initialCamera.FOV, initialCamera.nearPlane, initialCamera.farPlane);

  return initialCamera;
}

function updateViewInverseMatrix(camera, eyePosition)
{
  const viewMat = mat4.create();
  mat4.lookAt(viewMat, eyePosition, [0, 0, 0], [0, 1, 0]);
  mat4.invert(camera.u_view_inv, viewMat);
}

function updateProjectionInverseMatrix(camera, viewport, FOV, nearPlane, farPlane)
{
  const perspectiveMat = mat4.create();
  // NOTE: when near was set to 0.1 and shader projection plane distance was 1.0, raytracing
  // didn't work. I'm curious what is the exact issue with that. 
  mat4.perspective(perspectiveMat, glMatrix.toRadian(FOV), viewport.width / viewport.height, nearPlane, farPlane);
  mat4.invert(camera.u_projection_inv, perspectiveMat);

  camera.FOV = FOV;
}

function moveCamera(camera, moveVector)
{
  // yaw
  vec3.rotateY(camera.u_eye_position, camera.u_eye_position, [0, 0, 0], glMatrix.toRadian(moveVector[0]));
  updateViewInverseMatrix(camera, camera.u_eye_position);
}

function zoomCamera(camera, viewport, zoomDirection)
{
  if (zoomDirection === "in")
    updateProjectionInverseMatrix(camera, viewport, Math.max(camera.FOV - camera.zoomStep, camera.minFOV), camera.nearPlane, camera.farPlane);
  else // zoomDirection === "out"
    updateProjectionInverseMatrix(camera, viewport, Math.min(camera.FOV + camera.zoomStep, camera.maxFOV), camera.nearPlane, camera.farPlane);
}

export function updateCamera(camera, cameraControls, viewport, timeDelta)
{
  if (cameraControls.move)
    moveCamera(camera, cameraControls.moveVector);

  if (cameraControls.zoom)
    zoomCamera(camera, viewport, cameraControls.zoomDirection);
}
