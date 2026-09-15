"""
Writes public/cases/01/case.json — Case 1, "Nobody Tows A Clean Car".

The case lives here as Python rather than as hand-edited JSON because the text
is the game and it needs to be readable while it is being written. Rects are
placeholders until the photographs exist; scripts/check-hotspots.mjs draws them
back onto the images to prove they land.

Two rules the writing follows, both learned the hard way:

  - Cal talks. He does not narrate. Contractions everywhere, short sentences,
    no aphorisms, nothing balanced in threes. The first draft of this game read
    like a poem and it was unplayable for it.
  - The case file describes the SHAPE of the crime and never lists the tells.
    An earlier version named every single one, which turned the game into a
    shopping list and killed the only moment that matters: spotting it yourself.

Run: python scripts/build-case.py
"""

from __future__ import annotations

import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "cases" / "01" / "case.json"

# --- the photographs --------------------------------------------------------
# rect is [x, y, w, h] in fractions of the image. Measured properly once the
# art exists; these are honest placeholders.

PHOTOS = [
    # ---- the crime: six things that are wrong with the yard ----
    # Two plates, two small targets. One wide rect spanning both of them was a
    # third of the frame once padded, and a scribble anywhere near the middle
    # counted. Circling EITHER plate is a legitimate way to point at this.
    ("twin-plates", "crime", "cal", "Row three. Look at the plates.",
     "same-plate", [0.68, 0.60, 0.15, 0.11],
     "Same plate. Two different cars. Yeah, that's not normal.",
     'Two cars nose to tail in the same row. Read the plate on the one nearest you, then read the plate on the one behind it.',
     ("same-plate-far", [0.29, 0.51, 0.13, 0.10])),

    ("stripped-car", "crime", "cal", "Tuesday it had a plate. Thursday it didn't.",
     "no-plate", [0.50, 0.41, 0.27, 0.16],
     "Plate's gone. Badges too. That SUV came in with both.",
     'The silver SUV in the middle of the row. Look at where its number plate is supposed to be.'),

    ("plate-stack", "crime", "cal", "Office door was open. I didn't go in.",
     "dealer-plates", [0.70, 0.21, 0.18, 0.26],
     "A tow yard doesn't need a stack of dealer plates.",
     'Through the open door of the office trailer, hanging on the wall inside. Count them.'),

    ("cut-vin", "crime", "mateo", "There's supposed to be a number there.",
     "cut-vin", [0.23, 0.57, 0.56, 0.22],
     "Somebody cut the VIN plate out of the dash. That wasn't from a tow.",
     "The corner of the dashboard, down at the bottom of the windscreen. Something's been taken out of it."),

    ("container", "crime", "cal", "Back fence. They keep it shut most nights.",
     "container-car", [0.45, 0.38, 0.20, 0.17],
     "There's a supercar in that container. That's not where impounds go.",
     "The rusted shipping container at the back fence. The doors aren't shut properly."),

    ("night-tow", "crime", "cal", "Three in the morning. Every time.",
     "clean-car", [0.40, 0.26, 0.34, 0.22],
     "Not a scratch on it. So why's it on a flatbed at three in the morning?",
     'The car up on the back of the flatbed. Look at the bodywork, not the truck.'),

    # ---- the turn: five things that are about a man ----
    ("luis-night", "turn", "mateo", "That's Luis. He taught me to run the flatbed.",
     "luis", [0.46, 0.38, 0.22, 0.26],
     "Luis Ortega. Fifteen years at Sunstate.",
     "The man crouched down at the back of a car. Look at what he's holding."),

    ("sofia-flyer", "turn", "mateo", "Luis put these up all over Gellhorn. Nobody called.",
     "sofia-car", [0.65, 0.24, 0.12, 0.16],
     "Sofia Ortega's car. Stolen in March. Never recovered.",
     'The poster taped to the concrete pole. Look inside the car in the photograph, hanging off the mirror.'),

    ("flamingo-car", "turn", "mateo", "Sofia put that stupid flamingo in every car she ever owned.",
     "same-flamingo", [0.45, 0.35, 0.13, 0.15],
     "Same pink flamingo. Same car. Different plate. It's been sitting in the yard.",
     'The little blue hatchback. Look through its windscreen, at the mirror.'),

    ("luis-notebook", "turn", "cal", "That's not a run sheet.",
     "notebook", [0.72, 0.58, 0.26, 0.32],
     "Dates, times, plate numbers. Luis has been writing it all down.",
     'Through the open door on the right. The book lying open on the bench.'),

    ("locker-search", "turn", "cal", "They did that after he went home.",
     "ortega-locker", [0.36, 0.27, 0.13, 0.12],
     "That's Luis's locker. They're searching it right after he leaves.",
     "The locker the two of them have got open. There's a name written on the door."),

    # ---- context: nothing to find, and that is the point ----
    ("yard-dog", "context", "mateo",
     "Bruno. Luis feeds him every shift. Victor keeps saying he'll get rid of him.", None, None, None, None),
    ("day-yard", "context", "mateo",
     "It's just a yard in the daytime. People come and get their cars back.", None, None, None, None),
    ("luis-lunch", "context", "mateo",
     "He eats round the back so he doesn't have to talk to Victor.", None, None, None, None),
]

# Cal will not let you name anybody until you have walked the chain about Luis.
REQUIRED = ["luis", "sofia-car", "same-flamingo", "notebook", "ortega-locker"]

STORY = [
    {
        "title": "COME UP, I WANT TO SHOW YOU SOMETHING",
        "body": ["You work there, Mateo. That's why you're in my flat at one in the morning. I can see most of the yard from here, and the rest from my car. I'm not asking you to believe me. Just look."],
    },
    {
        "title": "WHAT I THINK IS HAPPENING",
        "body": ["A tow yard's where stolen cars are supposed to end up. I think this one sends them back out. Cars come in clean, then leave with new plates and new papers. I can't prove it. You know that yard better than I do."],
    },
    {
        "title": "WHAT TO LOOK FOR",
        "body": ["I'm not telling you what to circle. That'd be useless. Look for stuff that doesn't fit. Same plate twice. A clean car on a tow truck. Dealer plates in a tow yard. Most of the photos are normal. Good. That makes the bad ones easier to spot."],
    },
    {
        "title": "THERE'S A MAN IN A LOT OF THESE",
        "body": ["There's an older guy in the grey shirt. He's around every time those cars move at night. I don't know him. You do. So you tell me what he's doing."],
    },
    {
        "title": "THE BOX",
        "body": ["Fourteen photos. Open one, circle what looks wrong, then save it. If you're right, I'll tell you what I know. Pin the ones that matter. Use the string if it helps. When you're done, make one accusation. One sentence. Names included."],
    },
]

BRIEFING = {
    "title": "NOBODY TOWS A CLEAN CAR",
    "blocks": [
        {
            "head": 'ONE IN THE MORNING',
            "body": (
                "You're Mateo Ruiz. Twenty-two. Night driver at Sunstate Recovery. You're supposed to be asleep, but the guy upstairs just called you into his flat."
            ),
        },
        {
            "head": "CAL'S BEEN WATCHING",
            "body": (
                "His name's Cal Hampton. He doesn't work much. He watches things. Most people think he's lost it. For three weeks, he's been taking photos of your tow yard from his balcony and from his car."
            ),
        },
        {
            "head": 'FOURTEEN PHOTOS',
            "body": (
                "Some of them look bad. Some of them are just a dog on a step, or some guy eating lunch. Cal kept those too. He doesn't know which ones matter yet."
            ),
        },
        {
            "head": 'HE THINKS HE FOUND IT',
            "body": (
                "Cal says Sunstate isn't recovering stolen cars. He says cars go in clean and come back out as something else. New plates. New papers. Gone. He's got enough to worry about, but not enough to prove it."
            ),
        },
        {
            "head": "THAT'S WHY YOU'RE HERE",
            "body": (
                "He wants you to go through the photos. If something looks wrong, draw on it. If you're right, he'll tell you what he knows. If you're wrong, nothing happens. So try things."
            ),
        },
        {
            "head": 'PUT IT TOGETHER',
            "body": (
                "Pin the photos that matter to his board. Use the string if it helps. When you're done, Cal wants one sentence from you. Names included. That's the only part you can really get wrong."
            ),
        },
        {
            "head": 'ONE OF THEM',
            "body": (
                "There's an older man in a lot of Cal's photos. You know him well. Cal doesn't. And from where he's sitting, the guy looks bad."
            ),
        },
    ],
}

ACCUSATION = {
    "lead": "Alright. Say it properly. Once you put a name on this, you don't get to pretend you didn't.",
    "template": "{who} is using Sunstate Recovery to {crime}. Luis Ortega is {role} because he found {thing}.",
    "slots": [
        {
            "id": "who",
            "question": "Who's running it?",
            "answer": "victor",
            "options": [
                {"id": "victor", "text": "VICTOR SALAZAR"},
                {"id": "luis", "text": "LUIS ORTEGA"},
            ],
        },
        {
            "id": "crime",
            "question": "What's the yard actually for?",
            "answer": "clone",
            "options": [
                {"id": "clone", "text": "STEAL AND CLONE CARS"},
                {"id": "insurance", "text": "RUN AN INSURANCE SCAM"},
                {"id": "impound", "text": "SELL OFF IMPOUNDED CARS"},
            ],
        },
        {
            "id": "role",
            "question": "And Luis?",
            "answer": "investigating",
            "options": [
                {"id": "investigating", "text": "INVESTIGATING VICTOR"},
                {"id": "partner", "text": "VICTOR'S PARTNER"},
                {"id": "thief", "text": "STEALING CARS HIMSELF"},
            ],
        },
        {
            "id": "thing",
            "question": "Because he found what?",
            "answer": "sofia",
            "options": [
                {"id": "sofia", "text": "SOFIA'S STOLEN CAR"},
                {"id": "cash", "text": "A BAG OF CASH"},
                {"id": "tracker", "text": "A POLICE TRACKER"},
            ],
        },
    ],
}

ENDINGS = {
    "win": "They got Victor in the office trailer with a drawer full of plates. Luis gave his statement first, so they treated him like a witness. Sofia's car's in evidence now. She'll get it back. We had the yard right. We nearly had Luis wrong.",
    "lost": "You put Luis next to Victor and that was enough. They picked them both up that night. Luis had spent months writing down plates because nobody believed him. Now his name's tied to Victor's, and Sofia's car is still sitting in evidence.",
}


def main() -> None:
    photos = []
    for row in PHOTOS:
        pid, role, voice, caption, spot_id, rect, clue, hint = row[:8]
        extra = row[8] if len(row) > 8 else None
        photo = {
            "id": pid,
            "src": f"/cases/01/{pid}.jpg",
            "caption": caption,
            "voice": voice,
            "role": role,
            "hotspots": [],
        }
        if spot_id:
            photo["hotspots"] = [{"id": spot_id, "rect": rect, "clue": clue, "hint": hint}]
            if extra:
                # A second way to point at the same thing. Same clue, same hint,
                # so finding either one reads identically to the player.
                photo["hotspots"].append(
                    {
                        "id": extra[0],
                        "rect": extra[1],
                        "clue": clue,
                        "hint": hint,
                        "voiceAs": spot_id,
                    }
                )
        photos.append(photo)

    case = {
        "id": "01",
        "title": "Nobody Tows A Clean Car",
        "place": "Port Gellhorn",
        "briefing": BRIEFING,
        "brief": (
            "A 24-hour tow yard behind a strip mall. Cars go in that nobody reported stolen and "
            "come out wearing somebody else's plate. Three weeks of photographs, and the man who "
            "turns up in most of them is the one you'd trust with your keys."
        ),
        "photos": photos,
        "required": REQUIRED,
        "accusation": ACCUSATION,
        "endings": ENDINGS,
        "story": STORY,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(case, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    spots = sum(len(p["hotspots"]) for p in photos)
    by_role: dict[str, int] = {}
    for p in photos:
        by_role[p["role"]] = by_role.get(p["role"], 0) + 1
    print(f"{case['title']} -> {OUT.name}")
    print(f"  {len(photos)} photos  " + "  ".join(f"{k}:{v}" for k, v in by_role.items()))
    print(f"  {spots} hotspots · {len(REQUIRED)} required before the accusation")
    print(f"  {len(ACCUSATION['slots'])} slots · "
          f"{sum(len(s['options']) for s in ACCUSATION['slots'])} options")


if __name__ == "__main__":
    main()
