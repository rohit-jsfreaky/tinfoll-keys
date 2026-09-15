import { describe, expect, it } from "vitest";
import type { CaseFile } from "./case";
import {
  MAX_HINTS,
  MAX_STARS,
  accuse,
  canAccuse,
  canPin,
  crimeProved,
  findClues,
  link,
  missingRequired,
  newGame,
  nextHint,
  nextInChain,
  pin,
  unlink,
  hintIsFree,
  useHint,
} from "./game";
import realCase from "../../public/cases/01/case.json";

/** A small case with the same shape as the real one. */
const file: CaseFile = {
  id: "t",
  title: "test",
  place: "here",
  brief: "",
  photos: [
    ...["c1", "c2", "c3", "c4"].map((id) => ({
      id,
      src: `/${id}.jpg`,
      caption: id,
      voice: "cal" as const,
      role: "crime" as const,
      hotspots: [{ id: `${id}-spot`, rect: [0, 0, 1, 1] as const, clue: "clue", hint: `look at ${id}` }],
    })),
    ...["t1", "t2"].map((id) => ({
      id,
      src: `/${id}.jpg`,
      caption: id,
      voice: "mateo" as const,
      role: "turn" as const,
      hotspots: [{ id: `${id}-spot`, rect: [0, 0, 1, 1] as const, clue: "clue", hint: `look at ${id}` }],
    })),
    ...["n1", "n2"].map((id) => ({
      id,
      src: `/${id}.jpg`,
      caption: id,
      voice: "mateo" as const,
      role: "context" as const,
      hotspots: [],
    })),
  ],
  required: ["t1-spot", "t2-spot"],
  accusation: {
    lead: "say it",
    template: "{who} did {what}",
    slots: [
      {
        id: "who",
        question: "who",
        answer: "right",
        options: [
          { id: "right", text: "RIGHT" },
          { id: "wrong", text: "WRONG" },
        ],
      },
      {
        id: "what",
        question: "what",
        answer: "right",
        options: [
          { id: "right", text: "RIGHT" },
          { id: "wrong", text: "WRONG" },
        ],
      },
    ],
  },
  endings: { win: "win", lost: "lost" },
};

const ALL_SPOTS = file.photos.flatMap((p) => p.hotspots.map((h) => h.id));
const drawnAll = () => findClues(newGame("t"), ALL_SPOTS);
const pinned = (ids: string[]) => ids.reduce((s, id) => pin(s, file, id), drawnAll());

describe("a new game", () => {
  it("starts clean", () => {
    const s = newGame("t");
    expect(s.stars).toBe(0);
    expect(s.phase).toBe("playing");
    expect(s.found).toEqual([]);
    expect(s.links).toEqual([]);
    expect(s.lastWrong).toBe(-1);
  });
});

describe("finding clues", () => {
  it("adds clue ids without duplicates", () => {
    let s = findClues(newGame("t"), ["a", "b"]);
    s = findClues(s, ["b", "c"]);
    expect(s.found).toEqual(["a", "b", "c"]);
  });
  it("returns the same state when nothing is new", () => {
    const s = findClues(newGame("t"), ["a"]);
    expect(findClues(s, ["a"])).toBe(s);
  });
});

describe("pinning is gated on drawing", () => {
  it("will not put up a photo whose clue has not been found", () => {
    expect(canPin(file, [], "c1")).toBe(false);
    expect(pin(newGame("t"), file, "c1").pinned).toEqual([]);
  });

  it("puts it up the moment that photo's own clue is found", () => {
    const drawn = findClues(newGame("t"), ["c1-spot"]);
    expect(canPin(file, drawn.found, "c1")).toBe(true);
    expect(canPin(file, ["c2-spot"], "c1")).toBe(false);
  });

  it("lets context photos up freely — they are not junk, they are who these people are", () => {
    expect(canPin(file, [], "n1")).toBe(true);
    expect(pin(newGame("t"), file, "n1").pinned).toEqual(["n1"]);
  });

  it("cannot be won without drawing: nothing but context reaches the board", () => {
    const s = file.photos.reduce((acc, p) => pin(acc, file, p.id), newGame("t"));
    expect(s.pinned).toEqual(["n1", "n2"]);
  });
});

describe("the string costs nothing", () => {
  it("ties two pinned photos and charges no stars", () => {
    const r = link(pinned(["c1", "c2"]), file, "c1", "c2");
    expect(r.outcome).toBe("tied");
    expect(r.state.stars).toBe(0);
    expect(r.state.links).toEqual([["c1", "c2"]]);
  });

  it("charges nothing for tying a context photo either", () => {
    const r = link(pinned(["c1", "n1"]), file, "c1", "n1");
    expect(r.outcome).toBe("tied");
    expect(r.state.stars).toBe(0);
  });

  it("refuses the same photo twice, and photos not on the board", () => {
    expect(link(pinned(["c1"]), file, "c1", "c1").outcome).toBe("same");
    expect(link(pinned(["c1"]), file, "c1", "c2").outcome).toBe("not-pinned");
  });

  it("will not add the same string twice, in either direction", () => {
    const first = link(pinned(["c1", "c2"]), file, "c1", "c2").state;
    expect(link(first, file, "c2", "c1").outcome).toBe("already");
  });

  it("unties in either direction", () => {
    const s = link(pinned(["c1", "c2"]), file, "c1", "c2").state;
    expect(unlink(s, "c2", "c1").links).toEqual([]);
  });
});

describe("the accusation is gated on understanding the person", () => {
  it("stays shut until every required clue is found", () => {
    expect(canAccuse(file, [])).toBe(false);
    expect(canAccuse(file, ["t1-spot"])).toBe(false);
    expect(missingRequired(file, ["t1-spot"])).toBe(1);
    expect(canAccuse(file, ["t1-spot", "t2-spot"])).toBe(true);
    expect(missingRequired(file, ["t1-spot", "t2-spot"])).toBe(0);
  });
});

describe("stating the accusation", () => {
  it("refuses an unfinished sentence", () => {
    const r = accuse(drawnAll(), file, { who: "right" });
    expect(r.outcome).toBe("incomplete");
    expect(r.state.stars).toBe(0);
  });

  it("cracks the case when every claim is supported", () => {
    const r = accuse(drawnAll(), file, { who: "right", what: "right" });
    expect(r.outcome).toBe("cracked");
    expect(r.wrong).toBe(0);
    expect(r.state.phase).toBe("cracked");
    expect(r.state.stars).toBe(0);
  });

  it("counts unsupported claims as stars and lets you try again", () => {
    const r = accuse(drawnAll(), file, { who: "wrong", what: "right" });
    expect(r.outcome).toBe("short");
    expect(r.wrong).toBe(1);
    expect(r.state.stars).toBe(1);
    expect(r.state.phase).toBe("playing");
  });

  it("never says WHICH claim was wrong — only how many", () => {
    const r = accuse(drawnAll(), file, { who: "wrong", what: "wrong" });
    expect(r.wrong).toBe(2);
    // The result carries a count and a state. Nothing in it identifies a slot,
    // because attributable feedback turns a player into a search algorithm.
    expect(Object.keys(r)).toEqual(["outcome", "wrong", "state"]);
  });

  it("is WASTED on the fifth star and never goes past five", () => {
    let s = drawnAll();
    for (let i = 0; i < 2; i++) s = accuse(s, file, { who: "wrong", what: "wrong" }).state;
    expect(s.stars).toBe(4);
    expect(s.phase).toBe("playing");

    const r = accuse(s, file, { who: "wrong", what: "right" });
    expect(r.outcome).toBe("wasted");
    expect(r.state.stars).toBe(MAX_STARS);
    expect(r.state.phase).toBe("wasted");
  });

  it("does nothing once the game is over", () => {
    const done = accuse(drawnAll(), file, { who: "right", what: "right" }).state;
    const r = accuse(done, file, { who: "wrong", what: "wrong" });
    expect(r.outcome).toBe("over");
    expect(r.state).toBe(done);
  });
});

describe("the rail that stops a judge missing the story", () => {
  it("stays out of the way until enough of the crime is proved", () => {
    expect(nextInChain(file, [])).toBeNull();
    expect(nextInChain(file, ["c1-spot", "c2-spot"])).toBeNull();
  });

  it("then hands over the chain photos one at a time, in order", () => {
    const three = ["c1-spot", "c2-spot", "c3-spot"];
    expect(crimeProved(file, three)).toBe(3);
    expect(nextInChain(file, three)).toBe("t1");
    expect(nextInChain(file, [...three, "t1-spot"])).toBe("t2");
    expect(nextInChain(file, [...three, "t1-spot", "t2-spot"])).toBeNull();
  });
});

describe("the real Case 1 file", () => {
  const real = realCase as unknown as CaseFile;
  const spots = real.photos.flatMap((p) => p.hotspots.map((h) => h.id));

  it("has 14 photos across three roles, with no junk pile", () => {
    expect(real.photos).toHaveLength(14);
    const roles = real.photos.reduce<Record<string, number>>((a, p) => {
      a[p.role] = (a[p.role] ?? 0) + 1;
      return a;
    }, {});
    expect(roles).toEqual({ crime: 6, turn: 5, context: 3 });
  });

  it("every required clue is a hotspot that actually exists", () => {
    for (const id of real.required) expect(spots).toContain(id);
  });

  it("every slot's answer is one of its own options", () => {
    for (const slot of real.accusation.slots) {
      expect(slot.options.map((o) => o.id)).toContain(slot.answer);
      expect(slot.options.length).toBeGreaterThan(1);
    }
  });

  it("the sentence has a blank for every slot and no stray ones", () => {
    const inTemplate = [...real.accusation.template.matchAll(/\{(\w[\w-]*)\}/g)].map((m) => m[1]);
    expect([...inTemplate].sort()).toEqual(real.accusation.slots.map((s) => s.id).sort());
  });

  it("can be won", () => {
    const drawn = findClues(newGame(real.id), spots);
    expect(canAccuse(real, drawn.found)).toBe(true);
    const right = Object.fromEntries(real.accusation.slots.map((s) => [s.id, s.answer]));
    const r = accuse(drawn, real, right);
    expect(r.outcome).toBe("cracked");
  });

  it("can be lost, and naming Luis is what does it", () => {
    const drawn = findClues(newGame(real.id), spots);
    const wrong = Object.fromEntries(
      real.accusation.slots.map((s) => [
        s.id,
        s.options.find((o) => o.id !== s.answer)!.id,
      ]),
    );
    let s = accuse(drawn, real, wrong).state;
    expect(s.stars).toBe(4);
    const r = accuse(s, real, { ...wrong, who: "victor" });
    expect(r.outcome).toBe("wasted");

    // The role slot is the one the whole story turns on.
    const role = real.accusation.slots.find((x) => x.id === "role")!;
    expect(role.answer).toBe("investigating");
    expect(role.options.map((o) => o.id)).toContain("partner");
  });

  it("takes three crime clues before the game starts leading you to Luis", () => {
    // One hotspot per PHOTO — twin-plates offers two ways to point at the same
    // thing, and crimeProved counts photos proved, not hotspots ticked.
    const crime = real.photos
      .filter((p) => p.role === "crime")
      .map((p) => p.hotspots[0].id);
    expect(nextInChain(real, crime.slice(0, 2))).toBeNull();
    expect(nextInChain(real, crime.slice(0, 3))).toBe("luis-night");
  });
});

describe("hints", () => {
  it("points at the crime while the yard is still unproved", () => {
    const h = nextHint(file, []);
    expect(h?.photoId).toBe("c1");
    expect(h?.hint).toBe("look at c1");
  });

  it("switches to the chain about the person once the crime is proved", () => {
    const three = ["c1-spot", "c2-spot", "c3-spot"];
    expect(nextHint(file, three)?.photoId).toBe("t1");
    expect(nextHint(file, [...three, "t1-spot"])?.photoId).toBe("t2");
  });

  it("never points at something already found", () => {
    const all = ALL_SPOTS;
    expect(nextHint(file, all)).toBeNull();
  });

  it("spends one and stops at five", () => {
    let s = newGame("t");
    const spots = ["a", "b", "c", "d", "e"];
    for (const id of spots) s = useHint(s, id);
    expect(s.hintsUsed).toBe(MAX_HINTS);
    expect(useHint(s, "f")).toBe(s);
  });

  it("does not charge twice for the same hint", () => {
    let s = useHint(newGame("t"), "c1-spot");
    expect(s.hintsUsed).toBe(1);
    // Read it, go and look, fail to spot it, come back. Still one.
    s = useHint(s, "c1-spot");
    expect(s.hintsUsed).toBe(1);
    expect(hintIsFree(s, "c1-spot")).toBe(true);
    expect(hintIsFree(s, "c2-spot")).toBe(false);
  });

  it("names the hotspot and the photo's own path, so nothing has to guess", () => {
    const h = nextHint(file, [])!;
    expect(h.hotspotId).toBe("c1-spot");
    expect(h.src).toBe("/c1.jpg");
  });
});

describe("every hotspot in the real case can be hinted", () => {
  const real = realCase as unknown as CaseFile;
  it("has a hint on all of them", () => {
    for (const p of real.photos) {
      for (const h of p.hotspots) {
        expect(h.hint, `${p.id}/${h.id} has no hint`).toBeTruthy();
      }
    }
  });

  it("can walk a stuck player all the way to the accusation", () => {
    let found: string[] = [];
    for (let i = 0; i < 20 && !canAccuse(real, found); i++) {
      const h = nextHint(real, found);
      if (!h) break;
      const photo = real.photos.find((p) => p.id === h.photoId)!;
      found = [...found, ...photo.hotspots.map((x) => x.id)];
    }
    expect(canAccuse(real, found)).toBe(true);
  });
});
