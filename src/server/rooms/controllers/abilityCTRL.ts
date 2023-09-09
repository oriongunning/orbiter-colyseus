import Logger from "../../utils/Logger";
import { EntityState, Ability, CalculationTypes } from "../../../shared/types";
import { dropCTRL } from "./dropCTRL";
import { AbilitySchema } from "../schema/player/AbilitySchema";
import { randomNumberInRange } from "../../../shared/Utils";

export class abilitiesCTRL {
    private _owner;
    private _schema;
    public abilitiesOwned;
    public abilitiesDB;
    public abilities: Ability[] = [];

    public ability_in_cooldown: boolean[] = [false, false, false, false, false, false, false, false, false, false, false];
    public player_interval;
    public player_cooldown: number = 1000;
    public player_cooldown_timer: number = 0;
    public player_casting_timer: any = false;
    public gracePeriod: boolean = true;
    public attackTimer;

    constructor(owner, data) {
        this._owner = owner;
        this.abilitiesDB = this._owner._state.gameData.load("abilities");
        this.refreshAbilities();
    }

    public update() {}

    /**
     * refresh player abilities, useful after any changes
     */
    public refreshAbilities() {
        this.abilitiesOwned = this._owner.player_data.abilities;
        let i = 1;
        this.abilities = [];
        this.abilitiesOwned.forEach((element) => {
            const digit = i;
            const skill = this.abilitiesDB[element.key];
            skill.digit = digit;
            this.abilities.push(skill);
            element.digit = digit;
            i++;
        });
    }

    /**
     * allow player to learn a ability
     * @param ability
     */
    public learnAbility(ability: Ability) {
        // if ability exists, then delete it
        if (this._owner.player_data.abilities[ability.key]) {
            this._owner.player_data.abilities.delete(ability.key);
        } else {
            // else let's add it to the player
            console.log("learnAbility", "DIGIT", this.abilities.length, this._owner.player_data.abilities.size);
            this._owner.player_data.abilities.set(
                ability.key,
                new AbilitySchema({
                    digit: this.abilities.length + 1,
                    key: ability.key,
                })
            );
        }
        // refresh abilities
        this.abilitiesOwned = this._owner.abilities;
        this.refreshAbilities();
    }

    /**
     * process ability
     * @param owner
     * @param target
     * @param data
     * @returns void
     */
    async processAbility(owner, target, data) {
        let digit = data.digit;
        let ability = this.getByDigit(digit);

        // make sure ability exists
        if (!ability) {
            return false;
        }

        // cancel any existing auto attack
        this.cancelAutoAttack(owner);

        // make sure player can cast this ability
        if (!this.canEntityCastAbility(owner, target, ability, digit)) {
            return false;
        }

        // if there is a minRange, set target as target
        if (ability.minRange > 0 && owner.AI_TARGET != target) {
            console.log("minRange > 0");
            owner.AI_TARGET = target;
            owner.AI_ABILITY = ability; // store ability to use once user gets close enough
            return false;
        }

        // if ability can be casted
        if (ability.castTime > 0) {
            // inform player he can start casting
            let client = this._owner.getClient();
            client.send("ability_start_casting", {
                digit: data.digit,
            });

            // play animation
            owner.animationCTRL.playAnim(owner, EntityState.SPELL_CASTING, true);

            // start a timer
            this.player_casting_timer = setTimeout(() => {
                // process ability straight away
                this.castAbility(this._owner, target, ability, digit);
            }, ability.castTime);
        } else {
            // process ability straight away
            this.castAbility(this._owner, target, ability, digit);
        }
    }

    getByDigit(digit) {
        return this.abilities[digit - 1];
    }

    targetIsInRange(target, ability): boolean {
        let start = this._owner.getPosition();
        let end = target.getPosition();
        let distance = start.distanceTo(end);
        if (distance > ability.minRange) {
            Logger.warning(`[canEntityCastAbility] player is out of range ${distance} to ${ability.range} `, ability.range);
            return false;
        }
        return true;
    }

    /**
     * Check if player can cast an ability
     * @param target
     * @param ability_no
     * @returns boolean
     */
    canEntityCastAbility(owner, target, ability, digit) {
        // if target is not already dead
        if (owner.isMoving) {
            Logger.warning(`[canEntityCastAbility] target is moving, cannot cast an ability`, this._owner.isMoving);
            return false;
        }

        // if target is not already dead
        if (target.AI_SPAWN_INFO && target.AI_SPAWN_INFO.canAttack === false) {
            Logger.warning(`[canEntityCastAbility] target is not attackable`, target.health);
            return false;
        }

        // if already casting
        if (ability.castTime > 0 && this.player_casting_timer !== false) {
            Logger.warning(`[canEntityCastAbility] player is already casting an ability`, ability);
            return false;
        }

        // if caster is dead, cancel everything
        if (this._owner.health < 0 || this._owner.health === 0) {
            Logger.warning(`[canEntityCastAbility] caster is dead`, ability);
            return false;
        }

        // if ability not found, cancel everything
        if (!ability) {
            Logger.error(`[canEntityCastAbility] ability not found`, ability);
            return false;
        }

        // if target is not already dead
        if (target.isEntityDead()) {
            Logger.warning(`[canEntityCastAbility] target is dead`, target.health);
            return false;
        }

        // if in cooldown
        if (this.ability_in_cooldown[digit]) {
            Logger.warning(`[canEntityCastAbility] ability is in cooldown`, digit);
            return false;
        }

        // only cast ability if enought mana is available
        let prop = ability.casterPropertyAffected.find((prop) => prop.key === "mana");
        if (prop && prop.min > 0 && this._owner.mana < prop.min) {
            Logger.warning(`[canEntityCastAbility] not enough mana available`, this._owner.mana);
            return false;
        }

        // sender cannot cast on himself
        if (ability.castSelf === false && target.sessionId === this._owner.sessionId) {
            Logger.warning(`[canEntityCastAbility] cannot cast this ability on yourself`);
            return false;
        }

        //Logger.info(`[canEntityCastAbility] player can cast ability`, ability);

        return true;
    }

    affect(type, start, amount) {
        switch (type) {
            case CalculationTypes.ADD:
                start += amount;
                break;
            case CalculationTypes.REMOVE:
                start -= amount;
                break;
            case CalculationTypes.MULTIPLY:
                start *= amount;
                break;
        }
        return start;
    }

    // process caster affected properties
    affectCaster(owner, ability) {
        ability.casterPropertyAffected.forEach((p) => {
            let result = randomNumberInRange(p.min, p.max);
            let amount = this.affect(p.type, owner[p.key], result);
            owner[p.key] = amount;
        });
    }

    // process target affected properties
    affectTarget(target, owner, ability) {
        ability.targetPropertyAffected.forEach((p) => {
            // get min and max damage
            let base_min = p.min;
            let base_max = p.max;

            // generate a random number
            let base_damage = randomNumberInRange(base_min, base_max);

            // calculate player affinity ( ex: total strengh / 5 )
            let owner_affinity_roll = owner.player_data[ability.affinity] / 5;

            // add affinity to base damage
            base_damage += owner_affinity_roll;

            // add a multiplier to increase damage per level
            base_damage *= 1 + owner.level / 10;

            let amount = this.affect(p.type, target[p.key], base_damage);
            target[p.key] = amount;
        });
    }

    // start cooldown
    startCooldown(digit, ability) {
        // start cooldown period
        this.ability_in_cooldown[digit] = true;
        setTimeout(() => {
            this.ability_in_cooldown[digit] = false;
        }, ability.cooldown);
    }

    /**
     * cast an ability onto target
     * does not do any check, use canEntityCastAbility() to check.
     * @param target
     * @param ability
     * @param digit
     */
    castAbility(owner, target, ability: Ability, digit) {
        //console.log("castAbility", digit, ability);

        // rotate sender to face target
        owner.rot = owner.moveCTRL.calculateRotation(owner.getPosition(), target.getPosition());

        // set sender as enemy target
        if (target.type === "entity") {
            target.setTarget(owner);
        }

        //
        this.affectCaster(owner, ability);

        //
        if (ability.repeat > 0) {
            let repeat = 1;
            let timer = setInterval(() => {
                this.affectTarget(target, owner, ability);
                if (target.isEntityDead()) {
                    this.processDeath(owner, target);
                    clearInterval(timer);
                }
                if (repeat >= ability.repeat) {
                    clearInterval(timer);
                }
                repeat += 1;
            }, ability.repeatInterval);
        } else {
            this.affectTarget(target, owner, ability);
        }

        //
        this.startCooldown(digit, ability);

        // make sure no values are out of range.
        target.normalizeStats();

        // send to clients
        owner._state._gameroom.broadcast("entity_ability_cast", {
            key: ability.key,
            digit: digit,
            fromId: owner.sessionId,
            fromPos: owner.getPosition(),
            targetId: target.sessionId,
            targetPos: target.getPosition(),
        });

        // removing any casting timers
        if (this.player_casting_timer) {
            this.player_casting_timer = false;
        }

        // play animation
        owner.animationCTRL.playAnim(owner, ability.animation);

        // if target is dead, process target death
        if (target.isEntityDead()) {
            this.processDeath(owner, target);
        }
    }

    processDeath(owner, target) {
        if (target.isDead) {
            return false;
        }

        // cancel auto attack timer
        this.cancelAutoAttack(owner);

        // set target as dead
        target.setAsDead();

        // get player
        let client = owner.getClient();

        // update caster rewards
        if (client) {
            // send notif to player
            client.send("notification", {
                type: "event",
                message: "You've killed " + target.name + ".",
                date: new Date(),
            });

            // process drops, experience and gold
            let drop = new dropCTRL(owner, client);
            drop.addExperience(target);
            drop.addGold(target);
            drop.dropItems(target);
        }
    }

    //////////////////////////////////////////////
    ////////////// BASIC AUTO ATTACK /////////////
    //////////////////////////////////////////////

    startAutoAttack(owner, target, ability) {
        if (!owner || !target || !ability) {
            return false;
        }
        console.log('START AUTO ATTACK');
        this.doAutoAttack(owner, target, ability);
        this.attackTimer = setInterval(() => {
            this.doAutoAttack(owner, target, ability);
        }, 900);
    }

    doAutoAttack(owner, target, ability) {
        console.log('AUTO ATTACK');
        // only auto attack if entity has a target
        if (target !== null) {
            owner.anim_state = EntityState.ATTACK;
            this.castAbility(owner, target, ability, 1);
        }
    }

    cancelAutoAttack(owner) {
        console.log('CANCEL AUTO ATTACK');
        // remove target
        owner.AI_TARGET = null;
        owner.AI_ABILITY = null;

        // reset animation
        owner.animationCTRL.playAnim(owner, EntityState.IDLE);

        // remove attack timer
        if (this.attackTimer) {
            clearInterval(this.attackTimer);
        }

        // remove casting timer
        if (this.player_casting_timer) {
            clearInterval(this.player_casting_timer);
            this.player_casting_timer = false;
            owner._state._gameroom.broadcast("ability_cancel_casting");
        }
    }

    //////////////////////////////////////////////
    //////////////////////////////////////////////
    //////////////////////////////////////////////
}
