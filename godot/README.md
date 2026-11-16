# Atlas — versione Godot

Il gioco rifatto in **Godot 4.7 (GDScript)** per Android, iPhone e web. Regole e funzioni sono quelle della versione web (vedi il `README.md` nella cartella principale).

## A che punto siamo

1. ✅ **Motore delle regole e computer**, tradotti da `game.js` e `bot.js`, con i test.
2. Tavolo e carte giocabili contro il computer, offline.
3. Grafica nuova, effetti e suoni veri.
4. Partite tra amici con lo stesso server Node (`server.js`).
5. Pubblicazione sugli store.

Per ora, premendo ▶ nell'editor si apre una schermata di prova: il computer normale gioca contro il difficile e il registro si riempie mossa dopo mossa (mentre il difficile pensa compare «BOT difficile sta pensando…» e la finestra resta fluida). Il pulsante «Nuova partita» ne fa un'altra.

## Aprirlo

Godot 4.7 → *Importa* → scegli `godot/project.godot`.

Il renderer è **Compatibilità** (OpenGL): è l'unico che funziona anche nella versione web e va bene anche sui telefoni più vecchi; per un gioco di carte in 2D non serve altro.

## Test

```bash
godot --headless --path godot -s res://tests/run_tests.gd
```

(`godot` è l'eseguibile di Godot, per esempio `F:\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe`.) Esce con codice 0 se tutto va bene. Dura circa un minuto, quasi tutto per le 2000 partite casuali e per le partite del computer difficile.

Altri due script, da lanciare allo stesso modo:
- `tests/bench.gd` misura la velocità delle simulazioni del computer difficile.
- `tests/strength.gd` fa giocare 100 partite tra difficile e normale e dice quante ne vince il difficile (qualche minuto).

## Struttura

- `scripts/rules/game.gd` (`AtlasGame`) – motore delle regole, logica pura: stesse regole, stessi messaggi del registro, stesse viste ed eventi di `game.js`. Le chiavi dei dizionari che escono dal motore (viste, eventi, azioni) sono le stesse della versione web, così al passo 4 il client parlerà con lo stesso server senza traduzioni.
- `scripts/rules/bot.gd` (`AtlasBot`) – computer facile, normale e difficile, come `bot.js`. Con `decide_async()` pensa su un thread separato e risponde con il segnale `decided`: il tavolo non si blocca mai.
- `scripts/rules/sim.gd` – la simulazione veloce usata solo dal difficile: stesse regole e stesse scelte del computer normale, ma con soli numeri. I test la confrontano mossa per mossa con la partita vera.
- `scripts/main.gd`, `scenes/main.tscn` – la schermata di prova.
- `tests/` – i test di `test/game.test.js` e `test/bot.test.js` tradotti, i test della simulazione veloce e qualche controllo in più (stesso seme = stessa partita, la copia per le simulazioni non tocca la partita vera, tempo di pensiero del difficile, pensiero su thread).

Differenze dalla versione web, tutte interne:
- `opts` accetta anche `seed` (un numero): con lo stesso seme la partita è sempre uguale. Servirà alla sfida del giorno.
- GDScript è circa 3 volte più lento del browser. Per giocare forte come sul web, il difficile non pensa 120 ms ma fa almeno 80 giri di simulazione (quelli che il browser fa in 120 ms), che su un PC sono circa 300–450 ms, e mai più di un secondo, anche su un telefono lento. Pensa su un thread, quindi l'attesa non blocca nulla e si sovrappone alle animazioni. Prova con `tests/strength.gd`: batte il normale 59 volte su 100 (nel browser circa 65).

Non ancora tradotti (arrivano con i passi dove servono): `hub.js` (stanze, timer, sfide, reazioni, tutorial) e quindi il test della sfida del giorno, i test del timer e del tutorial, la partita contro il computer attraverso il server.
