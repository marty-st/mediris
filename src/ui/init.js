'use strict'

import { Pane } from 'tweakpane';

/**
 * Initializes the context of Tweakpane UI elements for debugging purposes
 * @param UIData object that reflects states of Tweakpane controlled variables
 * @returns `Pane`object
 */
export function initDebugUI(UIData)
{
  const pane = new Pane();

  // const PARAMS = {
  //   factor: 123,
  //   title: 'hello',
  //   color: '#ff0055',
  // };

  // pane.addBinding(PARAMS, 'factor');
  // pane.addBinding(PARAMS, 'title');
  // pane.addBinding(PARAMS, 'color');

  pane.addBinding(UIData, 'slice', {min: 1, max: 226, step: 1});

  pane.addBinding(UIData, "framesPerSecond", {
        readonly: true,
        label: "FPS",
        view: "graph",
        min: 0,
        max: 200
    });

  return pane;
}
