import { GameShell } from "@/features/game";
import { getGameData } from "@/lib/simulation";

export default function Home() {
  return <main><GameShell data={getGameData()} /></main>;
}
