# Atlas — istruzioni per Claude

## Chi e come
- Il proprietario è italiano: rispondi sempre in italiano, in modo semplice e diretto. Non è un programmatore di mestiere: spiega cosa hai fatto e cosa deve provare lui, non i dettagli tecnici.
- Commit e push solo quando lui lo chiede o quando il lavoro è finito e provato. `main` si pubblica da solo su Render (versione web).

## Il gioco
Atlas è il Basic Land Game di Magic: due giocatori, mazzi da 50 terre base (10 per tipo), si vince con 5 terre diverse in gioco o 5 uguali. Regole complete, funzioni e struttura in `README.md`: leggilo prima di tutto.

Versione web (questa cartella, in produzione):
- `game.js` motore delle regole (logica pura), `bot.js` computer (facile, normale, difficile), `hub.js` stanze/timer/sfide/reazioni, `server.js` server Node senza dipendenze.
- `public/` client in JS puro: `app.js`, `art.js` (disegni SVG generati), `fx.js`, `stats.js`, `goals.js`, `tutorial.js`.
- Test: `npm test`.

## Il passo in corso: versione Godot
Obiettivo: rifare Atlas in **Godot 4 (GDScript)** nella cartella `godot/`, come gioco vero per Android e iPhone (e web per il PC), con una grafica di livello da store. La versione web resta online finché la nuova non la sostituisce.

Ordine di lavoro concordato:
1. Progetto Godot in `godot/`, con il motore delle regole tradotto da `game.js` (stesse regole, stessi test) e il computer da `bot.js`.
2. Tavolo e carte giocabili contro il computer, offline.
3. Grafica nuova: illustrazioni vere per le carte (da illustratore o generatore di immagini: Claude non dipinge), effetti fatti dal motore, suoni veri.
4. Partite tra amici: il client Godot parla con lo stesso server Node (`server.js`, WebSocket, stessi messaggi di `hub.js`).
5. Pubblicazione sugli store.

Il collegamento con l'editor è il server MCP `godot` (`@coding-solo/godot-mcp`: avvia l'editor, esegue il progetto, legge gli errori), aggiunto dal proprietario sul suo computer. Se non c'è o non trova Godot, aiutalo ad aggiungerlo e a impostare `GODOT_PATH` con il percorso dell'eseguibile di Godot.

## Preferenze già espresse (valgono anche per Godot)
- Nessuno scorrimento: tutto deve stare nello schermo, su telefono verticale, orizzontale, tablet e PC.
- Nessuna sovrapposizione tra carte, scritte e pulsanti.
- Pulsante schermo intero sempre presente (entra ed esce).
- Effetti visibili ma non invadenti: la grafica avanzata web era "esagerata, distraeva, carte sgranate" ed è stata tolta.
- Su tablet il campo resta al centro; sul telefono in orizzontale la rosa dei venti va a destra.
- Prestazioni prima di tutto: niente scatti nel trascinamento delle carte.
- Le sfide non contano per statistiche, obiettivi e sblocchi; tra giocatori ci si arrende invece di uscire.
