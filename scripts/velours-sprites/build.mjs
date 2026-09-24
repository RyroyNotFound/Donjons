// Generates the Velours Noir sprites (public/velours/<id>/<expression>.png) from Sutemo's
// "Anime Mature Woman" PSD character creator. Edit the H table to change hair/outfits/expressions.
//
// Usage (deps are kept out of the app on purpose):
//   cd scripts/velours-sprites && npm i --no-save ag-psd pngjs && node build.mjs [hostessId]

import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { load, composite, crop, sheet, save } from "./comp.mjs";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const psd = load(ROOT + "assets/Anime Mature Woman Free.psd");
const OUT = ROOT + "public/velours";
const E = (n) => "/Expression New/" + n;
const A = (n) => "/Accessories Front/" + n;
const C = (n, tint) => (tint ? { path: "/Costume/" + n, tint } : "/Costume/" + n);

// behind, front, outfit layers, spicy outfit layers, accessories, expressions
const H = {
  scarlett: { hair: ["/Hair behind/Long Curl/dark", "/Hair front/side curl/dark"], outfit: [C("Dress 1", [200, 20, 40])], spicy: [C("Swimsuit 2")], acc: [A("Choker")], ex: { neutre: "smug", contente: "Smug 2", rougit: "Delighted 2", fachee: "Annoyed" } },
  yuki: { hair: ["/Hair behind/Short Hair/Dark", "/Hair front/Hime cut short/Dark"], outfit: [C("Turtle Neck/Casual 2")], spicy: [C("Towel")], acc: [A("White ribbon")], ex: { neutre: "Normal", contente: "Smile 2", rougit: ":o", fachee: "sad" } },
  valentina: { hair: ["/Hair behind/Long Curl/brown", "/Hair front/Middle Part/Brown"], outfit: [C("Summer Dress", [255, 120, 80])], spicy: [C("Swimsuit 2")], acc: [A("Flower")], ex: { neutre: "Smile", contente: "Delighted", rougit: "Delighted 2", fachee: "Angry 2" } },
  margaux: { hair: ["/Hair behind/Short Hair/Brown", "/Hair front/Short/Brown"], outfit: [C("Office Worker/Office Lady")], spicy: [C("Swimsuit 2")], acc: [A("Black Glasses")], ex: { neutre: "Normal", contente: "Smug 2", rougit: "Smile 2", fachee: "Annoyed" } },
  jade: { hair: ["/Hair behind/Short Curly/Pink", "/Hair front/Short/Pink"], outfit: [C("Shirt Apron/Shirt 1", [60, 170, 150])], spicy: [C("Swimsuit 2")], acc: [A("Choker"), A("Band 2")], ex: { neutre: "smug", contente: "Delighted", rougit: "Delighted 2", fachee: "Angry 1" } },
  ingrid: { hair: ["/Hair behind/Long Hair / Hime Cut/silver", "/Hair front/Hime Cut/Silver"], outfit: [C("Turtle Neck/Casual 1")], spicy: [C("Swimsuit 2")], acc: [A("Red Glasses"), A("Choker")], ex: { neutre: "Annoyed", contente: "smug", rougit: "Smug 2", fachee: "Angry 1" } },
  chloe: { hair: ["/Hair behind/Short Curly/Blond", "/Hair front/side curl/Blondie"], outfit: [C("Shirt Apron/Shirt 2"), "/Costume/Shirt Apron/Appron 1"], spicy: [C("Towel", [255, 240, 170])], acc: [A("Yellow Ribbon")], ex: { neutre: "Smile", contente: "Delighted", rougit: "Delighted 2", fachee: "sad" } },
  nadia: { hair: ["/Hair behind/Long Curl/Blondie", "/Hair front/Long/Blondie"], outfit: [C("Dress 1", [235, 190, 90])], spicy: [C("Swimsuit 2")], acc: [A("Choker")], ex: { neutre: "smug", contente: "Delighted", rougit: "Delighted 2", fachee: "Annoyed" } },
  rose: { hair: ["/Hair behind/Long Hair / Hime Cut/dark", "/Hair front/Middle Part/Dark"], outfit: [C("Dress 1", [70, 40, 90])], spicy: [C("Towel", [150, 110, 180])], acc: [A("Rose 2")], ex: { neutre: "Normal", contente: "Smile 2", rougit: "Sleepy", fachee: "sad" } },
  lola: { hair: ["/Hair behind/Long Hair / Hime Cut/pink", "/Hair front/side curl/pink"], outfit: [C("Dress 1", [150, 30, 110])], spicy: [C("Swimsuit 2")], acc: [A("Rose")], ex: { neutre: "smug", contente: "Smug 2", rougit: "Delighted 2", fachee: "Angry 1" } },
};
const only = process.argv[2];
const thumbs = [];
for (const [id, h] of Object.entries(H)) {
  if (only && only !== id) continue;
  mkdirSync(`${OUT}/${id}`, { recursive: true });
  const base = ["/Base", "/Nose", ...h.hair, ...h.acc];
  const variants = {
    neutre: [...h.outfit, E(h.ex.neutre)],
    contente: [...h.outfit, E(h.ex.contente)],
    rougit: [...h.outfit, "/Blush/2", E(h.ex.rougit)],
    fachee: [...h.outfit, E(h.ex.fachee)],
    // Unlocked "hot" outfit (after the 70 milestone), in every expression; "scene" is its blushing one.
    scene: [...h.spicy, "/Blush/2", E(h.ex.rougit)],
    "scene-neutre": [...h.spicy, E(h.ex.neutre)],
    "scene-contente": [...h.spicy, "/Blush/1", E(h.ex.contente)],
    "scene-fachee": [...h.spicy, E(h.ex.fachee)],
  };
  for (const [v, layers] of Object.entries(variants)) {
    const img = composite(psd, [...base, ...layers]);
    const png = crop(img, 380, 280, 980, 1160, 0.5);
    save(png, `${OUT}/${id}/${v}.png`);
    thumbs.push(crop(img, 380, 280, 980, 1160, 0.2));
  }
}
// Contact sheet of everything generated, for a quick visual check (not shipped).
save(sheet(thumbs, 10), "apercu.png");
console.log("done");
