import type { AIAnalysis, AnalysisResponse, AnalysisUiState, Direction, District, Fact, GameData, Initiative, Outcome, ScenarioRequest, SimulationResult, ValidationMode } from "./types";

export interface SimulationPort {
  getGameData(): GameData;
  validateScenario(input: unknown, data: GameData, mode: ValidationMode): Outcome<ScenarioRequest>;
  simulateScenario(request: ScenarioRequest, data: GameData, mode: ValidationMode): Outcome<SimulationResult>;
}
export interface AnalysisPort {
  analyzeScenario(input: unknown): Promise<Outcome<AnalysisResponse>>;
  buildAnalysisFacts(result: SimulationResult, data: GameData): Fact[];
  buildFallbackAnalysis(result: SimulationResult): AIAnalysis;
}
export interface GameShellProps { data: GameData }
export interface CityMapProps {
  districts: District[];
  selectedDistrictId: string | null;
  preview: SimulationResult | null;
  onSelectDistrict: (id: string) => void;
}
export interface InitiativePickerProps {
  initiatives: Initiative[];
  direction: Direction;
  districtId: string;
  selectedInitiativeId: string | null;
  remainingBudget: number;
  onSelect: (initiativeId: string) => void;
  onRemove: () => void;
}
export interface ResultsPanelProps {
  result: SimulationResult;
  analysisState: AnalysisUiState;
  onRetryAnalysis: () => void;
  onReplay: () => void;
  onEdit: () => void;
}
