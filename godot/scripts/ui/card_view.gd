## Una carta (fronte o dorso) disegnata con le stesse proporzioni di style.css.
## Si ridisegna solo quando cambia qualcosa: spostarla o trascinarla non costa nulla.
extends Control

const Art := preload("res://scripts/ui/art.gd")

## "full": con il testo dell'effetto · "compact": nome grande, niente testo
## "mini": solo disegno e simbolo (campo) · "mini_named": come mini ma con il nome (campo su PC)
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
## anello intorno alla carta (giallo: si può usare / rosso: verrà scartata o è dell'avversario)
var ring := Color(0, 0, 0, 0):
	set(v):
		ring = v
		queue_redraw()
var dim := 0.0:  # velo scuro sulle carte che ora non si possono usare
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
	var rad := w * 0.055
	if shadow:
		var sh := Art.box(Color(0, 0, 0, 0), rad)
		sh.shadow_color = Art.OMBRA
		sh.shadow_size = int(w * 0.09)
		sh.shadow_offset = Vector2(0, w * 0.06)
		draw_style_box(sh, Rect2(Vector2.ZERO, size))
	if ring.a > 0:
		var rw := w * 0.032
		draw_style_box(Art.box(ring, rad + rw), Rect2(-rw, -rw, w + rw * 2, h + rw * 2))
	# bordo inferiore più scuro, come lo spessore del cartoncino
	draw_style_box(Art.box(Art.CARTA2, rad), Rect2(0, w * 0.016, w, h))
	draw_style_box(Art.box(Art.CARTA, rad), Rect2(Vector2.ZERO, size))
	if kind == "back":
		var inset := w * 0.035
		Art.draw_cover(self, Art.tex("bk-" + (back_id if back_id != "" else Art.BACK), w), Rect2(inset, inset, w - inset * 2, h - inset * 2))
	else:
		_draw_face(w, h)
	if dim > 0:
		draw_style_box(Art.box(Color(Art.TAVOLO, dim), rad), Rect2(Vector2.ZERO, size))
	if badge != "":
		var r := w * 0.14
		var c := Vector2(w / 2, -w * 0.12 + r)
		draw_circle(c, r + 2, Art.CARTA)
		draw_circle(c, r, Art.ROSSO)
		var fs := int(w * 0.16)
		var f := Art.bold()
		var tw := f.get_string_size(badge, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		draw_string(f, c + Vector2(-tw / 2, f.get_ascent(fs) * 0.36), badge, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE)


func _draw_face(w: float, h: float) -> void:
	var art_h := 0.625
	var gem_top := 0.598
	var name_top := 0.75
	var name_em := 0.98
	var spacing := 0.14
	var show_name := true
	var show_text := mode == "full"
	match mode:
		"compact":
			art_h = 0.66
			gem_top = 0.633
			name_top = 0.805
			name_em = 1.14
			spacing = 0.1
		"mini":
			art_h = 0.82
			gem_top = 0.784
			show_name = false
		"mini_named":
			art_h = 0.705
			gem_top = 0.675
			name_top = 0.86
			name_em = 0.92
	var art := Rect2(w * 0.055, h * 0.04, w * 0.89, h * art_h)
	Art.draw_cover(self, Art.tex("art-" + kind, art.size.x), art)
	draw_rect(art, Color("#17262d66"), false, maxf(1.0, w * 0.007))
	var inner := art.grow(-art.size.x * 0.035)
	draw_rect(inner, Color(1, 0.97, 0.9, 0.5), false, maxf(1.0, w * 0.006))
	# simbolo nel disco colorato, con l'anello di carta intorno
	var gd := w * 0.18
	var gc := Vector2(w * 0.41 + gd / 2, h * gem_top + gd / 2)
	draw_circle(gc, gd / 2 + w * 0.024, Art.CARTA)
	Art.draw_contain(self, Art.tex("ico-" + kind, gd), Rect2(gc - Vector2(gd, gd) / 2, Vector2(gd, gd)))
	var em := w * 0.1
	if em * 0.66 < 2:
		return  # troppo piccola per le scritte
	if show_name:
		_draw_spaced(Art.NAMES[kind].to_upper(), h * name_top, em * name_em, spacing)
	if show_text:
		var f := Art.serif()
		var fs := int(round(em * 0.66))
		var y := h * 0.845 + f.get_ascent(fs)
		draw_multiline_string(f, Vector2(w * 0.07, y), Art.FXTXT[kind], HORIZONTAL_ALIGNMENT_CENTER,
			w * 0.86, fs, 2, Color(Art.INK, 0.8))


## Scritta maiuscola con le lettere distanziate, centrata (come letter-spacing nel CSS).
func _draw_spaced(text: String, top: float, fs_f: float, spacing_em: float) -> void:
	var f := Art.bold()
	var fs := int(round(fs_f))
	var sp := fs_f * spacing_em
	var widths := []
	var total := 0.0
	for ch in text:
		var cw := f.get_char_size(ch.unicode_at(0), fs).x
		widths.append(cw)
		total += cw
	total += sp * (text.length() - 1)
	var x := (size.x - total) / 2
	var y := top + f.get_ascent(fs)
	for i in text.length():
		draw_char(f, Vector2(x, y), text[i], fs, Art.INK)
		x += widths[i] + sp
