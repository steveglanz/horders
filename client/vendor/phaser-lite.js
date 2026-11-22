/**
 * L2: a smaller Phaser. The npm package's default build carries Arcade and
 * Matter physics, particles, tilemaps, video, render textures and more that
 * Horders never uses. This is Phaser's own src/phaser-core.js (the official
 * custom-build entry), in the same order, minus what the game never reaches:
 * Tweens, the Loader (every texture is drawn in code, client/textures.ts),
 * Layer and masks. Plus the one extra game object we use, TileSprite.
 * Phaser skips scene plugins that aren't registered (PluginManager hasCore),
 * and SceneManager checks `sys.load` before using it.
 * Keep the import order: Phaser's modules require each other in cycles, and
 * a different order leaves a base class undefined (BatchHandlerQuad crashed).
 * vite.config.ts aliases `phaser` here and fixes Phaser's build flags.
 * If the game starts using another Phaser feature (this.tweens, this.load,
 * add.layer...), add it back from node_modules/phaser/src/phaser-core.js.
 */
import '../../node_modules/phaser/src/polyfills/requestVideoFrame';
import CONST from '../../node_modules/phaser/src/const';
import Extend from '../../node_modules/phaser/src/utils/object/Extend';
import Animations from '../../node_modules/phaser/src/animations';
import BlendModes from '../../node_modules/phaser/src/renderer/BlendModes';
import Cache from '../../node_modules/phaser/src/cache';
import Cameras2D from '../../node_modules/phaser/src/cameras/2d';
import Core from '../../node_modules/phaser/src/core';
import Class from '../../node_modules/phaser/src/utils/Class';
import Data from '../../node_modules/phaser/src/data';
import DOM from '../../node_modules/phaser/src/dom';
import Events from '../../node_modules/phaser/src/events';
import Filters from '../../node_modules/phaser/src/filters';
import Game from '../../node_modules/phaser/src/core/Game';
import DisplayList from '../../node_modules/phaser/src/gameobjects/DisplayList';
import GameObjectCreator from '../../node_modules/phaser/src/gameobjects/GameObjectCreator';
import GameObjectFactory from '../../node_modules/phaser/src/gameobjects/GameObjectFactory';
import UpdateList from '../../node_modules/phaser/src/gameobjects/UpdateList';
import Components from '../../node_modules/phaser/src/gameobjects/components';
import BuildGameObject from '../../node_modules/phaser/src/gameobjects/BuildGameObject';
import BuildGameObjectAnimation from '../../node_modules/phaser/src/gameobjects/BuildGameObjectAnimation';
import GameObject from '../../node_modules/phaser/src/gameobjects/GameObject';
import Graphics from '../../node_modules/phaser/src/gameobjects/graphics/Graphics';
import Image from '../../node_modules/phaser/src/gameobjects/image/Image';
import Sprite from '../../node_modules/phaser/src/gameobjects/sprite/Sprite';
import Text from '../../node_modules/phaser/src/gameobjects/text/Text';
import GraphicsFactory from '../../node_modules/phaser/src/gameobjects/graphics/GraphicsFactory';
import ImageFactory from '../../node_modules/phaser/src/gameobjects/image/ImageFactory';
import SpriteFactory from '../../node_modules/phaser/src/gameobjects/sprite/SpriteFactory';
import TextFactory from '../../node_modules/phaser/src/gameobjects/text/TextFactory';
import GraphicsCreator from '../../node_modules/phaser/src/gameobjects/graphics/GraphicsCreator';
import ImageCreator from '../../node_modules/phaser/src/gameobjects/image/ImageCreator';
import SpriteCreator from '../../node_modules/phaser/src/gameobjects/sprite/SpriteCreator';
import TextCreator from '../../node_modules/phaser/src/gameobjects/text/TextCreator';
import Input from '../../node_modules/phaser/src/input';
import Between from '../../node_modules/phaser/src/math/Between';
import DegToRad from '../../node_modules/phaser/src/math/DegToRad';
import FloatBetween from '../../node_modules/phaser/src/math/FloatBetween';
import RadToDeg from '../../node_modules/phaser/src/math/RadToDeg';
import Vector2 from '../../node_modules/phaser/src/math/Vector2';
import Plugins from '../../node_modules/phaser/src/plugins';
import Renderer from '../../node_modules/phaser/src/renderer';
import Scale from '../../node_modules/phaser/src/scale';
import ScaleModes from '../../node_modules/phaser/src/renderer/ScaleModes';
import Scene from '../../node_modules/phaser/src/scene/Scene';
import Scenes from '../../node_modules/phaser/src/scene';
import Structs from '../../node_modules/phaser/src/structs';
import Textures from '../../node_modules/phaser/src/textures';
import Time from '../../node_modules/phaser/src/time';
import TintModes from '../../node_modules/phaser/src/renderer/TintModes';
import TileSprite from '../../node_modules/phaser/src/gameobjects/tilesprite/TileSprite';
import TileSpriteFactory from '../../node_modules/phaser/src/gameobjects/tilesprite/TileSpriteFactory';
import TileSpriteCreator from '../../node_modules/phaser/src/gameobjects/tilesprite/TileSpriteCreator';

const Phaser = Extend(false, {
  Animations, BlendModes, Cache, Cameras: { Scene2D: Cameras2D }, Core, Class, Data, DOM, Events, Filters, Game,
  GameObjects: {
    DisplayList, GameObjectCreator, GameObjectFactory, UpdateList, Components, BuildGameObject, BuildGameObjectAnimation, GameObject,
    Graphics, Image, Sprite, Text, TileSprite,
    Factories: { Graphics: GraphicsFactory, Image: ImageFactory, Sprite: SpriteFactory, Text: TextFactory, TileSprite: TileSpriteFactory },
    Creators: { Graphics: GraphicsCreator, Image: ImageCreator, Sprite: SpriteCreator, Text: TextCreator, TileSprite: TileSpriteCreator },
  },
  Input, Math: { Between, DegToRad, FloatBetween, RadToDeg, Vector2 },
  Plugins, Renderer, Scale, ScaleModes, Scene, Scenes, Structs, Textures, Time, TintModes,
}, CONST);

globalThis.Phaser = Phaser;
export default Phaser;
