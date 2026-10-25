#version 300 es
precision mediump float;
precision mediump sampler3D;

/* --------CONSTANTS-------- */
/* ------------------------- */
// Math
#define PI 3.14159265358979323846
// Array size
#define MAX_TF_ARRAY_SIZE 3
#define MAX_SHADING_INDICES 2
// Render mode
const int DICOM = 0;
const int SPHERE_DEBUG = 1;
// Variable macros
#define DISTANCE_MAP_CHANNEL g
#define TRAVEL_DISTANCE_CHANNEL a

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

struct TransferFunctionMedium
{
	vec4 color;
	vec2 interval;
};

struct VolumeMedium
{
	int tf_index;
	int shd_indices[MAX_SHADING_INDICES];
	int shading_count;
	int channel;
	bool enabled;
};

/* -----LOCAL VARIABLES----- */
/* ------------------------- */
const Hit miss = Hit(1e20, 1e20, vec3(0.0), vec3(0.0));
const vec4 no_sample_point = vec4(1e10, 1e10, 1e10, -1.0);
int heat_counter = 0;

/* ----------INPUT---------- */
/* ------------------------- */
in VaryingData var;

/* --------UNIFORMS--------- */
/* ------------------------- */
// Render mode
uniform int u_mode;
// Previous ray-trace pass sample point texture
uniform sampler2D u_end_sample_point_texture;
// Volume data texture
uniform sampler3D u_volume_texture;
// Bounding box lower left corner
uniform vec3 u_bbox_min;
// Bounding box upper right corner
uniform vec3 u_bbox_max;
// Ray Tracing
uniform float u_step_size;
// Volume Medium index
uniform int u_vm_index;
// Early stop
uniform bool u_use_early_stop_texture;
// Debug
uniform float u_heatmap_div;
// Camera uniforms
uniform vec3 u_eye_position;
uniform mat4 u_view_inv;
uniform mat4 u_projection_inv;
// Transfer Function array
uniform TransferFunction
{
	TransferFunctionMedium array[MAX_TF_ARRAY_SIZE];
	int array_size;
} tf;
// Volume Media array
uniform VolumeMedia
{
 	VolumeMedium array[MAX_TF_ARRAY_SIZE];
	int array_size;
} vm;

/* ---------OUTPUT---------- */
/* ------------------------- */
layout (location = 0) out vec4 o_sample_point;
layout (location = 1) out vec4 o_heat_color;

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

Hit ray_sphere_intersection(Ray ray, vec3 center, float radius)
{
	float tmin = -1e20;
	float tmax = 1e20;

	vec3 oc = ray.origin - center;
	float b = dot(oc, ray.direction);
	float c = dot(oc, oc) - radius*radius;
	float det = b*b - c;

	if (det < 0.0)
		return miss;

	tmin = -b - sqrt(det);

	if (tmin < 0.0)
		tmin = 0.0;

	tmax = -b + sqrt(det);

	vec3 intersection = ray.origin + tmin * ray.direction;

	return Hit(tmin, tmax, intersection, normalize(intersection - center));
}

// Evaluates the intersections of the ray with the scene objects and returns the closest hit.
Hit evaluate(const Ray ray)
{	
	switch(u_mode)
	{
		case DICOM:
			return ray_cube_intersection(ray, u_bbox_min, u_bbox_max);
		case SPHERE_DEBUG:
			return ray_sphere_intersection(ray, vec3(0.0), 1.0);
		default:
			return Hit(0.0, 0.0, vec3(0.0), vec3(0.0));
	}
}

vec3 get_uvw_coords(vec3 sample_point)
{
	vec3 uvw_coords = (sample_point + 1.0) * 0.5;
	// Temporary fix to flip the texture y-axis
	uvw_coords.y = 1.0 - uvw_coords.y;

	return uvw_coords;
}

vec4 sample_voxel(vec3 sample_point)
{
	vec3 uvw_coords = get_uvw_coords(sample_point);
	return texture(u_volume_texture, uvw_coords);
}

vec4 get_sample_color(vec3 sample_point)
{
	switch(u_mode)
	{
		case DICOM:
			return sample_voxel(sample_point);
		case SPHERE_DEBUG:
			return vec4(tf.array[vm.array[vm.array_size - 1].tf_index].interval.x);
	}
}

vec2 get_medium_interval(int vm_index)
{
	switch(u_mode)
	{
		case DICOM:
			return tf.array[vm.array[vm_index].tf_index].interval;
		case SPHERE_DEBUG:
			return tf.array[vm.array[vm.array_size - 1].tf_index].interval; // TODO: index of 1 selected medium
	}
}

vec4 sample_volume(vec3 ray_direction, vec3 first_interesection, float volume_travel_distance)
{
	vec4 sample_point = vec4(first_interesection, -1.0);

	float max_volume_travel_distance = volume_travel_distance;

	while (volume_travel_distance >= 0.0)
	{
		++heat_counter;

		vec4 float_sample_color = get_sample_color(sample_point.xyz);

		// EUCLIDEAN DISTANCE TO NON-AIR VOXELS SKIP
		float distance = float_sample_color.DISTANCE_MAP_CHANNEL; // squared distance in voxels
		if (u_mode == DICOM && distance > 1.0)
		{
			float stride = max((sqrt(distance) - 1.0), 1.0) / 256.0; // 256 = textureSize.x / 2.0 as sampled cube is <-1, 1>
			// TODO: use stride vector
			// vec3 strideVec = 2.0 * vec3(stride) / textureSize(u_volume_texture, 0);
			sample_point.xyz += ray_direction * stride;
			volume_travel_distance -= stride;
			continue;
		}

		// TODO: send vms that are relevant for this raytrace pass
		// NOTE: Option to not send disabled media to the GPU for performance improvement
		if (!vm.array[u_vm_index].enabled)
			return no_sample_point;

		vec2 medium_itv = get_medium_interval(u_vm_index);
		int medium_channel = vm.array[u_vm_index].channel;

		if (float_sample_color[medium_channel] >= medium_itv.x && float_sample_color[medium_channel] < medium_itv.y)
			return vec4(sample_point.xyz, max_volume_travel_distance - volume_travel_distance);

		sample_point.xyz += ray_direction * u_step_size;
		volume_travel_distance -= u_step_size;
	}

	return no_sample_point;
}

// Traces the ray trough the scene and accumulates the color.
vec4 trace(Ray ray) 
{
  int bounces = 0;

	vec4 sample_point = no_sample_point;

	for (int i = 0; i < bounces + 1; ++i) 
	{
		Hit hit = evaluate(ray);
		
		if (hit.t_first == miss.t_first)
			break;

		float cube_travel_distance = hit.t_last - hit.t_first;
		float early_stop_distance = 1e10;

		// Stop at other opaque medium
		if (u_use_early_stop_texture)
		{
			float travel_distance = texture(u_end_sample_point_texture, var.tex_coord).TRAVEL_DISTANCE_CHANNEL;
			if (travel_distance >= 0.0)
				early_stop_distance = travel_distance;
		}
    
		sample_point = sample_volume(ray.direction, hit.intersection, min(cube_travel_distance, early_stop_distance));
  }

  return sample_point;
}

vec3 heatmap(float t)
{
	t = clamp(t, 0.0, 1.0);
	vec3 cold = vec3(0.0, 0.2, 1.0);        // blue
	vec3 mid  = vec3(1.0, 0.6, 0.0);        // orange
	vec3 hot  = vec3(1.0, 0.0, 0.0);        // red
	return t < 0.5
		? mix(cold, mid, t * 2.0)
		: mix(mid, hot, (t - 0.5) * 2.0);
}

void main()
{
  vec3 ray_origin = (u_view_inv * u_projection_inv * vec4(var.tex_coord * 2.0 - 1.0, -1.0, 1.0)).xyz;
  vec3 ray_direction = normalize(ray_origin - u_eye_position);

  vec4 sample_point = trace(Ray(ray_origin, ray_direction));

 	float heat = float(heat_counter) / u_heatmap_div;
	o_heat_color = vec4(heatmap(heat), 1.0);

	o_sample_point = sample_point;
}
