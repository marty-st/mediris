#version 300 es

const vec2 tex_coords[3] = vec2[3] (
	vec2(0.0, 0.0),
	vec2(2.0, 0.0),
	vec2(0.0, 2.0)
);

struct VaryingData 
{
	vec2 tex_coord;
};

out VaryingData var;

void main()
{
	var.tex_coord = tex_coords[gl_VertexID];
	gl_Position = vec4(var.tex_coord * 2.0 - 1.0, 0.0, 1.0);
}
