## Una carta (fronte o dorso) nello stile «Orizzonti»: paesaggio in alto, fascia colorata con il
## nome in basso, angoli tondi. Si ridisegna solo quando cambia qualcosa: spostarla non costa nulla.
extends Control

const Art := preload("res://scripts/ui/art.gd")

## "full": nome ed effetto · "compact": solo il nome · "mini" e "mini_named": solo il disegno
var mode := "full":
	set(v):
		mode = v
		queue_redraw()
## "W".."G" oppure "back"
var kind := "W":
	set(v):
		kind = v
		queue_redraw()
var back_id := ""  # vuoto: il dorso scelto nella Collezione
## alone intorno alla carta (oro: si può usare / rosso: verrà scartata o è dell'avversario)
var ring := Color(0, 0, 0, 0):
	set(v):
		ring = v
		queue_redraw()
var dim := 0.0:  # velo sulle carte che ora non si possono usare
	set(v):
		dim = v
		queue_redraw()
var badge := "":  # piccolo segno rosso in alto (✕ sulle carte da scartare)
	set(v):
		badge = v
		queue_redraw()
var shadow := true


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func _draw() -> void:
	var w := size.x
	var h := size.y
	if w < 2:
		return
	if mode == "disc":
		_draw_disc(w)
		return
	var rad := w * 0.11
	var r := Rect2(Vector2.ZERO, size)
	if shadow:
		var sh := Art.box(Color(0, 0, 0, 0), rad)
		sh.shadow_color = Art.OMBRA
		sh.shadow_size = int(w * 0.12)
		sh.shadow_offset = Vector2(0, w * 0.06)
		draw_style_box(sh, r)
	if ring.a > 0:
		# alone morbido + bordo netto, che seguono gli angoli tondi della carta
		var rw := w * 0.035
		draw_style_box(Art.box(Color(ring, 0.28), rad + rw * 2.2), r.grow(rw * 2.2))
		draw_style_box(Art.box(ring, rad + rw), r.grow(rw))
	if kind == "back":
		draw_texture_rect(Art.tex("bk-" + (back_id if back_id != "" else Art.BACK), w), r, false)
	else:
		draw_texture_rect(Art.tex("card-" + kind, w), r, false)
		_draw_text(w, h)
	if dim > 0:
		draw_style_box(Art.box(Color(Art.TAVOLO, dim), rad), r)
	if badge != "":
		var br := w * 0.14
		var c := Vector2(w / 2, -w * 0.12 + br)
		draw_circle(c, br + 2, Art.CARTA)
		draw_circle(c, br, Art.ROSSO)
		Art.draw_text_centered(self, Art.bold(), badge, c, int(w * 0.16), Color.WHITE)


func _draw_text(w: float, h: float) -> void:
	if mode == "mini" or mode == "mini_named":
		return
	var fs := int(round(w * (0.125 if mode == "compact" else 0.115)))
	if fs < 4:
		return
	var band_top := h * 104.0 / 140.0
	var band_h := h - band_top
	var name: String = Art.NAMES[kind]
	var f := Art.bold()
	# il nome deve stare nella fascia: se è troppo lungo si rimpicciolisce
	while fs > 4 and f.get_string_size(name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > w * 0.86:
		fs -= 1
	if mode == "full" and w >= 96:
		Art.draw_text_centered(self, f, name, Vector2(w / 2, band_top + band_h * 0.36), fs, Art.TESTO)
		var fs2 := int(round(w * 0.07))
		var fx: String = Art.FXTXT[kind]
		var sf := Art.serif()
		while fs2 > 4 and sf.get_string_size(fx, HORIZONTAL_ALIGNMENT_LEFT, -1, fs2).x > w * 0.9:
			fs2 -= 1
		Art.draw_text_centered(self, sf, fx, Vector2(w / 2, band_top + band_h * 0.72), fs2, Color(Art.TESTO, 0.8))
	else:
		Art.draw_text_centered(self, f, name, Vector2(w / 2, band_top + band_h * 0.5), fs, Art.TESTO)


## Al centro del tavolo la carta giocata diventa un cerchio con il suo paesaggio (l'«orizzonte»).
func _draw_disc(d: float) -> void:
	var c := size / 2
	var r := minf(size.x, size.y) / 2
	draw_circle(c + Vector2(0, r * 0.06), r * 1.02, Color(Art.OMBRA, 0.45))
	if ring.a > 0:
		draw_circle(c, r + r * 0.09, Color(ring, 0.25))
		draw_circle(c, r + r * 0.045, ring)
	else:
		draw_circle(c, r + r * 0.04, Color(1, 1, 1, 0.16))
	var t := Art.tex("ico-" + kind, r * 2)
	draw_texture_rect(t, Rect2(c - Vector2(r, r), Vector2(r, r) * 2), false)
	if dim > 0:
		draw_circle(c, r, Color(Art.TAVOLO, dim))
