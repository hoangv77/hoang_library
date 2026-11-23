# IMDb collection replacement

Source: `22e1acce-6ffd-465b-9bd6-8574ae445e1e.csv` (52 unique titles).

Reconciled by IMDb ID against the previous 49-title collection. The result has **53 screen titles**: 25 matches, 27 additions, and Dexter retained because of saved personal work. Removed 23 absent titles with no personal work.

The saved overrides file was verified byte for byte unchanged. Favorites, comments, and custom ratings still apply by stable ID. The book collection was not imported or changed. New export ratings and metadata apply where there is no custom rating override.

Command: `npm run import:screen -- <csv-path> --preserve-edits`.

## Retained despite absence from the export

- Dexter (`tt0773262`)

## Added

- Seven (`tt0114369`)
- Inception (`tt1375666`)
- Pulp Fiction (`tt0110912`)
- 12 Angry Men (`tt0050083`)
- The Dark Knight (`tt0468569`)
- Project Hail Mary (`tt12042730`)
- Finding Nemo (`tt0266543`)
- Kill Bill: Vol. 1 (`tt0266697`)
- Oppenheimer (`tt15398776`)
- Shutter Island (`tt1130884`)
- The Wolf of Wall Street (`tt0993846`)
- Up (`tt1049413`)
- Oldboy (`tt0364569`)
- The Odyssey (`tt33764258`)
- Good Will Hunting (`tt0119217`)
- Avengers: Endgame (`tt4154796`)
- Inglourious Basterds (`tt0361748`)
- Dune: Part Two (`tt15239678`)
- Apocalypse Now (`tt0078788`)
- Parasite (`tt6751668`)
- Gladiator (`tt0172495`)
- City of God (`tt0317248`)
- Fight Club (`tt0137523`)
- Steins; Gate (`tt1910272`)
- Bleach: Thousand-Year Blood War (`tt14986406`)
- Hunter X Hunter (`tt2098220`)
- Serendipity (`tt0240890`)

## Removed

- Wayward (`tt27427326`)
- Eddington (`tt31176520`)
- Roofman (`tt4627382`)
- Marvel Adventures: Spider-Man and the Monsters of Manhattan (`tt13989548`)
- You (`tt7335184`)
- Unforgotten (`tt4192812`)
- House of Guinness (`tt13542714`)
- Law & Order: Special Victims Unit (`tt0203259`)
- Alien: Earth (`tt13623632`)
- Superman (`tt5950044`)
- F1: The Movie (`tt16311594`)
- Chainsaw Man - The Movie: Reze Arc (`tt30472557`)
- Grey's Anatomy (`tt0413573`)
- Him (`tt20990442`)
- Jujutsu Kaisen (`tt12343534`)
- KPop Demon Hunters (`tt14205554`)
- Lost (`tt0411008`)
- Zootopia 2 (`tt26443597`)
- X-Men (`tt0120903`)
- Nosferatu (`tt5040012`)
- Black Phone 2 (`tt29644189`)
- M (`tt0022100`)
- Mission: Impossible - The Final Reckoning (`tt9603208`)

## Artwork

50 of the 52 export titles matched TMDB and have poster artwork. Bleach: Thousand-Year Blood War and Dragon Ball Z use the archive's text fallback. Dexter keeps its existing artwork.
