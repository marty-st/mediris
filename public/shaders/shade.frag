#version 300 es
precision mediump float;
precision mediump sampler3D;

/* --------CONSTANTS-------- */
/* ------------------------- */
// Math
#define PI 3.14159265358979323846
#define UP_VECTOR vec3(0.0, 1.0, 0.0)
// Array size
#define MAX_TF_ARRAY_SIZE 2
#define MAX_LIGHT_ARRAY_SIZE 5
#define MAX_LIGHT_INDICES 3
#define MAX_SHADING_ARRAY_SIZE 5
#define MAX_SHADING_INDICES 2
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

/* -------DEFINITIONS------- */
/* ------------------------- */
struct VaryingData 
{
	vec2 tex_coord;
};

struct Light
{
	vec3 position;
	float intensity;
	bool enabled;
	bool camera_relative;
};

struct TransferFunctionMedium
{
	vec4 color;
	vec2 interval;
};

struct ShadingModelParameters
{
	// Stylized shading model
	float u_alpha;
	float u_tau;
	float u_lambda;
	float u_mu;
	float u_chi;
	float u_beta;
	float u_gamma;
	// Disney shading model
	float u_roughness;
	float u_subsurface;
	float u_sheen;
	float u_sheen_tint;
	float u_specular;
	float u_specular_tint;
	float u_anisotropic;
	float u_metallic;
	float u_clearcoat;
	float u_clearcoat_gloss;
	// Blinn-Phong shading model
	float u_shininess;
};

struct Shading
{
	int params_index;
	int light_indices[MAX_LIGHT_INDICES];
	int light_count;
	int model;
	bool enabled;
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
int heat_counter = 0;

/* ----------INPUT---------- */
/* ------------------------- */
in VaryingData var;

/* --------UNIFORMS--------- */
/* ------------------------- */
// Render mode
uniform int u_mode;
// Sample Point texture
uniform sampler2D u_sample_point_texture;
// Volume data texture
uniform sampler3D u_volume_texture;
// Ray Tracing
uniform float u_step_size;
uniform float u_gradient_delta;
uniform float u_curvature_delta_multiplier;
// Debug

// Lights array
uniform Lights
{
	Light array[MAX_LIGHT_ARRAY_SIZE];
} lights;
// Shading Parameters array
uniform ShadingParameters
{
	ShadingModelParameters array[MAX_SHADING_ARRAY_SIZE];
} params;
// Shading array
uniform Shadings
{
	Shading array[MAX_SHADING_ARRAY_SIZE];
} shd;
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
// Volume Media macros
#define MEDIUM vm.array[vm_index]
#define SHADING shd.array[MEDIUM.shd_indices[s]]
#define LIGHT lights.array[shd.array[vm.array[vm_index].shd_indices[s]].light_indices[l]]
#define PARAMS params.array[shd.array[MEDIUM.shd_indices[shd_index]].params_index]
// Camera uniforms
uniform vec3 u_eye_position;
uniform mat4 u_view_inv;
uniform mat4 u_projection_inv;

/* ---------OUTPUT---------- */
/* ------------------------- */
layout (location = 0) out vec4 o_color;

/* ------LOCAL METHODS------ */
/* ------------------------- */

vec4 sample_voxel(vec3 sample_point)
{
	vec3 uv_coords = (sample_point + 1.0) * 0.5;
	// Temporary fix to flip the texture y-axis
	uv_coords.y = 1.0 - uv_coords.y;

	return texture(u_volume_texture, uv_coords);
}

vec3 compute_gradient(vec4 sample_point, float delta)
{
	// NOTE: Sadly WebGL doesn't support GL_CLAMP_TO_BORDER nor border color so edge cases
	// have to be dealt with manually
	// TODO: use dot(sample, mask) instead of dynamically accessing sample[channel]

	int channel = int(sample_point.a);

	float x_delta_pos = sample_point.x + delta;
	float x_pos = sample_voxel(vec3(x_delta_pos, sample_point.yz))[channel] * step(x_delta_pos, 1.0);

	float x_delta_neg = sample_point.x - delta;
	float x_neg = sample_voxel(vec3(x_delta_neg, sample_point.yz))[channel] * step(-1.0, x_delta_neg);

	float y_delta_pos = sample_point.y + delta;
	float y_pos = sample_voxel(vec3(sample_point.x, y_delta_pos, sample_point.z))[channel] * step(y_delta_pos, 1.0);
	
	float y_delta_neg = sample_point.y - delta;
	float y_neg = sample_voxel(vec3(sample_point.x, y_delta_neg, sample_point.z))[channel] * step(-1.0, y_delta_neg);

	float z_delta_pos = sample_point.z + delta;
	float z_pos = sample_voxel(vec3(sample_point.xy, z_delta_pos))[channel] * step(z_delta_pos, 1.0);

	float z_delta_neg = sample_point.z - delta;
	float z_neg = sample_voxel(vec3(sample_point.xy, z_delta_neg))[channel] * step(-1.0, z_delta_neg);

	return vec3(x_pos - x_neg, y_pos - y_neg, z_pos - z_neg) / (2.0 * delta);
}

mat3 compute_hessian(vec4 p, float delta)
{
    vec3 g_x_pos = compute_gradient(vec4(p.x + delta, p.yz, p.a), delta);
    vec3 g_x_neg = compute_gradient(vec4(p.x - delta, p.yz, p.a), delta);

    vec3 g_y_pos = compute_gradient(vec4(p.x, p.y + delta, p.z, p.a), delta);
    vec3 g_y_neg = compute_gradient(vec4(p.x, p.y - delta, p.z, p.a), delta);

    vec3 g_z_pos = compute_gradient(vec4(p.xy, p.z + delta, p.a), delta);
    vec3 g_z_neg = compute_gradient(vec4(p.xy, p.z - delta, p.a), delta);

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

float compute_curvature(vec4 sample_point)
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

vec3 shade_lambert(vec4 medium_color, vec3 N, vec3 light_position, float light_intensity)
{
	vec3 L = normalize(light_position);
	float NdotL = max(dot(N, L), 0.0);

	return light_intensity * NdotL * medium_color.rgb;
}

vec3 shade_blinn_phong(int vm_index, int shd_index, vec4 medium_color, vec4 sample_point, vec3 N, vec3 light_position, float light_intensity)
{
	vec3 L = normalize(light_position);
	vec3 V = normalize(u_eye_position - sample_point.xyz);
	vec3 H = normalize(L + V);
	float NdotH = max(dot(N, H), 0.0001);
	float NdotL = max(dot(N, L), 0.0);

	return light_intensity * NdotL * (medium_color.rgb + pow(NdotH, PARAMS.u_shininess)); 
}

vec3 shade_disney(int vm_index, int shd_index, vec4 medium_color, vec4 sample_point, vec3 N, vec3 light_position, float light_intensity)
{
	// Base Diffuse
	// ThetaL = dot(N, L)
	// ThetaV = dot(N, V)
	// ThetaD = dot(L, H)
	// FD90 = 0.5 + 2 * roughness * cos^2ThetaD
	// base_diffuse = (baseColor / pi) * (1 + (FD90 - 1) * (1 - cosThetaL) ^ 5) * (1 + (FD90 - 1) * (1 - cosThetaV) ^ 5)
	vec3 L = normalize(light_position);
	vec3 V = normalize(u_eye_position - sample_point.xyz);
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

	float FD90 = 0.5 + 2.0 * PARAMS.u_roughness * LdotH * LdotH;
	// NOTE: ? This is the rewritten formula from the Disney 2012 paper, however not equivalent to the code below, possibly for cases
	// where dot product is < 0 -> needs to be clamped?
	// vec3 base_diffuse = (1.0 + (FD90 - 1.0) * pow(1.0 - NdotL, 5.0)) * (1.0 + (FD90 - 1.0) * pow(1.0 - NdotV, 5.0));

	// Code below from: https://github.com/wdas/brdf/blob/main/src/brdfs/disney.brdf
	float FL = fresnel_schlick(NdotL);
	float FV = fresnel_schlick(NdotV);
	float base_diffuse = mix(1.0, FD90, FL) * mix(1.0, FD90, FV);

	// Subsurface diffuse
	float FSS90 = LdotH * LdotH * PARAMS.u_roughness;
	float FSS = mix(1.0, FSS90, FL) * mix(1.0, FSS90, FV);
	float subsurface_diffuse = 1.25 * (FSS * (1.0 / (NdotL + NdotV) - 0.5) + 0.5);

	// Sheen (Fabric effect)
	// NOTE: sheen seems to behave oddly. Perhaps because of the transparency of the rendered data (color accumulates under the surface)
	// The resulting image gets brighter as a whole as sheen and sheen tint values increase 

	// medium_color.rgb = 3.0 * mon2lin(medium_color.rgb);
	// medium_color = texture(u_material_texture, abs(N.xy));

	float luminescence = 0.3 * medium_color.r + 0.6 * medium_color.g  + 0.1 * medium_color.b; // approximation
	vec3 tint_comp = luminescence > 0.0 ? medium_color.rgb / luminescence : vec3(1.0);
	vec3 sheen_comp = mix(vec3(1.0), tint_comp, PARAMS.u_sheen_tint);

	float FH = fresnel_schlick(LdotH);
	vec3 sheen_color = FH * PARAMS.u_sheen * sheen_comp;

	vec3 diffuse = medium_color.rgb * (1.0 / PI) * mix(base_diffuse, subsurface_diffuse, PARAMS.u_subsurface) + sheen_color;

	float NdotH = dot(N,H);
	// surface tangent and bitanget for anisotropy:
	vec3 help_vector = abs(N.y) > 0.99999999 ? vec3(1.0, 0.0, 0.0) : UP_VECTOR;
	vec3 X = normalize(cross(N, help_vector));
	vec3 Y = normalize(cross(N, X));
	vec3 specular0_comp = mix(PARAMS.u_specular * 0.08 * mix(vec3(1.0), tint_comp, PARAMS.u_specular_tint), medium_color.rgb, PARAMS.u_metallic);
	// specular
	float aspect = sqrt(1.0 - PARAMS.u_anisotropic * 0.9);
	float ax = max(0.001, sqr(PARAMS.u_roughness) / aspect);
	float ay = max(0.001, sqr(PARAMS.u_roughness) * aspect);
	float Ds = GTR2_aniso(NdotH, dot(H, X), dot(H, Y), ax, ay);
	// float FH = fresnel_schlick(LdotH);
	vec3 Fs = mix(specular0_comp, vec3(1.0), FH);
	float Gs;
	Gs  = smithG_GGX_aniso(NdotL, dot(L, X), dot(L, Y), ax, ay);
	Gs *= smithG_GGX_aniso(NdotV, dot(V, X), dot(V, Y), ax, ay);

	// clearcoat (ior = 1.5 -> F0 = 0.04)
	float Dr = GTR1(NdotH, mix(0.1, 0.001, PARAMS.u_clearcoat_gloss));
	float Fr = mix(0.04, 1.0, FH);
	float Gr = smithG_GGX(NdotL, 0.25) * smithG_GGX(NdotV, 0.25);

	// TODO: environment mapping
	return light_intensity * NdotL * (diffuse * (1.0 - PARAMS.u_metallic) + Gs * Fs * Ds + 0.25 * PARAMS.u_clearcoat * Gr * Fr * Dr);
}

// u: S^2 X S^2 X S^2 -> [0, PI]
float u(int vm_index, int shd_index, vec4 sample_point, vec3 n, vec3 l, vec3 v)
{
	// Anisotropy of the specular highlight
	vec3 help_vector = abs(n.y) > 0.99999999 ? vec3(1.0, 0.0, 0.0) : UP_VECTOR;
	vec3 t = normalize(cross(n, help_vector));
	vec3 b = normalize(cross(n, t));
	vec3 h = normalize(l + v);
	float eta = dot(l, v) * 0.5 + 0.5;
	float S_l = PARAMS.u_lambda >= 0.0 
		? 1.0 / (1.0 - PARAMS.u_lambda) * eta + (1.0 - eta)
		: 1.0 / (1.0 / (1.0 + PARAMS.u_lambda) * eta + (1.0 - eta));

		// Q: should tangent space t,b,n be used?
		vec3 ht = dot(h, t) * t;
		vec3 hb = dot(h, b) * b;
		vec3 hn = dot(h, n) * n;

		h = normalize(S_l * ht + 1.0 / S_l * hb + hn);
		v = reflect(-l, h);

		// Light response d_alpha
		vec3 r = reflect(-v, n);
		vec3 d = normalize((1.0 - PARAMS.u_alpha) * n + PARAMS.u_alpha * r);

	// Curvature
	float kappa = compute_curvature(sample_point);

	// Offset tau based on local surface curvature
	float tau = PARAMS.u_tau + (PARAMS.u_mu * tanh(kappa * PARAMS.u_chi));

	// angular response u
	return clamp(acos(dot(d, l)) - tau, 0.0, PI);
}

// I: [0, PI] -> [0, 1]
float I(int vm_index, int shd_index, float u)
{
	return pow(max(PARAMS.u_beta + (1.0 - PARAMS.u_beta) * cos(u), 0.0), PARAMS.u_gamma);
}

vec4 shade_stylized(int vm_index, int shd_index, vec4 medium_color, vec4 sample_point, vec3 n, vec3 light_position, float light_intensity)
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

	vec3 l = normalize(light_position);
	vec3 v = normalize(u_eye_position - sample_point.xyz);

	float u = u(vm_index, shd_index, sample_point, n, l, v);
	float I = I(vm_index, shd_index, u);

	// TODO: use a color ramp
	// NOTE: possible to use color ramps for concave/convex transitions
	// PI - u / PI is a fake color ramp
	// NOTE: use alpha = I for layering

	// intensity driven purely by the function
	// return vec4(light.intensity * I * medium_color.rgb * (PI - u) / PI, I);

	// alpha affects intensity
	return vec4(light_intensity * medium_color.a * I * mix(vec3(1.0), medium_color.rgb, (PI - u) / PI), I * medium_color.a);

	// test curvature
	// return vec4(vec3(compute_curvature(sample_point)), 1.0);
	// test u()
	// return vec4(vec3(u(sample_point, n, l, v)) / PI, 1.0);
	// test I()
	// return vec4(vec3(I), 1.0);
}


vec4 shade(int vm_index, vec4 medium_color, vec4 sample_point, vec3 normal)
{
	vec4 color = vec4(0.0);

// MEDIUM = vm.array[vm_index]
	for (int s = 0; s < MEDIUM.shading_count; ++s)
	{
		// SHADING = shd.array[vm.array[vm_index].shd_indices[s]]
		if (!SHADING.enabled)
			continue;
	
		int shading_model = SHADING.model;

		switch(shading_model)
		{
			case STYLIZED:
				for (int l = 0; l < SHADING.light_count; ++l)
				{
					// LIGHT = lights.array[shd.array[vm.array[vm_index].shd_indices[s]].light_indices[l]]
					if (!LIGHT.enabled)
						continue;

					vec3 light_position = LIGHT.position;
					if (LIGHT.camera_relative)
						light_position = vec3(u_view_inv * vec4(light_position, 1.0));

					color += shade_stylized(vm_index, s, medium_color, sample_point, normal, light_position, LIGHT.intensity);
				}
				break;
			case DISNEY:
				for (int l = 0; l < SHADING.light_count; ++l)
				{
					if (!LIGHT.enabled)
						continue;

					vec3 light_position = LIGHT.position;
					if (LIGHT.camera_relative)
						light_position = vec3(u_view_inv * vec4(light_position, 1.0));

					color += vec4(shade_disney(vm_index, s, medium_color, sample_point, normal, light_position, LIGHT.intensity), 1.0);
				}
				break;
			case BLINN_PHONG:
				for (int l = 0; l < SHADING.light_count; ++l)
				{
					if (!LIGHT.enabled)
						continue;

					vec3 light_position = LIGHT.position;
					if (LIGHT.camera_relative)
						light_position = vec3(u_view_inv * vec4(light_position, 1.0));

					color += vec4(shade_blinn_phong(vm_index, s, medium_color, sample_point, normal, light_position, LIGHT.intensity), 1.0);
				}
				break;
			case LAMBERT:
				for (int l = 0; l < SHADING.light_count; ++l)
				{
					if (!LIGHT.enabled)
						continue;

					vec3 light_position = LIGHT.position;
					if (LIGHT.camera_relative)
						light_position = vec3(u_view_inv * vec4(light_position, 1.0));

					color += vec4(shade_lambert(medium_color, normal, light_position, LIGHT.intensity), 1.0);
				}
				break;
			case NORMAL:
				color = vec4(vec3((normal + 1.0) * 0.5), 1.0);
				break;
			case POSITION:
				color = vec4(sample_point.xyz, 1.0);
				break;
		}
	}

	return color;
}

vec4 get_sample_point(vec2 uv_coords)
{
	// return vec4(texture(u_sample_point_texture, uv_coords).xyz, 1.0);
	return texture(u_sample_point_texture, uv_coords);
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

vec4 get_medium_color(int vm_index)
{
	switch(u_mode)
	{
		case DICOM:
			return tf.array[vm.array[vm_index].tf_index].color;
		case SPHERE_DEBUG:
			return tf.array[vm.array[vm.array_size - 1].tf_index].color; // TODO: index of 1 selected medium
	}
}

vec3 get_shading_normal(vec4 sample_point, vec3 surface_normal)
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

vec4 shade_volume(vec3 surface_normal)
{
	vec4 color = vec4(0.0);

	vec4 sample_point = get_sample_point(var.tex_coord);

	if (sample_point.a < 0.0)
		return color;

	vec4 float_sample_color = get_sample_color(sample_point.xyz);

	// TODO: send vms that are relevant for this shading pass
	for(int i = 0; i < vm.array_size; ++i)
	{
		// NOTE: Option to not send disabled media to the GPU for performance improvement
		if (!vm.array[i].enabled)
			continue;

		vec2 medium_itv = get_medium_interval(i);
		vec4 medium_color = get_medium_color(i);
		int medium_channel = vm.array[i].channel;

		if (float_sample_color[medium_channel] < medium_itv.x || float_sample_color[medium_channel] >= medium_itv.y)
			continue;

		sample_point.a = float(medium_channel);
		vec3 normal = get_shading_normal(sample_point, surface_normal);
		
		return shade(i, medium_color, sample_point, normal);
	}

	return color;
}

void main()
{
	vec3 surface_normal;
	switch(u_mode)
	{
		case DICOM:
			surface_normal = vec3(0.0);
			break;
		case SPHERE_DEBUG:
			surface_normal = vec3(1.0);
			break;
	}

	o_color = shade_volume(surface_normal);
}
