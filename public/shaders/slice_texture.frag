#version 300 es
precision mediump float;
precision mediump usampler3D;

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
uniform usampler3D u_volume_texture;
// Affects what depth (z-coordinate) of the 3D texture is sampled
uniform float u_slice_number;
// Total count of images that make up the 3D texture's depth
uniform float u_slice_count;

/* ---------OUTPUT---------- */
/* ------------------------- */
out vec4 o_color;

void main()
{
  float slice_norm = (u_slice_number - 1.0) / (u_slice_count - 1.0);
  uvec4 unsigned_color = texture(u_volume_texture, vec3(var.tex_coord, slice_norm));
  vec4 float_color = vec4(unsigned_color);
  vec3 color = vec3(float_color.r, float_color.r, float_color.r);
  color /= 4096.0; // Hardcoded
  o_color = vec4(color, 1.0);
}
