/**
 * L2: a smaller Phaser. The npm package's default build carries Arcade and
 * Matter physics, particles, tilemaps, video, render textures and more that
 * Horders never uses. This is Phaser's own src/phaser-core.js (the official
 * custom-build entry) plus the one extra game object we use, TileSprite.
 * vite.config.ts aliases `phaser` here and fixes Phaser's build flags.
 * If the game starts using another Phaser feature, add it below (see
 * node_modules/phaser/src/phaser.js for where each one lives).
 */
import Phaser from '../../node_modules/phaser/src/phaser-core.js';
import TileSprite from '../../node_modules/phaser/src/gameobjects/tilesprite/TileSprite';
import TileSpriteFactory from '../../node_modules/phaser/src/gameobjects/tilesprite/TileSpriteFactory';
import TileSpriteCreator from '../../node_modules/phaser/src/gameobjects/tilesprite/TileSpriteCreator';

Phaser.GameObjects.TileSprite = TileSprite;
Phaser.GameObjects.Factories.TileSprite = TileSpriteFactory;
Phaser.GameObjects.Creators.TileSprite = TileSpriteCreator;

export default Phaser;
