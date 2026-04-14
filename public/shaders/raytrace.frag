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
const vec3 UP_VECTOR = vec3(0.0, 1.0, 0.0);
const vec4 GROUND_COLOR = vec4(0.15, 0.2, 0.2, 1.0);
const vec4 SKY_COLOR = vec4(0.36f, 0.64f, 0.64f, 1.0f);
const vec4 DIRECTION_COLOR = vec4(0.54f, 0.25f, 0.5f, 1.0f);
const vec4 DIRECTION_COLOR2 = vec4(0.83f, 0.54f, 0.09f, 1.0f);
const RayIntersectionData no_intersection = RayIntersectionData(1e20, vec3(0.0), vec3(0.0));
const Hit miss = Hit(1e20, 1e20, vec3(0.0), vec3(0.0));
// Render mode
const int DICOM = 0;
const int SPHERE_DEBUG = 1;
// Shading model
const int STYLIZED = 0;
const int DISNEY = 1;
const int BLINN_PHONG = 2;
const int LAMBERT = 3;
const int NORMAL = 4;
const int POSITION = 5;
const int CUBEMAP = 6;

/* ----------INPUT---------- */
/* ------------------------- */
in VaryingData var;

/* --------UNIFORMS--------- */
/* ------------------------- */
// Render mode
uniform int u_mode;
// Material texture
uniform sampler2D u_material_texture;
// Cube Map texture
uniform samplerCube u_cube_map_texture;
// Volume data texture
uniform sampler3D u_volume_texture;
// Bounding box lower left corner
uniform vec3 u_bbox_min;
// Bounding box upper right corner
uniform vec3 u_bbox_max;
// Ray Tracing
uniform float u_step_size;
uniform float u_gradient_delta;
uniform float u_curvature_delta_multiplier;
uniform int u_shading_model;
// Light
uniform Lights {
	int lights_array_size;
	Light lights_array[MAX_LIGHT_ARRAY_SIZE];
} lights;
// Stylized shading model
uniform float u_alpha;
uniform float u_tau;
uniform float u_lambda;
uniform float u_mu;
uniform float u_chi;
uniform float u_beta;
uniform float u_gamma;
// Disney shading model
uniform float u_roughness;
uniform float u_subsurface;
uniform float u_sheen;
uniform float u_sheen_tint;
uniform float u_specular;
uniform float u_specular_tint;
uniform float u_anisotropic;
uniform float u_metallic;
uniform float u_clearcoat;
uniform float u_clearcoat_gloss;
// Blinn-Phong shading model
uniform float u_shininess;
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

vec4 sample_voxel(vec3 sample_point)
{
	vec3 uv_coords = (sample_point + 1.0) * 0.5;
	// Temporary fix to flip the texture y-axis
	uv_coords.y = 1.0 - uv_coords.y;

	return texture(u_volume_texture, uv_coords);
}

vec3 compute_gradient(vec3 sample_point, float delta)
{
	// NOTE: Sadly WebGL doesn't support GL_CLAMP_TO_BORDER nor border color so edge cases
	// have to be dealt with manually

	float x_delta_pos = sample_point.x + delta;
	float x_pos = sample_voxel(vec3(x_delta_pos, sample_point.yz)).r * step(x_delta_pos, 1.0);

	float x_delta_neg = sample_point.x - delta;
	float x_neg = sample_voxel(vec3(x_delta_neg, sample_point.yz)).r * step(-1.0, x_delta_neg);

	float y_delta_pos = sample_point.y + delta;
	float y_pos = sample_voxel(vec3(sample_point.x, y_delta_pos, sample_point.z)).r * step(y_delta_pos, 1.0);
	
	float y_delta_neg = sample_point.y - delta;
	float y_neg = sample_voxel(vec3(sample_point.x, y_delta_neg, sample_point.z)).r * step(-1.0, y_delta_neg);

	float z_delta_pos = sample_point.z + delta;
	float z_pos = sample_voxel(vec3(sample_point.xy, z_delta_pos)).r * step(z_delta_pos, 1.0);

	float z_delta_neg = sample_point.z - delta;
	float z_neg = sample_voxel(vec3(sample_point.xy, z_delta_neg)).r * step(-1.0, z_delta_neg);

	return vec3(x_pos - x_neg, y_pos - y_neg, z_pos - z_neg) / (2.0 * delta);
}

mat3 compute_hessian(vec3 p, float delta)
{
    vec3 g_x_pos = compute_gradient(vec3(p.x + delta, p.yz), delta);
    vec3 g_x_neg = compute_gradient(vec3(p.x - delta, p.yz), delta);

    vec3 g_y_pos = compute_gradient(vec3(p.x, p.y + delta, p.z), delta);
    vec3 g_y_neg = compute_gradient(vec3(p.x, p.y - delta, p.z), delta);

    vec3 g_z_pos = compute_gradient(vec3(p.xy, p.z + delta), delta);
    vec3 g_z_neg = compute_gradient(vec3(p.xy, p.z - delta), delta);

    vec3 row_x = (g_x_pos - g_x_neg) / (2.0 * delta);
    vec3 row_y = (g_y_pos - g_y_neg) / (2.0 * delta);
    vec3 row_z = (g_z_pos - g_z_neg) / (2.0 * delta);

    // mat3 is column-major in GLSL, so transpose to get rows right
    return mat3(
			row_x.x, row_y.x, row_z.x,   // col 0
			row_x.y, row_y.y, row_z.y,   // col 1
			row_x.z, row_y.z, row_z.z    // col 2
    );
}

float compute_curvature(vec3 sample_point)
{
	if (u_mode == SPHERE_DEBUG)
		return 1.0;

	vec3  g = compute_gradient(sample_point, u_gradient_delta);
	mat3  H = compute_hessian(sample_point, u_curvature_delta_multiplier * u_gradient_delta);

	float gx = g.x, gy = g.y, gz = g.z;
	float g2 = dot(g, g);        // |∇F|²
	float g1 = sqrt(g2);         // |∇F|

	// --- Mean curvature ---
	// H = -div(∇F / |∇F|) / 2, expanded analytically
	float num_H =
			H[0][0] * (gy*gy + gz*gz)
		+ H[1][1] * (gx*gx + gz*gz)
		+ H[2][2] * (gx*gx + gy*gy)
		- 2.0 * H[1][0] * gx*gy
		- 2.0 * H[2][0] * gx*gz
		- 2.0 * H[2][1] * gy*gz;

	return -num_H / (2.0 * g2 * g1);
}

float sqr(float x) 
{ 
	return x * x; 
}

float fresnel_schlick(float value)
{
	// equivalent to pow(1 - value, 5.0) with less multiplication instructions
	float clamped = clamp(1.0 - value, 0.0, 1.0);
	float value2 = clamped * clamped;
	return value2 * value2 * value; 
}

float GTR1(float NdotH, float a)
{
	if (a >= 1.0) 
		return 1.0 / PI;

	float a2 = a*a;
	float t = 1.0 + (a2 - 1.0) * NdotH * NdotH;
	return (a2 - 1.0) / (PI * log(a2) * t);
}

float GTR2(float NdotH, float a)
{
	float a2 = a * a;
	float t = 1.0 + (a2 - 1.0) * NdotH * NdotH;
	return a2 / (PI * t * t);
}

float smithG_GGX(float NdotV, float alphaG)
{
    float a = alphaG * alphaG;
    float b = NdotV * NdotV;
    return 1.0 / (NdotV + sqrt(a + b - a * b));
}

float GTR2_aniso(float NdotH, float HdotX, float HdotY, float ax, float ay)
{
    return 1.0 / (PI * ax * ay * sqr( sqr(HdotX / ax) + sqr(HdotY / ay) + NdotH * NdotH));
}

float smithG_GGX_aniso(float NdotV, float VdotX, float VdotY, float ax, float ay)
{
    return 1.0 / (NdotV + sqrt( sqr(VdotX * ax) + sqr(VdotY * ay) + sqr(NdotV) ));
}

vec3 mon2lin(vec3 color)
{
    return vec3(pow(color[0], 2.2), pow(color[1], 2.2), pow(color[2], 2.2));
}

vec3 shade_lambert(vec4 medium_color, vec3 N, Light light)
{
	vec3 L = normalize(light.position);
	float NdotL = max(dot(N, L), 0.0);

	return light.intensity * NdotL * medium_color.rgb;
}

vec3 shade_blinn_phong(vec4 medium_color, vec3 sample_point, vec3 N, Light light)
{
	vec3 L = normalize(light.position);
	vec3 V = normalize(u_eye_position - sample_point);
	vec3 H = normalize(L + V);
	float NdotH = max(dot(N, H), 0.0001);
	float NdotL = max(dot(N, L), 0.0);

	return light.intensity * NdotL * (medium_color.rgb + pow(NdotH, u_shininess)); 
}

vec3 shade_disney(vec4 medium_color, vec3 sample_point, vec3 N, Light light)
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

	NdotV = clamp(NdotV, 0.0, 1.0);

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

	// medium_color.rgb = 3.0 * mon2lin(medium_color.rgb);
	// medium_color = texture(u_material_texture, abs(N.xy));

	float luminescence = 0.3 * medium_color.r + 0.6 * medium_color.g  + 0.1 * medium_color.b; // approximation
	vec3 tint_comp = luminescence > 0.0 ? medium_color.rgb / luminescence : vec3(1.0);
	vec3 sheen_comp = mix(vec3(1.0), tint_comp, u_sheen_tint);

	float FH = fresnel_schlick(LdotH);
	vec3 sheen_color = FH * u_sheen * sheen_comp;

	vec3 diffuse = medium_color.rgb * (1.0 / PI) * mix(base_diffuse, subsurface_diffuse, u_subsurface) + sheen_color;

	float NdotH = dot(N,H);
	// surface tangent and bitanget for anisotropy:
	vec3 help_vector = abs(N.y) > 0.99999999 ? vec3(1.0, 0.0, 0.0) : UP_VECTOR;
	vec3 X = normalize(cross(N, help_vector));
	vec3 Y = normalize(cross(N, X));
	vec3 specular0_comp = mix(u_specular * 0.08 * mix(vec3(1.0), tint_comp, u_specular_tint), medium_color.rgb, u_metallic);
	// specular
	float aspect = sqrt(1.0 - u_anisotropic * 0.9);
	float ax = max(0.001, sqr(u_roughness) / aspect);
	float ay = max(0.001, sqr(u_roughness) * aspect);
	float Ds = GTR2_aniso(NdotH, dot(H, X), dot(H, Y), ax, ay);
	// float FH = fresnel_schlick(LdotH);
	vec3 Fs = mix(specular0_comp, vec3(1.0), FH);
	float Gs;
	Gs  = smithG_GGX_aniso(NdotL, dot(L, X), dot(L, Y), ax, ay);
	Gs *= smithG_GGX_aniso(NdotV, dot(V, X), dot(V, Y), ax, ay);

	// clearcoat (ior = 1.5 -> F0 = 0.04)
	float Dr = GTR1(NdotH, mix(0.1, 0.001, u_clearcoat_gloss));
	float Fr = mix(0.04, 1.0, FH);
	float Gr = smithG_GGX(NdotL, 0.25) * smithG_GGX(NdotV, 0.25);

	// TODO: environment mapping
	return light.intensity * NdotL * (diffuse * (1.0 - u_metallic) + Gs * Fs * Ds + 0.25 * u_clearcoat * Gr * Fr * Dr);
}

// u: S^2 X S^2 X S^2 -> [0, PI]
float u(vec3 sample_point, vec3 n, vec3 l, vec3 v)
{
	// Anisotropy of the specular highlight
	vec3 help_vector = abs(n.y) > 0.99999999 ? vec3(1.0, 0.0, 0.0) : UP_VECTOR;
	vec3 t = normalize(cross(n, help_vector));
	vec3 b = normalize(cross(n, t));
	vec3 h = normalize(l + v);
	float eta = dot(l, v) * 0.5 + 0.5;
	float S_l = u_lambda >= 0.0 
		? 1.0 / (1.0 - u_lambda) * eta + (1.0 - eta)
		: 1.0 / (1.0 / (1.0 + u_lambda) * eta + (1.0 - eta));

		// Q: should tangent space t,b,n be used?
		vec3 ht = dot(h, t) * t;
		vec3 hb = dot(h, b) * b;
		vec3 hn = dot(h, n) * n;

		h = normalize(S_l * ht + 1.0 / S_l * hb + hn);
		v = reflect(-l, h);

		// Light response d_alpha
		vec3 r = reflect(-v, n);
		vec3 d = normalize((1.0 - u_alpha) * n + u_alpha * r);

	// Curvature
	float kappa = compute_curvature(sample_point);

	// Offset tau based on local surface curvature
	float tau = u_tau + (u_mu * tanh(kappa * u_chi));

	// angular response u
	return clamp(acos(dot(d, l)) - tau, 0.0, PI);
}

// I: [0, PI] -> [0, 1]
float I(float u)
{
	return pow(max(u_beta + (1.0 - u_beta) * cos(u), 0.0), u_gamma);
}

vec4 shade_stylized(vec4 medium_color, vec3 sample_point, vec3 n, Light light)
{
	// description:
	// n 				normal
	// l 				light vector
	// v 				view vector
	// r 				reflected view vector around the surface normal

	// u(n,l,v)	[0, PI] angular parametrization, parameters: alpha, tau, lambda, mu, chi
	// alpha 		[0, 1] user controlled, interpolated diffuse (0) and specular (1) shading
	// tau 			[-PI or 0, PI] user controlled  extent of a shading primitive
	// lambda		<-1, 1> user controlled anisotropy
	// mu				<-INF, INF> magnitude of surface enhancement
	// chi			<-INF, INF> slope of transition between concave (kappa < 0) and convec (kappa > 0) features
	// d_alpha 	reference direction for light movement

	// K(u)			[0, 1] color profile uses u as a parameter for a color ramp

	// I(u)			[0, 1] intensity profile = alpha value, parameters: beta, gamma
	// beta			[-0.5, 0.5] allows to extend primitive intensity toward the interval [0.5*PI, PI]
	// gamma		<0, INF> intensity fall of rate

	vec3 l = normalize(light.position);
	vec3 v = normalize(u_eye_position - sample_point);

	float u = u(sample_point, n, l, v);
	float I = I(u);

	// TODO: use a color ramp
	// NOTE: possible to use color ramps for concave/convex transitions
	// PI - u / PI is a fake color ramp
	// NOTE: use alpha = I for layering

	// intensity driven purely by the function
	// return vec4(light.intensity * I * medium_color.rgb * (PI - u) / PI, I);

	// alpha affects intensity
	return vec4(light.intensity * medium_color.a * I * mix(vec3(1.0), medium_color.rgb, (PI - u) / PI), I * medium_color.a);

	// test curvature
	// return vec4(vec3(compute_curvature(sample_point)), 1.0);
	// test u()
	// return vec4(vec3(u(sample_point, n, l, v)) / PI, 1.0);
	// test I()
	// return vec4(vec3(I), 1.0);
}


vec4 shade(vec4 medium_color, vec3 sample_point, vec3 normal)
{
	vec4 color = vec4(0.0); 

	switch(u_shading_model)
	{
		case STYLIZED:
			for (int l = 0; l < lights.lights_array_size; ++l)
			{
				color += shade_stylized(medium_color, sample_point, normal, lights.lights_array[l]);
			}
			break;
		case DISNEY:
			for (int l = 0; l < lights.lights_array_size; ++l)
			{
				color += vec4(shade_disney(medium_color, sample_point, normal, lights.lights_array[l]), 1.0);
			}
			break;
		case BLINN_PHONG:
			for (int l = 0; l < lights.lights_array_size; ++l)
			{
				color += vec4(shade_blinn_phong(medium_color, sample_point, normal, lights.lights_array[l]), 1.0);
			}
			break;
		case LAMBERT:
			for (int l = 0; l < lights.lights_array_size; ++l)
			{
				color += vec4(shade_lambert(medium_color, normal, lights.lights_array[l]), 1.0);
			}
			break;
		case NORMAL:
			color = vec4(vec3((normal + 1.0) * 0.5), 1.0);
			break;
		case POSITION:
			color = vec4(sample_point, 1.0);
			break;
		case CUBEMAP:
			color = texture(u_cube_map_texture, normal);
			break;
	}

	return color;
}

vec4 get_sample_color(vec3 sample_point)
{
	switch(u_mode)
	{
		case DICOM:
			return sample_voxel(sample_point);
		case SPHERE_DEBUG:
			return vec4(tf.media_array[tf.media_array_size - 1].interval.x);
	}
}

vec2 get_medium_interval(int index)
{
	switch(u_mode)
	{
		case DICOM:
			return tf.media_array[index].interval;
		case SPHERE_DEBUG:
			return tf.media_array[tf.media_array_size - 1].interval; // TODO: index of 1 selected medium
	}
}

vec4 get_medium_color(int index)
{
	switch(u_mode)
	{
		case DICOM:
			return tf.media_array[index].color;
		case SPHERE_DEBUG:
			return tf.media_array[tf.media_array_size - 1].color; // TODO: index of 1 selected medium
	}
}

vec3 get_shading_normal(vec3 sample_point, vec3 surface_normal)
{
	vec3 result;
	switch(u_mode)
	{
		case DICOM:
			result = -compute_gradient(sample_point, u_gradient_delta);
			break;
		case SPHERE_DEBUG:
			result = surface_normal;
			break;
	}

	return normalize(result);
}

vec4 sample_volume(vec3 ray_direction, vec3 first_interesection, vec3 surface_normal, float volume_travel_distance)
{
	vec3 sample_point = first_interesection;
	vec4 color = vec4(0.0);

	bool skin_colored = false;

	while (volume_travel_distance >= 0.0 && color.a < 1.0)
	{
		vec4 float_sample_color = get_sample_color(sample_point);

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
			vec2 medium_itv = get_medium_interval(i);
			vec4 medium_color = get_medium_color(i);

			if (float_sample_color.r < medium_itv.x || float_sample_color.r >= medium_itv.y)
				continue;

			vec3 normal = get_shading_normal(sample_point, surface_normal);
			
			// TODO: do systematically
			if (!skin_colored)
			{
				color += shade(medium_color, sample_point, normal);
				skin_colored = true;
			}
			else
			{
				color += vec4(0.9f, 0.7f, 0.47f, 1.0f) * (1.0 - color.a) * u_step_size;
				return color;
			}
			// TODO: Return only if not using volume shading
			// return color;


			// TODO: alpha should be consistent for all step sizes so: alpha = medium_alpha * (step size / reference step size)
			// float available_alpha = min(medium_color.a, 1.0 - color.a);
			// color += vec4(diffuse_color * available_alpha, available_alpha);
			break;
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
    
		color += sample_volume(ray.direction, hit.intersection, hit.normal, hit.t_last - hit.t_first);
  }

	vec4 background_color = ray.direction.y > 0.0 ? SKY_COLOR: GROUND_COLOR;
	background_color = mix(vec4(0.7, 0.7, 0.7, 1.0), background_color, smoothstep(0.0, 1.0, abs(ray.direction.y)));
	if (ray.direction.x > 0.0)
		background_color = mix(background_color, DIRECTION_COLOR, ray.direction.x);
		
	if (color.a == 0.0)
		color = background_color;
	else
		// NOTE: color.a was going above 1.0 when using stylized shading (it shouldn't though)
		color.rgb += background_color.rgb * max(1.0 - color.a, 0.0);

  return color;
}

void main()
{
  vec3 ray_origin = (u_view_inv * u_projection_inv * vec4(var.tex_coord * 2.0 - 1.0, -1.0, 1.0)).xyz;
  vec3 ray_direction = normalize(ray_origin - u_eye_position);

  vec4 color = trace(Ray(ray_origin, ray_direction));

	// Tone Mapping
	// color.rgb = color.rgb / (color.rgb + vec3(1.0));

	// Gamma Correction
	float gamma = 2.2;
	color.rgb = pow(color.rgb, vec3(1.0 / gamma));

	o_color = color;
}
