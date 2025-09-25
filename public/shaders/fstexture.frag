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

/* ---------OUTPUT---------- */
/* ------------------------- */
out vec4 o_color;

void main()
{
  o_color = texture(u_texture, var.tex_coord);
}
