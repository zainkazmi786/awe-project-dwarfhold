export type ResourceKey = "wood" | "stone" | "food" | "tools" | "weapons";
export type JobType = "woodcutting" | "mining" | "farming" | "smithing" | null;
export type DwarfStatus = "idle" | "working" | "expedition";
export interface Resources { wood: number; stone: number; food: number; tools: number; weapons: number }
export type Recipe = "tool" | "weapon";

export interface Dwarf { 
    id: string;
     name: string; 
     title: string; 
     icon: string; 
     assignment: JobType; 
     status: DwarfStatus; 
     specialty?: Exclude<JobType, null>;
     hungry: boolean; // true = not fed at last meal, will not produce next day
     hasTool: boolean; // D2: carries one tool from storage
}

// D3: one forge order per smith, materials already paid
export interface CraftJob {
    dwarfId: string;
    recipe: Recipe;
    readyDay: number;
}

export interface ColonyState { 
    day: number; 
    resources: Resources; 
    dwarves: Dwarf[];
    crafting: CraftJob[];
}

export interface ExpeditionResult { 
    expeditionId: string; 
    status: "completed"; 
    rewards: Partial<Resources>; 
    message: string 
}

export interface Activity { 
    id: string; 
    day: number; 
    message: string; 
    tone?: "good" | "warning" 
}
