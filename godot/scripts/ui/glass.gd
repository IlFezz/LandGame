## Effetto vetro smerigliato: il pannello sfoca ciò che c'è dietro e ci posa sopra il suo colore,
## un po' trasparente (bordo e angoli arrotondati restano quelli del suo riquadro).
## Si spegne dal menu della partita («Effetto vetro»): i pannelli tornano pieni come prima.
## Lo shader lavora solo sui pixel del pannello, quindi costa solo mentre una finestra è aperta.
extends RefCounted

const Prefs := preload("res://scripts/app/prefs.gd")

const CODE := """
shader_type canvas_item;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform float strength = 0.6;  // quanto colore del pannello sopra lo sfondo sfocato
uniform float spread = 7.0;    // raggio della sfocatura in pixel
uniform float lod = 2.0;       // sfocatura in più dalle immagini ridotte dello schermo

void fragment() {
	vec2 px = SCREEN_PIXEL_SIZE * spread;
	vec3 acc = textureLod(screen_tex, SCREEN_UV, lod).rgb * 2.0;
	float w = 2.0;
	for (int i = 0; i < 12; i++) {
		float a = float(i) * 0.5235988;
		float r = mod(float(i), 2.0) < 0.5 ? 1.0 : 2.0;
		acc += textureLod(screen_tex, SCREEN_UV + vec2(cos(a), sin(a)) * px * r, lod).rgb;
		w += 1.0;
	}
	vec3 bg = acc / w;
	COLOR = vec4(mix(bg, COLOR.rgb, strength), COLOR.a);
}
"""

static var _shader: Shader


static func enabled() -> bool:
	return bool(Prefs.get_value("glass"))


static func material(strength := 0.6) -> ShaderMaterial:
	if _shader == null:
		_shader = Shader.new()
		_shader.code = CODE
	var m := ShaderMaterial.new()
	m.shader = _shader
	m.set_shader_parameter("strength", strength)
	return m


## Mette il vetro su un pannello (se l'effetto è acceso). Restituisce true se l'ha messo.
static func apply(c: CanvasItem, strength := 0.6) -> bool:
	if not enabled():
		return false
	c.material = material(strength)
	return true
