#version 300 es
precision mediump float;
precision mediump sampler2D;

/* -------DEFINITIONS------- */
/* ------------------------- */
struct VaryingData 
{
	vec2 tex_coord;
};

/* ----------INPUT---------- */
/* ------------------------- */
in VaryingData var;

/* --------UNIFORMS--------- */
/* ------------------------- */
uniform sampler2D u_texture_original;
uniform sampler2D u_texture_blur;
uniform float u_bloom_intensity;
// NOTE: more efficient to disable draw calls on the CPU
uniform bool u_use_bloom;

/* ---------OUTPUT---------- */
/* ------------------------- */
out vec4 o_color;

void main()
{
  // Additive blend
  vec4 original_color = texture(u_texture_original, var.tex_coord);
  vec4 blur_color = texture(u_texture_blur, var.tex_coord);
  o_color = u_use_bloom ? u_bloom_intensity * original_color + blur_color : original_color;
}