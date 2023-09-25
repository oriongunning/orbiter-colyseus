import { LootTableEntry } from "../../shared/Class/LootTable";
import { raceDataMap } from "../../shared/types";

let RacesDB: raceDataMap = {
    male_knight: {
        key: "male_knight",
        title: "Knight",
        description: "The knight is as knight should be, strong and righteous. It has a large health pool and uses stamina to cast its abilities.",
        icon: "ICON_RACE_male_knight",
        speed: 0.7,
        scale: 1,
        rotationFix: Math.PI,
        meshIndex: 1,
        animations: {
            IDLE: { animation_id: 36, duration: 1000, speed: 1 },
            WALK: { animation_id: 72, duration: 1000, speed: 1.3 },
            ATTACK: { animation_id: 1, duration: 1000, speed: 1 },
            DEATH: { animation_id: 24, duration: 1000, speed: 1 }, // 24 for knight, 23 for rogue and mage
            DAMAGE: { animation_id: 34, duration: 1000, speed: 1 },
            CASTING: { animation_id: 63, duration: 1000, speed: 1 },
            CAST: { animation_id: 62, duration: 1000, speed: 1 },
            PICKUP: { animation_id: 47, duration: 1000, speed: 1 },
        },
        bones: {
            WEAPON: 12,
            OFF_HAND: 7,
            HEAD: 14,
        },
        baseHealth: 50,
        baseMana: 50,
        healthRegen: 0.2,
        manaRegen: 0.4, // per second
        experienceGain: { min: 0, max: 0 },
        goldGain: { min: 0, max: 0 },
        drops: [],
        default_abilities: ["base_attack"],
        materials: [
            { title: "Color 1", material: "knight_texture.png" },
            { title: "Color 2", material: "knight_texture_alt_A.png" },
            { title: "Color 3", material: "knight_texture_alt_B.png" },
            { title: "Color 4", material: "knight_texture_alt_C.png" },
        ],
    },
    male_mage: {
        key: "male_mage",
        title: "Mage",
        description:
            "The mage is a powerful class, but has a small health pool. It uses mana to cast spells, and should use its spells carefully if it does not want to run out of mana.",
        icon: "ICON_RACE_male_mage",
        speed: 0.7,
        scale: 1,
        rotationFix: Math.PI,
        meshIndex: 1,
        animations: {
            IDLE: { animation_id: 36, duration: 1000, speed: 1 },
            WALK: { animation_id: 72, duration: 1000, speed: 1.3 },
            ATTACK: { animation_id: 1, duration: 1000, speed: 1 },
            DEATH: { animation_id: 23, duration: 1000, speed: 1 }, // 24 for knight, 23 for rogue and mage
            DAMAGE: { animation_id: 34, duration: 1000, speed: 1 },
            CASTING: { animation_id: 63, duration: 1000, speed: 1 },
            CAST: { animation_id: 62, duration: 1000, speed: 1 },
            PICKUP: { animation_id: 47, duration: 1000, speed: 1 },
        },
        bones: {
            WEAPON: 12,
            OFF_HAND: 7,
            HEAD: 14,
        },
        baseHealth: 50,
        baseMana: 50,
        healthRegen: 0.2,
        manaRegen: 0.4,
        experienceGain: { min: 0, max: 0 },
        goldGain: { min: 0, max: 0 },
        drops: [],
        default_abilities: ["base_attack"],
        materials: [
            { title: "Color 1", material: "mage_texture.png" },
            { title: "Color 2", material: "mage_texture_alt_A.png" },
            { title: "Color 3", material: "mage_texture_alt_B.png" },
        ],
    },
    male_rogue: {
        key: "male_rogue",
        title: "Rogue",
        description: "To be written...",
        icon: "ICON_RACE_male_mage",
        speed: 0.4,
        scale: 1,
        rotationFix: Math.PI,
        meshIndex: 1,
        animations: {
            IDLE: { animation_id: 36, duration: 1000, speed: 1 },
            WALK: { animation_id: 72, duration: 1000, speed: 1.3 },
            ATTACK: { animation_id: 1, duration: 1000, speed: 1 },
            DEATH: { animation_id: 23, duration: 1000, speed: 1 }, // 24 for knight, 23 for rogue and mage
            DAMAGE: { animation_id: 34, duration: 1000, speed: 1 },
            CASTING: { animation_id: 63, duration: 1000, speed: 1 },
            CAST: { animation_id: 62, duration: 1000, speed: 1 },
            PICKUP: { animation_id: 47, duration: 1000, speed: 1 },
        },
        bones: {
            WEAPON: 12,
            OFF_HAND: 7,
            HEAD: 14,
        },
        baseHealth: 50,
        baseMana: 50,
        healthRegen: 0.2,
        manaRegen: 0.4, // per second
        experienceGain: { min: 2000, max: 4000 },
        goldGain: { min: 120, max: 250 },
        drops: [
            LootTableEntry("sword_01", 10, 1, 1, 1, 1),
            LootTableEntry("potion_small_blue", 40, 1, 1, 1, 1),
            LootTableEntry("potion_small_red", 25, 1, 1, 1, 1),
            LootTableEntry("shield_01", 5, 1, 1, 1, 1),
            LootTableEntry("amulet_01", 1, 1, 1, 1, 1),
        ],
        default_abilities: ["base_attack"],
        materials: [{ title: "Color 1", material: "mage_texture.png" }],
    },
};

export { RacesDB };
