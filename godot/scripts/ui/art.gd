## Grafica di Atlas: colori, caratteri e disegni SVG (presi da public/art.js) trasformati in
## immagini alla misura esatta in cui compaiono sullo schermo, così restano sempre nitidi.
extends RefCounted

const Data := preload("res://scripts/ui/art_data.gd")

# colori del tema Notte (style.css)
const TAVOLO := Color("#12363f")
const TAVOLO2 := Color("#0a232b")
const TESTO := Color("#e9f1ec")
const MUTO := Color("#93b3b0")
const RIGA := Color("#d6e8e04d")
const CARTA := Color("#f4eddd")
const CARTA2 := Color("#e2d6bd")
const INK := Color("#17262d")
const SEGNALE := Color("#f6c453")
const SEGNALE2 := Color("#c9962e")
const ROSSO := Color("#c8402b")
const OMBRA := Color(0, 0, 0, 0.53)
const LAND := {"W": Color("#e0a92e"), "U": Color("#1f8fb8"), "B": Color("#7557a6"), "R": Color("#d9482f"), "G": Color("#23855a")}

const NAMES := {"W": "Pianura", "U": "Isola", "B": "Palude", "R": "Montagna", "G": "Foresta"}
const FXTXT := {
	"W": "Riattiva una tua terra",
	"U": "Pesca una carta, o contrasta",
	"B": "Fai scartare una terra",
	"R": "Distruggi una terra",
	"G": "Riprendi una terra dal cimitero",
}
const LONG_FX := {
	"W": "Riattiva l'effetto di un'altra tua terra in gioco.",
	"U": "Entrando peschi una carta.",
	"B": "Guardi la mano avversaria e scegli una terra da scartare.",
	"R": "Distruggi una terra avversaria in gioco.",
	"G": "Riprendi in mano una terra dal tuo cimitero.",
}

static var _tex := {}
static var _fonts := {}
## Pixel veri per unità logica (lo imposta screen.gd): serve a disegnare le immagini nitide.
static var px := 1.0


static func _font(path: String) -> Font:
	if not _fonts.has(path):
		var f = load(path)
		if f is FontFile:
			f.fallbacks = [ThemeDB.fallback_font]
		_fonts[path] = f if f != null else ThemeDB.fallback_font
	return _fonts[path]


static func sans() -> Font:
	return _font("res://assets/fonts/adventor.woff")


static func bold() -> Font:
	return _font("res://assets/fonts/adventor-bold.woff")


static func serif() -> Font:
	return _font("res://assets/fonts/lora-italic.woff")


static func _viewbox(svg: String) -> Vector2:
	var i := svg.find("viewBox=\"")
	if i < 0:
		return Vector2(100, 100)
	var parts := svg.substr(i + 9, svg.find("\"", i + 9) - i - 9).split(" ")
	return Vector2(float(parts[2]), float(parts[3]))


## Il disegno `key` (es. "art-W", "ico-R", "bk-bussola", "rose-n") largo `width` unità logiche.
## Le misure vengono arrotondate a gradini, così le immagini già pronte si riusano.
static func tex(key: String, width: float) -> Texture2D:
	var w := maxi(16, int(ceil(width * px / 24.0)) * 24)
	var k := "%s@%d" % [key, w]
	if _tex.has(k):
		return _tex[k]
	var svg: String = Data.SVG[key]
	var img := Image.new()
	img.load_svg_from_string(svg, float(w) / _viewbox(svg).x)
	var t := ImageTexture.create_from_image(img)
	_tex[k] = t
	return t


## Disegna `t` dentro `r` riempiendolo tutto e tagliando ciò che avanza (come "cover" nel CSS).
static func draw_cover(ci: CanvasItem, t: Texture2D, r: Rect2, modulate := Color.WHITE) -> void:
	var ts := t.get_size()
	var k := maxf(r.size.x / ts.x, r.size.y / ts.y)
	var src := Rect2(Vector2.ZERO, r.size / k)
	src.position = (ts - src.size) / 2
	ci.draw_texture_rect_region(t, r, src, modulate)


## Disegna `t` dentro `r` senza tagliare, centrato (come "contain").
static func draw_contain(ci: CanvasItem, t: Texture2D, r: Rect2, modulate := Color.WHITE) -> void:
	var ts := t.get_size()
	var k := minf(r.size.x / ts.x, r.size.y / ts.y)
	var s := ts * k
	ci.draw_texture_rect(t, Rect2(r.position + (r.size - s) / 2, s), false, modulate)


## Riquadro arrotondato pieno, con bordo e ombra facoltativi.
static func box(fill: Color, radius: float, border := Color(0, 0, 0, 0), bw := 0.0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = fill
	sb.set_corner_radius_all(int(round(radius)))
	sb.corner_detail = 6
	sb.anti_aliasing = true
	if bw > 0:
		sb.border_color = border
		sb.set_border_width_all(int(ceil(bw)))
	return sb
