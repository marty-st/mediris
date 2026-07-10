'use strict';

/**
 * Marks the start of a timing benchmark.
 * @param {*} name benchmark name
 * @param  {...any} ids benchmark identification (file names, etc.)
 * @returns start timestamp of the benchmark
 */
export function startBenchmark(name, ...ids)
{
  console.log(`[${name}]`, "start", ...ids);
  return performance.now();
}

/**
 * Marks the end of a timing benchmark.
 * @param {*} name benchmark name
 * @param {*} startTime start timestamp of the benchmark
 * @param {*} usingCache benchmark ended by using cached resources
 * @param  {...any} ids benchmark identification (file names, etc.)
 */
export function endBenchmark(name, startTime, usingCache = false, ...ids)
{
  const end = performance.now();

  let unit = "ms";
  let decimals = 0;
  let time = end - startTime;
  const endType = usingCache ? "using cache" : "end";

  if (time > 1000)
  {
    time /= 1000;
    unit = "s";
    decimals = 2;
  }

  console.log(`[${name}]`, endType, ...ids, `(${time.toFixed(decimals)}${unit})`);
}
