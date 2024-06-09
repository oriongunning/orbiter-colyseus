// colyseus
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { GameController } from "./GameController";
import { bakeVertexData, calculateRanges, setAnimationParameters } from "../Entities/Common/VatHelper";
import { BakedVertexAnimationManager } from "@babylonjs/core/BakedVertexAnimation/bakedVertexAnimationManager";
import { Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import { VertexAnimationBaker } from "@babylonjs/core/BakedVertexAnimation/vertexAnimationBaker";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import AnimationHelper from "../Entities/Common/AnimationHelper";
import { mergeMesh, mergeMeshAndSkeleton } from "../Entities/Common/MeshHelper";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PBRCustomMaterial } from "@babylonjs/materials/custom/pbrCustomMaterial";
import { PlayerSlots } from "../../shared/types";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { AssetContainer } from "@babylonjs/core/assetContainer";

class JavascriptDataDownloader {
    private data;
    constructor(data = {}) {
        this.data = data;
    }
    download(type_of = "text/plain", filename = "data.txt") {
        let body = document.body;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(
            new Blob([JSON.stringify(this.data, null, 2)], {
                type: type_of,
            })
        );
        a.setAttribute("download", filename);
        body.appendChild(a);
        a.click();
        body.removeChild(a);
    }
}

export class VatController {
    public _game: GameController;
    private _spawns: any[] = [];
    public _entityData = new Map();
    public _vatData = new Map();
    private _skeletonData = new Map();

    public get entityData() {
        return this._entityData;
    }

    public get skeletonData() {
        return this._skeletonData;
    }

    constructor(game, spawns) {
        this._game = game;
        this._spawns = spawns;
    }

    async fetchVAT(key) {
        const url = "./models/races/vat/" + key + ".json";
        const response = await fetch(url);
        const movies = await response.json();
        return movies;
    }

    async prepareVat(race){

        let key = race.vat;

        console.log("[prepareVat] "+key, race);

        if(!this._entityData.has(key)){
            // get vat data
            const bakedAnimationJson = await this.fetchVAT(key);

            const { animationGroups, skeletons } = this._game._loadedAssets["RACE_" + key];
            const skeleton = skeletons[0];

            // get selected animations
            animationGroups.forEach((ag) => ag.stop());
            const selectedAnimationGroups = this.getAnimationGroups(animationGroups, race.animations);    

            // calculate animations ranges
            const ranges = calculateRanges(selectedAnimationGroups);

            // create vat manager
            const b = new VertexAnimationBaker(this._game.scene, skeleton);
            const manager = new BakedVertexAnimationManager(this._game.scene);

            // load prebaked vat animations
            let bufferFromMesh = b.loadBakedVertexDataFromJSON(bakedAnimationJson);
            manager.texture = b.textureFromBakedVertexData(bufferFromMesh);

            // save vat
            this._entityData.set(key, {
                name: key,
                meshes: new Map(),
                animationRanges: ranges,
                selectedAnimationGroups: selectedAnimationGroups,
                vat: manager,
                skeleton: skeleton,
                items: new Map(),
            })

        }
        return this._entityData.get(key);
    }

    makeHumanoid(root, skeleton, data){
        
        ///let root = baseMeshes.clone('HELLO');

        /*
        let keepArray = [
            "HELLO.Rig."+data.head+"."+data.head,
            "HELLO.Rig.Base_ArmLeft.Base_ArmLeft",
            "HELLO.Rig.Base_ArmRight.Base_ArmRight",
            Math.random() < .5 ? "HELLO.Rig.Base_Body.Base_Body" : "HELLO.Rig.Armor_Robe.Armor_Robe",
            "HELLO.Rig.Base_LegLeft.Base_LegLeft",
            "HELLO.Rig.Base_LegRight.Base_LegRight"
        ];*/

        let keepArray = [
            data.head,
            "Base_ArmLeft",
            "Base_ArmRight",
            Math.random() < .5 ? "Base_Body" : "Armor_Robe",
            "Base_LegLeft",
            "Base_LegRight"
        ];

        console.log('[VAT] making humanoid', data.head, keepArray);

        root.getChildMeshes(false).forEach(element => {
            console.log(element.id);
            if(!keepArray.includes(element.id)){
                element.dispose();
            }
        });

        return mergeMeshAndSkeleton(root, skeleton);
    }

    async prepareMesh(entity) {
        let key = entity.race;
        let race = this._game.getGameData("race", key);

        // gets or prepare vat
        let vat = await this.prepareVat(race);

        // 
        const { meshes } = this._game._loadedAssets["RACE_" + key];
        const root = meshes[0];
        root.name = "_root_race_" + key;

        // reset positions
        root.position.setAll(0);
        root.scaling.setAll(1);
        root.rotationQuaternion = null;
        root.rotation.setAll(0);
        root.setEnabled(false);

        // cherry pick meshes
        let modelMeshMerged = this.makeHumanoid(root, vat.skeleton, entity);

        // setup vat
        if (modelMeshMerged) {

            // set mesh
            modelMeshMerged.registerInstancedBuffer("bakedVertexAnimationSettingsInstanced", 4);
            modelMeshMerged.instancedBuffers.bakedVertexAnimationSettingsInstanced = new Vector4(0, 0, 0, 0);
            
            modelMeshMerged.bakedVertexAnimationManager = vat.vat;
            modelMeshMerged.instancedBuffers.bakedVertexAnimationSettingsInstanced = new Vector4(0, 0, 0, 0);

            // copy mesh for each material
            /*
            let mergedMeshes: any[] = [];
            let materials = race.materials ?? [];
            if (materials.length > 1) {
                let materialId = 0;
                race.materials.forEach((material) => {
                    let raceKey = race.key + "_" + materialId;

                    // prepare clone
                    let clone = modelMeshMerged.clone(raceKey);
                    clone.bakedVertexAnimationManager = vat.vat;
                    clone.registerInstancedBuffer("bakedVertexAnimationSettingsInstanced", 4);
                    clone.instancedBuffers.bakedVertexAnimationSettingsInstanced = new Vector4(0, 0, 0, 0);
                    clone.setEnabled(false);
                    mergedMeshes.push(this.prepareClone(clone, material, raceKey, materialId));
                    materialId++;
                });
            } else {
                // in the case where there is only one material
                let raceKey = race.key + "_0";
                let clone = modelMeshMerged.clone(raceKey);
                clone.bakedVertexAnimationManager = vat.vat;
                clone.registerInstancedBuffer("bakedVertexAnimationSettingsInstanced", 4);
                clone.instancedBuffers.bakedVertexAnimationSettingsInstanced = new Vector4(0, 0, 0, 0);
                clone.setEnabled(false);
                mergedMeshes.push(clone);
            }
            */
            // in the case where there is only one material
            /*
            let raceKey = race.key + "_0";
            let clone = modelMeshMerged.clone(raceKey);
            clone.bakedVertexAnimationManager = vat.vat;
            clone.registerInstancedBuffer("bakedVertexAnimationSettingsInstanced", 4);
            clone.instancedBuffers.bakedVertexAnimationSettingsInstanced = new Vector4(0, 0, 0, 0);
            clone.setEnabled(false);
            */
            vat.meshes.set(entity.sessionId, modelMeshMerged);

            // hide mesh
            modelMeshMerged.setEnabled(false);

            // 
            console.log("[VAT] vat loaded", vat);
        }
    }

    async prepareItemForVat(raceKey, itemKey) {
        // get entityData
        let entityData = this._entityData.get(raceKey);

        // make sure not already loaded
        if (entityData.items.has(itemKey)) {
            return false;
        }

        // load item
        let item = this._game.getGameData("item", itemKey);
        let race = this._game.getGameData("race", raceKey);
        let slot = item.equippable ? PlayerSlots[item.equippable.slot] : 0;
        let boneId = race.bones[slot];

        if (!boneId) return false;

        // clone raw mesh
        let rawMesh = this._game._loadedAssets["ITEM_" + item.key].meshes[0]; // mandatory: needs to be cloned
        
        rawMesh.position.copyFrom(entityData.skeleton.bones[boneId].getAbsolutePosition());
        rawMesh.rotationQuaternion = undefined;
        rawMesh.rotation.set(0, Math.PI * 1.5, 0); // could be set it in Blender
        rawMesh.scaling.setAll(1);

        /*
        // if mesh offset required
        let equipOptions = item.equippable;
        if (equipOptions.scale) {
            rawMesh.scaling = new Vector3(equipOptions.scale, equipOptions.scale, equipOptions.scale);
        }
        if (equipOptions.offset_x) {
            rawMesh.position.x += equipOptions.offset_x;
        }
        if (equipOptions.offset_y) {
            rawMesh.position.y += equipOptions.offset_y;
        }
        if (equipOptions.offset_z) {
            rawMesh.position.z += equipOptions.offset_z;
        }

        // if rotationFix needed
        if (equipOptions.rotation_x || equipOptions.rotation_y || equipOptions.rotation_z) {
            // You cannot use a rotationQuaternion followed by a rotation on the same mesh. Once a rotationQuaternion is applied any subsequent use of rotation will produce the wrong orientation, unless the rotationQuaternion is first set to null.
            rawMesh.rotationQuaternion = null;
            rawMesh.rotation.set(equipOptions.rotation_x ?? 0, equipOptions.rotation_y ?? 0, equipOptions.rotation_z ?? 0);
        }*/

        // merge mesh
        let itemMesh = mergeMesh(rawMesh, itemKey);
        if (itemMesh) {
            itemMesh.name = race.key + "_" + itemMesh.name;

            // attach to VAT
            itemMesh.skeleton = entityData.skeleton;
            itemMesh.bakedVertexAnimationManager = entityData.vat;
            itemMesh.registerInstancedBuffer("bakedVertexAnimationSettingsInstanced", 4);
            itemMesh.instancedBuffers.bakedVertexAnimationSettingsInstanced = new Vector4(0, 0, 0, 0);

            // manually set MatricesIndicesKind & MatricesWeightsKind
            // https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons#preparing-mesh
            const totalCount = itemMesh.getTotalVertices();
            const weaponMI: any = [];
            const weaponMW: any = [];
            for (let i = 0; i < totalCount; i++) {
                weaponMI.push(boneId, 0, 0, 0);
                weaponMW.push(1, 0, 0, 0);
            }

            itemMesh.setVerticesData(VertexBuffer.MatricesIndicesKind, weaponMI, false);
            itemMesh.setVerticesData(VertexBuffer.MatricesWeightsKind, weaponMW, false);

            // cleanup
            //rawMesh.dispose();
            rawMesh.position.y = 5000; // offset to hide the raw item as setEnabled does not work
            itemMesh.position.y = 5000; // offset to hide the raw item as setEnabled does not work
            //itemMesh.setEnabled(false);

            //console.log("PREPARING ITEM FOR VAT", race, itemKey);
            entityData.items.set(itemKey, itemMesh);
        }
    }

    prepareClone(cloneMesh, material: any, raceKey, materialIndex) {
        const selectedMaterial = cloneMesh.material ?? false;

        if (selectedMaterial) {
            selectedMaterial.dispose();
        }

        // create a new material based on race and material index
        let alreadyExistMaterial = this._game.scene.getMaterialByName(raceKey);

        if (alreadyExistMaterial) {
            alreadyExistMaterial.freeze();
            // material already exists
            cloneMesh.material = alreadyExistMaterial;
        } else {
            // create material as it does not exists
            let mat = new PBRCustomMaterial(raceKey);
            mat.albedoTexture = new Texture("./models/races/materials/" + material.material, this._game.scene, {
                invertY: false,
            });
            mat.reflectionColor = new Color3(0, 0, 0);
            mat.reflectivityColor = new Color3(0, 0, 0);
            mat.freeze();

            //
            cloneMesh.material = mat;
        }

        return cloneMesh;
    }

    async bakeTextureAnimation(key: string, merged) {
        const b = new VertexAnimationBaker(this._game.scene, merged);
        const bufferFromMesh = await bakeVertexData(merged, this._entityData[key].selectedAnimationGroups);
        let vertexDataJson = b.serializeBakedVertexDataToJSON(bufferFromMesh);
        new JavascriptDataDownloader(vertexDataJson).download("text/json", key + ".json");
    }

    async bakeTextureAnimationRealtime(key: string, merged) {
        const b = new VertexAnimationBaker(this._game.scene, merged);
        const bufferFromMesh = await bakeVertexData(merged, this._entityData[key].selectedAnimationGroups);
        const buffer = bufferFromMesh;
        this._entityData[key].vat.texture = b.textureFromBakedVertexData(buffer);
    }

    async loadBakedAnimation(key: string, merged) {
        const b = new VertexAnimationBaker(this._game.scene, merged);
        const req = await fetch("./models/races/vat/" + key + ".json");
        const json = await req.json();
        let bufferFromMesh = await b.loadBakedVertexDataFromJSON(json);
        this._entityData.get(key).vat.texture = b.textureFromBakedVertexData(bufferFromMesh);
    }

    // todo: there must a better way to do this, it's so ugly
    getAnimationGroups(animationGroups, raceAnimations) {
        let anims: AnimationGroup[] = [];
        for (let i in raceAnimations) {
            let animationGroup = raceAnimations[i];
            let anim = animationGroups.filter((ag) => animationGroup.name === ag.name);
            if (anim && anim[0]) {
                anims.push(anim[0]);
            }
        }
        return anims;
    }

    process(delta) {
        this._entityData.forEach((entityData) => {
            entityData.vat.time += this._game.scene.getEngine().getDeltaTime() / 1000.0;
        });
    }
}
