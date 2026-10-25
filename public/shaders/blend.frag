#version 300 es
precision mediump float;
precision mediump sampler2D;

/* --------CONSTANTS-------- */
/* ------------------------- */
// Colors
const vec4 GROUND_COLOR = vec4(0.15, 0.2, 0.2, 1.0);
const vec4 SKY_COLOR = vec4(0.36f, 0.64f, 0.64f, 1.0f);
const vec4 DIRECTION_COLOR = vec4(0.54f, 0.25f, 0.5f, 1.0f);
const vec4 DIRECTION_COLOR2 = vec4(0.83f, 0.54f, 0.09f, 1.0f);

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
// Textures
uniform sampler2D u_texture_shell;
uniform sampler2D u_texture_pet;
uniform sampler2D u_texture_bone;
// Camera uniforms
uniform vec3 u_eye_position;
uniform mat4 u_view_inv;
uniform mat4 u_projection_inv;

/* ---------OUTPUT---------- */
/* ------------------------- */
out vec4 o_color;

void main()
{
  vec3 ray_origin = (u_view_inv * u_projection_inv * vec4(var.tex_coord * 2.0 - 1.0, -1.0, 1.0)).xyz;
  vec3 ray_direction = normalize(ray_origin - u_eye_position);

  // Color textures
  vec4 shell = texture(u_texture_shell, var.tex_coord);
  vec4 pet = texture(u_texture_pet, var.tex_coord);
  vec4 bone = texture(u_texture_bone, var.tex_coord);

  // Blend
  o_color.rgb = shell.rgb + bone.rgb * (1.0 - shell.a) + pet.rgb * (1.0 - shell.a - bone.a);
  o_color.a = shell.a + bone.a * (1.0 - shell.a) + pet.a * (1.0 - shell.a - bone.a);

  // Background
  vec4 background_color = ray_direction.y > 0.0 ? SKY_COLOR: GROUND_COLOR;
	background_color = mix(vec4(0.7, 0.7, 0.7, 1.0), background_color, smoothstep(0.0, 1.0, abs(ray_direction.y)));
	if (ray_direction.x > 0.0)
		background_color = mix(background_color, DIRECTION_COLOR, ray_direction.x);

  o_color.rgb += background_color.rgb * (1.0 - o_color.a);
  o_color.a = 1.0;

  // Gamma Correction
  float gamma = 1.8;
	o_color.rgb = pow(o_color.rgb, vec3(1.0 / gamma));

  // Tone Mapping
	// o_color.rgb = o_color.rgb / (o_color.rgb + vec3(1.0));
}
