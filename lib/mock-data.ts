import type { Game, Session } from "./types";

export const sessions: Session[] = [
  { id: "friday-crew", name: "Friday Night Crew", code: "FRY-829", frequency: "weekly", members: 5, status: "ready", nextDate: "Fri, 8:30 PM" },
  { id: "old-friends", name: "The Old Friends", code: "OLD-144", frequency: "biweekly", members: 4, status: "planning" },
];

export const games: Game[] = [
  { appid: 1172470, name: "Apex Legends", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1172470/header.jpg", owners: 5, maxPlayers: 60, genres: ["Action", "Battle Royale"] },
  { appid: 359550, name: "Rainbow Six Siege", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/359550/header.jpg", owners: 5, maxPlayers: 10, genres: ["Tactical", "Shooter"] },
  { appid: 252950, name: "Rocket League", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/252950/header.jpg", owners: 5, maxPlayers: 8, genres: ["Sports", "Competitive"] },
  { appid: 548430, name: "Deep Rock Galactic", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/548430/header.jpg", owners: 4, maxPlayers: 4, genres: ["Co-op", "Adventure"] },
];
