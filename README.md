Xtream Viewer
=============

Petit site web (Node/Express + frontend statique) pour consulter un compte Xtream (Xtream Codes API / Xtream UI) :

- Affiche `user_info` et `server_info`
- Parcourt les catégories et chaînes Live (icônes incluses)
- Parcourt les catégories et VOD (icônes incluses)
- Séries (liste par catégorie)
- Téléchargement de playlists M3U (Tout / Live / VOD)
- Téléchargement de l’EPG (XMLTV)
- Bouton par élément pour générer un M3U “play” (ouvrir dans VLC)
- Génération de liens directs (URL / tentative `vlc://`)

Prérequis
---------

- Node.js 18+

Installation
------------

1. Installer les dépendances:

   npm install

2. Lancer le serveur en dev:

   npm run dev

3. Ouvrir l’URL:

   http://localhost:5173

Utilisation
-----------

1. Saisir l’URL du panel (ex: `http://host:port`) + vos identifiants.
2. Choisir le format de lecture souhaité (MPEG-TS ou HLS).
3. Se connecter pour voir `user_info`/`server_info` et les onglets.
4. Naviguer par catégorie, cliquer sur “M3U” pour un flux unique, “Copier URL” pour le lien brut, ou “Ouvrir”.
5. Utiliser les boutons “Télécharger M3U (Tout/Live/VOD)” et “Télécharger EPG”.

Notes techniques
---------------

- Beaucoup de panels bloquent CORS / hotlink: le backend agit comme proxy API (pas de proxy vidéo streaming).
- Les liens direct `.ts` peuvent ne pas jouer dans le navigateur; utilisez VLC ou HLS avec un lecteur compatible.
- Le schéma `vlc://` peut nécessiter l’enregistrement du protocole sur votre OS; sinon téléchargez un `.m3u` et ouvrez-le dans VLC.
- Pour HLS, option “HLS (.m3u8)” dans la barre supérieure; la disponibilité dépend du panel/transcoding.

Sécurité
-------

- Les identifiants sont envoyés au backend à chaque requête (pas de session côté serveur, simplification locale). Ne déployez pas tel quel sur Internet.
- Évitez d’exposer ce serveur publiquement sans ajout d’authentification et de chiffrement (HTTPS, sessions, rate-limit, logs réduits).

