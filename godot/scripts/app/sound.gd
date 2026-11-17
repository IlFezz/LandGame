## Suoni e musica sintetizzati (nessun file), con le stesse note di app.js; vibrazione.
## Gli effetti si calcolano una volta all'avvio; la musica ambient (accordi lenti con riverbero)
## si genera su un thread e poi gira in loop.
extends RefCounted

const Prefs := preload("res://scripts/app/prefs.gd")
const RATE := 22050

static var _fx := {}
static var _players: Array = []
static var _music_player: AudioStreamPlayer
static var _music_stream: AudioStreamWAV
static var _music_thread: Thread
static var _node: Node


static func _host() -> Node:
	if _node == null or not is_instance_valid(_node):
		_node = Node.new()
		_node.name = "Suoni"
		_node.process_mode = Node.PROCESS_MODE_ALWAYS
		(Engine.get_main_loop() as SceneTree).root.add_child.call_deferred(_node)
		_players = []
	return _node


# ---------------- sintesi ----------------

static func _wave(kind: String, ph: float) -> float:
	var x := fposmod(ph, 1.0)
	match kind:
		"triangle":
			return 4.0 * absf(x - 0.5) - 1.0
		"square":
			return 1.0 if x < 0.5 else -1.0
		"sawtooth":
			return 2.0 * x - 1.0
	return sin(TAU * x)


## Un tono come Sound.tone di app.js: attacco di 10 ms e coda esponenziale, frequenza che scivola a `to`.
static func _tone(buf: PackedFloat32Array, freq: float, dur: float, kind := "sine", vol := 0.12, at := 0.0, to := 0.0) -> void:
	var start := int(at * RATE)
	var n := int(dur * RATE)
	var ph := 0.0
	for i in n:
		var t := float(i) / RATE
		var f := freq * pow(to / freq, t / dur) if to > 0 else freq
		ph += f / RATE
		var g: float
		if t < 0.01:
			g = 0.0001 * pow(vol / 0.0001, t / 0.01)
		else:
			g = vol * pow(0.0001 / vol, (t - 0.01) / maxf(0.001, dur - 0.01))
		var j := start + i
		if j < buf.size():
			buf[j] += _wave(kind, ph) * g


## Rumore filtrato come Sound.noise: filtro passa-basso che si chiude fino a `to`.
static func _noise(buf: PackedFloat32Array, dur: float, vol := 0.15, at := 0.0, freq := 1200.0, to := 0.0) -> void:
	var start := int(at * RATE)
	var n := int(dur * RATE)
	var y := 0.0
	for i in n:
		var t := float(i) / RATE
		var fc := freq * pow(to / freq, t / dur) if to > 0 else freq
		var a := 1.0 - exp(-TAU * fc / RATE)
		y += a * (randf() * 2.0 - 1.0 - y)
		var g := vol * pow(0.0001 / vol, t / dur)
		var j := start + i
		if j < buf.size():
			buf[j] += y * g * 1.6


static func _to_wav(buf: PackedFloat32Array, stereo := false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(buf.size() * 2)
	for i in buf.size():
		bytes.encode_s16(i * 2, int(clampf(buf[i], -1.0, 1.0) * 32767.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = stereo
	w.data = bytes
	return w


static func _make(name: String) -> AudioStreamWAV:
	var b := PackedFloat32Array()
	b.resize(int(RATE * 0.9))
	match name:
		"draw":
			_tone(b, 900, 0.07, "triangle", 0.06, 0, 600)
		"play":
			_tone(b, 260, 0.12, "sine", 0.14, 0, 180)
			_noise(b, 0.08, 0.05, 0, 2500)
		"land":
			_tone(b, 330, 0.16, "triangle", 0.12)
			_tone(b, 495, 0.2, "triangle", 0.1, 0.07)
		"counter":
			_tone(b, 1400, 0.28, "sawtooth", 0.05, 0, 250)
			_noise(b, 0.2, 0.05, 0, 4000, 500)
		"fizzle":
			_noise(b, 0.35, 0.12, 0, 3000, 200)
		"destroy":
			_noise(b, 0.4, 0.25, 0, 900, 80)
			_tone(b, 110, 0.25, "square", 0.06, 0, 50)
		"regrow":
			_tone(b, 392, 0.12, "triangle", 0.1)
			_tone(b, 523, 0.12, "triangle", 0.1, 0.08)
			_tone(b, 659, 0.18, "triangle", 0.1, 0.16)
		"discard":
			_noise(b, 0.12, 0.1, 0, 1800)
			_tone(b, 300, 0.15, "sine", 0.08, 0, 180)
		"reuse":
			for i in 3:
				_tone(b, [660, 880, 990][i], 0.2, "sine", 0.06, i * 0.06)
		"look":
			_tone(b, 500, 0.25, "sine", 0.05, 0, 700)
		"turn":
			_tone(b, 523, 0.15, "sine", 0.09)
			_tone(b, 784, 0.25, "sine", 0.09, 0.12)
		"tick":
			_tone(b, 1050, 0.04, "square", 0.03)
		"timeout":
			_tone(b, 220, 0.3, "square", 0.06, 0, 140)
		"win":
			for i in 4:
				_tone(b, [523, 659, 784, 1046][i], 0.28, "triangle", 0.1, i * 0.12)
		"lose":
			for i in 3:
				_tone(b, [392, 330, 262][i], 0.35, "triangle", 0.09, i * 0.18)
		"click":
			_tone(b, 700, 0.03, "triangle", 0.04)
		"grab":
			_tone(b, 420, 0.12, "triangle", 0.07, 0, 820)
		"deny":
			_tone(b, 220, 0.14, "square", 0.04, 0, 170)
	# toglie il silenzio in fondo
	var last := b.size() - 1
	while last > 0 and absf(b[last]) < 0.0005:
		last -= 1
	b.resize(mini(b.size(), last + 200))
	return _to_wav(b)


## Prepara gli effetti (si chiama all'avvio).
static func prepare() -> void:
	for n in ["draw", "play", "land", "counter", "fizzle", "destroy", "regrow", "discard", "reuse", "look",
			"turn", "tick", "timeout", "win", "lose", "click", "grab", "deny"]:
		_fx[n] = _make(n)
	_host()
	if Prefs.get_value("music"):
		set_music(true)


static func play(name: String) -> void:
	if not Prefs.get_value("sound") or not _fx.has(name):
		return
	var host := _host()
	var p: AudioStreamPlayer = null
	for q in _players:
		if is_instance_valid(q) and not q.playing:
			p = q
			break
	if p == null:
		if _players.size() >= 8:
			return
		p = AudioStreamPlayer.new()
		host.add_child.call_deferred(p)
		_players.append(p)
	p.stream = _fx[name]
	if p.is_inside_tree():
		p.play()
	else:
		p.ready.connect(p.play, CONNECT_ONE_SHOT)


## Vibrazioni della partita, per forza: "light" (il tuo turno, un fumetto), "medium" (contrasto,
## scarto, una terra che entra), "strong" (distruzione, terra annullata, avviso), "win", "lose".
## Durano almeno 180 ms e sono a piena intensità: alcuni telefoni (per esempio OnePlus/Oppo)
## trasformano le vibrazioni più brevi in un «tic» quasi impercettibile.
const VIBES := {"light": [180, 0.7], "medium": [240, 0.9], "strong": [340, 1.0], "win": [520, 1.0], "lose": [300, 0.8]}


static func vibrate(kind) -> void:
	if not Prefs.get_value("vibrate") or not OS.has_feature("mobile"):
		return
	var v: Array = VIBES.get(kind, VIBES.medium) if kind is String else [maxi(90, int(kind) * 3), 1.0]
	Input.vibrate_handheld(v[0], v[1])


# ---------------- musica ----------------

static func set_music(on: bool) -> void:
	Prefs.set_value("music", on)
	if not on:
		if _music_player != null and is_instance_valid(_music_player):
			var tw := _music_player.create_tween()
			tw.tween_property(_music_player, "volume_db", -60.0, 0.8)
			tw.tween_callback(_music_player.stop)
		return
	if _music_stream == null and FileAccess.file_exists(MUSIC_FILE):
		var w := AudioStreamWAV.load_from_file(MUSIC_FILE)
		if w != null:
			w.loop_mode = AudioStreamWAV.LOOP_FORWARD
			w.loop_begin = 0
			w.loop_end = w.data.size() / 4
			_music_stream = w
	if _music_stream != null:
		_start_music()
	elif _music_thread == null:
		_music_thread = Thread.new()
		_music_thread.start(_build_music)


static func _start_music() -> void:
	if not Prefs.get_value("music"):
		return
	if _music_player == null or not is_instance_valid(_music_player):
		_music_player = AudioStreamPlayer.new()
		_host().add_child.call_deferred(_music_player)
		await _music_player.ready
	_music_player.stream = _music_stream
	_music_player.volume_db = -40.0
	_music_player.play()
	_music_player.create_tween().tween_property(_music_player, "volume_db", 0.0, 3.0)


static func _mtof(m: float) -> float:
	return 440.0 * pow(2.0, (m - 69.0) / 12.0)


## Una voce lenta: attacco, tenuta, coda (come Music.voice).
static func _voice(buf: PackedFloat32Array, freq: float, t0: float, kind := "sine", peak := 0.04, attack := 2.5, hold := 6.0, release := 3.5, detune := 0.0) -> void:
	var f := freq * pow(2.0, detune / 1200.0)
	var table: PackedFloat32Array = _table(kind)
	var tsize := table.size()
	var total := attack + hold + release
	var start := int(t0 * RATE)
	var n := int(total * RATE)
	var ph := randf() * tsize
	var size := buf.size()
	var na := int(attack * RATE)
	var nh := int((attack + hold) * RATE)
	var decay := pow(0.0001 / peak, 1.0 / (release * RATE))  # la coda si calcola moltiplicando
	var g := 0.0
	var step := f / RATE * tsize
	for i in n:
		if i < na:
			g = peak * i / na
		elif i < nh:
			g = peak
		else:
			g *= decay
		ph += step
		if ph >= tsize:
			ph -= tsize
		var j := start + i
		if j >= size:
			j -= size  # il pezzo gira in loop: la coda rientra all'inizio
		buf[j] += table[int(ph)] * g


static var _tables := {}


## Una forma d'onda già calcolata (2048 punti): leggerla costa molto meno che calcolarla.
static func _table(kind: String) -> PackedFloat32Array:
	if not _tables.has(kind):
		var t := PackedFloat32Array()
		t.resize(2048)
		for i in 2048:
			t[i] = _wave(kind, i / 2048.0)
		_tables[kind] = t
	return _tables[kind]


const MUSIC_FILE := "user://musica.wav"


## Dm9 · Bbmaj7 · Gm(add9) · A7sus4, lento e cupo, con note sparse sopra (come Music in app.js).
static func _build_music() -> void:
	var chords := [[38, 50, 53, 57, 64], [34, 50, 53, 58, 62], [31, 50, 55, 58, 62], [33, 52, 57, 62, 64]]
	var scale := [62, 65, 67, 69, 72, 74, 77]
	var length := 11.0 * 4
	var buf := PackedFloat32Array()
	buf.resize(int(length * RATE))
	for k in 4:
		var t := k * 11.0
		var notes: Array = chords[k % 4]
		for i in notes.size():
			var f := _mtof(notes[i])
			if i == 0:
				_voice(buf, f, t, "sine", 0.06, 2.5, 8)
				_voice(buf, f / 2, t, "sine", 0.035, 4, 8)
			else:
				_voice(buf, f, t + i * 0.12, "triangle", 0.018, 2.5, 6, 3.5, -6)
				_voice(buf, f, t + i * 0.12, "sine", 0.022, 2.5, 6, 3.5, 6)
	var tn := 2.0
	while tn < length:
		if randf() < 0.55:
			_voice(buf, _mtof(scale[randi() % scale.size()]), tn, "sine", 0.028, 0.4, 0.1, 4.5)
		tn += 2.2 + randf() * 4
	# filtro morbido e due eco con ritorno, come il riverbero leggero della versione web
	var out := PackedFloat32Array()
	out.resize(buf.size() * 2)
	var y := 0.0
	var a := 1.0 - exp(-TAU * 950.0 / RATE)
	for i in buf.size():
		y += a * (buf[i] - y)
		buf[i] = y
	var d1 := int(0.37 * RATE)
	var d2 := int(0.53 * RATE)
	var e1 := PackedFloat32Array()
	e1.resize(buf.size())
	var e2 := PackedFloat32Array()
	e2.resize(buf.size())
	for i in buf.size():
		e1[i] = buf[i - d1] * 0.55 + e1[i - d1] * 0.55 if i >= d1 else 0.0
		e2[i] = buf[i - d2] * 0.5 + e2[i - d2] * 0.5 if i >= d2 else 0.0
		var dry := buf[i] * 0.6
		out[i * 2] = (dry + e1[i] * 0.55 * 0.75 + e2[i] * 0.55 * 0.25) * 1.5
		out[i * 2 + 1] = (dry + e1[i] * 0.55 * 0.25 + e2[i] * 0.55 * 0.75) * 1.5
	var w := _to_wav(out, true)
	w.loop_mode = AudioStreamWAV.LOOP_FORWARD
	w.loop_begin = 0
	w.loop_end = buf.size()
	w.save_to_wav(MUSIC_FILE)  # la prossima volta parte subito
	_music_stream = w
	(Engine.get_main_loop() as SceneTree).process_frame.connect(func():
		if _music_thread != null:
			_music_thread.wait_to_finish()
			_music_thread = null
		_start_music(), CONNECT_ONE_SHOT)
