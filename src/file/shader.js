/**
 * Code by: 
 * David Banks
 * from:
 * https://medium.com/@banksysan_10088/webgl-external-glsl-files-dd7cf85f9ee9
 * 
 * Fetch the fragment and vertex shader text from external files.
 * @param vertexShaderPath
 * @param fragmentShaderPath
 * @returns {Promise<{vertexShaderText: string | null, fragmentShaderText: string | null}>}
 */
export default async function fetchShaderTexts(vertexShaderPath, fragmentShaderPath) {
  const results = {
    vertexShaderText: null,
    fragmentShaderText: null,
  };

  let errors = [];
  await Promise.all([
    fetch(vertexShaderPath)
      .catch((e) => {
          errors.push(e);
        })
      .then(async (response) => {
        if (response.status === 200) {
          results.vertexShaderText = await response.text();
        } else {
          errors.push(
            `Non-200 response for ${vertexShaderPath}.  ${response.status}:  ${response.statusText}`
          );
        }
      }),

    fetch(fragmentShaderPath)
      .catch((e) => errors.push(e))
      .then(async (response) => {
        if (response.status === 200) {
          results.fragmentShaderText = await response.text();
        } else {
          errors.push(
            `Non-200 response for ${fragmentShaderPath}.  ${response.status}:  ${response.statusText}`
          );
        }
      }),
  ]);

  if (errors.length !== 0) {
    throw new Error(
      `Failed to fetch shader(s):\n${JSON.stringify(errors, (key, value) => {
        if (value?.constructor.name === 'Error') {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
            cause: value.cause,
          };
        }
        return value;
      }, 2)}`
    );
  }
  
  return results;
}

// Simple alternative:
// async function loadShader(url) {
//   const response = await fetch(url);
//   return await response.text();
// }

// async function initShaders(vertexShaderPath, fragmentShaderPath) {
//   vsSource = await loadShader(vertexShaderPath);
//   fsSource = await loadShader(fragmentShaderPath);
// }
