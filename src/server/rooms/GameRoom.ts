import http from "http";
import { Room, Client, Delayed } from "@colyseus/core";
import { GameRoomState } from "./state/GameRoomState";
import databaseInstance from "../../shared/Database";
import Config from "../../shared/Config";
import Logger from "../../shared/Logger";
import loadNavMeshFromFile from "../../shared/Utils/loadNavMeshFromFile";
import { PlayerInputs } from "../../shared/types";
import { NavMesh } from "../../shared/yuka-min";
import { dataDB } from "../../shared/Data/dataDB";

import { Auth } from "./commands";
import { Entity, EquipmentSchema, PlayerSchema } from "./schema";
import { PlayerSlots } from "../../shared/Data/ItemDB";

export class GameRoom extends Room<GameRoomState> {
    public maxClients = 64;
    public autoDispose = false;
    public database: any;
    public delayedInterval!: Delayed;
    public navMesh: NavMesh;

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // on create room event
    async onCreate(options: any) {
        Logger.info("[gameroom][onCreate] game room created: " + this.roomId, options);

        this.setMetadata(options);

        // initialize navmesh
        const navMesh = await loadNavMeshFromFile(options.location);
        this.navMesh = navMesh;
        Logger.info("[gameroom][onCreate] navmesh " + options.location + " initialized.");

        // Set initial state
        this.setState(new GameRoomState(this, this.navMesh, options));

        // Register message handlers for messages from the client
        this.registerMessageHandlers();

        // Set the frequency of the patch rate
        // let's make it the same as our game loop
        this.setPatchRate(Config.updateRate);

        // Set the simulation interval callback
        // use to check stuff on the server at regular interval
        this.setSimulationInterval((dt) => {
            this.state.update(dt);
        }, Config.updateRate);

        // set max clients
        this.maxClients = Config.maxClients;

        // initialize database
        this.database = new databaseInstance();
        await this.database.initDatabase();

        ///////////////////////////////////////////////////////////////////////////
        // if players are in a room, make sure we save any changes to the database.
        let saveTimer = 0;
        let saveInterval = 5000;
        this.delayedInterval = this.clock.setInterval(() => {
            saveTimer += Config.databaseUpdateRate;
            // only save if there is any players
            if (this.state.entityCTRL.hasEntities()) {
                //Logger.info("[gameroom][onCreate] Saving data for room " + options.location + " with " + this.state.players.size + " players");
                this.state.entityCTRL.all.forEach((entity) => {
                    if (entity.type === "player") {
                        let player = entity as PlayerSchema;
                        // update player every second...
                        let playerClient = this.clients.getById(entity.sessionId);

                        this.database.updateCharacter(playerClient.auth.id, entity);

                        // update player items
                        if (player.player_data.inventory && player.player_data.inventory.size > 0) {
                            this.database.saveItems(playerClient.auth.id, player.player_data.inventory);
                        }

                        // update player abilities
                        if (player.player_data.abilities && player.player_data.abilities.size > 0) {
                            this.database.saveAbilities(playerClient.auth.id, player.player_data.abilities);
                        }

                        Logger.info("[gameroom][onCreate] player " + entity.name + " saved to database.");
                    }
                });
            }
        }, Config.databaseUpdateRate);
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // authorize client based on provided options before WebSocket handshake is complete
    async onAuth(client: Client, authData: any, request: http.IncomingMessage) {
        let character = await Auth.check(this.database, authData);
        character.AI_MODE = authData.AI_MODE ?? false;
        return character;
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // on client join
    async onJoin(client: Client, options: any) {
        this.state.addPlayer(client);
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // client message handler

    private registerMessageHandlers() {
        /////////////////////////////////////
        // on player input
        this.onMessage("*", (client, type, data) => {
            this.state.processMessage(client, type, data);
        });
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // when a client leaves the room
    async onLeave(client: Client, consented: boolean) {
        // remove from state
        this.state.deleteEntity(client.sessionId);

        // make sure no one has this entity as a target
        this.state.removeTarget(client.sessionId);

        // colyseus client leave
        client.leave();

        // set character as not online
        this.database.toggleOnlineStatus(client.auth.id, 0);

        // log
        Logger.info(`[onLeave] player ${client.auth.name} left`);
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // cleanup callback, called after there are no more clients in the room. (see `autoDispose`)
    onDispose() {
        //log
        Logger.warning(`[onDispose] game room removed. `);
    }
}
