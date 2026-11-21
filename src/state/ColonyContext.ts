import { createContext, useContext } from "react";
import type { Activity, ColonyState, JobType, Recipe } from "../types";

export interface ColonyContextValue {
  colony: ColonyState;
  paused: boolean;
  activities: Activity[];
  expeditionPending: boolean;
  togglePaused: () => void;
  assignDwarf: (id: string, assignment: JobType) => void;
  equipTool: (id: string) => void;
  returnTool: (id: string) => void;
  craft: (recipe: Recipe) => void;
  sendExpedition: (dwarfId: string, destination: string) => Promise<void>;
}

export const ColonyContext = createContext<ColonyContextValue | null>(null);

export function useColony(): ColonyContextValue {
  const context = useContext(ColonyContext);
  if (!context) {
    throw new Error("useColony must be used inside <ColonyProvider>");
  }
  return context;
}
