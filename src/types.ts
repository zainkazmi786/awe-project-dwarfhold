export type ResourceKey = "wood" | "stone" | "food" | "tools" | "weapons";
export type JobType = "woodcutting" | "mining" | "farming" | "smithing" | null;
export type DwarfStatus = "idle" | "working" | "expedition";
export interface Resources { wood: number; stone: number; food: number; tools: number; weapons: number }
export type Recipe = "tool" | "weapon";
export type Species = "dwarf" | "working-student"; // D6

export interface Dwarf {
    id: string;
     species: Species; // D6
     name: string; 
     title: string; 
     icon: string; 
     assignment: JobType; 
     status: DwarfStatus; 
     specialty?: Exclude<JobType, null>;
     hungry: boolean; // true = not fed at last meal, will not produce next day
     hasTool: boolean; // D2: carries one tool from storage
     destination?: string; // D5: set while on expedition, so the trip can resume after a refresh
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
    recruited: boolean; // D6: the working student has joined (only once)
    lastAttack: AttackReport | null; // D7
    destroyed: boolean; // D7: game over
}

// D7: result of a goblin raid, shown in the UI
export interface AttackReport {
    day: number;
    force: number;
    weaponsUsed: number;
    losses: Partial<Resources>;
    defended: boolean;
    destroyed: boolean;
}

export interface ExpeditionResult { 
    expeditionId: string; 
    status: "completed"; 
    rewards: Partial<Resources>;
    message: string;
    recruit?: Recruit; // D6: only returned by the university
    attack?: { force: number }; // D7: only returned by the goblin warrens
}

// D6: who the server says joins the colony
export interface Recruit {
    species: Species;
    name: string;
    title: string;
}

export interface Activity { 
    id: string; 
    day: number; 
    message: string; 
    tone?: "good" | "warning" 
}
