'use strict'

import { Pane } from 'tweakpane';
import { vec2, vec4 } from 'gl-matrix';

function initInterval(medium)
{
  return {x: medium.interval.min, y: medium.interval.max};
}

function initColor(medium)
{
  return { r: medium.color.r, g: medium.color.g, b: medium.color.b, a: medium.color.a };
}

function initIntervalVec(medium)
{
  return vec2.fromValues(medium.interval.min, medium.interval.max);
}

function initColorVec(medium)
{
  return vec4.fromValues(medium.color.r, medium.color.g, medium.color.b, medium.color.a);
}

export function initUIData(tf)
{
  let UIData = {
    slice: 1,
    framesPerSecond: 0,
    // Transfer Function
    itvSkin: initInterval(tf.skin),
    colorSkin: initColor(tf.skin),
    u_itv_skin: initIntervalVec(tf.skin),
    u_color_skin: initColorVec(tf.skin),
    itvBoneCortical: initInterval(tf.boneCortical),
    colorBoneCortical: initColor(tf.boneCortical),
    u_itv_bone_cortical: initIntervalVec(tf.boneCortical),
    u_color_bone_cortical: initColorVec(tf.boneCortical),
  };

  return UIData;
}

/**
 * Initializes the context of Tweakpane UI elements for debugging purposes
 * @param UIData object that reflects states of Tweakpane controlled variables
 * @returns `Pane`object
 */
export function initDebugUI(UIData)
{
  const pane = new Pane();

  pane.addBinding(UIData, 'slice', {min: 1, max: 226, step: 1});

  pane.addBinding(UIData, "framesPerSecond", {
        readonly: true,
        label: "FPS",
        view: "graph",
        min: 0,
        max: 200
    });

  const folderTF = pane.addFolder({ title: "Transfer Function" });

  // SKIN
  folderTF.addBinding(UIData, "itvSkin", {
    x: {min: 0, max: 4095, step: 1},
    y: {min: 0, max: 4095, step: 1},
  })
  .on('change', (event) => {
    const { x, y } = event.value;
    vec2.set(UIData.u_itv_skin, x, y);
  });
  folderTF.addBinding(UIData, "colorSkin", {
    color: { type: "float" },
    picker: "inline",
    expanded: true,
  })
  .on('change', (event) => {
    const { r, g, b, a } = event.value;
    vec4.set(UIData.u_color_skin, r, g, b, a);
  });
  // BONE CORTICAL
  folderTF.addBinding(UIData, "itvBoneCortical", {
    x: {min: 0, max: 4095, step: 1},
    y: {min: 0, max: 4095, step: 1},
  })
  .on('change', (event) => {
    const { x, y } = event.value;
    vec2.set(UIData.u_itv_bone_cortical, x, y);
  });
  folderTF.addBinding(UIData, "colorBoneCortical", {
    color: { type: "float" },
    picker: "inline",
    expanded: true,
  })
  .on('change', (event) => {
    const { r, g, b, a } = event.value;
    vec4.set(UIData.u_color_bone_cortical, r, g, b, a);
  });

  return pane;
}
