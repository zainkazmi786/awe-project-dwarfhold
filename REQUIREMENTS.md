# Dwarfhold Requirements

## D1 — Colony work and survival (15%)

As a player, I want work assignments, worker availability, production, and food consumption to form one consistent daily simulation. A dwarf should contribute to at most one activity at a time, and a food shortage should have a clear, visible consequence instead of silently creating invalid resources.

The exact shortage consequence may be chosen by your team, but it must affect gameplay, be explained in the interface, and behave deterministically.

## D2 — Useful tools, weapons, and equipment (20%)

As a player, I want crafted tools to have a meaningful use. I should be able to equip an available tool to a dwanarf, see who owns it, and receive a production benefit while that dwarf performs a compatible local job.

One dwarf may carry at most one tool, and one tool may not be equipped by multiple dwarves. Equipping and returning tools must keep the inventory consistent. For assessment, an equipped tool adds **one additional unit of the dwarf's assigned resource per day**. So, e.g. Woodcutting normal: 3; with tool: 4; Mining normal: 2; with tool: 3. Tools do not need durability in this version.

The forge should also offer a weapon recipe. Your team may choose and display its material cost. Weapons are stored as a colony resource rather than assigned to individual characters, and their purpose is to prepare Stonehome for hostile events.

## D3 — Crafting as colony work (10%)

As a player, I want forging a tool or weapon to require materials, an eligible character, and time.

An invalid attempt must change neither workers nor resources. The interface should show who is crafting and when the result completes. Immediate crafting is not sufficient.

## D4 — Resilient expeditions (10%)

As a player, I want to send an eligible dwarf to a destination and understand that the dwarf is unavailable while travelling. Expedition rewards must be applied exactly once after success. A failed request must not award resources or leave the dwarf permanently unavailable, and slow or repeated actions must not create contradictory worker state.

Your team must define whether an equipped tool remains with the travelling dwarf or is returned before departure. 

## D5 — Save and restore (10%)

As a player, I want the meaningful colony state restored after refreshing the browser. Corrupt or incompatible saved data must fall back safely.

The game must also define a reasonable, visible policy for an expedition or forge task interrupted by refresh.

## D6 — A new species joins Stonehome (20%)

As a player, I want a successful expedition to introduce one non-dwarf character who can join Stonehome. Your team may choose the species, identity, and narrative, but the character should be recognizably different from a dwarf in the interface and in gameplay.

The character joins after the first successful expedition to a destination chosen and communicated by your team, and may join only once. The new species must have its own production capability and its own crafting capability or limitation. These differences must be visible enough that I can make an informed assignment or crafting decision.

The new resident should participate consistently in the colony's availability, food, equipment, task, and persistence rules wherever those rules reasonably apply.

## D7 — Expedition consequences and defense (15%)

As a player, I want an additional expedition destination whose successful completion changes the situation in Stonehome instead of only granting resources. The expedition should cause a hostile force to follow the traveller home and attack the colony.

Your team's weapon recipe from D2 should matter during this event. If Stonehome has reached a weapon threshold chosen by your team, the colony defends itself. Otherwise, the attackers loot a deterministic selection of stored resources. The result and its effect on the game state must be clearly visible.

Your team may decide whether defense consumes or preserves the weapons, but the chosen rule must be communicated and applied consistently. Failed expedition requests must not trigger the attack.

## Qualitative requirements and team decisions

In addition to the functional requirements, your team must define a small set of qualitative goals for your solution. Choose goals that are relevant to your implementation and the way you expect the application to be used.

Document the selected goals, why they matter, and the decisions or trade-offs you made to support them. You should also consider how you can evaluate whether your solution meets those goals.

There is no single required architecture, or design pattern. During the exam, team members must be able to explain and defend the chosen non functionals, and discuss the resulting engineering decisions.