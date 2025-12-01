#version 300 es
precision mediump float;
precision mediump sampler3D;

/* -------DEFINITIONS------- */
/* ------------------------- */
struct VaryingData 
{
	vec2 tex_coord;
};

// The definition of a ray.
struct Ray 
{
    vec3 origin;     // The ray origin.
    vec3 direction;  // The ray direction.
};
// The definition of an intersection.
struct RayIntersectionData
{
	float t;
	vec3 intersection;
	vec3 normal;
};
// The definition of an intersection including information about the hit object.
struct Hit 
{
  float t_first;				    // The distance between the ray origin and the CLOSEST intersection point along the ray. 
	float t_last;							// The distance between the ray origin and the FARTHEST intersection point along the ray. 
	vec3 intersection;        // The intersection point.
  vec3 normal;              // The surface normal at the interesection point.
};

struct Light
{
	vec3 position;
	float intensity;
};

struct Medium
{
	vec4 color;
	vec2 interval;
};

/* -----LOCAL VARIABLES----- */
/* ------------------------- */
const float PI = 3.14159265358979323846;
const int MAX_TF_ARRAY_SIZE = 20;
const int MAX_LIGHT_ARRAY_SIZE = 5;
const float AIR_UPPER_LIMIT = 50.0;
const RayIntersectionData no_intersection = RayIntersectionData(1e20, vec3(0.0), vec3(0.0));
const Hit miss = Hit(1e20, 1e20, vec3(0.0), vec3(0.0));
const int DISNEY = 0;
const int LAMBERT = 1;
const int NORMAL = 2;
const int POSITION = 3;

/* ----------INPUT---------- */
/* ------------------------- */
in VaryingData var;

/* --------UNIFORMS--------- */
/* ------------------------- */
// Volume data texture
uniform sampler3D u_volume_texture;
// Bounding box lower left corner
uniform vec3 u_bbox_min;
// Bounding box upper right corner
uniform vec3 u_bbox_max;
// Ray Tracing
uniform float u_step_size;
uniform float u_default_step_size;
uniform int u_shading_model;
// Light
uniform Lights {
	int lights_array_size;
	Light lights_array[MAX_LIGHT_ARRAY_SIZE];
} lights;
// Shading model
uniform float u_roughness;
uniform float u_subsurface;
uniform float u_sheen;
uniform float u_sheen_tint;
// Transfer Function
uniform TransferFunction
{
	int media_array_size;
	Medium media_array[MAX_TF_ARRAY_SIZE];
} tf;
// Camera uniforms
uniform vec3 u_eye_position;
uniform mat4 u_view_inv;
uniform mat4 u_projection_inv;

/* ---------OUTPUT---------- */
/* ------------------------- */
out vec4 o_color;

/* ------LOCAL METHODS------ */
/* ------------------------- */

// Computes intersection with an axis aligned cube
// Code from:
// https://tavianator.com/2011/ray_box.html
// TODO: fix division by zero (see code in the link)
Hit ray_cube_intersection(const Ray ray, const vec3 bbox_min, const vec3 bbox_max)
{
	float tmin = -1e20;
	float tmax = 1e20;

	// bbox axis intersection parameters
	float t0x = (bbox_min.x - ray.origin.x) / ray.direction.x;
	float t1x = (bbox_max.x - ray.origin.x) / ray.direction.x;
	tmin = max(tmin, min(t0x, t1x));
	tmax = min(tmax, max(t0x, t1x));

	float t0y = (bbox_min.y - ray.origin.y) / ray.direction.y;
	float t1y = (bbox_max.y - ray.origin.y) / ray.direction.y;
	tmin = max(tmin, min(t0y, t1y));
	tmax = min(tmax, max(t0y, t1y));

	float t0z = (bbox_min.z - ray.origin.z) / ray.direction.z;
	float t1z = (bbox_max.z - ray.origin.z) / ray.direction.z;
	tmin = max(tmin, min(t0z, t1z));
	tmax = min(tmax, max(t0z, t1z));

	if (tmax < tmin)
		return miss;

	vec3 interesection = ray.origin + tmin * ray.direction;

	return Hit(tmin, tmax, interesection, vec3(0.0));
}

// Evaluates the intersections of the ray with the scene objects and returns the closest hit.
Hit evaluate(const Ray ray)
{	
	Hit closest_hit = ray_cube_intersection(ray, u_bbox_min, u_bbox_max);
  return closest_hit;
}

vec4 sample_voxel(vec3 sample_point)
{
	vec3 uv_coords = (sample_point + 1.0) * 0.5;
	// Temporary fix to flip the texture y-axis
	uv_coords.y = 1.0 - uv_coords.y;

	return texture(u_volume_texture, uv_coords);
}

vec3 compute_gradient(vec3 sample_point, float delta)
{
	float x_pos = sample_voxel(vec3(sample_point.x + delta, sample_point.yz)).r;
	float x_neg = sample_voxel(vec3(sample_point.x - delta, sample_point.yz)).r;

	float y_pos = sample_voxel(vec3(sample_point.x, sample_point.y + delta, sample_point.z)).r;
	float y_neg = sample_voxel(vec3(sample_point.x, sample_point.y - delta, sample_point.z)).r;

	float z_pos = sample_voxel(vec3(sample_point.xy, sample_point.z + delta)).r;
	float z_neg = sample_voxel(vec3(sample_point.xy, sample_point.z - delta)).r;

	// NOTE: Had to put minus in front, otherwise normal were pointing in the wrong direction for the shading models
	return -vec3(x_pos - x_neg, y_pos - y_neg, z_pos - z_neg) / (2.0 * delta);
}

float fresnel_schlick(float value)
{
	// equivalent to pow(1 - value, 5.0) with less multiplication instructions
	float clamped = clamp(1.0 - value, 0.0, 1.0);
	float value2 = clamped * clamped;
	return value2 * value2 * value; 
}

vec3 lambert_diffuse(vec4 medium_color, vec3 N, Light light)
{
	vec3 L = normalize(light.position);
	float NdotL = dot(N, L);

	return light.intensity * NdotL * medium_color.rgb;
}

vec3 disney_diffuse(vec4 medium_color, vec3 sample_point, vec3 N, Light light)
{
	// Base Diffuse
	// ThetaL = dot(N, L)
	// ThetaV = dot(N, V)
	// ThetaD = dot(L, H)
	// FD90 = 0.5 + 2 * roughness * cos^2ThetaD
	// base_diffuse = (baseColor / pi) * (1 + (FD90 - 1) * (1 - cosThetaL) ^ 5) * (1 + (FD90 - 1) * (1 - cosThetaV) ^ 5)
	vec3 L = normalize(light.position);
	vec3 V = normalize(u_eye_position - sample_point);
	vec3 H = normalize(L + V);
	float LdotH = dot(L, H);
	float NdotL = dot(N, L);
	float NdotV = dot(N, V);

	if (NdotL < 0.0)
	{
		// L *= -1.0;
		// H = normalize(L + V);
		// LdotH = dot(L, H);
		// NdotL = dot(N, L);
		return vec3(0.0);
	}

	float FD90 = 0.5 + 2.0 * u_roughness * LdotH * LdotH;
	// NOTE: ? This is the rewritten formula from the Disney 2012 paper, however not equivalent to the code below, possibly for cases
	// where dot product is < 0 -> needs to be clamped?
	// vec3 base_diffuse = (1.0 + (FD90 - 1.0) * pow(1.0 - NdotL, 5.0)) * (1.0 + (FD90 - 1.0) * pow(1.0 - NdotV, 5.0));

	// Code below from: https://github.com/wdas/brdf/blob/main/src/brdfs/disney.brdf
	float FL = fresnel_schlick(NdotL);
	float FV = fresnel_schlick(NdotV);
	float base_diffuse = mix(1.0, FD90, FL) * mix(1.0, FD90, FV);

	// Subsurface diffuse
	float FSS90 = LdotH * LdotH * u_roughness;
	float FSS = mix(1.0, FSS90, FL) * mix(1.0, FSS90, FV);
	float subsurface_diffuse = 1.25 * (FSS * (1.0 / (NdotL + NdotV) - 0.5) + 0.5);

	// Sheen (Fabric effect)
	// NOTE: sheen seems to behave oddly. Perhaps because of the transparency of the rendered data (color accumulates under the surface)
	// The resulting image gets brighter as a whole as sheen and sheen tint values increase 

	float luminescence = 0.3 * medium_color.r + 0.6 * medium_color.g  + 0.1 * medium_color.b; // approximation
	vec3 tint_comp = luminescence > 0.0 ? medium_color.rgb / luminescence : vec3(1.0);
	vec3 sheen_comp = mix(vec3(1.0), tint_comp, u_sheen_tint);

	float FH = fresnel_schlick(LdotH);
	vec3 sheen_color = FH * u_sheen * sheen_comp;

	// TEMP: Scale PI by 0.5 to make image brighter
	vec3 diffuse = (1.0 / (PI)) * mix(base_diffuse, subsurface_diffuse, u_subsurface) + sheen_color;

	return light.intensity * medium_color.rgb * diffuse;
}

vec4 sample_volume(vec3 ray_direction, vec3 first_interesection, float volume_travel_distance)
{
	vec3 sample_point = first_interesection;
	vec4 color = vec4(0.0);

	while (volume_travel_distance >= 0.0 && color.a < 1.0)
	{
		vec4 float_sample_color = sample_voxel(sample_point);

		// AIR SKIP 
		// TODO: read the value from a uniform
		if (float_sample_color.r < AIR_UPPER_LIMIT)
		{
			sample_point += ray_direction * u_step_size;
			volume_travel_distance -= u_step_size;
			continue;
			// color += vec4(tf.media_array[0].color.rgb * tf.media_array[0].color..a, tf.media_array[0].color.a);
		}

		// NOTE: Think about different color multiplier and opacity addition
		for(int i = 0; i < tf.media_array_size; ++i)
		{
			vec2 medium_itv = tf.media_array[i].interval;
			vec4 medium_color = tf.media_array[i].color;

			if (float_sample_color.r >= medium_itv.x && float_sample_color.r < medium_itv.y)
			{
				vec3 gradient = compute_gradient(sample_point, u_default_step_size);
				vec3 normal = normalize(gradient);	
				
				vec3 diffuse_color = vec3(0.0); 

				switch(u_shading_model)
				{
					case DISNEY:
						for (int l = 0; l < lights.lights_array_size; ++l)
						{
							diffuse_color += disney_diffuse(medium_color, sample_point, normal, lights.lights_array[l]);
						}
						break;
					case LAMBERT:
						for (int l = 0; l < lights.lights_array_size; ++l)
						{
							diffuse_color += lambert_diffuse(medium_color, normal, lights.lights_array[l]);
						}
						break;
					case NORMAL:
						diffuse_color = vec3((normal + 1.0) * 0.5);
						break;
					case POSITION:
						diffuse_color = sample_point;
						break;
				}

				// TODO: alpha should be consistent for all step sizes so: alpha = medium_alpha * (step size / reference step size)
				float available_alpha = min(medium_color.a, 1.0 - color.a);
				color += vec4(diffuse_color * available_alpha, available_alpha);
				break;
			}
		}

		sample_point += ray_direction * u_step_size;
		volume_travel_distance -= u_step_size;
	}

	return color;
}

// Traces the ray trough the scene and accumulates the color.
vec4 trace(Ray ray) 
{
  // The accumulated color used when tracing the rays through the scene.
	vec4 color = vec4(0.0);

  int bounces = 0;

	for (int i = 0; i < bounces + 1; ++i) 
	{
		Hit hit = evaluate(ray);

		// First intersection depth, costs some perfomance
		if (i == 0) 
			gl_FragDepth = (1.0 / hit.t_first - 1.0) / -0.999; // (1.0 / hit.t - 1.0 / near) / (1.0 / far - 1.0 / near)
		
		if (hit.t_first == miss.t_first)
			break;
    
		color += sample_volume(ray.direction, hit.intersection, hit.t_last - hit.t_first);
  }

	vec4 background_color = vec4(0.15, 0.2, 0.2, 1.0);
	if (color.a == 0.0)
		color = background_color;

  return color;
}

void main()
{
  vec3 ray_origin = (u_view_inv * u_projection_inv * vec4(var.tex_coord * 2.0 - 1.0, -1.0, 1.0)).xyz;
  vec3 ray_direction = normalize(ray_origin - u_eye_position);

  vec4 color = trace(Ray(ray_origin, ray_direction));

	o_color = color;
}
