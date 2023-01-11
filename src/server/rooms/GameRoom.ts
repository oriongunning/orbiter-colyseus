import http from "http";
import { Room, Client, Delayed } from "@colyseus/core";
import { GameRoomState } from './schema/GameRoomState';
import databaseInstance from "../../shared/Database";
import Config from '../../shared/Config';
import Logger from "../../shared/Logger";
import loadNavMeshFromFile from "../../shared/Utils/loadNavMeshFromFile";
import { EntityState } from "./schema/EntityState";
import { PlayerInputs } from "../../shared/types";
import { EntityCurrentState } from "../../shared/Entities/Entity/EntityCurrentState";
import { NavMesh, Vector3 } from "../../shared/yuka";

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

        Logger.info("[gameroom][onCreate] game room created: "+this.roomId, options)
 
        this.setMetadata(options);

        // initialize navmesh
        const navMesh = await loadNavMeshFromFile(options.location)
        this.navMesh = navMesh;
        Logger.info("[gameroom][onCreate] navmesh "+options.location+" initialized.");
   
        // Set initial state
        this.setState(new GameRoomState(this, this.navMesh, options));

        // Register message handlers for messages from the client
        this.registerMessageHandlers();

        // Set the frequency of the patch rate
        // let's make it the same as our game loop
        this.setPatchRate(Config.updateRate);

        // Set the simulation interval callback
        // use to check stuff on the server at regular interval
        this.setSimulationInterval(dt => { 
            this.state.serverTime += dt; 
            this.state.update(dt);
        });  

        // set max clients
        this.maxClients = Config.maxClients;

        // initialize database
        this.database = new databaseInstance();

        ///////////////////////////////////////////////////////////////////////////
        // if players are in a room, make sure we save any changes to the database.
        this.delayedInterval = this.clock.setInterval(() => {

            // only save if there is any players
            if(this.state.entities.size > 0){

                //Logger.info("[gameroom][onCreate] Saving data for room "+options.location+" with "+this.state.players.size+" players");
                this.state.entities.forEach(entity => {

                    if(entity.type === 'player'){

                        // do not save if players is blocked
                        if(entity.blocked){

                            // update player
                            let playerClient = this.clients.hashedArray[entity.sessionId];
                            this.database.updateCharacter(playerClient.auth.id, {
                                location: entity.location,
                                x: entity.x,
                                y: entity.y,
                                z: entity.z,
                                rot: entity.rot,
                            });

                            //Logger.info("[gameroom][onCreate] player "+playerClient.auth.name+" saved to database.");
                        }
                    }

                });
                
            }
           
        }, Config.databaseUpdateRate);
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // authorize client based on provided options before WebSocket handshake is complete
    async onAuth (client: Client, data: any, request: http.IncomingMessage) { 

        // try to find char
        const character = await this.database.getCharacter(data.character_id);

        // if no character found, then refuse auth
        if (!character) {
            Logger.error("[gameroom][onAuth] client could not authentified, joining failed.", data.character_id);
            return false
        }

        // character found, check if already logged in
        if(character.online > 0){
            Logger.error("[gameroom][onAuth] client already connected. "+ character);
            return false
        }

        // all checks are good, proceed
        Logger.info("[gameroom][onAuth] client authentified.", character);
        return character;
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // on client join
    async onJoin(client: Client, options: any) {

        // add player to server
        Logger.info(`[gameroom][onJoin] player ${client.sessionId} joined room ${this.roomId}.`, options);

        // add player using auth data
        this.state.addEntity(client.sessionId, client.auth);
        this.database.toggleOnlineStatus(client.auth.id, 1);
        Logger.info(`[gameroom][onJoin] player added `);

        //client.send('sdfsdfsd', element)
        
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // client message handler

    private registerMessageHandlers() {

        /////////////////////////////////////
        // on player input
		this.onMessage('playerInput', (client, playerInput: PlayerInputs) => {
            const playerState: EntityState = this.state.entities.get(client.sessionId);
            if (playerState) {
                playerState.processPlayerInput(playerInput);
            } else {
                console.error(`Failed to retrieve Player State for ${client.sessionId}`);
            }
        });

        /////////////////////////////////////
        // on player teleport
        this.onMessage("playerTeleport", (client, location) => {

            const playerState: EntityState = this.state.entities.get(client.sessionId);

            if (playerState) {

                // update player location in database
                let newLocation = Config.locations[location];
                let updateObj = {
                    location: newLocation.key,
                    x: newLocation.spawnPoint.x,
                    y: newLocation.spawnPoint.y,
                    z: newLocation.spawnPoint.z,
                    rot: 0,
                };
                this.database.updateCharacter(client.auth.id, updateObj);
                
                // update player state on server
                //playerState.setPositionManual(updateObj.x, updateObj.y, updateObj.z, 0);
                playerState.setLocation(location);

                // inform client he cand now teleport to new zone
                client.send('playerTeleportConfirm', location)

                // log
                Logger.info(`[gameroom][playerTeleport] player teleported to ${location}`);


            }else{
                Logger.error(`[gameroom][playerTeleport] failed to teleported to ${location}`);
            }
        });

        /////////////////////////////////////
        // player action
        this.onMessage("entity_attack", (client, data: any) => {

            let state = this.state;

            // get players involved
            let sender:EntityState = state.entities[client.sessionId];
            let target:EntityState = state.entities[data.targetId];
            
            if(sender && target){
                // sender state
                //sender.state = PlayerCurrentState.ATTACK;
                target.state = EntityCurrentState.TAKING_DAMAGE;

                // target loses health
                target.loseHealth(40);

                // if target has no more health
                if(target.health == 0 || target.health < 0){ 

                    // set entity as dead
                    target.health = 0;
                    target.state = EntityCurrentState.DEAD;
                    target.blocked = true;
                    Logger.info(`[gameroom][playerAction] Entity is dead`, data);

                    // delete so entity can be respawned
                    setTimeout(function(){
                        Logger.info(`[gameroom][playerAction] Deleting entity from server`, data);
                        delete state.entities[target.sessionId];
                    }, Config.MONSTER_RESPAWN_RATE);
                }

            }else{
                
                Logger.error(`[gameroom][playerAction] target or sender is invalid`, data);
            }

            /*
            // inform target hes been hurt
            this.clients.get(target.sessionId).send('playerActionConfirmation', {
                action: 'attack',
                fromSenderId: client.sessionId,
                fromPosition: {
                    x: sender.x,
                    y: sender.y,
                    z: sender.z,
                },
                toPosition: {
                    x: target.x,
                    y: target.y,
                    z: target.z,
                },
                message: sender.name +" attacked you and you lost 5 health"
            })*/

            Logger.info(`[gameroom][entity_attack] player action processed`, data);

        });

        /////////////////////////////////////
        // player move to
        this.onMessage("player_moveTo", (client, data: any) => {

            // get players involved
            let player:EntityState = this.state.entities[client.sessionId];
           
            if(!player) throw new Error('sender does not exists!');

            // set destination
            let from = new Vector3(player.x, player.y, player.z);
            let destination = new Vector3(data.to._x, data.to._y, data.to._z);
            player.toRegion = this.navMesh.getClosestRegion( destination );
            player.destinationPath = this.navMesh.findPath(from, destination);

        });

	}

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // when a client leaves the room
    async onLeave(client: Client, consented: boolean) {
        /*
		try {
			if (consented) {
				throw new Error('consented leave!');
			}

			//throw new Error('DEBUG force no reconnection check');

			console.log("let's wait for reconnection for client: " + client.sessionId);
			const newClient: Client = await this.allowReconnection(client, 3);
			console.log('reconnected! client: ' + newClient.sessionId);

		} catch (e) {
			Logger.info(`[onLeave] player ${client.auth.name} left`);

			this.state.players.delete(client.sessionId);
            this.database.toggleOnlineStatus(client.auth.id, 0);
		}
        */

        Logger.info(`[onLeave] player ${client.auth.name} left`);

        this.state.entities.delete(client.sessionId);
        this.database.toggleOnlineStatus(client.auth.id, 0);
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
