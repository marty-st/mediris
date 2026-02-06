'use strict'

import { vec3, mat3, mat4, quat, glMatrix } from 'gl-matrix';

/* --------------------------------------------------------------------------- */
/* CAMERA OBJECT MANAGEMENT -------------------------------------------------- */
/* --------------------------------------------------------------------------- */

/**
 * Initializes the camera's `distanceToTarget` and `rotationQuaternion` attributes 
 * from the camera's position. It is assumed that the camera looks at (0, 0, 0).
 * @param {*} camera camera object
 */
function initAttributesFromPosition(camera)
{
  // Distance
  camera.distanceToTarget = vec3.distance(camera.u_eye_position, camera.targetPosition);

  // Rotation
  const cameraRight = vec3.create();
  const cameraUp = vec3.fromValues(0, 1, 0);
  const cameraForward = vec3.create(); // camera -Z

  vec3.subtract(cameraForward, camera.targetPosition, camera.u_eye_position);
  vec3.normalize(cameraForward, cameraForward);

  vec3.cross(cameraRight, cameraForward, cameraUp);
  vec3.normalize(cameraRight, cameraRight);

  // tilt up-vector according to the forward vector
  vec3.cross(cameraUp, cameraRight, cameraForward);


  // NOTE: Use this method when it gets implemented correctly.
  // issue: https://github.com/toji/gl-matrix/issues/436
  // quat.setAxes(camera.rotationQuaternion, cameraForward, cameraRight, cameraUp);

  const cameraZ = vec3.create();
  vec3.negate(cameraZ, cameraForward);
  
  const rotationMatrix = mat3.fromValues(
    cameraRight[0], cameraRight[1], cameraRight[2], 
    cameraUp[0], cameraUp[1], cameraUp[2], 
    cameraZ[0], cameraZ[1], cameraZ[2]);

  quat.fromMat3(camera.rotationQuaternion, rotationMatrix);

  // rebuild eye to ensure consistency
  updatePosition(camera);
}

/**
 * Initializes the camera object. Contains values used in shader programs.
 * @param {*} viewport object containing width and height attributes
 * @returns `camera` object
 */
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
    rotationQuaternion: quat.create(),
    // shader uniforms
    u_eye_position: vec3.fromValues(1.5, 1.25, -1.5),
    u_view_inv: mat4.create(),
    u_projection_inv: mat4.create(),
  };

  initAttributesFromPosition(initialCamera);

  updateViewInverseMatrix(initialCamera);

  updateProjectionInverseMatrix(initialCamera, viewport);

  return initialCamera;
}

/* --------------------------------------------------------------------------- */
/* CAMERA UPDATE LOGIC ------------------------------------------------------- */
/* --------------------------------------------------------------------------- */

/**
 * Updates camera's position by placing it in the direction of its z-axis 
 * (computed from the rotation quaternion) and offsets it from the `targetPosition`
 *  by its `distanceToTarget`.
 * @param {*} camera camera object
 */
function updatePosition(camera)
{
  const rotationMatrix = mat3.create();
  mat3.fromQuat(rotationMatrix, camera.rotationQuaternion);

  const cameraZ = vec3.fromValues(rotationMatrix[6], rotationMatrix[7], rotationMatrix[8]);
  vec3.normalize(cameraZ, cameraZ);

  // targetPosition + cameraZ * distanceToTarget
  vec3.scaleAndAdd(camera.u_eye_position, camera.targetPosition, cameraZ, camera.distanceToTarget);
}

/**
 * Updates camera's inverse view matrix used by the ray-cast shaders.
 * @param {*} camera camera object
 */
function updateViewInverseMatrix(camera)
{
  const viewMat = mat4.create();
  mat4.lookAt(viewMat, camera.u_eye_position, camera.targetPosition, [0, 1, 0]);
  mat4.invert(camera.u_view_inv, viewMat);
}

/**
 * Updates camera's inverse projection matrix used by the ray-cast shaders.
 * @param {*} camera camera object
 * @param {*} viewport object containing width and height attributes
 */
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

/**
 * Takes a screen-space vector and transforms it into a camera's rotation in 3D space
 * (camera's rotation quaternion is updated).
 * The camera's rotation is computed in world space. 'Pitch' movement is allowed within 
 * <-90, 90> degree interval.
 * @param {*} camera camera object
 * @param {*} mouseVector 2D screen-space motion vector from the latest application frame 
 */
function rotateCamera(camera, mouseVector)
{
  const [deltaX, deltaY] = mouseVector;
  const horizontalRotation = -deltaX * camera.rotateSensitivity;
  const verticalRotation = deltaY * camera.rotateSensitivity;

  // YAW
  const horizontalRotationQuat = quat.create();
  quat.setAxisAngle(horizontalRotationQuat, [0, 1, 0], horizontalRotation);
  
  // NOTE: This order multiplies in world space (needed for rotation around (0, 1, 0))
  quat.multiply(camera.rotationQuaternion, horizontalRotationQuat, camera.rotationQuaternion);
  quat.normalize(camera.rotationQuaternion, camera.rotationQuaternion);
  
  // PITCH
  const verticalRotationQuatCheck = quat.create();
  quat.rotateX(verticalRotationQuatCheck, camera.rotationQuaternion, verticalRotation)

  // pitch within <-90, 90> degree range check
  const verticalRotationMatCheck = mat3.create();
  mat3.fromQuat(verticalRotationMatCheck, verticalRotationQuatCheck);
  const cameraAxisY = vec3.fromValues(verticalRotationMatCheck[3], verticalRotationMatCheck[4], verticalRotationMatCheck[5]);

  if (vec3.dot(cameraAxisY, [0, 1, 0]) < 0)
    return;

  quat.rotateX(camera.rotationQuaternion, camera.rotationQuaternion, verticalRotation);
  quat.normalize(camera.rotationQuaternion, camera.rotationQuaternion);
}

/**
 * Translates the camera in a 3D space. Camera's target position is updated using a motion 
 * vector transformed into world space. Distance to target is kept which effectively 
 * moves the camera.
 * @param {*} camera camera object
 * @param {*} keyboardVector 3D local-space motion vector from the latest application frame 
 * @param {*} timeDelta time elapsed from the previous frame (in seconds)
 */
function moveCamera(camera, keyboardVector, timeDelta)
{
  const rotateMatrix = mat3.create();
  mat3.fromQuat(rotateMatrix, camera.rotationQuaternion);

  const translationVectorWS = vec3.create();
  vec3.transformMat3(translationVectorWS, keyboardVector, rotateMatrix);

  vec3.scaleAndAdd(camera.targetPosition, camera.targetPosition, translationVectorWS, timeDelta);
}

/**
 * Zooms the camera by altering its Field of View by `zoomStep` amount.
 * Zooming is clamped within <`minFOV`, `maxFOV`> range.
 * @param {*} camera camera object
 * @param {*} viewport object containing width and height attributes
 * @param {*} zoomDirection string, "in" - FOV is decreased, otherwise FOV is increased
 */
function zoomCamera(camera, viewport, zoomDirection)
{
  if (zoomDirection === "in")
    camera.FOV = Math.max(camera.FOV - camera.zoomStep, camera.minFOV);
  else // zoomDirection === "out"
    camera.FOV = Math.min(camera.FOV + camera.zoomStep, camera.maxFOV);

  updateProjectionInverseMatrix(camera, viewport);
}

/**
 * Reads the state of `cameraControls` object and updates the WebGL `camera` accordingly.
 * @param {*} camera camera object
 * @param {*} cameraControls state object for camera controls
 * @param {*} viewport object containing width and height attributes
 * @param {*} timeDelta time elapsed from the previous frame (in seconds)
 * @returns 
 */
export function updateCamera(camera, cameraControls, viewport, timeDelta)
{
  if (cameraControls.idle)
    return;

  if (cameraControls.rotate)
    rotateCamera(camera, cameraControls.mouseVector);

  if (cameraControls.translate)
    moveCamera(camera, cameraControls.keyboardVector, timeDelta);

  if (cameraControls.zoom)
    zoomCamera(camera, viewport, cameraControls.zoomDirection);

  updatePosition(camera);
  updateViewInverseMatrix(camera);
}
