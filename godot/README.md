# Atlas — versione Godot

Il gioco rifatto in **Godot 4.7 (GDScript)** per Android, iPhone e web. Regole e funzioni sono quelle della versione web (vedi il `README.md` nella cartella principale).

## A che punto siamo

1. ✅ **Motore delle regole e computer**, tradotti da `game.js` e `bot.js`, con i test.
2. Tavolo e carte giocabili contro il computer, offline.
3. Grafica nuova, effetti e suoni veri.
4. Partite tra amici con lo stesso server Node (`server.js`).
5. Pubblicazione sugli store.

Per ora, premendo ▶ nell'editor si apre una schermata di prova: il computer normale gioca contro il difficile e si legge il registro della partita. Il pulsante «Nuova partita» ne fa un'altra.

## Aprirlo

Godot 4.7 → *Importa* → scegli `godot/project.godot`.

Il renderer è **Compatibilità** (OpenGL): è l'unico che funziona anche nella versione web e va bene anche sui telefoni più vecchi; per un gioco di carte in 2D non serve altro.

## Test

```bash
godot --headless --path godot -s res://tests/run_tests.gd
```

(`godot` è l'eseguibile di Godot, per esempio `F:\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe`.) Esce con codice 0 se tutto va bene. Dura circa un minuto, quasi tutto per le 2000 partite casuali e per le partite del computer difficile.

`tests/bench.gd` misura la velocità delle simulazioni del computer difficile.

## Struttura

- `scripts/rules/game.gd` (`AtlasGame`) – motore delle regole, logica pura: stesse regole, stessi messaggi del registro, stesse viste ed eventi di `game.js`. Le chiavi dei dizionari che escono dal motore (viste, eventi, azioni) sono le stesse della versione web, così al passo 4 il client parlerà con lo stesso server senza traduzioni.
- `scripts/rules/bot.gd` (`AtlasBot`) – computer facile, normale e difficile, come `bot.js`.
- `scripts/main.gd`, `scenes/main.tscn` – la schermata di prova.
- `tests/` – i test di `test/game.test.js` e `test/bot.test.js` tradotti, più qualche controllo in più (stesso seme = stessa partita, la copia per le simulazioni non tocca la partita vera, tempo di pensiero del difficile).

Differenze dalla versione web, tutte interne:
- `opts` accetta anche `seed` (un numero): con lo stesso seme la partita è sempre uguale. Servirà alla sfida del giorno.
- In GDScript il computer difficile è più lento che nel browser: con il minimo di 24 giri di simulazione pensa circa 150–200 ms per mossa su un PC. Al passo 2 il suo pensiero va spostato su un thread separato, così il tavolo non si blocca mai.

Non ancora tradotti (arrivano con i passi dove servono): `hub.js` (stanze, timer, sfide, reazioni, tutorial) e quindi il test della sfida del giorno, i test del timer e del tutorial, la partita contro il computer attraverso il server.
