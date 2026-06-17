export interface Colleague {
  id: string;
  name: string;
  surname: string;
  initials: string;
  color: string;
}

const colors = [
  'bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500', 
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500'
];

const colleaguesRaw = [
  {"name": "Alberto", "surname": "Pasquini"},
  {"name": "Alessandra", "surname": "Tedeschi"},
  {"name": "Alessandro", "surname": "Tedeschi Gallo"},
  {"name": "Alessia", "surname": "Golfetti"},
  {"name": "Alexandra", "surname": "Ghita"},
  {"name": "Alice", "surname": "Salvatori"},
  {"name": "Ana", "surname": "Ferreira"},
  {"name": "Anna", "surname": "Vicario"},
  {"name": "Andrea", "surname": "Capaccioli"},
  {"name": "Aurora", "surname": "De Bortoli"},
  {"name": "Andrea", "surname": "Carrieri"},
  {"name": "Marianna", "surname": "Groia"},
  {"name": "Carla", "surname": "Fresia"},
  {"name": "Carlo", "surname": "Abate"},
  {"name": "Damiano", "surname": "Taurino"},
  {"name": "Daria", "surname": "Verna"},
  {"name": "Elisa", "surname": "Spiller"},
  {"name": "Elizabeth", "surname": "Humm"},
  {"name": "Erica", "surname": "Vannucci"},
  {"name": "Francesca", "surname": "Piazza"},
  {"name": "Francesca", "surname": "Margiotta"},
  {"name": "Francois", "surname": "Brambati"},
  {"name": "Emanuela", "surname": "Laguardia"},
  {"name": "Angela", "surname": "Donati"},
  {"name": "Giorgio", "surname": "Sestili"},
  {"name": "Giuseppe", "surname": "Frau"},
  {"name": "Linda", "surname": "Portoghese"},
  {"name": "Viviana", "surname": "S. Couto"},
  {"name": "Linda", "surname": "Napoletano"},
  {"name": "Luca", "surname": "Save"},
  {"name": "Marta", "surname": "Cecconi"},
  {"name": "Mara", "surname": "Marzella"},
  {"name": "Marilea", "surname": "Laviola"},
  {"name": "Susanna", "surname": "Cohen"},
  {"name": "Michela", "surname": "Cohen"},
  {"name": "Michela", "surname": "Terenzi"},
  {"name": "Micol", "surname": "Biscotto"},
  {"name": "Morena", "surname": "Ugulini"},
  {"name": "Nicola", "surname": "Cavagnetto"},
  {"name": "Nikolas", "surname": "Giampaolo"},
  {"name": "Paola", "surname": "Lanzi"},
  {"name": "Paola", "surname": "Tomasello"},
  {"name": "Patrizia", "surname": "Di Leonardo"},
  {"name": "Rebecca", "surname": "Hueting"},
  {"name": "Roberto", "surname": "Venditti"},
  {"name": "Fabio", "surname": "Lovati"},
  {"name": "Katarzyna", "surname": "Cichomska"},
  {"name": "Annalisa", "surname": "De Angelis"},
  {"name": "Simona", "surname": "Turco"},
  {"name": "Simone", "surname": "Pozzi"},
  {"name": "Stefano", "surname": "Bonelli"},
  {"name": "Hossein", "surname": "Mapar"},
  {"name": "Tommaso", "surname": "Vendruscolo"},
  {"name": "Vanessa", "surname": "Arrigoni"},
  {"name": "Vera", "surname": "Ferraiuolo"},
  {"name": "Debora", "surname": "Zanatto"},
  {"name": "Bhavesh", "surname": "Sharma"},
  {"name": "Vladimira", "surname": "Canadyova"},
  {"name": "Serena", "surname": "Fabbrini"},
  {"name": "Serena", "surname": "Scuccimarra"},
  {"name": "Teodora", "surname": "Mosor"},
  {"name": "Sonia", "surname": "Matera"},
  {"name": "Natalia", "surname": "Kravchenko"},
  {"name": "Marta", "surname": "Renzini"},
  {"name": "Alfonso", "surname": "Levantesi"},
  {"name": "Emma", "surname": "Volpato"},
  {"name": "Veronika", "surname": "Takacs"},
  {"name": "Giusy", "surname": "Portolan"},
  {"name": "Lorenzo", "surname": "Mancini"},
  {"name": "Daniele", "surname": "Ruscio"},
  {"name": "Matteo", "surname": "Cirillo"},
  {"name": "Leonie", "surname": "Stieren"},
  {"name": "Virginia", "surname": "Procopio"},
  {"name": "Elisa", "surname": "Prati"},
  {"name": "Paris", "surname": "Vaiopoulos"},
  {"name": "Domenico", "surname": "De Pasquali"},
  {"name": "Claudia", "surname": "Iasillo"},
  {"name": "Izabela", "surname": "Ihnatiuc"},
  {"name": "Jean Baptiste", "surname": "Shamuana"},
  {"name": "Michele", "surname": "Di Virgilio"},
  {"name": "Ginevra", "surname": "Fedrizzi"},
  {"name": "Olivia", "surname": "Cox"},
  {"name": "Silvia", "surname": "Torsi"},
  {"name": "Edoardo", "surname": "Pedicini"},
  {"name": "Lorenzo", "surname": "Cane"},
  {"name": "Luca", "surname": "Cappello"}
];

export const COLLEAGUES: Colleague[] = colleaguesRaw.map((c, index) => ({
  id: `${c.name.toLowerCase()}-${c.surname.toLowerCase()}-${index}`,
  name: c.name,
  surname: c.surname,
  initials: `${c.name.charAt(0)}${c.surname.charAt(0)}`.toUpperCase(),
  color: colors[Math.floor(Math.abs(hashString(`${c.name}${c.surname}`)) % colors.length)]
}));

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}
