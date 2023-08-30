import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock, TextWrapping } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Image } from "@babylonjs/gui/2D/controls/image";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import Config from "../../../shared/Config";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { generatePanel } from "./Theme";
import { randomNumberInRange } from "../../../../src/shared/Utils";

export class DamageText {
    private _ui;
    private _scene: Scene;

    private damageText = [];

    constructor(ui, scene, entities) {
        this._ui = ui;
        this._scene = scene;

        // some ui must be constantly refreshed as things change
        this._scene.registerBeforeRender(() => {
            // refresh
            this._update();
        });
    }

    public addDamage(entity, amount) {
        let key = this.damageText.length;
        var rect1 = new Rectangle("damage_" + key + "_" + entity.sessionId);
        rect1.isVisible = true;
        rect1.width = "50px";
        rect1.height = "40px";
        rect1.thickness = 0;
        rect1.zIndex = this._ui.addControl(rect1);
        rect1.linkWithMesh(entity.mesh);
        rect1.linkOffsetY = -50;
        rect1.metadata = { offset: randomNumberInRange(-1, 1) };
        var label = new TextBlock("text_" + entity.sessionId);
        label.text = amount;
        label.color = "red";
        label.fontWeight = "bold";
        label.fontSize = "18px";
        label.outlineWidth = 3;
        label.outlineColor = "yellow";
        rect1.addControl(label);

        this.damageText.push(rect1);
    }

    private _update() {
        this.damageText.forEach((v, k) => {
            v.linkOffsetYInPixels -= 2;
            v.linkOffsetXInPixels -= v.metadata.offset;
            if (v.linkOffsetYInPixels < -150) {
                v.dispose();
                delete this.damageText[k];
            }
        });
    }
}
