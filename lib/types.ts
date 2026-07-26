export type Frequency = "weekly" | "biweekly" | "monthly";
export type Session = { id: string; name: string; code: string; frequency: Frequency; members: number; status: "planning" | "ready"; nextDate?: string };
export type Game = { appid: number; name: string; image: string; owners: number; maxPlayers: number; genres: string[] };
