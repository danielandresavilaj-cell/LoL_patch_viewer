import type { ChampionSummary } from "../types";

export const mockAhri: ChampionSummary = {
  id: "Ahri",
  key: "103",
  name: "Ahri",
  title: "the Nine-Tailed Fox",
  blurb: "Innately connected to the magic of the spirit realm...",
  tags: ["Mage", "Assassin"],
  partype: "Mana",
  info: { attack: 3, defense: 4, magic: 8, difficulty: 5 },
  stats: {
    hp: 590,
    mp: 418,
    armor: 21,
    spellblock: 30,
    attackdamage: 53,
    attackspeed: 0.668,
    movespeed: 330,
    attackrange: 550,
  },
  imageUrl: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Ahri.png",
  version: "14.1.1",
};

export const mockGaren: ChampionSummary = {
  id: "Garen",
  key: "86",
  name: "Garen",
  title: "The Might of Demacia",
  blurb: "A proud and noble warrior...",
  tags: ["Fighter", "Tank"],
  partype: "None",
  info: { attack: 7, defense: 7, magic: 1, difficulty: 5 },
  stats: {
    hp: 690,
    mp: 0,
    armor: 38,
    spellblock: 32,
    attackdamage: 69,
    attackspeed: 0.625,
    movespeed: 340,
    attackrange: 175,
  },
  imageUrl:
    "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/Garen.png",
  version: "14.1.1",
};
