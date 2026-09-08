/**
 * Every model file the room loads, in one place.
 *
 * `sk/` came from Sketchfab (CC BY — see CREDITS.md, attribution is required),
 * `ph/` from Poly Haven (CC0). Everything was reprocessed through
 * @gltf-transform/cli before shipping: textures down to 1024px (512px for small
 * props) and re-encoded to WebP, geometry simplified on the heavy ones. The raw
 * downloads were 264MB. What ships is 17MB.
 */

/** Room box. Walls sit at +/- half these. */
export const ROOM = { w: 7, h: 3.1, d: 7 } as const;
export const HALF_W = ROOM.w / 2;
export const HALF_D = ROOM.d / 2;

export const SK = {
  slidingDoor: "/models/sk/sliding_door.glb",
  railing: "/models/sk/railing_set.glb",
  tvStand: "/models/sk/reclaimed_tv_stand__furniture.glb",
  corkboard: "/models/sk/corkboard_free_low_poly.glb",
  sofa: "/models/sk/grey_sofa.glb",
  coffeeTable: "/models/sk/free_3d_model_coffee_table_glass_and_metal.glb",
  wireShelf: "/models/sk/metal_wire_shelf.glb",
  rug: "/models/sk/rug_-_square_pattern.glb",
  plantTall: "/models/sk/tall_potted_house_plant.glb",
  plantSmall: "/models/sk/small_potted_plants.glb",
  laptop: "/models/sk/modern_slim_laptop.glb",
  bin: "/models/sk/trash_bin.glb",
  laundryBasket: "/models/sk/plastic_laundry_basket_free.glb",
  officeChair: "/models/sk/office_chair.glb",
  books: "/models/sk/books_and_magazines.glb",
  sneakers: "/models/sk/common_projects_achilles_low.glb",
  camera: "/models/sk/camera.glb",
  mug: "/models/sk/coffee_mug.glb",
  pizzaBox: "/models/sk/pizza_box.glb",
  sodaCans: "/models/sk/soda_cans.glb",
  ashtray: "/models/sk/ashtray.glb",
  phone: "/models/sk/smartphone.glb",
  cables: "/models/sk/cables_on_floor.glb",
  skateboard: "/models/sk/skateboard.glb",
  blanket: "/models/sk/blanket.glb",
  blind: "/models/sk/venetian_blind.glb",
  vent: "/models/sk/ventilation_grill.glb",
  fridge: "/models/sk/fridge_-_modern_furniture_game-ready.glb",
  desk: "/models/sk/simple_desk.glb",
} as const;

export const PH = {
  fan: "/models/ph/ceiling_fan.glb",
  nightstand: "/models/ph/ClassicNightstand_01.glb",
  consoleTable: "/models/ph/chinese_console_table.glb",
  box: "/models/ph/cardboard_box_01.glb",
  scanner: "/models/ph/cassette_player.glb",
  crateWood: "/models/ph/CheeseBox_01.glb",
  magnifier: "/models/ph/magnifying_glass_01.glb",
  bottles: "/models/ph/wine_bottles_01.glb",
  balconyChair: "/models/ph/plastic_monobloc_chair_01.glb",
  deskLamp: "/models/ph/desk_lamp_arm_01.glb",
  crate: "/models/ph/plastic_crate_02.glb",
  drawers: "/models/ph/drawer_cabinet.glb",
} as const;

export const WARDROBE_FBX = "/models/wardrobe/wardrobe.fbx";

/** The four bottles inside the one wine bottle model. */
export const BOTTLE = {
  bordeaux: "wine_bottles_01_bordeaux",
  alsace: "wine_bottles_01_alsace",
  burgundy: "wine_bottles_01_burgundy",
  champagne: "wine_bottles_01_champagne",
} as const;

export const ALL_GLB: string[] = [...Object.values(SK), ...Object.values(PH)];
