export type ResourceKey = "wood" | "stone" | "food" | "tools";
export type JobType = "woodcutting" | "mining" | "farming" | null;
export type DwarfStatus = "idle" | "working" | "expedition";
export interface Resources { wood: number; stone: number; food: number; tools: number }

export interface Dwarf { 
    id: string;
     name: string; 
     title: string; 
     icon: string; 
     assignment: JobType; 
     status: DwarfStatus; 
     specialty?: Exclude<JobType, null>;
     hungry: boolean; // true = not fed at last meal, will not produce next day
}

export interface ColonyState { 
    day: number; 
    resources: Resources; 
    dwarves: Dwarf[] 
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
