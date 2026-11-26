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
uniform sampler2D u_texture_blur;
uniform sampler2D u_texture_focus_window;
uniform vec2 u_resolution_inverse;
uniform float u_pixel_offset_blur;
uniform float u_offset_multiplier_blur;
uniform float u_pixel_offset_focus_window;
uniform float u_offset_multiplier_focus_window;
uniform bool u_use_ss_focus_window;

/* ---------OUTPUT---------- */
/* ------------------------- */
layout (location = 0) out vec4 o_color_blur;
layout (location = 1) out vec4 o_color_focus_window;

// inspired by code from
// https://blog.frost.kiwi/dual-kawase/#kawase-blur
vec4 kawase_blur(sampler2D tex, vec2 pixel_offset, float offset_multiplier)
{
  /* Kawase blur samples 4 corners in a diamond pattern */
	vec2 o = vec2(pixel_offset + 0.5) * offset_multiplier * u_resolution_inverse;
	
	/* Sample the 4 diagonal corners with equal weight */
	vec4 color = vec4(0.0);
	color += texture(tex, var.tex_coord + vec2( o.x,  o.y)); /* top-right */
	color += texture(tex, var.tex_coord + vec2(-o.x,  o.y)); /* top-left   */
	color += texture(tex, var.tex_coord + vec2(-o.x, -o.y)); /* bottom-left */
	color += texture(tex, var.tex_coord + vec2( o.x, -o.y)); /* bottom-right */
	color *= 0.25;

  return color;
}

float dilate(sampler2D tex, vec2 pixel_offset, float offset_multiplier)
{

	// To make offset correspond to a constant physical size in world space when zooming via FOV:
	// CPU or Vertex/Fragment Uniforms:
	// uTanHalfFov = tan(fovRadians * 0.5)
	// uRefTanHalfFov = tan(referenceFovRadians * 0.5) (e.g., at 45° default FOV)

	// float zoomScale = uRefTanHalfFov / uTanHalfFov;
	// vec2 offset = uTexelSize * (float(uPassIndex) + 0.5) * zoomScale;)

	// OR:
	// dilate 3D pet texture
	// compute distance map to this dilated texture
	// when tracing bone: use the dilated distance map and jump to the dilated surface
	// from there onward, use the bone distance map and trace bone as usual.
	// alternatively: compute sample_point texture of the dilated pet first, then start
	// tracing of regular pet and bone from its coordinates (for bone only when using focus window)

	vec2 o = vec2(pixel_offset + 0.5) * offset_multiplier * u_resolution_inverse;

	vec2 oo = vec2(pixel_offset + 1.5) * offset_multiplier * u_resolution_inverse;
	
	float color = 0.0;

	// Dilate
	color = max(color, texture(tex, var.tex_coord + vec2( o.x,  o.y)).a); /* top-right */
	color = max(color, texture(tex, var.tex_coord + vec2(-o.x,  o.y)).a); /* top-left   */
	color = max(color, texture(tex, var.tex_coord + vec2(-o.x, -o.y)).a); /* bottom-left */
	color = max(color, texture(tex, var.tex_coord + vec2( o.x, -o.y)).a); /* bottom-right */

	color = max(color, texture(tex, var.tex_coord + vec2( 0.0,  oo.y)).a); /* top */
	color = max(color, texture(tex, var.tex_coord + vec2(-oo.x,  0.0)).a); /* left   */
	color = max(color, texture(tex, var.tex_coord + vec2( oo.x,  0.0)).a); /* right */
	color = max(color, texture(tex, var.tex_coord + vec2( 0.0, -oo.y)).a); /* bottom- */

	// Blur
	// color += texture(tex, var.tex_coord + vec2( o.x,  o.y)).a; /* top-right */
	// color += texture(tex, var.tex_coord + vec2(-o.x,  o.y)).a; /* top-left   */
	// color += texture(tex, var.tex_coord + vec2(-o.x, -o.y)).a; /* bottom-left */
	// color += texture(tex, var.tex_coord + vec2( o.x, -o.y)).a; /* bottom-right */
	// color *= 0.25;

  return color;
}

void main()
{
	// NOTE: evaluating both blur and focus window in one function may bring more performance
	// as one texture fetch may serve both.
  o_color_blur = kawase_blur(u_texture_blur, vec2(u_pixel_offset_blur), u_offset_multiplier_blur);

	if (u_use_ss_focus_window)
  	o_color_focus_window = vec4(dilate(u_texture_focus_window, vec2(u_pixel_offset_focus_window), u_offset_multiplier_focus_window));
}