## Esegue tutti i test del motore e del computer, senza aprire finestre:
##   godot --headless --path godot -s res://tests/run_tests.gd
## Esce con codice 0 se tutto va bene, 1 se qualcosa fallisce.
extends SceneTree

const SUITES := ["res://tests/test_game.gd", "res://tests/test_sim.gd", "res://tests/test_bot.gd", "res://tests/test_modes.gd", "res://tests/test_table.gd"]


## Parte quando il ciclo principale è avviato, così i test possono aspettare i fotogrammi (await).
func _initialize() -> void:
	var passed := 0
	var failed := 0
	for path in SUITES:
		var suite = load(path).new()
		print("\n== %s ==" % path.get_file())
		for t in suite.tests():
			suite.failures = []
			var t0 := Time.get_ticks_msec()
			var finished = await t[1].call()
			var ms := Time.get_ticks_msec() - t0
			if finished != true:
				suite.failures.append("il test si è interrotto per un errore (vedi SCRIPT ERROR sopra)")
			if suite.failures.is_empty():
				passed += 1
				print("ok    %s  (%d ms)" % [t[0], ms])
			else:
				failed += 1
				print("FAIL  %s" % t[0])
				for f in suite.failures:
					print("        - " + str(f))
	print("\n%d test superati, %d falliti" % [passed, failed])
	quit(1 if failed > 0 else 0)
