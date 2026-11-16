## Esegue una sola serie di test:  godot --headless --path godot -s res://tests/only.gd -- test_table
extends SceneTree


func _initialize() -> void:
	var suite = load("res://tests/%s.gd" % OS.get_cmdline_user_args()[0]).new()
	var failed := 0
	for t in suite.tests():
		suite.failures = []
		var r = await t[1].call()
		if r != true:
			suite.failures.append("interrotto da un errore")
		print(("ok    " if suite.failures.is_empty() else "FAIL  ") + t[0])
		for f in suite.failures:
			print("        - " + str(f))
		if not suite.failures.is_empty():
			failed += 1
	print("%d falliti" % failed)
	quit(1 if failed else 0)
