# Chatterbox TTS

Gibt Gladys eine ausdrucksstarke Stimme mit **Chatterbox**, dem freien
(MIT-Lizenz) Sprachsynthesemodell von [Resemble AI](https://www.resemble.ai),
bereitgestellt von
[Chatterbox-TTS-Server](https://github.com/devnen/Chatterbox-TTS-Server) auf
einem Rechner in deinem Netzwerk: Die Texte bleiben bei dir. Die Durchsagen
deiner Szenen werden damit auf deinen Lautsprechern gesprochen.

Ohne Grafikkarte entwickelt: Rückmeldungen sind willkommen.

## Was du bekommst

- Eine **Stimme für Gladys** (Gladys 5.3.0 oder neuer): Einmal gewählt,
  spricht die Szenenaktion **Auf einem Lautsprecher sprechen** mit Chatterbox
  auf deinen Lautsprechern (Sonos, Google Cast, AirPlay…).
- **Französisch, Englisch, Deutsch und Spanisch** mit dem mehrsprachigen
  Modell: Jeder Benutzer hört seine Sprache, oder eine feste Sprache, die du
  wählst.
- **Eine Stimme pro Sprache**: eine der 28 fertigen Stimmen des Servers
  (Emily, Gabriel, Olivia…) oder eine Stimme, **geklont** aus einer Aufnahme
  von 10 bis 20 Sekunden auf dem Server.
- Einstellungen für **Ausdrucksstärke** (von monoton bis dramatisch) und
  **Geschwindigkeit**.
- Die Schaltflächen **Stimme testen** (mit der benötigten Zeit) und **Stimmen
  anzeigen** in der Konfiguration.
- Zwei Szenenauslöser: **Chatterbox-Server nicht verfügbar** und
  **Chatterbox-Server wieder da**.

## Bevor du anfängst

- Installiere Chatterbox-TTS-Server (Docker oder Python, siehe sein README),
  standardmäßig Port 8004.
- **In der Praxis ist eine Grafikkarte nötig.** Gladys wartet 30 Sekunden auf
  den Clip. Gemessen auf einem Mini-PC mit 4 Kernen ohne Grafikkarte, mit dem
  mehrsprachigen Modell: ein bis zwei Minuten für ein einfaches „Ja.“ oder einen
  kurzen Satz, viel zu lang für eine Durchsage. Mit einer NVIDIA- oder AMD-Grafikkarte
  dauert ein Satz eine bis wenige Sekunden.
- Für Französisch, Deutsch oder Spanisch stelle in seiner `config.yaml` ein:
  `model: repo_id: chatterbox-multilingual` (etwa 3 GB beim ersten Start
  heruntergeladen). Das Standardmodell `chatterbox-turbo` spricht nur
  Englisch.
- Nur mit Prozessor lädt die aktuelle Version von Chatterbox-TTS-Server das
  mehrsprachige Modell nicht (Fehler `Attempting to deserialize object on a
CUDA device`): ein Fehler des Servers, im offiziellen Chatterbox von
  Resemble AI behoben.
- Geklonte Stimmen: Lege eine saubere WAV- oder MP3-Datei (eine Person, ohne
  Musik) in den Ordner `reference_audio` des Servers. Klone nur Stimmen, die du
  verwenden darfst.
- Jeder Clip trägt ein unhörbares Audio-Wasserzeichen (Perth) von Resemble AI,
  das einen Ton als KI-erzeugt kennzeichnet.
- Keine Verbindung zu Resemble AI oder zum Autor von Chatterbox-TTS-Server.

## Konfiguration

1. Installiere die Integration und öffne ihren Reiter **Konfiguration**.
2. **Serveradresse**: zum Beispiel `http://<Host>:8004`. Ein bloßes
   `Host:Port` bekommt `http://`.
3. **Sprache**: Automatisch (die Sprache des Gladys-Benutzers, Französisch,
   wenn unbekannt) oder eine feste Sprache.
4. **Stimme für Französisch / Englisch / Deutsch / Spanisch**: der Name einer
   fertigen Stimme (`Emily`, `Gabriel`…) oder einer Aufnahme aus
   `reference_audio` (`Meine_Stimme`), mit oder ohne `.wav`. Leer: Emily.
5. **Ausdrucksstärke** und **Geschwindigkeit**: „Einstellung des Servers“
   behält die seiner `config.yaml`. 0,5 ergibt eine neutrale Stimme; darüber
   ist die Stimme emotionaler und schneller. Das Turbo-Modell ignoriert die
   Ausdrucksstärke.
6. Speichere, drücke dann **Stimmen anzeigen** und **Stimme testen**, um zu
   prüfen, dass ein Clip zurückkommt (Sekunden Ton und benötigte Zeit; die
   Schaltfläche spielt ihn nicht ab).
7. Öffne **Integrationen → Künstliche Intelligenz** und wähle Chatterbox TTS
   in der Karte **Stimme**.

## Verwendung in Szenen

Füge einer Szene die Aktion **Auf einem Lautsprecher sprechen** hinzu, wähle
einen Lautsprecher und tippe den Text. Gladys fragt diese Integration nach dem
Clip und liefert ihn dann im lokalen Netzwerk an den Lautsprecher.

Die Auslöser **Chatterbox-Server nicht verfügbar** und **Chatterbox-Server
wieder da** starten eine Szene, zum Beispiel um dir eine Nachricht zu senden.
Der Server wird alle 5 Minuten geprüft.

Der Sprachassistent von Gladys bleibt mit einer Stimmintegration bei Text:
Seine Seite läuft über HTTPS, der Clip wird im lokalen Netzwerk über HTTP
geliefert, was der Browser blockiert. Das ist eine Grenze von Gladys, gleich
für alle Stimmintegrationen.

## Grenzen

- **Gladys wartet 30 Sekunden** auf den Clip (die Integration gibt nach 25 s
  auf): Ohne Grafikkarte schlagen Durchsagen fehl. Ein Text über der Frist
  schlägt fehl, ohne den Server als nicht verfügbar zu markieren.
- Ein rein englisches Modell (`chatterbox-turbo`, `chatterbox`) lehnt
  Französisch, Deutsch und Spanisch ab, statt sie mit englischen Lauten zu
  lesen; die Überwachung meldet es.
- Clips sind WAV (24 kHz). Gladys lehnt Clips über 5 MB ab (etwa 100
  Sekunden): Ein längerer Clip wird niedriger abgetastet.
- Ein schon erstellter Clip (gleicher Text, gleiche Einstellungen) bleibt im
  Speicher (die letzten 16), und eine Durchsage auf mehreren Lautsprechern
  fragt den Server nur einmal.
- Kein Passwort: Chatterbox-TTS-Server verlangt keines. Mach ihn außerhalb
  deines Netzwerks nicht erreichbar.

## Fehlerbehebung

- Die **Überwachung** zeigt, ob der Server antwortet, mit seinem Modell, oder
  ob er sein Modell noch lädt.
- Eine fehlgeschlagene Durchsage steht in den **Logs** der Integration, mit
  dem Grund, den der Server angibt (Stimme nicht gefunden, keine rechtzeitige
  Antwort…). Der gesprochene Text wird nie geschrieben.
- „Keine Stimme mit diesem Namen“: Drücke **Stimmen anzeigen** und übernimm
  einen Namen aus der Liste.
- „Nicht erreichbar“: Prüfe die Adresse, den Port (standardmäßig 8004) und ob
  der Server auf `0.0.0.0` lauscht.
- Mehr Details im Debug-Modus: Stelle die Protokollstufe der Integration auf
  debug.
