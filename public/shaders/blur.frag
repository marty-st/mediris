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
uniform sampler2D u_texture;
uniform vec2 u_resolution_inverse;
uniform float u_pixel_offset;
uniform float u_offset_multiplier;

/* ---------OUTPUT---------- */
/* ------------------------- */
out vec4 o_color;

// inspired by code from
// https://blog.frost.kiwi/dual-kawase/#kawase-blur
vec4 kawase_blur(vec2 pixel_offset)
{
  /* Kawase blur samples 4 corners in a diamond pattern */
	vec2 o = vec2(pixel_offset + 0.5) * u_offset_multiplier * u_resolution_inverse;
	
	/* Sample the 4 diagonal corners with equal weight */
	vec4 color = vec4(0.0);
	color += texture(u_texture, var.tex_coord + vec2( o.x,  o.y)); /* top-right */
	color += texture(u_texture, var.tex_coord + vec2(-o.x,  o.y)); /* top-left   */
	color += texture(u_texture, var.tex_coord + vec2(-o.x, -o.y)); /* bottom-left */
	color += texture(u_texture, var.tex_coord + vec2( o.x, -o.y)); /* bottom-right */
	color *= 0.25;

  return color;
}

void main()
{
  o_color = kawase_blur(vec2(u_pixel_offset));
}