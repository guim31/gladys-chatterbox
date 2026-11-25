# Chatterbox TTS

Donne à Gladys une voix expressive avec **Chatterbox**, le modèle de synthèse
vocale libre (licence MIT) de [Resemble AI](https://www.resemble.ai), servi par
[Chatterbox-TTS-Server](https://github.com/devnen/Chatterbox-TTS-Server) sur une
machine de votre réseau : les textes restent chez vous. Les annonces des scènes
sont dites par lui sur vos enceintes.

Développée sans carte graphique : vos retours sont les bienvenus.

## Ce que vous obtenez

- Une **voix pour Gladys** (Gladys 5.3.0 ou plus) : une fois choisie, l'action
  de scène **Parler sur une enceinte** parle avec Chatterbox sur vos enceintes
  (Sonos, Google Cast, AirPlay…).
- **Français, anglais, allemand et espagnol** avec le modèle multilingue :
  chaque utilisateur entend sa langue, ou une langue fixe que vous choisissez.
- **Une voix par langue** : l'une des 28 voix prêtes du serveur (Emily,
  Gabriel, Olivia…), ou une voix **clonée** depuis un enregistrement de 10 à 20
  secondes déposé sur le serveur.
- Réglages d'**expressivité** (de monotone à théâtrale) et de **vitesse**.
- Des boutons **Tester la voix** (avec le temps mis) et **Afficher les voix**
  dans la configuration.
- Deux déclencheurs de scène : **Serveur Chatterbox indisponible** et
  **Serveur Chatterbox revenu**.

## Avant de commencer

- Installez Chatterbox-TTS-Server (Docker ou Python, voir son README), port
  8004 par défaut.
- **Une carte graphique est nécessaire en pratique.** Gladys attend le clip 30
  secondes. Mesuré sur un mini PC à 4 cœurs sans carte graphique, avec le
  modèle multilingue : une à deux minutes pour un simple « Oui. » ou une phrase
  courte, soit bien trop pour une annonce. Avec une carte graphique NVIDIA ou AMD, une
  phrase prend une à quelques secondes.
- Pour le français, l'allemand ou l'espagnol, réglez dans son `config.yaml` :
  `model: repo_id: chatterbox-multilingual` (environ 3 Go téléchargés au
  premier démarrage). Le modèle par défaut, `chatterbox-turbo`, ne parle que
  l'anglais.
- Sur processeur seul, la version actuelle de Chatterbox-TTS-Server ne charge
  pas le modèle multilingue (erreur `Attempting to deserialize object on a
CUDA device`) : c'est un défaut du serveur, corrigé dans le Chatterbox
  officiel de Resemble AI.
- Voix clonées : déposez un WAV ou un MP3 propre (une seule personne, sans
  musique) dans le dossier `reference_audio` du serveur. Ne clonez que des voix
  dont vous avez le droit d'usage.
- Chaque clip porte un filigrane audio inaudible (Perth) de Resemble AI, qui
  signale un son généré par IA.
- Sans lien avec Resemble AI ni avec l'auteur de Chatterbox-TTS-Server.

## Configuration

1. Installez l'intégration, puis ouvrez son onglet **Configuration**.
2. **Adresse du serveur** : par exemple `http://<hôte>:8004`. Un simple
   `hôte:port` est complété par `http://`.
3. **Langue** : Automatique (la langue de l'utilisateur de Gladys, le français
   si elle est inconnue) ou une langue fixe.
4. **Voix pour le français / l'anglais / l'allemand / l'espagnol** : le nom
   d'une voix prête (`Emily`, `Gabriel`…) ou d'un enregistrement de
   `reference_audio` (`Ma_voix`), avec ou sans `.wav`. Vide : Emily.
5. **Expressivité** et **Vitesse** : « Réglage du serveur » garde celui de son
   `config.yaml`. 0,5 donne une voix neutre ; au-delà, la voix est plus émotive
   et plus rapide. Le modèle Turbo ignore l'expressivité.
6. Enregistrez, puis appuyez sur **Afficher les voix**, et sur **Tester la
   voix** pour vérifier qu'un clip revient (secondes de son et temps mis ; le
   bouton ne le joue pas).
7. Ouvrez **Intégrations → Intelligence artificielle** et choisissez
   Chatterbox TTS dans la carte **Voix**.

## Utilisation dans les scènes

Ajoutez une action **Parler sur une enceinte** à une scène, choisissez une
enceinte et tapez le texte. Gladys demande le clip à cette intégration, puis le
sert à l'enceinte sur votre réseau local.

Les déclencheurs **Serveur Chatterbox indisponible** et **Serveur Chatterbox
revenu** lancent une scène, par exemple pour vous envoyer un message. Le
serveur est vérifié toutes les 5 minutes.

L'assistant vocal de Gladys reste en texte avec une intégration de voix : sa
page passe en HTTPS, et le clip est servi sur le réseau local en HTTP, ce que
le navigateur bloque. C'est une limite de Gladys, la même pour toutes les
intégrations de voix.

## Limites

- **Gladys attend 30 secondes** le clip (l'intégration abandonne à 25 s) :
  sans carte graphique, les annonces échouent. Un texte qui dépasse le délai
  échoue sans marquer le serveur indisponible.
- Un modèle anglais seul (`chatterbox-turbo`, `chatterbox`) refuse le
  français, l'allemand et l'espagnol plutôt que de les lire avec des sons
  anglais ; la Supervision le signale.
- Les clips sont en WAV (24 kHz). Gladys refuse les clips de plus de 5 Mo
  (environ 100 secondes) : un clip plus long est rééchantillonné plus bas.
- Un clip déjà fait (même texte et mêmes réglages) est gardé en mémoire (les
  16 derniers), et une annonce sur plusieurs enceintes ne sollicite le serveur
  qu'une fois.
- Pas de mot de passe : Chatterbox-TTS-Server n'en demande pas. Ne l'exposez
  pas hors de votre réseau.

## Dépannage

- La **Supervision** indique si le serveur répond, avec son modèle, ou s'il
  charge encore son modèle.
- Une annonce ratée est écrite dans les **journaux** de l'intégration, avec la
  raison donnée par le serveur (voix introuvable, pas de réponse à temps…). Le
  texte dit n'est jamais écrit.
- « Pas de voix de ce nom » : appuyez sur **Afficher les voix** et recopiez un
  nom de la liste.
- « Injoignable » : vérifiez l'adresse, le port (8004 par défaut) et que le
  serveur écoute sur `0.0.0.0`.
- Plus de détails en debug : passez le niveau de journal de l'intégration en
  debug.
