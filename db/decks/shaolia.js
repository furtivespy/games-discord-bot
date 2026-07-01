const BASE_L1 = 'https://furtivespy.com/images/shaolia/level1/';
const BASE_L2 = 'https://furtivespy.com/images/shaolia/level2/';

// Shaolia - Level 1 Cards (48 cards total: 6 types × 8 each)
// Each numbered card image = one die-face variant. Some faces have 2 copies per the rulebook.
// Duplicate die faces per type: Blacksmith=3,6 | Farm=5,6 | Infantry=4,5 | Market=3,6 | School=1,4
// Format "C" displays as "value: name" e.g. "3: Blacksmith"
const shaoiliaLevel1 = [
    // Barricade × 8 (P = permanent — must be attacked first)
    { name: "Barricade", value: "P", description: "Must be attacked first", url: `${BASE_L1}barricade_p.png` },
    { name: "Barricade", value: "P", description: "Must be attacked first", url: `${BASE_L1}barricade_p.png` },
    { name: "Barricade", value: "P", description: "Must be attacked first", url: `${BASE_L1}barricade_p.png` },
    { name: "Barricade", value: "P", description: "Must be attacked first", url: `${BASE_L1}barricade_p.png` },
    { name: "Barricade", value: "P", description: "Must be attacked first", url: `${BASE_L1}barricade_p.png` },
    { name: "Barricade", value: "P", description: "Must be attacked first", url: `${BASE_L1}barricade_p.png` },
    { name: "Barricade", value: "P", description: "Must be attacked first", url: `${BASE_L1}barricade_p.png` },
    { name: "Barricade", value: "P", description: "Must be attacked first", url: `${BASE_L1}barricade_p.png` },

    // Blacksmith × 8 (die faces 1,2,3,3,4,5,6,6 — extra 3 and 6)
    { name: "Blacksmith", value: "1", description: "Gain 1 Mineral", url: `${BASE_L1}blacksmith_1.png` },
    { name: "Blacksmith", value: "2", description: "Gain 1 Mineral", url: `${BASE_L1}blacksmith_2.png` },
    { name: "Blacksmith", value: "3", description: "Gain 1 Mineral", url: `${BASE_L1}blacksmith_3.png` },
    { name: "Blacksmith", value: "3", description: "Gain 1 Mineral", url: `${BASE_L1}blacksmith_3.png` },
    { name: "Blacksmith", value: "4", description: "Gain 1 Mineral", url: `${BASE_L1}blacksmith_4.png` },
    { name: "Blacksmith", value: "5", description: "Gain 1 Mineral", url: `${BASE_L1}blacksmith_5.png` },
    { name: "Blacksmith", value: "6", description: "Gain 1 Mineral", url: `${BASE_L1}blacksmith_6.png` },
    { name: "Blacksmith", value: "6", description: "Gain 1 Mineral", url: `${BASE_L1}blacksmith_6.png` },

    // Farm × 8 (die faces 1,2,3,4,5,5,6,6 — extra 5 and 6)
    { name: "Farm", value: "1", description: "Gain 3 Gold", url: `${BASE_L1}farm_1.png` },
    { name: "Farm", value: "2", description: "Gain 3 Gold", url: `${BASE_L1}farm_2.png` },
    { name: "Farm", value: "3", description: "Gain 3 Gold", url: `${BASE_L1}farm_3.png` },
    { name: "Farm", value: "4", description: "Gain 3 Gold", url: `${BASE_L1}farm_4.png` },
    { name: "Farm", value: "5", description: "Gain 3 Gold", url: `${BASE_L1}farm_5.png` },
    { name: "Farm", value: "5", description: "Gain 3 Gold", url: `${BASE_L1}farm_5.png` },
    { name: "Farm", value: "6", description: "Gain 3 Gold", url: `${BASE_L1}farm_6.png` },
    { name: "Farm", value: "6", description: "Gain 3 Gold", url: `${BASE_L1}farm_6.png` },

    // Infantry × 8 (die faces 1,2,3,4,4,5,5,6 — extra 4 and 5)
    { name: "Infantry", value: "1", url: `${BASE_L1}infantry_1.png` },
    { name: "Infantry", value: "2", url: `${BASE_L1}infantry_2.png` },
    { name: "Infantry", value: "3", url: `${BASE_L1}infantry_3.png` },
    { name: "Infantry", value: "4", url: `${BASE_L1}infantry_4.png` },
    { name: "Infantry", value: "4", url: `${BASE_L1}infantry_4.png` },
    { name: "Infantry", value: "5", url: `${BASE_L1}infantry_5.png` },
    { name: "Infantry", value: "5", url: `${BASE_L1}infantry_5.png` },
    { name: "Infantry", value: "6", url: `${BASE_L1}infantry_6.png` },

    // Market × 8 (die faces 1,2,3,3,4,5,6,6 — extra 3 and 6)
    { name: "Market", value: "1", url: `${BASE_L1}market_1.png` },
    { name: "Market", value: "2", url: `${BASE_L1}market_2.png` },
    { name: "Market", value: "3", url: `${BASE_L1}market_3.png` },
    { name: "Market", value: "3", url: `${BASE_L1}market_3.png` },
    { name: "Market", value: "4", url: `${BASE_L1}market_4.png` },
    { name: "Market", value: "5", url: `${BASE_L1}market_5.png` },
    { name: "Market", value: "6", url: `${BASE_L1}market_6.png` },
    { name: "Market", value: "6", url: `${BASE_L1}market_6.png` },

    // School × 8 (die faces 1,1,2,3,4,4,5,6 — extra 1 and 4)
    { name: "School", value: "1", url: `${BASE_L1}school_1.png` },
    { name: "School", value: "1", url: `${BASE_L1}school_1.png` },
    { name: "School", value: "2", url: `${BASE_L1}school_2.png` },
    { name: "School", value: "3", url: `${BASE_L1}school_3.png` },
    { name: "School", value: "4", url: `${BASE_L1}school_4.png` },
    { name: "School", value: "4", url: `${BASE_L1}school_4.png` },
    { name: "School", value: "5", url: `${BASE_L1}school_5.png` },
    { name: "School", value: "6", url: `${BASE_L1}school_6.png` },
];

// Shaolia - Warring States Level 2 Cards (47 cards)
// Card Setting: use every Lv1 card + these 47 Lv2 cards
// 11 types × 4 cards + 3 singletons (War Elephant, Ancestral Valley, Fortress)
const shaoiliaWSLevel2 = [
    // Cavalry × 4
    { name: "Cavalry", value: "1", url: `${BASE_L2}cavalry_1_34.png` },
    { name: "Cavalry", value: "2", url: `${BASE_L2}cavalry_2_45.png` },
    { name: "Cavalry", value: "5", url: `${BASE_L2}cavalry_5_12.png` },
    { name: "Cavalry", value: "6", url: `${BASE_L2}cavalry_6_23.png` },

    // Gym × 4 (P = permanent; 4 identical copies)
    { name: "Gym", value: "P", description: "Place 1 ATK Token on an ATK card before rolling dice", url: `${BASE_L2}gym_p.png` },
    { name: "Gym", value: "P", description: "Place 1 ATK Token on an ATK card before rolling dice", url: `${BASE_L2}gym_p.png` },
    { name: "Gym", value: "P", description: "Place 1 ATK Token on an ATK card before rolling dice", url: `${BASE_L2}gym_p.png` },
    { name: "Gym", value: "P", description: "Place 1 ATK Token on an ATK card before rolling dice", url: `${BASE_L2}gym_p.png` },

    // Catapult × 4
    { name: "Catapult", value: "1", url: `${BASE_L2}catapult_1_34.png` },
    { name: "Catapult", value: "2", url: `${BASE_L2}catapult_2_45.png` },
    { name: "Catapult", value: "3", url: `${BASE_L2}catapult_3_56.png` },
    { name: "Catapult", value: "4", url: `${BASE_L2}catapult_4_61.png` },

    // Wall × 4
    { name: "Wall", value: "3", url: `${BASE_L2}wall_p_3.png` },
    { name: "Wall", value: "4", url: `${BASE_L2}wall_p_4.png` },
    { name: "Wall", value: "5", url: `${BASE_L2}wall_p_5.png` },
    { name: "Wall", value: "6", url: `${BASE_L2}wall_p_6.png` },

    // Port × 4
    { name: "Port", value: "1", url: `${BASE_L2}port_1.png` },
    { name: "Port", value: "2", url: `${BASE_L2}port_2.png` },
    { name: "Port", value: "3", url: `${BASE_L2}port_3.png` },
    { name: "Port", value: "4", url: `${BASE_L2}port_4.png` },

    // Temple × 4
    { name: "Temple", value: "1", url: `${BASE_L2}temple_1_34.png` },
    { name: "Temple", value: "2", url: `${BASE_L2}temple_2_45.png` },
    { name: "Temple", value: "3", url: `${BASE_L2}temple_3_56.png` },
    { name: "Temple", value: "4", url: `${BASE_L2}temple_4_61.png` },

    // Garden × 4 (P = permanent; 4 identical copies)
    { name: "Garden", value: "P", url: `${BASE_L2}garden_p.png` },
    { name: "Garden", value: "P", url: `${BASE_L2}garden_p.png` },
    { name: "Garden", value: "P", url: `${BASE_L2}garden_p.png` },
    { name: "Garden", value: "P", url: `${BASE_L2}garden_p.png` },

    // Theater × 4
    { name: "Theater", value: "1", url: `${BASE_L2}theater_1.png` },
    { name: "Theater", value: "2", url: `${BASE_L2}theater_2.png` },
    { name: "Theater", value: "5", url: `${BASE_L2}theater_5.png` },
    { name: "Theater", value: "6", url: `${BASE_L2}theater_6.png` },

    // Ranch × 4
    { name: "Ranch", value: "1", url: `${BASE_L2}ranch_1.png` },
    { name: "Ranch", value: "2", url: `${BASE_L2}ranch_2.png` },
    { name: "Ranch", value: "3", url: `${BASE_L2}ranch_3.png` },
    { name: "Ranch", value: "4", url: `${BASE_L2}ranch_4.png` },

    // Smelter × 4
    { name: "Smelter", value: "1", description: "Gain 2 Minerals", url: `${BASE_L2}smelter_1.png` },
    { name: "Smelter", value: "2", description: "Gain 2 Minerals", url: `${BASE_L2}smelter_2.png` },
    { name: "Smelter", value: "5", description: "Gain 2 Minerals", url: `${BASE_L2}smelter_5.png` },
    { name: "Smelter", value: "6", description: "Gain 2 Minerals", url: `${BASE_L2}smelter_6.png` },

    // Mansion × 4 (P = permanent; 4 identical copies)
    { name: "Mansion", value: "P", description: "Roll one more die during your action phase", url: `${BASE_L2}mansion_p.png` },
    { name: "Mansion", value: "P", description: "Roll one more die during your action phase", url: `${BASE_L2}mansion_p.png` },
    { name: "Mansion", value: "P", description: "Roll one more die during your action phase", url: `${BASE_L2}mansion_p.png` },
    { name: "Mansion", value: "P", description: "Roll one more die during your action phase", url: `${BASE_L2}mansion_p.png` },

    // Fortress × 1
    { name: "Fortress", value: "P", description: "Gain life tokens and place them anywhere", url: `${BASE_L2}fortress_p_any.png` },
];

// War Elephant — two variants, one is randomly chosen per deck build
const shaoiliaWarElephantVariants = [
    { name: "War Elephant", value: "Any", description: "Deal 2 damage to all opponent's cards and palace", url: `${BASE_L2}war_elephant_23.png` },
    { name: "War Elephant", value: "Any", description: "Deal 2 damage to all opponent's cards and palace", url: `${BASE_L2}war_elephant_61.png` },
];

// Ancestral Valley — two variants, one is randomly chosen per deck build
const shaoiliaAncestralValleyVariants = [
    { name: "Ancestral Valley", value: "P", description: "Can't be destroyed. Gain 7 Culture on 2 or 3.", url: `${BASE_L2}ancestral_p_23.png` },
    { name: "Ancestral Valley", value: "P", description: "Can't be destroyed. Gain 7 Culture on 4 or 5.", url: `${BASE_L2}ancestral_p_45.png` },
];

module.exports = { shaoiliaLevel1, shaoiliaWSLevel2, shaoiliaWarElephantVariants, shaoiliaAncestralValleyVariants };
