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
## Timbro di traverso sulla carta (la carta contrastata): testo, colore, numero di contrasti.
var stamp := "":
	set(v):
		stamp = v
		queue_redraw()
var stamp_color := Color("#4fa3d9")
var stamp_n := 1


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
		Art.draw_tex(self, "bk-" + (back_id if back_id != "" else Art.BACK), r)
	else:
		Art.draw_tex(self, "card-" + kind, r)
		_draw_text(w, h)
	if dim > 0:
		draw_style_box(Art.box(Color(Art.TAVOLO, dim), rad), r)
	if stamp != "":
		_draw_stamp(w, h)
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
	Art.draw_tex(self, "ico-" + kind, Rect2(c - Vector2(r, r), Vector2(r, r) * 2))
	if dim > 0:
		draw_circle(c, r, Color(Art.TAVOLO, dim))


## Il timbro della carta contrastata: la carta si vela, e di traverso passa una fascia con le onde
## dell'Isola e la scritta; tanti segnetti quanti sono i contrasti.
func _draw_stamp(w: float, h: float) -> void:
	var neg := stamp == "Contrastata"
	if neg:
		draw_style_box(Art.box(Color("#17152e", 0.45), w * 0.11), Rect2(Vector2.ZERO, size))
	var c := Vector2(w / 2, h * 0.42)
	draw_set_transform(c, deg_to_rad(-14))
	var bw := w * 1.12
	var bh := w * 0.36
	var band := Rect2(-bw / 2, -bh / 2, bw, bh)
	var sb := Art.box(stamp_color, bh * 0.22, Color.WHITE, 2)
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_size = 6
	draw_style_box(sb, band)
	# onde dell'Isola ai lati della scritta
	for sx in [-1.0, 1.0]:
		var x0: float = sx * bw * 0.4
		for k in 2:
			var y := (k - 0.5) * bh * 0.32
			var pts := PackedVector2Array()
			for i in 9:
				var t := i / 8.0
				pts.append(Vector2(x0 - bw * 0.06 + t * bw * 0.12, y + sin(t * TAU) * bh * 0.07))
			draw_polyline(pts, Color(1, 1, 1, 0.85), maxf(1.2, w * 0.012), true)
	var f := Art.bold()
	var fs := int(w * 0.15)
	while fs > 6 and f.get_string_size(stamp.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > bw * 0.66:
		fs -= 1
	Art.draw_text_centered(self, f, stamp.to_upper(), Vector2(0, -bh * 0.06), fs, Color.WHITE)
	# un puntino per ogni contrasto
	var n := mini(stamp_n, 6)
	for i in n:
		draw_circle(Vector2((i - (n - 1) / 2.0) * w * 0.07, bh * 0.3), w * 0.02, Color(1, 1, 1, 0.9))
	draw_set_transform(Vector2.ZERO)
