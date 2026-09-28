'use strict';

import { vec3 } from "gl-matrix";

export function setWorldPositionFromCameraSpace(lightPosition, cameraInvViewMat)
{
  const lightPositionWorld = vec3.create();
  vec3.transformMat4(lightPositionWorld, lightPosition, cameraInvViewMat);
  return lightPositionWorld;
}
