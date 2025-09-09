'use strict'

import { Pane } from 'tweakpane.js';

/**
 * Initializes the context of Tweakpane UI elements for debugging purposes
 * @returns `Pane`object
 */
export function initDebugUI()
{
  const pane = new Pane();

  const PARAMS = {
    factor: 123,
    title: 'hello',
    color: '#ff0055',
  };

  pane.addBinding(PARAMS, 'factor');
  pane.addBinding(PARAMS, 'title');
  pane.addBinding(PARAMS, 'color');

  return pane;
}
