import Phaser from "phaser";

export type CoverType = "sandbag" | "crate" | "tree" | "wall" | "house" | "camp_tent";

const COVER_COLORS: Record<CoverType, number> = {
  sandbag: 0x8b7a4a,
  crate: 0x8b6914,
  tree: 0x2d5a27,
  wall: 0x6b6b6b,
  house: 0x9c7a4a,
  camp_tent: 0x4a7a5a,
};

export const COVER_SPRITE_PATHS: Record<CoverType, string> = {
  sandbag: "/assets/sprites/tilemap/cover_sandbag.svg",
  crate: "/assets/sprites/tilemap/cover_crate.svg",
  tree: "/assets/sprites/tilemap/obstacle_tree.svg",
  wall: "/assets/sprites/tilemap/obstacle_wall.svg",
  house: "/assets/sprites/tilemap/obstacle_house.svg",
  camp_tent: "/assets/sprites/tilemap/obstacle_camp_tent.svg",
};

/** Each obstacle type's on-screen size — trees/houses are visually and physically
 *  bigger than the small crate/sandbag covers, matching their art. */
export const COVER_SIZES: Record<CoverType, { width: number; height: number }> = {
  sandbag: { width: 56, height: 40 },
  crate: { width: 56, height: 40 },
  tree: { width: 72, height: 90 },
  wall: { width: 100, height: 44 },
  house: { width: 110, height: 100 },
  camp_tent: { width: 80, height: 60 },
};

/**
 * v9 #1: rect-only AABB fractions weren't tight enough (sandbag/tree still
 * read as a big square, house's rect still ate the roof overhang). Measured
 * directly against each real SVG's own viewBox geometry this time:
 *  - sandbag: 5 overlapping mound ellipses, no single rect fits them well —
 *    a circle centered on the mound cluster (not the shadow) is a much closer
 *    match, per the user's own table.
 *  - tree: canopy is itself a circle (r=30 of an 80x80 viewBox) with smaller
 *    decorative leaf-cluster circles overlapping it — hitbox uses ~57% of the
 *    canopy radius so it covers the trunk + inner canopy, not the outermost
 *    leaf clusters.
 *  - crate/wall: rects already matched the real wood/wall frame exactly
 *    (verified against the SVG source), unchanged from the v6 fix.
 *  - house: previously included the sloped roof triangle — narrowed to just
 *    the wall rect (roof starts above y=30 of a 96-tall viewBox; excluded).
 *  - camp_tent: previously matched the full silhouette triangle — narrowed to
 *    the inner door-panel triangle's bounding box, deliberately smaller than
 *    the tent's outer shadow/silhouette.
 */
type HitboxShape =
  | { kind: "circle"; radiusFrac: number; centerXFrac: number; centerYFrac: number }
  | { kind: "rect"; widthFrac: number; heightFrac: number; offsetXFrac: number; offsetYFrac: number };

const HITBOX_SHAPE: Record<CoverType, HitboxShape> = {
  // v13: shrunk further (0.4 -> 0.32) — still reported as blocking visually-
  // empty space around the mound cluster. Arcade's setCircle() can only ever
  // be a TRUE circle, not an ellipse, so any non-square display box (this
  // cover's COVER_SIZES aren't square) already can't perfectly hug an
  // asymmetric sprite — erring smaller trades a sliver of unhit-tested solid
  // pixels for guaranteeing no shots get blocked by empty space, which is the
  // direction the user explicitly asked for. Flag with a screenshot if a
  // specific stage's cover still feels wrong — this couldn't be pixel-verified
  // visually in this sandbox (no working in-browser preview against this
  // project's backend), only reasoned about from the source SVG geometry.
  sandbag: { kind: "circle", radiusFrac: 0.32, centerXFrac: 0.5, centerYFrac: 0.646 },
  // Wooden frame rect x12,y18,w72,h60 of a 96x96 viewBox — matches exactly, unchanged.
  crate: { kind: "rect", widthFrac: 0.75, heightFrac: 0.625, offsetXFrac: 0.125, offsetYFrac: 0.1875 },
  // v13: shrunk further (0.2138 -> 0.16) for the same reason as sandbag above.
  tree: { kind: "circle", radiusFrac: 0.16, centerXFrac: 0.5, centerYFrac: 0.475 },
  // Wall strip rect x4,y6,w112,h30 of a 120x48 viewBox — matches exactly, unchanged.
  wall: { kind: "rect", widthFrac: 0.933, heightFrac: 0.625, offsetXFrac: 0.033, offsetYFrac: 0.125 },
  // Wall-only rect x16,y30,w64,h50 of a 96x96 viewBox — excludes the roof triangle above y=30.
  house: { kind: "rect", widthFrac: 0.667, heightFrac: 0.521, offsetXFrac: 0.167, offsetYFrac: 0.3125 },
  // Inner door-panel triangle's bounding box (x24-64, y8-62 of an 88x76 viewBox) —
  // deliberately narrower than the tent's full outer silhouette.
  camp_tent: { kind: "rect", widthFrac: 0.4545, heightFrac: 0.7105, offsetXFrac: 0.2727, offsetYFrac: 0.105 },
};

function drawCoverShape(gfx: Phaser.GameObjects.Graphics, type: CoverType, width: number, height: number, color: number) {
  if (type === "sandbag") {
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(0, 0, width, height, height / 2.5);
    gfx.lineStyle(2, 0x5c4e2e, 0.7);
    for (let x = height / 2; x < width; x += height * 0.7) gfx.lineBetween(x, 4, x, height - 4);
    gfx.strokeRoundedRect(0, 0, width, height, height / 2.5);
  } else if (type === "tree") {
    gfx.fillStyle(0x5c4433, 1);
    gfx.fillRect(width / 2 - 6, height * 0.55, 12, height * 0.45);
    gfx.fillStyle(color, 1);
    gfx.fillCircle(width / 2, height * 0.4, width * 0.45);
  } else if (type === "house") {
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, height * 0.35, width, height * 0.65);
    gfx.fillStyle(0x6b3a2a, 1);
    gfx.fillTriangle(0, height * 0.35, width, height * 0.35, width / 2, 0);
  } else if (type === "camp_tent") {
    gfx.fillStyle(color, 1);
    gfx.fillTriangle(0, height, width, height, width / 2, 0);
    gfx.lineStyle(2, 0x2d4a3a, 0.8);
    gfx.lineBetween(width / 2, 0, width / 2, height);
  } else {
    // crate / wall — flat rectangular blocks with a border
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, 0, width, height);
    gfx.lineStyle(3, 0x333333, 0.8);
    gfx.strokeRect(0, 0, width, height);
    if (type === "crate") {
      gfx.lineBetween(0, 0, width, height);
      gfx.lineBetween(width, 0, 0, height);
    }
  }
}

export class CoverObject {
  sprite: Phaser.Physics.Arcade.Image;
  type: CoverType;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    width: number, height: number,
    type: CoverType,
    group: Phaser.Physics.Arcade.StaticGroup,
    failedAssetKeys?: Set<string>
  ) {
    this.type = type;
    const realKey = `cover_sprite_${type}`;
    const hasRealSprite = scene.textures.exists(realKey) && !failedAssetKeys?.has(realKey);

    let key = realKey;
    if (!hasRealSprite) {
      const color = COVER_COLORS[type];
      key = `cover_${type}_${width}_${height}`;
      if (!scene.textures.exists(key)) {
        const gfx = scene.add.graphics();
        drawCoverShape(gfx, type, width, height, color);
        gfx.generateTexture(key, width, height);
        gfx.destroy();
      }
    }

    this.sprite = group.create(x, y, key) as Phaser.Physics.Arcade.Image;
    if (hasRealSprite) this.sprite.setDisplaySize(width, height);
    this.sprite.setDepth(8);
    // v14: lets GameScene's colliders skip trees specifically (trees are
    // walk-through/shoot-through — a hiding spot, not solid cover — while
    // every other cover type stays solid).
    this.sprite.setData("coverType", type);
    this.sprite.refreshBody(); // syncs body to the full display rect first...

    // ...then reshape it to the sprite's actual visual footprint. This MUST
    // happen after refreshBody() — calling setSize/setOffset/setCircle before
    // it gets silently overwritten, since Arcade static bodies resnap to the
    // full display size every time refreshBody() runs.
    const shape = HITBOX_SHAPE[type];
    const body = this.sprite.body as Phaser.Physics.Arcade.StaticBody;
    if (shape.kind === "circle") {
      const radius = width * shape.radiusFrac;
      body.setCircle(radius, width * shape.centerXFrac - radius, height * shape.centerYFrac - radius);
    } else {
      body.setSize(width * shape.widthFrac, height * shape.heightFrac);
      body.setOffset(width * shape.offsetXFrac, height * shape.offsetYFrac);
    }
  }
}
