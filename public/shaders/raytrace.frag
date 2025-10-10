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

/* -----LOCAL VARIABLES----- */
/* ------------------------- */
const RayIntersectionData no_intersection = RayIntersectionData(1e20, vec3(0.0), vec3(0.0));
const Hit miss = Hit(1e20, 1e20, vec3(0.0), vec3(0.0));

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
// Transfer Function
uniform vec2 u_itv_air;
uniform vec4 u_color_air;
uniform vec2 u_itv_lungs;
uniform vec4 u_color_lungs;
uniform vec2 u_itv_fat;
uniform vec4 u_color_fat;
uniform vec2 u_itv_water;
uniform vec4 u_color_water;
uniform vec2 u_itv_muscle;
uniform vec4 u_color_muscle;
uniform vec2 u_itv_soft_tissue_contrast;
uniform vec4 u_color_soft_tissue_contrast;
uniform vec2 u_itv_bone_cancellous;
uniform vec4 u_color_bone_cancellous;
uniform vec2 u_itv_bone_cortical;
uniform vec4 u_color_bone_cortical;
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

vec4 sample_volume(vec3 ray_direction, vec3 first_interesection, float volume_travel_distance)
{
	vec3 sample_point = first_interesection;
	// TODO: make step_size adjustable uniform
	const float default_step_size = 0.005;
	// const float air_jump_factor = 0.1;
	float step_size = default_step_size;
	vec4 color = vec4(0.0);

	// TODO: use UBOs and loop over array of tf invtervals and values
	vec2 media_itv[6] = vec2[6](
		u_itv_lungs,
		u_itv_fat,
		// u_itv_water,
		u_itv_muscle,
		u_itv_soft_tissue_contrast,
		u_itv_bone_cancellous,
		u_itv_bone_cortical
	);

	vec4 media_color[6] = vec4[6](
		u_color_lungs,
		u_color_fat,
		// u_color_water,
		u_color_muscle,
		u_color_soft_tissue_contrast,
		u_color_bone_cancellous,
		u_color_bone_cortical
	);

	while (volume_travel_distance >= 0.0 && color.a < 1.0)
	{
		vec4 float_sample_color = sample_voxel(sample_point);

		// AIR SKIP // TIDO: try air jumps with uitv <0, 20>
		if (float_sample_color.r < u_itv_air.y)
		{
			sample_point += ray_direction * step_size;
			volume_travel_distance -= step_size;
			continue;
			// color += vec4(u_color_air.rgb * u_color_air.a, u_color_air.a);
		}

		// NOTE: Think about different color multiplier and opacity addition
		for(int i = 0; i < 6; ++i)
		{
			vec2 medium_itv = media_itv[i];
			vec4 medium_color = media_color[i];

			if (float_sample_color.r > medium_itv.x && float_sample_color.r < medium_itv.y)
			{
				color += vec4(medium_color.rgb * medium_color.a, medium_color.a);
				break;
			}
		}

		sample_point += ray_direction * step_size;
		volume_travel_distance -= step_size;
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
