# FX Terminal player headshots

Drop player photos here as `<anything>.png` (square, clean/transparent bg ideal).
Then register each in `lib/wc2026/playerVisual.ts` → PLAYER_PHOTOS:

  "kylian mbappe": "/player-photos/mbappe.png",

(key = the player's name, lowercased, accents stripped.)

Until a player's photo is registered, their card shows their national flag,
and if their nation is unknown, the Polymarket event icon. Nothing renders blank.

Players needing photos: <players-needing-photos.txt> (123 players)
