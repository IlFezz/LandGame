# Basic Land Game online

Il Basic Land Game di Magic giocabile da browser, in due, con stanze e codice d'invito.
Installabile come app su telefono (PWA). Nessuna dipendenza: serve solo Node.js 18 o più recente.

## Provarlo sul tuo computer

```bash
node server.js
```

Apri http://localhost:3000 in due finestre (una normale e una in incognito): crea la stanza nella prima, entra con il codice nella seconda.
Dallo stesso Wi‑Fi puoi giocare anche dal telefono con `http://IP-DEL-COMPUTER:3000` (l'installazione come app richiede però HTTPS, vedi sotto).

Test automatici: `npm test`.

## Metterlo online (gratis, con HTTPS)

Il server tiene le partite in memoria, quindi serve un hosting Node con WebSocket. Il più semplice è **Render**:

1. Carica questa cartella in un repository GitHub.
2. Su https://render.com → **New → Web Service** → scegli il repository.
3. Runtime: Node · Build command: *(vuoto)* · Start command: `node server.js` · Piano: Free.
4. Dopo il deploy avrai un indirizzo `https://...onrender.com`: condividilo e gioca.

Nota: sul piano gratuito il server si addormenta dopo ~15 minuti senza visite e il primo accesso impiega circa un minuto. Se il server si riavvia, le partite in corso vanno perse.

Alternative equivalenti: Railway, Fly.io, Glitch, un VPS qualsiasi (`PORT` viene letto dalle variabili d'ambiente).

## Installare come app

- **Android (Chrome):** apri il sito → menu ⋮ → *Installa app* / *Aggiungi a schermata Home*.
- **iPhone (Safari):** tasto Condividi → *Aggiungi alla schermata Home*.

## Funzioni

- Stanze con codice di 4 caratteri e link di invito; rientro automatico se cade la connessione.
- Animazioni per ogni evento (distribuzione, pescata, giocata, contrasto, terra annullata, ingresso in gioco, distruzione, recupero, scarto, Pianura) con didascalia che spiega cosa succede.
- Azioni nel pannello centrale e direttamente sul campo (i bersagli validi lampeggiano): la mano resta sempre visibile.
- Timer per turno scelto da chi crea la stanza (30/45/60/90 secondi o illimitato). Per contrastare o scegliere ci sono 20 secondi. Allo scadere: si passa il turno, la terra avversaria risolve, oppure la scelta viene fatta a caso.
- Indicatore di avanzamento (tipi diversi e terre uguali), con avviso quando qualcuno è a un passo dalla vittoria.
- Menu in partita: effetti sonori, vibrazione, registro, regole, esci.

## Struttura

- `game.js` – motore di gioco con tutte le regole (logica pura, testabile).
- `server.js` – server HTTP + WebSocket, gestione stanze e riconnessione.
- `public/` – client (HTML/CSS/JS), manifest e service worker.
- `test/` – test delle regole e test end-to-end con due client.

## Regole implementate

- Mazzo da 50 carte (10 per tipo), 5 carte iniziali, niente mulligan, chi inizia salta la prima pescata.
- Una terra per turno; si vince appena una terra entra in gioco e si ha dominio (5 tipi) o 5 terre uguali.
- **Pianura**: riattiva l'effetto di un'altra tua terra non‑Pianura in gioco.
- **Isola**: entrando peschi 1. Dalla mano, scartata con un'altra terra, contrasta la terra appena giocata (e il suo effetto). Un contrasto si può contrastare a sua volta.
- **Palude**: guardi la mano avversaria e scegli una terra da scartare.
- **Montagna**: distruggi una terra avversaria.
- **Foresta**: riprendi in mano una terra dal tuo cimitero.
- I bersagli di Montagna, Foresta e Pianura si dichiarano prima della finestra di contrasto. La Palude e gli effetti riattivati dalla Pianura scelgono alla risoluzione.
- Senza bersagli validi la terra si può giocare comunque, senza effetto.
- La finestra di contrasto viene offerta ogni volta che l'avversario ha almeno 2 carte in mano, così non si rivela se ha un'Isola.
- Mazzo vuoto: non si pesca. Quando entrambi i mazzi sono vuoti e le mani sono vuote, oppure entrambi passano di fila, vince chi ha più tipi distinti in gioco; in parità vince chi ha giocato l'ultima terra.
