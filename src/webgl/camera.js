'use strict'

import { vec3, mat4, glMatrix } from 'gl-matrix';

export function initCamera(canvas)
{
  let eyePosition = vec3.create();
  vec3.set(eyePosition, 5, 2, 5);
  let viewMat = mat4.create();
  mat4.lookAt(viewMat, eyePosition, [0, 0, 0], [0, 1, 0]);
  let viewInvMat = mat4.create();
  mat4.invert(viewInvMat, viewMat);
  let perspectiveMat = mat4.create();
  // NOTE: when near was set to 0.1 and shader projection plane distance was 1.0, raytracing
  // didn't work. I'm curious what is the exact issue with that. 
  mat4.perspective(perspectiveMat, glMatrix.toRadian(60), canvas.width / canvas.height, 1, 1000);
  let perspectiveInvMat = mat4.create();
  mat4.invert(perspectiveInvMat, perspectiveMat);

  return {
    u_eye_position: eyePosition,
    u_view_inv: viewInvMat,
    u_projection_inv: perspectiveInvMat,
  };
}
