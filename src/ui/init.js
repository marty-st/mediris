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

  const PARAMS = {
    slice: 1,
  };

  const slice_slider = pane.addBinding(PARAMS, 'slice', {min: 1, max: 226, step: 1});

  slice_slider.on('change', function(ev) {
    UIData.slice = ev.value;
  });

  return pane;
}
