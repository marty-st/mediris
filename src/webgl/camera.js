'use strict'

import { vec3, mat4, glMatrix } from 'gl-matrix';

/**
 * Initializes the camera object. Contains values used in shader programs
 * @param {*} viewport object containing width and height attributes
 * @returns camera object
 */
// TODO: use quaternion instead of pitch, yaw
export function initCamera(viewport)
{
  let initialCamera = {
    FOV: 60,
    minFOV: 10,
    maxFOV: 90,
    zoomStep: 4,
    nearPlane: 1, 
    farPlane: 1000,
    // orbital camera attributes
    targetPosition: vec3.fromValues(0, 0, 0),
    distanceToTarget: null,
    yaw: 0,
    pitch: 0,
    minPitch: glMatrix.toRadian(-89),
    maxPitch: glMatrix.toRadian(89),
    rotateSensitivity: 0.005,
    // shader uniforms
    u_eye_position: vec3.fromValues(1.5, 1.25, -1.5),
    u_view_inv: mat4.create(),
    u_projection_inv: mat4.create(),
  };

  initParametersFromPosition(initialCamera);

  updateViewInverseMatrix(initialCamera);

  updateProjectionInverseMatrix(initialCamera, viewport);

  return initialCamera;
}

function initParametersFromPosition(camera)
{
  // Distance
  camera.distanceToTarget = vec3.distance(camera.u_eye_position, camera.targetPosition);

  // direction from eye to target
  const dir = vec3.create();
  vec3.subtract(dir, camera.targetPosition, camera.u_eye_position);
  const len = vec3.length(dir);
  if (len > 1e-8) vec3.scale(dir, dir, 1 / len);
  else vec3.set(dir, 0, 0, -1);

  // Derive yaw & pitch from direction (forward = target - eye)
  // forward = (fx, fy, fz)
  // pitch = asin(fy)
  // yaw = atan2(fx, -fz)  (convention: -Z forward at yaw=0)
  const fy = Math.min(1, Math.max(-1, dir[1]));
  camera.pitch = Math.asin(fy);
  camera.yaw = Math.atan2(dir[0], -dir[2]);
  // rebuild eye to ensure consistency
  updatePosition(camera);
}

function updatePosition(camera)
{
  const d = camera.distanceToTarget;
  const cp = Math.cos(camera.pitch);
  const sp = Math.sin(camera.pitch);
  const sy = Math.sin(camera.yaw);
  const cy = Math.cos(camera.yaw);

  // Forward (from eye toward target)
  // Matches inverse of conversion used above
  const fx = sy * cp;
  const fy = sp;
  const fz = -cy * cp;

  // eye = target - forward * distance
  camera.u_eye_position[0] = camera.targetPosition[0] - fx * d;
  camera.u_eye_position[1] = camera.targetPosition[1] - fy * d;
  camera.u_eye_position[2] = camera.targetPosition[2] - fz * d;
}

function updateViewInverseMatrix(camera)
{
  const viewMat = mat4.create();
  mat4.lookAt(viewMat, camera.u_eye_position, camera.targetPosition, [0, 1, 0]);
  mat4.invert(camera.u_view_inv, viewMat);
}

function updateProjectionInverseMatrix(camera, viewport)
{
  const perspectiveMat = mat4.create();
  // NOTE: when near was set to 0.1 and shader projection plane distance was 1.0, raytracing
  // didn't work. I'm curious what is the exact issue with that. 
  mat4.perspective(
    perspectiveMat, 
    glMatrix.toRadian(camera.FOV), 
    viewport.width / viewport.height, 
    camera.nearPlane, 
    camera.farPlane
  );

  mat4.invert(camera.u_projection_inv, perspectiveMat);
}

function moveCamera(camera, moveVector)
{
  const [deltaX, deltaY] = moveVector;

  camera.yaw   += deltaX * camera.rotateSensitivity;
  camera.pitch += deltaY * camera.rotateSensitivity;

  // clamp pitch
  camera.pitch = Math.min(camera.maxPitch, Math.max(camera.minPitch, camera.pitch));

  // wrap yaw to avoid float growth
  const twoPI = Math.PI * 2;
  if (camera.yaw > twoPI || camera.yaw < -twoPI)
    camera.yaw = ((camera.yaw % twoPI) + twoPI) % twoPI;

  updatePosition(camera);
  updateViewInverseMatrix(camera);
}

function zoomCamera(camera, viewport, zoomDirection)
{
  if (zoomDirection === "in")
    camera.FOV = Math.max(camera.FOV - camera.zoomStep, camera.minFOV);
  else // zoomDirection === "out"
    camera.FOV = Math.min(camera.FOV + camera.zoomStep, camera.maxFOV);

  updateProjectionInverseMatrix(camera, viewport);
}

export function updateCamera(camera, cameraControls, viewport, timeDelta)
{
  if (cameraControls.move)
    moveCamera(camera, cameraControls.moveVector);

  if (cameraControls.zoom)
    zoomCamera(camera, viewport, cameraControls.zoomDirection);
}
