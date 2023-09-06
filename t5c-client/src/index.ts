if (process.env.NODE_ENV !== "production") {
    import("@babylonjs/core/Debug/debugLayer");
    import("@babylonjs/inspector");
}

import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_pbrSpecularGlossiness";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_draco_mesh_compression";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/outlineRenderer";

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";

// IMPORT SCREEN
import State from "./Screens/Screens";
import { LoginScene } from "./Screens/LoginScene";
import { CharacterSelectionScene } from "./Screens/CharacterSelection";

import { Config } from "../../Config";
import { Network } from "./Controllers/Network";
import { Loading } from "./Controllers/Loading";
import { isLocal } from "./Utils";

import { Environment } from "./Controllers/Environment";
import { GameController } from "./Controllers/GameController";

// App class is our entire game application
class App {
    // babylon
    public canvas;
    public engine: Engine;
    public client: Network;
    public scene: Scene;
    public config: Config;
    public _environment;
    public _loadedAssets = null;

    // scene management
    public state: number = 0;
    public currentScene;
    public nextScene;

    //
    public game: GameController;

    constructor() {
        // create canvas
        this.canvas = document.getElementById("renderCanvas");

        // set config
        this.config = new Config();

        // initialize babylon scene and engine
        this._init();
    }

    private async _init(): Promise<void> {
        // create engine
        this.engine = new Engine(this.canvas, true, {
            adaptToDeviceRatio: true,
            antialias: true,
        });

        // preload game data
        this.game = new GameController(this);

        // load game data
        await this.game.initializeGameData();

        // set default scene
        this.game.setScene(this.config.defaultScene);

        // loading
        var loadingScreen = new Loading("Loading Assets...");
        this.engine.loadingScreen = loadingScreen;

        // create colyseus client
        // this should use environement values
        this.client = new Network(this.config.port);

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
            if (this.currentScene && this.currentScene.resize) {
                this.currentScene.resize();
            }
        });
    }

    private checkForSceneChange() {
        let currentScene = this.nextScene;
        if (this.nextScene != State.NULL) {
            this.nextScene = State.NULL;
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
