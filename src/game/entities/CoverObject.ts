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
  // v65 fix: the v24 "recenter to 0.5" pass assumed the sandbag art was
  // vertically symmetric within its viewBox and wasn't — measured directly
  // against cover_sandbag.svg's 5 mound ellipses (viewBox 128x96), the drawn
  // shape actually spans x:8-120, y:37-84 (center-Y fraction ~0.63, not
  // 0.5). A circle centered at 0.5 straddled that real center, so its top
  // half sat mostly in the empty transparent gap above the mounds (blocking
  // walk/shoot there for no visual reason) while its bottom/left/right edges
  // undershot the actual mound spread (letting shots through PAST where the
  // sandbag visually ends). Switched to a rect matching the real geometry —
  // same fix shape as crate/house/camp_tent below, which were already correct.
  sandbag: { kind: "rect", widthFrac: 0.875, heightFrac: 0.4896, offsetXFrac: 0.0625, offsetYFrac: 0.3854 },
  // Wooden frame rect x12,y18,w72,h60 of a 96x96 viewBox — matches exactly, unchanged.
  crate: { kind: "rect", widthFrac: 0.75, heightFrac: 0.625, offsetXFrac: 0.125, offsetYFrac: 0.1875 },
  // v13: shrunk further (0.2138 -> 0.16) for the same reason as sandbag above.
  // Trees are walk-through/shoot-through anyway (see GameScene's notTree
  // collider filter) so this shape never actually blocks anything — kept
  // centered for correctness, not because it's load-bearing.
  tree: { kind: "circle", radiusFrac: 0.16, centerXFrac: 0.5, centerYFrac: 0.5 },
  // v65 fix: same "recentered to the wrong center" bug as sandbag — the real
  // stone rect in obstacle_wall.svg is x4,y6,w112,h30 of a 120x48 viewBox,
  // i.e. offsetYFrac 0.125 (center-Y fraction 0.4375), not the 0.1875 the
  // v24 pass moved it to (which shifted the hitbox 3px too far down).
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
    failedAssetKeys?: Set<string>,
    // v25: stage-layout PDFs draw some wall runs as vertical columns, not just
    // horizontal rows — the sprite/hitbox were previously always authored
    // landscape (100x44), so a "vertical" placement just stacked flat
    // horizontal segments with big gaps instead of reading as an actual wall.
    // rotationDeg 90 rotates the sprite visually AND swaps the footprint used
    // for the hitbox math below, so a rotated wall collides as a true
    // portrait bar matching what's drawn on screen.
    rotationDeg: 0 | 90 = 0
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
    if (rotationDeg) this.sprite.setAngle(rotationDeg);
    this.sprite.setDepth(8);
    // v14: lets GameScene's colliders skip trees specifically (trees are
    // walk-through/shoot-through — a hiding spot, not solid cover — while
    // every other cover type stays solid).
    this.sprite.setData("coverType", type);
    this.sprite.refreshBody(); // syncs body to the full display rect first...

    // ...then reshape it to the sprite's actual visual footprint. This MUST
    // happen after refreshBody() — calling setSize/setOffset/setCircle before
    // it gets silently overwritten, since Arcade static bodies resnap to the
    // full display size every time refreshBody() runs. Arcade static bodies
    // are always axis-aligned regardless of the sprite's visual angle, so a
    // rotated wall's hitbox is built directly from the swapped (footprint)
    // width/height rather than actually rotating a shape — this correctly
    // reproduces the post-rotation on-screen bounding box.
    const footprintWidth = rotationDeg ? height : width;
    const footprintHeight = rotationDeg ? width : height;
    const shape = HITBOX_SHAPE[type];
    const body = this.sprite.body as Phaser.Physics.Arcade.StaticBody;
    if (shape.kind === "circle") {
      const radius = footprintWidth * shape.radiusFrac;
      body.setCircle(radius, footprintWidth * shape.centerXFrac - radius, footprintHeight * shape.centerYFrac - radius);
    } else {
      body.setSize(footprintWidth * shape.widthFrac, footprintHeight * shape.heightFrac);
      body.setOffset(footprintWidth * shape.offsetXFrac, footprintHeight * shape.offsetYFrac);
    }
  }
}
