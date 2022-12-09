import http from "http";
import { Room, Client, Delayed } from "@colyseus/core";
import { GameRoomState } from './schema/GameRoomState';
import databaseInstance from "../../shared/Database";
import Config from '../../shared/Config';
import Logger from "../../shared/Logger";
import loadNavMeshFromFile from "../../shared/Utils/loadNavMeshFromFile";
import { PlayerState } from "./schema/PlayerState";
import { PlayerInputs } from "../../shared/types";
import { PlayerCurrentState } from "../../shared/Entities/Player/PlayerCurrentState";
import { NavMesh } from "yuka";

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
        /*
        const navMesh = await loadNavMeshFromFile(options.location)
        this.navMesh = navMesh;
        Logger.info("[gameroom][onCreate] navmesh initialized.");*/
        const navMesh = await loadNavMeshFromFile(options.location)
        this.navMesh = navMesh;
        Logger.info("[gameroom][onCreate] navmesh initialized.");


        // Set initial state
        this.setState(new GameRoomState(this, options));

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
            if(this.state.players.size > 0){
                //Logger.info("[gameroom][onCreate] Saving data for room "+options.location+" with "+this.state.players.size+" players");
                this.state.players.forEach(player => {

                    // do not save if players is blocked
                    if(player.blocked){

                        // update player
                        let playerClient = this.clients.hashedArray[player.sessionId];
                        this.database.updateCharacter(playerClient.auth.id, {
                            location: player.location,
                            x: player.x,
                            y: player.y,
                            z: player.z,
                            rot: player.rot,
                        });

                        //Logger.info("[gameroom][onCreate] player "+playerClient.auth.name+" saved to database.");
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
        this.state.addPlayer(client.sessionId, client.auth);
        this.database.toggleOnlineStatus(client.auth.id, 1);
        Logger.info(`[gameroom][onJoin] player added `);

    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // client message handler

    private registerMessageHandlers() {

        /////////////////////////////////////
        // on player input
		this.onMessage('playerInput', (client, playerInput: PlayerInputs) => {
            const playerState: PlayerState = this.state.players.get(client.sessionId);
            if (playerState) {
                playerState.processPlayerInput(playerInput);
            } else {
                console.error(`Failed to retrieve Player State for ${client.sessionId}`);
            }
        });

        /////////////////////////////////////
        // on player teleport
        this.onMessage("playerTeleport", (client, location) => {

            const playerState: PlayerState = this.state.players.get(client.sessionId);

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
                playerState.setPositionManual(updateObj.x, updateObj.y, updateObj.z, 0);
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
        this.onMessage("playerAction", (client, data: any) => {

            // get players involved
            let sender:PlayerState = this.state.players[client.sessionId];
            let target:PlayerState = this.state.players[data.targetId];
            
            if(!sender) throw new Error('sender does not exists!');
            if(!target) throw new Error('target does not exists!');

            // player loses health
            target.loseHealth(5);

            // sender state
            sender.state = PlayerCurrentState.SPELL_ATTACK;

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
            })

            Logger.info(`[gameroom][playerAction] player action processed`, data);

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

        this.state.players.delete(client.sessionId);
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
