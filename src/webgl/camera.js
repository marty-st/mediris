'use strict'

import { vec3, mat3, mat4, quat, glMatrix } from 'gl-matrix';

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
    rotateSensitivity: 0.005,
    rotateQuaternion: quat.create(),
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

  const cameraRight = vec3.create();
  const cameraUp = vec3.fromValues(0, 1, 0);
  // camera -Z
  const cameraForward = vec3.create();

  vec3.subtract(cameraForward, camera.targetPosition, camera.u_eye_position);
  vec3.normalize(cameraForward, cameraForward);

  vec3.cross(cameraRight, cameraForward, cameraUp);
  vec3.normalize(cameraRight, cameraRight);

  // tilt up vector according to the forward vector
  vec3.cross(cameraUp, cameraRight, cameraForward);


  // NOTE: Use this method if implemented correctly.
  // issue: https://github.com/toji/gl-matrix/issues/436
  // quat.setAxes(camera.rotateQuaternion, cameraForward, cameraRight, cameraUp);

  const cameraZ = vec3.create();
  vec3.negate(cameraZ, cameraForward);
  
  const rotationMatrix = mat3.fromValues(
    cameraRight[0], cameraRight[1], cameraRight[2], 
    cameraUp[0], cameraUp[1], cameraUp[2], 
    cameraZ[0], cameraZ[1], cameraZ[2]);

  quat.fromMat3(camera.rotateQuaternion, rotationMatrix);

  // rebuild eye to ensure consistency
  updatePosition(camera);
}

function updatePosition(camera)
{
  const rotateMatrix = mat3.create();
  mat3.fromQuat(rotateMatrix, camera.rotateQuaternion);

  const cameraZ = vec3.fromValues(rotateMatrix[6], rotateMatrix[7], rotateMatrix[8]);
  vec3.normalize(cameraZ, cameraZ);

  // targetPosition + cameraZ * distanceToTarget
  vec3.scaleAndAdd(camera.u_eye_position, camera.targetPosition, cameraZ, camera.distanceToTarget);
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

function rotateCamera(camera, screenVector)
{
  const [deltaX, deltaY] = screenVector;
  const horizontalRotation = -deltaX * camera.rotateSensitivity;
  const verticalRotation = deltaY * camera.rotateSensitivity;

  // YAW
  const horizontalRotationQuat = quat.create();
  quat.setAxisAngle(horizontalRotationQuat, [0, 1, 0], horizontalRotation);
  
  // NOTE: This order multiplies in world space (needed for rotation around (0, 1, 0))
  quat.multiply(camera.rotateQuaternion, horizontalRotationQuat, camera.rotateQuaternion);
  quat.normalize(camera.rotateQuaternion, camera.rotateQuaternion);
  
  // PITCH
  const verticalRotationQuatCheck = quat.create();
  quat.rotateX(verticalRotationQuatCheck, camera.rotateQuaternion, verticalRotation)

  // pitch within <-90, 90> degree range check
  const verticalRotationMatCheck = mat3.create();
  mat3.fromQuat(verticalRotationMatCheck, verticalRotationQuatCheck);
  const cameraAxisY = vec3.fromValues(verticalRotationMatCheck[3], verticalRotationMatCheck[4], verticalRotationMatCheck[5]);

  if (vec3.dot(cameraAxisY, [0, 1, 0]) < 0)
    return;

  quat.rotateX(camera.rotateQuaternion, camera.rotateQuaternion, verticalRotation);
  quat.normalize(camera.rotateQuaternion, camera.rotateQuaternion);
}

function moveCamera(camera, screenVector)
{
  // TODO
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
  {
    rotateCamera(camera, cameraControls.screenVector);
    moveCamera(camera, cameraControls.screenVector);

    updatePosition(camera);
    updateViewInverseMatrix(camera);
  }

  if (cameraControls.zoom)
  {
    zoomCamera(camera, viewport, cameraControls.zoomDirection);
    updateViewInverseMatrix(camera);
  }
}
