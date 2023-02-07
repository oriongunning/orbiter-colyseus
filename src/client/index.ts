import { isLocal } from "../shared/Utils";

if (process.env.NODE_ENV !== "production") {
    import("@babylonjs/core/Debug/debugLayer");
    import("@babylonjs/inspector");
}

import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_pbrSpecularGlossiness";

import { Engine } from "@babylonjs/core/Engines/engine";
import { EngineFactory } from "@babylonjs/core/Engines/engineFactory";
import { Scene } from "@babylonjs/core/scene";

// IMPORT SCREEN
import State from "./Screens/Screens";
import { GameScene } from "./Screens/GameScene";
import { LoginScene } from "./Screens/LoginScene";
import { CharacterSelectionScene } from "./Screens/CharacterSelection";
import Config from "../shared/Config";
import { Network } from "./Controllers/Network";
import { Loading } from "./Controllers/Loading";
import Locations from "./../shared/Data/Locations";

// App class is our entire game application
class App {
    // babylon
    public canvas;
    public engine: Engine;
    public client: Network;
    public scene: Scene;

    // scene management
    public state: number = 0;
    public currentScene;
    public nextScene;

    // custom data
    public currentUser;
    public currentPlayer;
    public currentRoomID;
    public currentSessionID;
    public currentLocation;
    public metaData: any;

    constructor() {
        // create canvas
        this.canvas = document.getElementById("renderCanvas");

        // initialize babylon scene and engine
        this._init();

        // setup default values
        this.setDefault();
    }

    private async _init(): Promise<void> {
        // create engine
        this.engine = (await EngineFactory.CreateAsync(this.canvas, {
            antialiasing: true,
        })) as Engine;

        // loading
        var loadingScreen = new Loading("Loading Assets...");
        this.engine.loadingScreen = loadingScreen;

        // create colyseus client
        // this should use environement values
        this.client = new Network();

        // main render loop & state machine
        await this._render();
    }

    private async _render(): Promise<void> {
        // render loop
        this.engine.runRenderLoop(() => {
            // monitor state
            this.state = this.checkForSceneChange();

            switch (this.state) {
                ///////////////////////////////////////
                // LOGIN SCENE
                case State.LOGIN:
                    this.clearScene();
                    this.currentScene = new LoginScene();
                    this.currentScene.createScene(this);
                    this.scene = this.currentScene._scene;
                    this.state = State.NULL;
                    break;

                ///////////////////////////////////////
                // CHARACTER SELECTION SCENE
                case State.CHARACTER_SELECTION:
                    this.clearScene();
                    this.currentScene = new CharacterSelectionScene();
                    this.currentScene.createScene(this);
                    this.scene = this.currentScene._scene;
                    this.state = State.NULL;
                    break;

                ///////////////////////////////////////
                // GAME SCENE
                case State.GAME:
                    this.clearScene();
                    this.currentScene = new GameScene();
                    this.currentScene.createScene(this);
                    this.scene = this.currentScene._scene;
                    this.state = State.NULL;
                    break;

                default:
                    break;
            }

            // render when scene is ready
            this._process();
        });

        if (isLocal()) {
            //**for development: make inspector visible/invisible
            window.addEventListener("keydown", (ev) => {
                //Shift+Ctrl+Alt+I
                if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                    if (this.scene.debugLayer.isVisible()) {
                        this.scene.debugLayer.hide();
                    } else {
                        this.scene.debugLayer.show();
                    }
                }
            });
        }

        //resize if the screen is resized/rotated
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    // functions
    setDefault() {
        global.T5C = {
            //nextScene: isLocal() ? State.GAME : State.LOGIN,
            nextScene: State.LOGIN,
            currentRoomID: "",
            currentSessionID: "",
            currentLocation: Locations[Config.initialLocation],
            currentUser: false,
            currentMs: 0,
        };
    }

    private checkForSceneChange() {
        let currentScene = global.T5C.nextScene;
        if (global.T5C.nextScene != State.NULL) {
            global.T5C.nextScene = State.NULL;
            return currentScene;
        }
    }

    private async _process(): Promise<void> {
        // make sure scene and camera is initialized
        if (this.scene && this.scene.activeCamera) {
            //when the scene is ready, hide loading
            this.engine.hideLoadingUI();

            // render scene
            this.scene.render();
        }
    }

    private clearScene() {
        if (this.scene) {
            this.engine.displayLoadingUI();
            this.scene.detachControl();
            this.scene.dispose();
            this.currentScene = null;
        }
    }
}
new App();
