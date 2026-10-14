// Song packs: title, artist, cue time and difficulty only (spec § Music
// rounds). No lyrics, no audio: the host plays the song from their own phone.
// Cue times are starting suggestions; hosts adjust them on the song card.

import type { SongCard, SongPack } from "@/types/domain";

const s = (id: string, title: string, artist: string, cueSeconds = 45, difficulty: 1 | 2 | 3 = 1): SongCard => ({
  id,
  title,
  artist,
  cueSeconds,
  difficulty,
});

export const SONG_PACKS: SongPack[] = [
  {
    id: "afrobeats-classics",
    title: "Afrobeats classics",
    kind: "songs",
    premium: false,
    items: [
      s("ab1", "Ojuelegba", "Wizkid", 48, 2),
      s("ab2", "Fall", "Davido"),
      s("ab3", "If", "Davido"),
      s("ab4", "Ye", "Burna Boy"),
      s("ab5", "Johnny", "Yemi Alade"),
      s("ab6", "Skelewu", "Davido"),
      s("ab7", "Dami Duro", "Davido", 45, 2),
      s("ab8", "Essence", "Wizkid ft. Tems"),
      s("ab9", "Soco", "Wizkid"),
      s("ab10", "Pana", "Tekno"),
      s("ab11", "Duro", "Tekno", 45, 2),
      s("ab12", "Kele Kele Love", "Tiwa Savage", 45, 2),
      s("ab13", "Last Last", "Burna Boy"),
      s("ab14", "Love Nwantiti", "CKay"),
      s("ab15", "Calm Down", "Rema"),
      s("ab16", "Dumebi", "Rema", 45, 2),
      s("ab17", "Unavailable", "Davido"),
      s("ab18", "Assurance", "Davido", 45, 2),
    ],
  },
  {
    id: "2000s-naija",
    title: "2000s Naija",
    kind: "songs",
    premium: false,
    items: [
      s("n1", "African Queen", "2Face Idibia"),
      s("n2", "Yahooze", "Olu Maintain"),
      s("n3", "Do Me", "P-Square"),
      s("n4", "Busy Body", "P-Square", 45, 2),
      s("n5", "Gongo Aso", "9ice"),
      s("n6", "Why Me", "D'banj", 45, 2),
      s("n7", "Tongolo", "D'banj", 45, 2),
      s("n8", "Fall in Love", "D'banj"),
      s("n9", "Mr Lecturer", "Eedris Abdulkareem", 45, 3),
      s("n10", "Olufunmi", "Styl-Plus", 45, 2),
      s("n11", "Dem Mama", "Timaya", 45, 2),
      s("n12", "Implication", "2Face Idibia", 45, 3),
    ],
  },
  {
    id: "amapiano",
    title: "Amapiano",
    kind: "songs",
    premium: false,
    items: [
      s("am1", "Ke Star", "Focalistic", 45, 2),
      s("am2", "Mnike", "Tyler ICU"),
      s("am3", "Water", "Tyla"),
      s("am4", "Sungba", "Asake"),
      s("am5", "Terminator", "Asake"),
      s("am6", "Peace Be Unto You", "Asake", 45, 2),
      s("am7", "Ameno Amapiano (You Wanna Bamba)", "Goya Menor & Nektunez", 45, 2),
      s("am8", "Tshwala Bam", "TitoM & Yuppe", 45, 2),
      s("am9", "Jerusalema", "Master KG"),
    ],
  },
  {
    id: "street-pop",
    title: "Street-pop",
    kind: "songs",
    premium: false,
    items: [
      s("sp1", "Science Student", "Olamide"),
      s("sp2", "Wo", "Olamide"),
      s("sp3", "Shoki", "Lil Kesh"),
      s("sp4", "Soapy", "Naira Marley"),
      s("sp5", "Am I a Yahoo Boy", "Naira Marley & Zlatan", 45, 2),
      s("sp6", "Zanku (Legwork)", "Zlatan"),
      s("sp7", "Joha", "Asake"),
      s("sp8", "Mr Money", "Asake", 45, 2),
    ],
  },
  {
    id: "highlife",
    title: "Highlife",
    kind: "songs",
    premium: false,
    items: [
      s("hl1", "Sweet Mother", "Prince Nico Mbarga"),
      s("hl2", "Osondi Owendi", "Osita Osadebe", 45, 2),
      s("hl3", "Joromi", "Victor Uwaifo", 45, 2),
      s("hl4", "Ada Ada", "Flavour"),
      s("hl5", "Nwa Baby (Ashawo)", "Flavour"),
      s("hl6", "Ololufe", "Flavour", 45, 2),
    ],
  },
];
