import Config from "../../../../shared/Config";
import { State } from "../../../../shared/yuka";
import { EntityState } from "../../../../shared/Entities/Entity/EntityState";

class AttackState extends State {
    enter(owner) {
        console.log("----------------------------------");
        owner.ATTACK_TIMER = 0;
    }

    execute(owner) {
        // target is valid,keep attacking
        if (owner.AI_TARGET === null || owner.AI_TARGET === undefined || owner.AI_TARGET === false || owner.AI_TARGET.isEntityDead() === true) {
            owner._stateMachine.changeTo("PATROL");
            return false;
        }

        // if target is escaping, go back to searching
        if (owner.AI_TARGET_DISTANCE > Config.MONSTER_ATTACK_DISTANCE) {
            owner.AI_TARGET_WAYPOINTS = [];
            owner._stateMachine.changeTo("CHASE");
            return false;
        }

        // attack target
        if (owner.ATTACK_TIMER >= 900) {
            let damage = owner.calculateDamage(owner, owner.AI_TARGET);
            owner.ATTACK_TIMER = 0;
            owner.AI_TARGET.health -= damage;
            owner.AI_TARGET.normalizeStats();
        }

        // increment attack timer
        owner.ATTACK_TIMER += Config.updateRate;

        // set state and anim state
        owner.anim_state = EntityState.ATTACK;

        //debug
        console.log("[AttackState] attacking entity", owner.AI_TARGET.name);
    }

    exit(owner) {
        owner.resetDestination();
    }
}

export default AttackState;
