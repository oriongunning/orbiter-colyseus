type Item = {
    key: string;
    name: string;
    description: string;
    value: number;
    type: ItemType;
    canEquip?: {
        slot: PlayerSlots;
    };
    requirements?: {};
    benefits?: {};
    mesh?: {
        scale?: number;
        rotationFix?: number;
        meshIndex?: number;
    };
};

interface itemDataMap {
    [key: string]: Item;
}

enum ItemType {
    WEAPON = 1,
    ARMOR = 2,
    CONSUMABLE = 3,
    QUEST = 4,
    OTHER = 5,
}

enum ItemEffect {
    ADD = 1,
    REMOVE = 2,
}

enum PlayerKeys {
    STRENGTH = "strength",
    ENDURANCE = "endurance",
    AGILITY = "agility",
    WISDOM = "wisdom",
    INTELLIGENCE = "inteligence",
    AC = "ac",
    LEVEL = "level",
    HEALTH = "health",
    MANA = "mana",
}

enum PlayerSlots {
    HEAD = 1,
    AMULET = 2,
    CHEST = 3,
    PANTS = 4,
    SHOES = 5,
    WEAPON_1 = 6,
    WEAPON_2 = 7,
    HAND_1 = 8,
    HAND_2 = 9,
}

let ItemsDB: itemDataMap = {
    apple: {
        key: "apple",
        name: "Apple",
        description: "A delicious apple.",
        type: ItemType.CONSUMABLE,
        value: 25,
        canEquip: {
            slot: PlayerSlots.AMULET,
        },
        requirements: [
            { key: PlayerKeys.LEVEL, amount: 10 },
            { key: PlayerKeys.STRENGTH, amount: 20 },
        ],
        benefits: [
            { key: PlayerKeys.AC, type: ItemEffect.ADD, amount: 10 },
            { key: PlayerKeys.STRENGTH, type: ItemEffect.ADD, amount: 8 },
            { key: PlayerKeys.WISDOM, type: ItemEffect.REMOVE, amount: 2 },
        ],
        mesh: {
            meshIndex: 1,
        },
    },
    pear: {
        key: "pear",
        name: "Pear",
        description: "A delicious pear.",
        type: ItemType.CONSUMABLE,
        value: 200,
        benefits: [{ key: PlayerKeys.HEALTH, type: ItemEffect.ADD, amount: 40 }],
        mesh: {
            meshIndex: 1,
        },
    },
};

export { ItemsDB, Item };
