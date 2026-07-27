"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Gamepad2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

type Game = {
  app_id: number;
  name: string;
  header_image: string | null;
  genres: string[];
  groupPlaytime: number;
};

export function ViableGames({ games, metadataPending, sessionId }: { games: Game[]; metadataPending: number; sessionId: string }) {
  const [genre, setGenre] = useState("All");
  const [sort, setSort] = useState("name");
  const genres = useMemo(
    () => ["All", ...Array.from(new Set(games.flatMap((game) => game.genres))).sort()],
    [games],
  );
  const shown = useMemo(
    () => games
      .filter((game) => genre === "All" || game.genres.includes(genre))
      .sort((a, b) => sort === "playtime"
        ? b.groupPlaytime - a.groupPlaytime
        : sort === "genre"
          ? (a.genres[0] || "Uncategorized").localeCompare(b.genres[0] || "Uncategorized") || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name)),
    [games, genre, sort],
  );

  return <>
    <div className="gameControls">
      <div><SlidersHorizontal size={16} /><span>{shown.length} shared {shown.length === 1 ? "game" : "games"}</span></div>
      <label>Genre<div className="selectWrap">
        <select value={genre} onChange={(event) => setGenre(event.target.value)}>
          {genres.map((value) => <option key={value}>{value}</option>)}
        </select>
        <ChevronDown size={14} />
      </div></label>
      <label>Sort by<div className="selectWrap">
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="name">Name</option>
          <option value="genre">Genre</option>
          <option value="playtime">Group playtime</option>
        </select>
        <ChevronDown size={14} />
      </div></label>
    </div>
    {metadataPending > 0 && <p className="muted">Checking {metadataPending} more shared {metadataPending === 1 ? "game" : "games"} with Steam…</p>}
    {!shown.length && metadataPending === 0 && <div className="emptyGames"><Gamepad2 /><p>No shared multiplayer games match this genre.</p></div>}
    <div className="gameGrid">
      {shown.map((game) => <Link href={`/sessions/${sessionId}/games/${game.app_id}`} className="gameCard" key={game.app_id}>
        <div className="gameImage" style={{ backgroundImage: `url(${game.header_image || ""})` }} />
        <div className="gameInfo">
          <h3>{game.name}</h3>
          <div className="tags">{game.genres.map((value) => <span key={value}>{value}</span>)}</div>
          <p>Owned by everyone · {Math.round(game.groupPlaytime / 60)} group hours</p>
          <p><b>View member playtime comparison →</b></p>
        </div>
      </Link>)}
    </div>
  </>;
}
