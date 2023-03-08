import { Scene } from "@babylonjs/core/scene";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { NavMesh } from "../yuka";
import { Room } from "colyseus.js";

import { EntityState } from "../../server/rooms/schema/EntityState";
import { PlayerCamera } from "./Player/PlayerCamera";
import { EntityUtils } from "./Entity/EntityUtils";
import { EntityActions } from "./Entity/EntityActions";
import { Entity } from "./Entity";
import { PlayerInput } from "../../client/Controllers/PlayerInput";
import { UserInterface } from "../../client/Controllers/UserInterface";
import Config from "../Config";
import State from "../../client/Screens/Screens";
import { EntityCurrentState } from "./Entity/EntityCurrentState";
import { dataDB } from "../Data/dataDB";

export class Player extends Entity {
    public input;
    public interval;

    public isCasting: boolean = false;
    public castingDigit: number = 0;
    public castingTimer;
    public castingElapsed: number = 0;
    public castingTarget: number = 0;
    public ability_in_cooldown;

    public abilities;
    public inventory;

    constructor(entity: EntityState, room: Room, scene: Scene, ui: UserInterface, shadow: CascadedShadowGenerator, navMesh: NavMesh, _loadedAssets: any[], input: PlayerInput) {
        super(entity, room, scene, ui, shadow, navMesh, _loadedAssets);

        this._input = input;

        this.ability_in_cooldown = [false, false, false, false, false, false, false, false, false, false, false];

        this.spawnPlayer();
    }

    private async spawnPlayer() {
        //spawn
        this.utilsController = new EntityUtils(this._scene, this._room);
        this.cameraController = new PlayerCamera(this._scene, this._input);
        this.actionsController = new EntityActions(this._scene, this._loadedAssets);

        ///////////////////////////////////////////////////////////
        // entity network event
        // colyseus automatically sends entity updates, so let's listen to those changes

        //////////////////////////////////////////////////////////////////////////
        // player register event

        // register server messages
        this.registerServerMessages();

        // mouse events
        this._scene.onPointerObservable.add((pointerInfo: any) => {
            // on left mouse click
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 0) {
                /////////////////////////////////////////////////////////////////////
                // if click on entity
                if (pointerInfo._pickInfo.pickedMesh && pointerInfo._pickInfo.pickedMesh.metadata && pointerInfo._pickInfo.pickedMesh.metadata !== null && pointerInfo._pickInfo.pickedMesh.metadata.race) {
                    let metadata = pointerInfo._pickInfo.pickedMesh.metadata;
                    let targetSessionId = metadata.sessionId;
                    let target = this.ui._entities[targetSessionId];
                    if (metadata.type === "player" && targetSessionId === this.sessionId) {
                        target = this;
                    }
                    global.T5C.selectedEntity = target;
                }
            }

            // on right mouse click
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 2) {
                /////////////////////////////////////////////////////////////////////
                // display nameplate for a certain time for any entity right clicked
                if (pointerInfo._pickInfo.pickedMesh && pointerInfo._pickInfo.pickedMesh.metadata && pointerInfo._pickInfo.pickedMesh.metadata.sessionId && pointerInfo._pickInfo.pickedMesh.metadata.sessionId != this._room.sessionId) {
                    let targetMesh = pointerInfo._pickInfo.pickedMesh;
                    let targetData = targetMesh.metadata;
                    let target = this.ui._entities[targetData.sessionId];
                    target.characterLabel.isVisible = true;
                    setTimeout(function () {
                        target.characterLabel.isVisible = false;
                    }, Config.PLAYER_NAMEPLATE_TIMEOUT);
                }
            }

            // on wheel mouse
            if (pointerInfo.type === PointerEventTypes.POINTERWHEEL) {
                /////////////////////////////////////////////////////////////////////
                // camera zoom on mouse wheel
                this.cameraController.zoom(pointerInfo.event.deltaY);
            }
        });

        //////////////////////////////////////////////////////////////////////////
        // player before render loop
        this._scene.registerBeforeRender(() => {
            // move camera as player moves
            this.cameraController.follow(this.mesh.position, this.mesh.rotation.y);
        });
    }

    // update at engine rate
    public update(delta) {
        if (this && this.moveController) {
            // global camera rotation
            global.T5C.camY = this.cameraController._camRoot.rotation.y;

            // tween entity
            this.moveController.tween();
        }
    }

    // update at server rate
    public updateServerRate(delta) {
        // if digit pressed
        if (this._input.digit_pressed > 0 && !this.isCasting) {
            // get all necessary vars
            let digit = this._input.digit_pressed;
            let target = global.T5C.selectedEntity;

            // send to server
            this._room.send("entity_ability_key", {
                senderId: this._room.sessionId,
                targetId: target ? target.sessionId : false,
                digit: digit,
            });

            // clear digit
            this._input.digit_pressed = 0;
        }

        // check if casting
        if (this.isCasting === true) {
            // increment casting timer
            this.ui._UICastingTimer.isVisible = true; // show timer
            this.castingElapsed += delta; // increment casting timer by server delta
            let widthInPercentage = ((this.castingElapsed / this.castingTarget) * 100) / 100; // percentage between 0 and 1
            this.ui._UICastingTimerText.text = this.castingElapsed + "/" + this.castingTarget;
            this.ui._UICastingTimerInside.width = widthInPercentage;
        }

        // check for cooldowns  (estethic only as server really controls cooldowns)
        this.ability_in_cooldown.forEach((cooldown, digit) => {
            if (cooldown > 0) {
                let cooldownUI = this.ui._playerUI.getControlByName("ability_" + digit + "_cooldown");
                let ability = this.getAbilityByDigit(digit);
                if (ability) {
                    this.ability_in_cooldown[digit] -= delta;
                    let percentage = ((this.ability_in_cooldown[digit] / ability.cooldown) * 100) / 100;
                    cooldownUI.height = percentage;
                }
            }
        });

        if (this.state === EntityCurrentState.DEAD) {
            this.ui.revivePanel.isVisible = true;
        } else {
            this.ui.revivePanel.isVisible = false;
        }
    }

    public getAbilityByDigit(digit) {
        let link = this.abilities[digit - 1];
        if (link) {
            return dataDB.get("ability", link.key);
        }
        return false;
    }

    // player is casting
    public startCasting(data) {
        let digit = data.digit;
        let ability = this.getAbilityByDigit(digit);
        if (ability) {
            this.isCasting = true;
            this.castingElapsed = 0;
            this.castingTarget = ability.castTime;
            this.castingDigit = digit;
            this.ui._UICastingTimer.isVisible = true;
            this.ui._UICastingTimerText.text = "Start Casting";
        }
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // server message handler

    public registerServerMessages() {
        this._room.onMessage("notification", (data) => {
            this.ui._UIChat.addNotificationMessage(data.type, data.message, data.message);
        });

        // on teleport confirmation
        this._room.onMessage("playerTeleportConfirm", (location) => {
            this.actionsController.teleport(this._room, location);
        });

        // server confirm player can start casting
        this._room.onMessage("ability_start_casting", (data) => {
            this.startCasting(data);
        });

        // server confirms ability can be cast
        this._room.onMessage("entity_ability_cast", (data) => {
            let digit = data.digit;
            let ability = this.getAbilityByDigit(digit);
            if (ability) {
                // if you are sender, cancel casting and strat cooldown on client
                if (data.fromId === this.sessionId) {
                    // cancel casting
                    this.castingElapsed = 0;
                    this.castingTarget = 0;
                    this.isCasting = false;
                    this.ui._UICastingTimer.isVisible = false;
                    this.ui._UICastingTimerText.text = "";
                    this.ability_in_cooldown[digit] = ability.cooldown; // set cooldown
                }

                // action ability
                this.actionsController.process(data, ability);
            }
        });
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // to refactor

    public async teleport(location) {
        await this._room.leave();
        global.T5C.currentLocation = dataDB.get("location", location);
        global.T5C.currentLocationKey = location;
        global.T5C.currentCharacter.location = location;
        global.T5C.currentRoomID = "";
        global.T5C.nextScene = State.GAME;
    }

    public remove() {
        this.characterLabel.dispose();
        this.characterChatLabel.dispose();
        this.mesh.dispose();
        if (global.T5C.selectedEntity && global.T5C.selectedEntity.sessionId === this.sessionId) {
            global.T5C.selectedEntity = false;
        }
    }
}
