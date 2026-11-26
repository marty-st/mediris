#version 300 es
precision mediump float;
precision mediump sampler2D;

/* --------CONSTANTS-------- */
/* ------------------------- */
// Colors
const vec4 GROUND_COLOR = vec4(0.38f, 0.48f, 0.22f, 1.0f);
const vec4 SKY_COLOR = vec4(0.83f, 0.54f, 0.09f, 1.0f);
const vec4 DIRECTION_COLOR = vec4(0.22f, 0.0f, 0.37f, 1.0f);
const vec4 DIRECTION_COLOR2 = vec4(0.0f, 0.2f, 0.56f, 1.0f);
// const vec4 DIRECTION_COLOR2 = vec4(0.18f, 0.36f, 0.71f, 1.0f);
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
uniform sampler2D u_texture_focus_window;
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
  vec4 focus_window = texture(u_texture_focus_window, var.tex_coord);

  // Blend

  // Focus Window
  bone *= focus_window.a;

  o_color.rgb = shell.rgb + bone.rgb * (1.0 - shell.a) + pet.rgb * max(1.0 - shell.a - bone.a, 0.0);
  o_color.a = shell.a + bone.a * (1.0 - shell.a) + pet.a * max(1.0 - shell.a - bone.a, 0.0);

  // Background
  vec2 horizontal_ray = normalize(vec2(ray_direction.x, ray_direction.z));
  vec2 direction_normal = normalize(vec2(-1.0, 1.0));

  // dot product (-1,1) -> (0,1)
  float transformed_dot = (dot(horizontal_ray, direction_normal) + 1.0) * 0.5;

  vec4 background_color = mix(
    DIRECTION_COLOR2,
    DIRECTION_COLOR,
    smoothstep(0.0, 1.0, transformed_dot)
  );

  vec4 vertical_color = ray_direction.y > 0.0 ? DIRECTION_COLOR : DIRECTION_COLOR2;
  background_color = mix(
    background_color,
    vertical_color,
    smoothstep(0.3, 0.7, abs(ray_direction.y))
  );

  o_color.rgb += background_color.rgb * (1.0 - o_color.a);
  o_color.a = 1.0;

  // Gamma Correction
  float gamma = 1.8;
	o_color.rgb = pow(o_color.rgb, vec3(1.0 / gamma));

  // Tone Mapping
	// o_color.rgb = o_color.rgb / (o_color.rgb + vec3(1.0));
}
