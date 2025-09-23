#version 300 es
precision mediump float;
precision mediump usampler3D;

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
  float t;				          // The distance between the ray origin and the intersection points along the ray. 
	vec3 intersection;        // The intersection point.
  vec3 normal;              // The surface normal at the interesection point.
};

/* -----LOCAL VARIABLES----- */
/* ------------------------- */
const RayIntersectionData no_intersection = RayIntersectionData(1e20, vec3(0.0), vec3(0.0));
const Hit miss = Hit(1e20, vec3(0.0), vec3(0.0));

/* ----------INPUT---------- */
/* ------------------------- */
in VaryingData var;

/* --------UNIFORMS--------- */
/* ------------------------- */
// Volume data texture
uniform usampler3D u_volume_texture;
// Bounding box dimensions
uniform vec3 u_bbox_dimensions;
// Camera uniforms
uniform vec3 u_eye_position;
uniform mat4 u_view_inv;
uniform mat4 u_projection_inv;

/* ---------OUTPUT---------- */
/* ------------------------- */
out vec4 o_color;

/* ------LOCAL METHODS------ */
/* ------------------------- */
Hit ray_cube_intersection(const Ray ray, const vec3 dimensions)
{
  // For now a plane intersection
  const vec3 normal = vec3(0.0, 1.0, 0.0);
  const vec3 point = vec3(0.0);

  float t = dot(normal, (point - ray.origin)) / dot(normal, ray.direction);
	if (t < 0.0)
		return miss;
		
	vec3 intersection = ray.origin + t * ray.direction;

	// Finite plane - square
	if (abs(intersection.x) + abs(intersection.z) > dimensions.x)
		return miss;

  return Hit(t, intersection, normal);
}

// Evaluates the intersections of the ray with the scene objects and returns the closest hit.
Hit evaluate(const Ray ray)
{	
	Hit closest_hit = ray_cube_intersection(ray, u_bbox_dimensions);
  return closest_hit;
}

// Traces the ray trough the scene and accumulates the color.
vec3 trace(Ray ray) 
{
  // The accumulated color used when tracing the rays through the scene.
	vec3 color = vec3(0.15, 0.2, 0.2);

  int bounces = 0;

	for (int i = 0; i < bounces + 1; ++i) 
	{
		Hit hit = evaluate(ray);

		// First intersection depth, costs some perfomance
		if (i == 0) 
			gl_FragDepth = (1.0 / hit.t - 1.0) / -0.999; // (1.0 / hit.t - 1.0 / near) / (1.0 / far - 1.0 / near)
		
		if (hit.t == miss.t)
			break;
    
    color = vec3(0.7, 0.7, 0.7);
  }

  return color;
}

void main()
{
  vec3 ray_origin = (u_view_inv * u_projection_inv * vec4(var.tex_coord * 2.0 - 1.0, -1.0, 1.0)).xyz;
  vec3 ray_direction = normalize(ray_origin - u_eye_position);

  vec3 color = trace(Ray(ray_origin, ray_direction));

	o_color = vec4(color, 1.0);
}
