// Starter question packs. Have a Nigerian editor review before launch:
// facts change (squads, records) and questions should be argued over on the
// street, not in the comments. The answer is always also listed in choices.

import type { QuestionPack } from "@/types/domain";

const q = (id: string, prompt: string, answer: string, wrong: string[], difficulty: 1 | 2 | 3 = 1) => ({
  id,
  prompt,
  answer,
  choices: stableShuffle([answer, ...wrong], id),
  difficulty,
});

/** Same order every time for a given id, so the answer's slot varies but never moves. */
function stableShuffle<T>(items: T[], key: string): T[] {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const QUESTION_PACKS: QuestionPack[] = [
  {
    id: "naija-general",
    title: "Naija general knowledge",
    kind: "questions",
    premium: false,
    items: [
      q("ng1", "What is the capital of Nigeria?", "Abuja", ["Lagos", "Kano", "Ibadan"]),
      q("ng2", "In what year did Nigeria gain independence?", "1960", ["1963", "1957", "1970"]),
      q("ng3", "How many states does Nigeria have?", "36", ["30", "37", "32"]),
      q("ng4", "Nigeria became a republic in which year?", "1963", ["1960", "1966", "1979"], 2),
      q("ng5", "Who was Nigeria's first Prime Minister?", "Abubakar Tafawa Balewa", ["Nnamdi Azikiwe", "Obafemi Awolowo", "Ahmadu Bello"], 2),
      q("ng6", "Who was Nigeria's first President?", "Nnamdi Azikiwe", ["Abubakar Tafawa Balewa", "Shehu Shagari", "Yakubu Gowon"], 2),
      q("ng7", "Which river meets the Niger at Lokoja?", "Benue", ["Ogun", "Kaduna", "Cross River"], 2),
      q("ng8", "Which Nigerian won the Nobel Prize in Literature in 1986?", "Wole Soyinka", ["Chinua Achebe", "Ben Okri", "Chimamanda Adichie"]),
      q("ng9", "Who wrote 'Things Fall Apart'?", "Chinua Achebe", ["Wole Soyinka", "Cyprian Ekwensi", "Buchi Emecheta"]),
      q("ng10", "In which year did Nigeria switch from pounds to the naira?", "1973", ["1960", "1980", "1966"], 3),
      q("ng11", "Olumo Rock is in which city?", "Abeokuta", ["Ibadan", "Oyo", "Ilorin"]),
      q("ng12", "Zuma Rock is in which state?", "Niger", ["Kogi", "Nasarawa", "Plateau"], 2),
      q("ng13", "What is the capital of Cross River State?", "Calabar", ["Uyo", "Ikom", "Ogoja"]),
      q("ng14", "What is the capital of Rivers State?", "Port Harcourt", ["Yenagoa", "Bonny", "Owerri"]),
      q("ng15", "What is the capital of Anambra State?", "Awka", ["Onitsha", "Nnewi", "Enugu"]),
      q("ng16", "What is the capital of Akwa Ibom State?", "Uyo", ["Calabar", "Eket", "Ikot Ekpene"]),
      q("ng17", "What is the capital of Delta State?", "Asaba", ["Warri", "Sapele", "Benin City"]),
      q("ng18", "What is the capital of Imo State?", "Owerri", ["Orlu", "Okigwe", "Umuahia"]),
      q("ng19", "What is the capital of Bayelsa State?", "Yenagoa", ["Brass", "Port Harcourt", "Ogbia"], 2),
      q("ng20", "What is the capital of Ekiti State?", "Ado-Ekiti", ["Ikere", "Akure", "Ilesa"]),
      q("ng21", "What is the capital of Ogun State?", "Abeokuta", ["Ijebu-Ode", "Sagamu", "Ota"]),
      q("ng22", "What is the capital of Kwara State?", "Ilorin", ["Offa", "Lokoja", "Oyo"]),
      q("ng23", "Which is Nigeria's largest national park?", "Gashaka-Gumti", ["Yankari", "Kainji Lake", "Old Oyo"], 3),
      q("ng24", "What is 100 kobo equal to?", "₦1", ["₦10", "₦100", "50 kobo"]),
      q("ng25", "What are the colours of the Nigerian flag?", "Green and white", ["Green and yellow", "Green, white and red", "White and blue"]),
    ],
  },
  {
    id: "lagos-streets",
    title: "Lagos streets",
    kind: "questions",
    premium: false,
    items: [
      q("ls1", "Which bridge is the longest in Lagos?", "Third Mainland Bridge", ["Eko Bridge", "Carter Bridge", "Lekki-Ikoyi Link Bridge"]),
      q("ls2", "What year did Third Mainland Bridge open?", "1990", ["1985", "1996", "1979"], 2),
      q("ls3", "What is the capital of Lagos State?", "Ikeja", ["Lagos Island", "Epe", "Badagry"]),
      q("ls4", "In which year did Abuja replace Lagos as Nigeria's capital?", "1991", ["1976", "1999", "1987"], 2),
      q("ls5", "Where is Computer Village?", "Ikeja", ["Yaba", "Surulere", "Ojota"]),
      q("ls6", "Alaba International Market is best known for?", "Electronics", ["Fabrics", "Foodstuff", "Car parts"]),
      q("ls7", "The yellow commercial buses in Lagos are called?", "Danfo", ["Molue", "Keke", "Korope"]),
      q("ls8", "Commercial motorcycles in Lagos are called?", "Okada", ["Keke", "Danfo", "Maruwa"]),
      q("ls9", "What does BRT stand for?", "Bus Rapid Transit", ["Big Road Transport", "Bus Route Terminal", "Bus Rail Transit"]),
      q("ls10", "The National Theatre is in which area?", "Iganmu", ["Ikoyi", "Yaba", "Apapa"], 2),
      q("ls11", "Murtala Muhammed International Airport is in which area?", "Ikeja", ["Lekki", "Ikorodu", "Oshodi"]),
      q("ls12", "Fela's Afrika Shrine is in which part of Lagos?", "Ikeja", ["Surulere", "Mushin", "Yaba"], 2),
      q("ls13", "Ojuelegba is in which part of Lagos?", "Surulere", ["Ikeja", "Yaba", "Mushin"], 2),
      q("ls14", "Balogun Market is on which side of Lagos?", "Lagos Island", ["Mainland", "Lekki", "Ikorodu"]),
      q("ls15", "Eko Atlantic is being built beside which island?", "Victoria Island", ["Lagos Island", "Ikoyi", "Banana Island"], 2),
      q("ls16", "Lekki Conservation Centre is famous for its?", "Canopy walkway", ["Zoo", "Waterfall", "Museum"]),
      q("ls17", "The Lagos Blue Line train started carrying passengers in which year?", "2023", ["2019", "2021", "2025"], 3),
      q("ls18", "Tafawa Balewa Square is in which part of Lagos?", "Lagos Island", ["Ikeja", "Apapa", "Surulere"], 2),
      q("ls19", "Elegushi Beach is in which area?", "Lekki", ["Badagry", "Epe", "Apapa"]),
      q("ls20", "Which Lagos area is home to the University of Lagos?", "Akoka", ["Ojo", "Ikeja", "Lekki"], 2),
    ],
  },
  {
    id: "football",
    title: "Football",
    kind: "questions",
    premium: false,
    items: [
      q("fb1", "What is the nickname of Nigeria's men's national team?", "Super Eagles", ["Green Eagles", "Flying Eagles", "Golden Eaglets"]),
      q("fb2", "What is the nickname of Nigeria's women's national team?", "Super Falcons", ["Super Eagles", "Flamingos", "Falconets"]),
      q("fb3", "In which year did Nigeria win Olympic football gold?", "1996", ["2000", "1992", "2008"]),
      q("fb4", "Nigeria's first World Cup was in which year?", "1994", ["1990", "1998", "1986"], 2),
      q("fb5", "Who scored Nigeria's first ever World Cup goal?", "Rashidi Yekini", ["Daniel Amokachi", "Jay-Jay Okocha", "Emmanuel Amunike"], 2),
      q("fb6", "Where was the 2013 AFCON, which Nigeria won, held?", "South Africa", ["Ghana", "Egypt", "Gabon"], 2),
      q("fb7", "Who coached the Super Eagles to the 2013 AFCON title?", "Stephen Keshi", ["Samson Siasia", "Sunday Oliseh", "Gernot Rohr"], 2),
      q("fb8", "Kanu Nwankwo won the Champions League with which club in 1995?", "Ajax", ["Arsenal", "Inter Milan", "Barcelona"], 3),
      q("fb9", "Victor Osimhen won Serie A in 2023 with which club?", "Napoli", ["Lille", "Galatasaray", "AC Milan"]),
      q("fb10", "Who was named African Footballer of the Year for 2023?", "Victor Osimhen", ["Mohamed Salah", "Sadio Mané", "Achraf Hakimi"]),
      q("fb11", "Who was named African Footballer of the Year for 2024?", "Ademola Lookman", ["Victor Osimhen", "Achraf Hakimi", "Simon Adingra"], 2),
      q("fb12", "Mikel Obi spent most of his career at which club?", "Chelsea", ["Arsenal", "Liverpool", "Manchester United"]),
      q("fb13", "Jay-Jay Okocha's real first name is?", "Augustine", ["Jonathan", "Joseph", "Jude"], 2),
      q("fb14", "Who was top scorer at AFCON 2019?", "Odion Ighalo", ["Mohamed Salah", "Riyad Mahrez", "Ahmed Musa"], 3),
      q("fb15", "How many times has Nigeria won the FIFA U-17 World Cup?", "5", ["3", "4", "2"], 3),
      q("fb16", "What is Nigeria's top football league called?", "NPFL", ["NFL", "NPL", "NSL"]),
      q("fb17", "The Godswill Akpabio International Stadium is in which city?", "Uyo", ["Calabar", "Abuja", "Port Harcourt"], 2),
      q("fb18", "Asisat Oshoala plays for which national team?", "Super Falcons", ["Black Queens", "Banyana Banyana", "Super Eagles"]),
    ],
  },
  {
    id: "nollywood",
    title: "Nollywood",
    kind: "questions",
    premium: false,
    items: [
      q("nw1", "Which 1992 film is often called Nollywood's first blockbuster?", "Living in Bondage", ["Osuofia in London", "Glamour Girls", "Rattlesnake"], 2),
      q("nw2", "Who plays the character Jenifa?", "Funke Akindele", ["Toyin Abraham", "Mercy Johnson", "Omotola Jalade"]),
      q("nw3", "Who directed 'The Wedding Party' (2016)?", "Kemi Adetiba", ["Kunle Afolayan", "Funke Akindele", "Mo Abudu"], 2),
      q("nw4", "Who directed 'King of Boys'?", "Kemi Adetiba", ["Niyi Akinmolayan", "Kunle Afolayan", "Jade Osiberu"], 2),
      q("nw5", "Who directed and starred in 'Lionheart' (2018)?", "Genevieve Nnaji", ["Omotola Jalade", "Rita Dominic", "Joke Silva"]),
      q("nw6", "Who starred as Osuofia in 'Osuofia in London'?", "Nkem Owoh", ["Sam Loco", "Pete Edochie", "John Okafor"]),
      q("nw7", "Which actors played Aki and Pawpaw?", "Chinedu Ikedieze and Osita Iheme", ["Nkem Owoh and Sam Loco", "Mr Ibu and Nkem Owoh", "Bovi and AY"]),
      q("nw8", "Who directed 'Anikulapo' (2022)?", "Kunle Afolayan", ["Femi Adebayo", "Tunde Kelani", "Kemi Adetiba"], 2),
      q("nw9", "Who directed 'The Figurine' (2009)?", "Kunle Afolayan", ["Tunde Kelani", "Izu Ojukwu", "Obi Emelonye"], 3),
      q("nw10", "What does RMD stand for?", "Richard Mofe-Damijo", ["Ramsey Mofe Daniels", "Richard Mike Dada", "Ramsey Nouah"]),
      q("nw11", "Pete Edochie is famous for playing Okonkwo in which TV series?", "Things Fall Apart", ["Checkmate", "Super Story", "Tinsel"], 2),
      q("nw12", "'Gangs of Lagos' (2023) premiered on which platform?", "Prime Video", ["Netflix", "Showmax", "YouTube"], 2),
      q("nw13", "'Blood Sisters' (2022) was released on?", "Netflix", ["Prime Video", "Showmax", "DSTV"], 2),
      q("nw14", "Who directed 'A Tribe Called Judah' (2023)?", "Funke Akindele", ["Kemi Adetiba", "Kunle Afolayan", "Toyin Abraham"], 2),
    ],
  },
  {
    id: "pidgin",
    title: "Pidgin wahala",
    kind: "questions",
    premium: true,
    items: [
      q("pg1", "What does 'Abeg' mean?", "Please", ["Thank you", "Hurry up", "Sorry"]),
      q("pg2", "What does 'Wahala' mean?", "Trouble", ["Money", "Food", "Party"]),
      q("pg3", "What does 'I no sabi' mean?", "I don't know", ["I'm not coming", "I'm not hungry", "I'm not sure"]),
      q("pg4", "What does 'Comot' mean?", "Leave / get out", ["Come in", "Calm down", "Come back"]),
      q("pg5", "What does 'Chop' mean?", "Eat", ["Cut", "Spend", "Sleep"]),
      q("pg6", "What does 'Pikin' mean?", "Child", ["Friend", "Small money", "Cousin"]),
      q("pg7", "What does 'Japa' mean?", "Relocate abroad", ["Run a race", "Get married", "Be broke"]),
      q("pg8", "What does 'Sapa' mean?", "Being broke", ["Being rich", "Being lazy", "Being tired"]),
      q("pg9", "What does 'Una' mean?", "You all", ["Us", "Them", "Only you"]),
      q("pg10", "What does 'Shakara' mean?", "Showing off", ["Dancing", "Crying", "Lying"]),
      q("pg11", "What does 'Gist' mean?", "Gossip or story", ["Food", "Money", "Argument"]),
      q("pg12", "What does 'Carry go' mean?", "Continue", ["Take it away", "Stop", "Go home"]),
      q("pg13", "What does 'K-leg' mean?", "Something is wrong", ["Fast walking", "Good luck", "A dance move"], 2),
      q("pg14", "What does 'Gbege' mean?", "Trouble", ["Celebration", "Small money", "Gossip"], 2),
      q("pg15", "What does 'No wahala' mean?", "No problem", ["No money", "No time", "No food"]),
      q("pg16", "What does 'How far?' usually mean?", "How are you?", ["How long?", "How much?", "Where are you?"]),
    ],
  },
];
