'use strict'

import { Pane } from 'tweakpane';
import * as TweakpaneEssentialsPlugin from '@tweakpane/plugin-essentials';
import { vec2, vec3, vec4 } from 'gl-matrix';

function initIntervalVec(medium)
{
  return vec2.fromValues(medium.interval.min, medium.interval.max);
}

function initColorVec(medium)
{
  return vec4.fromValues(medium.color.r, medium.color.g, medium.color.b, medium.color.a);
}

function initVec3(v)
{
  return vec3.fromValues(v.x, v.y, v.z);
}

export function initUIData(tf)
{
  let UIData = {
    // Debug
    slice: 1,
    framesPerSecond: 0,
    mode: 0,
    // Ray Tracing
    defaultStepSize: 0.0025,
    stepSize: 0.0025,
    shadingModel: 0,
    // Light:
    light: {
      x: 0,
      y: 0,
      z: -1,
    },
    u_light: initVec3({x: 0, y: 0, z: -1}),
    // Shading Model
    roughness: 0.1,
    subsurface: 0.0,
    sheen: 0.0,
    sheenTint: 0.0,
    // Transfer Function
    airItv: tf.air.interval,
    airColor: tf.air.color,
    u_itv_air: initIntervalVec(tf.air),
    u_color_air: initColorVec(tf.air),

    lungsItv: tf.lungs.interval,
    lungsColor: tf.lungs.color,
    u_itv_lungs: initIntervalVec(tf.lungs),
    u_color_lungs: initColorVec(tf.lungs),

    fatItv: tf.fat.interval,
    fatColor: tf.fat.color,
    u_itv_fat: initIntervalVec(tf.fat),
    u_color_fat: initColorVec(tf.fat),

    waterItv: tf.water.interval,
    waterColor: tf.water.color,
    u_itv_water: initIntervalVec(tf.water),
    u_color_water: initColorVec(tf.water),

    muscleItv: tf.muscle.interval,
    muscleColor: tf.muscle.color,
    u_itv_muscle: initIntervalVec(tf.muscle),
    u_color_muscle: initColorVec(tf.muscle),

    softTissueContrastItv: tf.softTissueContrast.interval,
    softTissueContrastColor: tf.softTissueContrast.color,
    u_itv_soft_tissue_contrast: initIntervalVec(tf.softTissueContrast),
    u_color_soft_tissue_contrast: initColorVec(tf.softTissueContrast),

    boneCancellousItv: tf.boneCancellous.interval,
    boneCancellousColor: tf.boneCancellous.color,
    u_itv_bone_cancellous: initIntervalVec(tf.boneCancellous),
    u_color_bone_cancellous: initColorVec(tf.boneCancellous),

    boneCorticalItv: tf.boneCortical.interval,
    boneCorticalColor: tf.boneCortical.color,
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

  pane.registerPlugin(TweakpaneEssentialsPlugin);

  // pane.addBinding(UIData, 'slice', {min: 1, max: 226, step: 1});

  pane.addBinding(UIData, "framesPerSecond", {
        readonly: true,
        label: "FPS",
        view: "graph",
        min: 0,
        max: 200
    });

  pane.addBinding(UIData, "mode", {
    options: {
      main: 0,
      debugShader: 1,
      debugSlice: 2,
    }
  });

  pane.addBinding(UIData, "stepSize", {min: 0.0001, max: 0.01, step: 0.0001});
  pane.addBinding(UIData, "defaultStepSize", {min: 0.0001, max: 0.01, step: 0.0001});
  pane.addBinding(UIData, "shadingModel", { 
    options: {
      Disney: 0,
      Lambert: 1,
      normal: 2,
      position: 3,
    } 
  });

  pane.addBinding(UIData, "light", { min: -1, max: 1 })
  .on('change', (event) => {
    const {x, y, z} = event.value;
    vec3.set(UIData.u_light, x, y, z);
  });

  pane.addBinding(UIData, "roughness", { min: 0, max: 1 });
  pane.addBinding(UIData, "subsurface", { min: 0, max: 1 });
  pane.addBinding(UIData, "sheen", { min: 0, max: 1 });
  pane.addBinding(UIData, "sheenTint", { min: 0, max: 1 });


  const folderTF = pane.addFolder({ title: "Transfer Function" });

  // AIR
  // folderTF.addBinding(UIData, "airItv", {
  //   min: 0,
  //   max: 4095,
  //   step: 1,
  // })
  // .on('change', (event) => {
  //   const { min, max } = event.value;
  //   vec2.set(UIData.u_itv_air, min, max);
  // });
  // folderTF.addBinding(UIData, "airColor", {
  //   color: { type: "float" },
  //   picker: "inline",
  //   expanded: false,
  // })
  // .on('change', (event) => {
  //   const { r, g, b, a } = event.value;
  //   vec4.set(UIData.u_color_air, r, g, b, a);
  // });
  // // LUNGS
  // folderTF.addBinding(UIData, "lungsItv", {
  //   min: 0,
  //   max: 4095,
  //   step: 1,
  // })
  // .on('change', (event) => {
  //   const { min, max } = event.value;
  //   vec2.set(UIData.u_itv_lungs, min, max);
  // });
  // folderTF.addBinding(UIData, "lungsColor", {
  //   color: { type: "float" },
  //   picker: "inline",
  //   expanded: false,
  // })
  // .on('change', (event) => {
  //   const { r, g, b, a } = event.value;
  //   vec4.set(UIData.u_color_lungs, r, g, b, a);
  // });
  // // FAT
  // folderTF.addBinding(UIData, "fatItv", {
  //   min: 0,
  //   max: 4095,
  //   step: 1,
  // })
  // .on('change', (event) => {
  //   const { min, max } = event.value;
  //   vec2.set(UIData.u_itv_fat, min, max);
  // });
  // folderTF.addBinding(UIData, "fatColor", {
  //   color: { type: "float" },
  //   picker: "inline",
  //   expanded: false,
  // })
  // .on('change', (event) => {
  //   const { r, g, b, a } = event.value;
  //   vec4.set(UIData.u_color_fat, r, g, b, a);
  // });
  // // WATER
  // folderTF.addBinding(UIData, "waterItv", {
  //   min: 0,
  //   max: 4095,
  //   step: 1,
  // })
  // .on('change', (event) => {
  //   const { min, max } = event.value;
  //   vec2.set(UIData.u_itv_water, min, max);
  // });
  // folderTF.addBinding(UIData, "waterColor", {
  //   color: { type: "float" },
  //   picker: "inline",
  //   expanded: false,
  // })
  // .on('change', (event) => {
  //   const { r, g, b, a } = event.value;
  //   vec4.set(UIData.u_color_water, r, g, b, a);
  // });
  // // MUSCLE
  // folderTF.addBinding(UIData, "muscleItv", {
  //   min: 0,
  //   max: 4095,
  //   step: 1,
  // })
  // .on('change', (event) => {
  //   const { min, max } = event.value;
  //   vec2.set(UIData.u_itv_muscle, min, max);
  // });
  // folderTF.addBinding(UIData, "muscleColor", {
  //   color: { type: "float" },
  //   picker: "inline",
  //   expanded: false,
  // })
  // .on('change', (event) => {
  //   const { r, g, b, a } = event.value;
  //   vec4.set(UIData.u_color_muscle, r, g, b, a);
  // });
  // // SOFT TISSUE CONTRAST
  // folderTF.addBinding(UIData, "softTissueContrastItv", {
  //   min: 0,
  //   max: 4095,
  //   step: 1,
  // })
  // .on('change', (event) => {
  //   const { min, max } = event.value;
  //   vec2.set(UIData.u_itv_soft_tissue_contrast, min, max);
  // });
  // folderTF.addBinding(UIData, "softTissueContrastColor", {
  //   color: { type: "float" },
  //   picker: "inline",
  //   expanded: false,
  // })
  // .on('change', (event) => {
  //   const { r, g, b, a } = event.value;
  //   vec4.set(UIData.u_color_soft_tissue_contrast, r, g, b, a);
  // });
  // // BONE CANCELLOUS
  // folderTF.addBinding(UIData, "boneCancellousItv", {
  //   min: 0,
  //   max: 4095,
  //   step: 1,
  // })
  // .on('change', (event) => {
  //   const { min, max } = event.value;
  //   vec2.set(UIData.u_itv_bone_cancellous, min, max);
  // });
  // folderTF.addBinding(UIData, "boneCancellousColor", {
  //   color: { type: "float" },
  //   picker: "inline",
  //   expanded: false,
  // })
  // .on('change', (event) => {
  //   const { r, g, b, a } = event.value;
  //   vec4.set(UIData.u_color_bone_cancellous, r, g, b, a);
  // });
  // BONE CORTICAL
  folderTF.addBinding(UIData, "boneCorticalItv", {
    min: 0,
    max: 4095,
    step: 1,
  })
  .on('change', (event) => {
    const { min, max } = event.value;
    vec2.set(UIData.u_itv_bone_cortical, min, max);
  });
  folderTF.addBinding(UIData, "boneCorticalColor", {
    color: { type: "float" },
    picker: "inline",
    expanded: false,
  })
  .on('change', (event) => {
    const { r, g, b, a } = event.value;
    vec4.set(UIData.u_color_bone_cortical, r, g, b, a);
  });

  return pane;
}
