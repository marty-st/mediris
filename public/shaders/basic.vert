#version 300 es
in vec2 i_position;

void main()
{
  gl_Position = vec4(i_position, 0.0, 1.0);
}