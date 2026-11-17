## Stile «Orizzonti»: i disegni del gioco come SVG generati da codice (paesaggi piatti a strati,
## cielo sfumato, sole o luna). Le stesse forme servono per carte, caselle, icone, dorsi e sfondo;
## art.gd li trasforma in immagini alla misura esatta dello schermo, quindi restano sempre nitidi.
extends RefCounted

## Colori di ogni terra: cielo (alto, basso), astro, strati dal più lontano al più vicino, fascia del nome.
const LAND := {
	"W": {"sky": ["#ffe7ae", "#f7b257"], "star": "#fff4d6", "layers": ["#efa64b", "#d9822f", "#b4632a"], "band": "#9a5320"},
	"U": {"sky": ["#c9eefa", "#83cdee"], "star": "#ffffff", "layers": ["#5fb0dd", "#2f7fc0", "#1e5a94"], "band": "#1b4f84"},
	"B": {"sky": ["#a691e0", "#62509f"], "star": "#efe9ff", "layers": ["#4a3b85", "#2f8d86", "#221a3d"], "band": "#221a3d"},
	"R": {"sky": ["#ffc6a8", "#f08d78"], "star": "#ffe8d6", "layers": ["#cc4559", "#8f2741", "#4f1a35"], "band": "#5e1d38"},
	"G": {"sky": ["#d8f6c4", "#9fdf9f"], "star": "#f5ffe9", "layers": ["#43a86c", "#22744a", "#174e34"], "band": "#164a31"},
}


static func _grad(id: String, a: String, b: String, vertical := true) -> String:
	return "<linearGradient id=\"%s\" x1=\"0\" y1=\"0\" x2=\"%s\" y2=\"%s\"><stop offset=\"0\" stop-color=\"%s\"/><stop offset=\"1\" stop-color=\"%s\"/></linearGradient>" % [id, "0" if vertical else "1", "1" if vertical else "0", a, b]


## Fila di pini: triangoli affiancati con altezze diverse (seme fisso: sempre uguale).
static func _pines(y: float, h: float, step: float, color: String, seed: int) -> String:
	var r := RandomNumberGenerator.new()
	r.seed = seed
	var d := "M-4 %.1f" % (y + 20)
	var x := -4.0
	while x < 108:
		var top := y - h * (0.65 + r.randf() * 0.35)
		d += " L%.1f %.1f L%.1f %.1f" % [x + step / 2, top, x + step, y]
		x += step
	d += " L108 %.1f Z" % (y + 20)
	return "<path d=\"%s\" fill=\"%s\"/>" % [d, color]


## Il paesaggio della terra `t` in un'area 100×h, con le forme appoggiate al fondo.
## `star_y` (0–1) sposta il sole o la luna in verticale (serve all'alba della vittoria).
static func scene(t: String, h: float, star_y := 0.38) -> String:
	var c: Dictionary = LAND[t]
	var B := h
	var L: Array = c.layers
	var s := "<defs>%s</defs>" % _grad("sky" + t, c.sky[0], c.sky[1])
	s += "<rect width=\"100\" height=\"%.1f\" fill=\"url(#sky%s)\"/>" % [h, t]
	var sy := h * star_y
	match t:
		"W":
			s += "<circle cx=\"56\" cy=\"%.1f\" r=\"13\" fill=\"%s\"/>" % [sy, c.star]
			s += "<path d=\"M0 %.1f Q28 %.1f 58 %.1f T100 %.1f V%.1f H0Z\" fill=\"%s\"/>" % [B - 34, B - 47, B - 36, B - 38, B, L[0]]
			s += "<path d=\"M0 %.1f Q36 %.1f 70 %.1f T100 %.1f V%.1f H0Z\" fill=\"%s\"/>" % [B - 22, B - 33, B - 21, B - 25, B, L[1]]
			s += "<path d=\"M0 %.1f Q52 %.1f 100 %.1f V%.1f H0Z\" fill=\"%s\"/>" % [B - 10, B - 21, B - 9, B, L[2]]
		"U":
			s += "<circle cx=\"74\" cy=\"%.1f\" r=\"8\" fill=\"%s\"/>" % [sy, c.star]
			s += "<path d=\"M2 %.1f Q22 %.1f 44 %.1f Z\" fill=\"%s\"/>" % [B - 33, B - 60, B - 33, L[0]]
			s += "<defs>%s</defs>" % _grad("sea", "#3c95d4", "#1d5a96")
			s += "<rect y=\"%.1f\" width=\"100\" height=\"34\" fill=\"url(#sea)\"/>" % (B - 34)
			s += "<path d=\"M50 %.1f Q64 %.1f 80 %.1f Z\" fill=\"%s\"/>" % [B - 33, B - 47, B - 33, L[2]]
			s += "<g stroke=\"#ffffff\" stroke-opacity=\".35\" stroke-width=\"1.4\" stroke-linecap=\"round\" fill=\"none\">"
			s += "<path d=\"M12 %.1f h12 M58 %.1f h16 M30 %.1f h10\"/></g>" % [B - 24, B - 18, B - 10]
		"B":
			s += "<circle cx=\"70\" cy=\"%.1f\" r=\"8\" fill=\"%s\"/>" % [sy, c.star]
			s += "<path d=\"M0 %.1f Q50 %.1f 100 %.1f V%.1f H0Z\" fill=\"%s\"/>" % [B - 27, B - 38, B - 26, B, L[0]]
			s += "<path d=\"M0 %.1f Q50 %.1f 100 %.1f V%.1f H0Z\" fill=\"%s\"/>" % [B - 17, B - 22, B - 16, B, L[1]]
			s += "<path d=\"M0 %.1f Q50 %.1f 100 %.1f V%.1f H0Z\" fill=\"%s\"/>" % [B - 13, B - 18, B - 12, B, L[2]]
			s += "<g stroke=\"#1c1530\" stroke-width=\"2.4\" stroke-linecap=\"round\" fill=\"none\">"
			s += "<path d=\"M22 %.1f V%.1f M22 %.1f L15 %.1f M22 %.1f L28 %.1f\"/>" % [B - 16, B - 44, B - 34, B - 41, B - 38, B - 45]
			s += "<path d=\"M80 %.1f V%.1f M80 %.1f L85 %.1f\"/></g>" % [B - 15, B - 33, B - 27, B - 32]
		"R":
			s += "<circle cx=\"33\" cy=\"%.1f\" r=\"10\" fill=\"%s\"/>" % [sy, c.star]
			s += "<path d=\"M-2 %.1f L36 %.1f L54 %.1f L72 %.1f L102 %.1f V%.1f H-2Z\" fill=\"%s\"/>" % [B - 18, B - 66, B - 42, B - 60, B - 22, B, L[0]]
			s += "<path d=\"M36 %.1f L42 %.1f L38 %.1f L46 %.1f Z\" fill=\"#ffd3c2\" opacity=\".55\"/>" % [B - 66, B - 56, B - 52, B - 50]
			s += "<path d=\"M0 %.1f Q40 %.1f 100 %.1f V%.1f H0Z\" fill=\"%s\"/>" % [B - 14, B - 30, B - 12, B, L[1]]
			s += "<path d=\"M0 %.1f Q60 %.1f 100 %.1f V%.1f H0Z\" fill=\"%s\"/>" % [B - 6, B - 13, B - 5, B, L[2]]
		"G":
			s += "<circle cx=\"74\" cy=\"%.1f\" r=\"8\" fill=\"%s\"/>" % [sy, c.star]
			s += _pines(B - 24, 26, 12, L[0], 7)
			s += _pines(B - 10, 30, 14, L[1], 11)
			s += "<rect y=\"%.1f\" width=\"100\" height=\"6\" fill=\"%s\"/>" % [B - 6, L[2]]
	return s


static func _svg(w: float, h: float, inner: String) -> String:
	return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 %.1f %.1f\">%s</svg>" % [w, h, inner]


## Velo notturno: la stessa terra "spenta" (casella vuota del campo).
static func _night(w: float, h: float) -> String:
	return "<rect width=\"%.1f\" height=\"%.1f\" fill=\"#17152e\" opacity=\".74\"/>" % [w, h]


## Ritaglio arrotondato: il disegno esce già con gli angoli tondi e trasparenti.
static func _clipped(w: float, h: float, rx: float, inner: String, id: String) -> String:
	return "<defs><clipPath id=\"%s\"><rect width=\"%.1f\" height=\"%.1f\" rx=\"%.1f\"/></clipPath></defs><g clip-path=\"url(#%s)\">%s</g>" % [id, w, h, rx, id, inner]


## Carta (100×140): paesaggio in alto, fascia colorata per il nome in basso.
static func card(t: String) -> String:
	var inner := scene(t, 106)
	inner += "<rect y=\"104\" width=\"100\" height=\"36\" fill=\"%s\"/>" % LAND[t].band
	inner += "<rect y=\"104\" width=\"100\" height=\"1.2\" fill=\"#ffffff\" opacity=\".18\"/>"
	return _svg(100, 140, _clipped(100, 140, 11, inner, "c"))


## Casella del campo (100×100, angoli tondi); `dim` la mostra spenta, di notte.
static func tile(t: String, dim := false) -> String:
	var inner := scene(t, 100)
	if dim:
		inner += _night(100, 100)
	return _svg(100, 100, _clipped(100, 100, 22, inner, "t"))


## Icona tonda (cerchio) con il paesaggio.
static func disc(t: String, star_y := 0.38) -> String:
	var inner := scene(t, 100, star_y)
	return _svg(100, 100, "<defs><clipPath id=\"d\"><circle cx=\"50\" cy=\"50\" r=\"50\"/></clipPath></defs><g clip-path=\"url(#d)\">%s</g>" % inner)


# ---------------------------------------------------------------- dorsi

const BACKS := {
	"sole": ["#2a2a5e", "#6b4a8c"],
	"luna": ["#141838", "#33306a"],
	"colline": ["#3c2f6a", "#b26a7c"],
	"monti": ["#432a5c", "#e08a7c"],
	"pini": ["#14382b", "#3f8f68"],
	"onde": ["#123a5c", "#3b8fc4"],
	"stelle": ["#0f1030", "#2c2560"],
}


static func back(id: String) -> String:
	var g: Array = BACKS.get(id, BACKS.sole)
	var s := "<defs>%s</defs><rect width=\"100\" height=\"140\" fill=\"url(#bk)\"/>" % _grad("bk", g[0], g[1])
	match id:
		"sole":
			s += "<g fill=\"none\" stroke=\"#fcf1e3\" stroke-opacity=\".22\" stroke-width=\"1.2\"><circle cx=\"50\" cy=\"62\" r=\"30\"/><circle cx=\"50\" cy=\"62\" r=\"38\"/></g>"
			s += "<circle cx=\"50\" cy=\"62\" r=\"20\" fill=\"#ffd9a0\"/>"
			s += "<path d=\"M0 104 Q30 88 60 100 T100 96 V140 H0Z\" fill=\"#3a2d63\"/><path d=\"M0 118 Q50 104 100 116 V140 H0Z\" fill=\"#251d47\"/>"
		"luna":
			s += "<circle cx=\"56\" cy=\"58\" r=\"20\" fill=\"#f2ecff\"/><circle cx=\"64\" cy=\"52\" r=\"18\" fill=\"#1c1f48\"/>"
			for p in [[18, 22], [80, 30], [30, 96], [74, 108], [22, 60], [86, 84], [44, 20]]:
				s += "<circle cx=\"%d\" cy=\"%d\" r=\"1.4\" fill=\"#ffffff\" opacity=\".8\"/>" % p
		"colline":
			s += "<circle cx=\"68\" cy=\"46\" r=\"12\" fill=\"#ffe3c2\"/>"
			s += "<path d=\"M0 80 Q30 62 60 78 T100 72 V140 H0Z\" fill=\"#7d4f86\"/><path d=\"M0 100 Q45 84 100 98 V140 H0Z\" fill=\"#5a3a72\"/><path d=\"M0 120 Q55 106 100 118 V140 H0Z\" fill=\"#3a2652\"/>"
		"monti":
			s += "<circle cx=\"30\" cy=\"40\" r=\"10\" fill=\"#ffe0cc\"/>"
			s += "<path d=\"M-2 104 L34 50 L52 78 L72 56 L102 100 V140 H-2Z\" fill=\"#a8455e\"/><path d=\"M0 116 Q50 96 100 114 V140 H0Z\" fill=\"#6a2843\"/>"
		"pini":
			s += "<circle cx=\"70\" cy=\"34\" r=\"9\" fill=\"#effcd9\"/>"
			s += _pines(100, 34, 13, "#2f8a5c", 5).replace("M-4", "M-4") + _pines(126, 40, 15, "#163f2c", 9)
		"onde":
			s += "<circle cx=\"50\" cy=\"38\" r=\"11\" fill=\"#eaf8ff\"/>"
			for i in 6:
				var y := 66 + i * 12
				s += "<path d=\"M-4 %d q13 -7 26 0 t26 0 t26 0 t26 0 V140 H-4Z\" fill=\"#ffffff\" opacity=\"%.2f\"/>" % [y, 0.06 + i * 0.03]
		"stelle":
			var pts := [[22, 30], [38, 44], [50, 36], [64, 54], [78, 46], [60, 80], [44, 96], [30, 110], [54, 116], [74, 108]]
			s += "<path d=\"M22 30L38 44L50 36L64 54L78 46M64 54L60 80L44 96L30 110M44 96L54 116L74 108\" fill=\"none\" stroke=\"#ffd27a\" stroke-width=\"1\" opacity=\".7\"/>"
			for p in pts:
				s += "<circle cx=\"%d\" cy=\"%d\" r=\"2.2\" fill=\"#ffd27a\"/>" % p
			var r := RandomNumberGenerator.new()
			r.seed = 3
			for i in 40:
				s += "<circle cx=\"%.1f\" cy=\"%.1f\" r=\"%.2f\" fill=\"#ffffff\" opacity=\"%.2f\"/>" % [r.randf() * 100, r.randf() * 140, 0.3 + r.randf() * 0.6, 0.3 + r.randf() * 0.5]
	s += "<rect x=\"5\" y=\"5\" width=\"90\" height=\"130\" rx=\"7\" fill=\"none\" stroke=\"#fcf1e3\" stroke-opacity=\".35\" stroke-width=\"1.2\"/>"
	return _svg(100, 140, _clipped(100, 140, 11, s, "b"))


# ---------------------------------------------------------------- cieli (tavoli)

## Cielo del tavolo: [alto, basso, colline lontane, colline vicine, stelle?]
const SKIES := {
	"crepuscolo": ["#1d1f47", "#5b3f6e", "#6c4a7e", "#3a2950", false],
	"alba": ["#2b2a5c", "#b4687a", "#c98181", "#6e3e62", false],
	"stellata": ["#0b0f2a", "#26285a", "#2f3270", "#171a40", true],
	"aurora": ["#0e2a3a", "#2f6f6a", "#3b8a76", "#183e45", true],
}


## Colline in fondo allo schermo (400×120), da disegnare sopra il cielo sfumato.
static func hills(sky: String) -> String:
	var k: Array = SKIES.get(sky, SKIES.crepuscolo)
	var s := "<path d=\"M0 70 Q70 30 150 62 T300 50 T400 58 V120 H0Z\" fill=\"%s\" opacity=\".55\"/>" % k[2]
	s += "<path d=\"M0 92 Q90 64 190 86 T400 80 V120 H0Z\" fill=\"%s\" opacity=\".8\"/>" % k[3]
	return _svg(400, 120, s)


## Cielo stellato (solo per i tavoli notturni): puntini sparsi su 400×400, si ripete.
static func stars() -> String:
	var r := RandomNumberGenerator.new()
	r.seed = 21
	var s := ""
	for i in 70:
		s += "<circle cx=\"%.1f\" cy=\"%.1f\" r=\"%.2f\" fill=\"#ffffff\" opacity=\"%.2f\"/>" % [r.randf() * 400, r.randf() * 400, 0.4 + r.randf() * 0.9, 0.25 + r.randf() * 0.55]
	return _svg(400, 400, s)
