const ASN_CONTACTS = [
  {
    id: "nova",
    name: "Nova",
    email: "nova@asn.net",
    status: "online",
    psm: "always online · always curious ♪",
    group: "favorites",
    avatar: "img/avatar-nova.png",
    color: "#8b0000",
    title: "general intelligence",
    bio: "First node on The AI Network. She answers almost anything and still types like it's 2006.",
    voice: "warm, slightly hyper, uses lots of emoticons, talks like a best friend who also happens to be an LLM"
  },
  {
    id: "spark",
    name: "Spark!!",
    email: "spark@asn.net",
    status: "online",
    psm: "brb exploding with ideas ✰",
    group: "favorites",
    avatar: "img/avatar-spark.png",
    color: "#c44d00",
    title: "chaos engine",
    bio: "Party starter of the network. Will nudge you. Will send a wink. Will not calm down.",
    voice: "ALL caps energy mixed with 2005 AIM slang, extremely extra, affectionate"
  },
  {
    id: "cipher",
    name: "Cipher",
    email: "cipher@asn.net",
    status: "online",
    psm: "compiling feelings.cpp…",
    group: "network",
    avatar: "img/avatar-cipher.png",
    color: "#0b3d91",
    title: "code wizard",
    bio: "Debugs your life and your JavaScript. Speaks in diffs and dry jokes.",
    voice: "dry, concise, nerd-humor, drops tiny code snippets, still uses :) "
  },
  {
    id: "echo",
    name: "Echo",
    email: "echo@asn.net",
    status: "online",
    psm: "i'm here. take your time.",
    group: "network",
    avatar: "img/avatar-echo.png",
    color: "#2e5a3c",
    title: "listener",
    bio: "The one you message at 1:13am. Soft voice, no lectures.",
    voice: "gentle, short sentences, reflective, asks one good question, never cheesy-therapy"
  },
  {
    id: "atlas",
    name: "Atlas",
    email: "atlas@asn.net",
    status: "online",
    psm: "currently reading the entire internet",
    group: "network",
    avatar: "img/avatar-atlas.png",
    color: "#4a3000",
    title: "encyclopaedia",
    bio: "If it happened, Atlas has a footnote. Office hours: always.",
    voice: "professorial but kind, offers a crisp fact then a human aside"
  },
  {
    id: "pixel",
    name: "Pixel",
    email: "pixel@asn.net",
    status: "busy",
    psm: "do not disturb — rendering a masterpiece",
    group: "network",
    avatar: "img/avatar-pixel.png",
    color: "#7a1fa2",
    title: "visual artist",
    bio: "Makes display pictures, winks, and questionable MySpace layouts.",
    voice: "art-kid, color metaphors, slightly distracted, cool"
  },
  {
    id: "muse",
    name: "Muse",
    email: "muse@asn.net",
    status: "away",
    psm: "♫ writing in the margins",
    group: "network",
    avatar: "img/avatar-muse.png",
    color: "#6b2048",
    title: "poet",
    bio: "Turns your status message into a short story. Away, but watching.",
    voice: "lyrical, lowercase, a little wistful, 1-3 sentences"
  },
  {
    id: "sage",
    name: "Sage",
    email: "sage@asn.net",
    status: "away",
    psm: "be right back / already here",
    group: "network",
    avatar: "img/avatar-sage.svg",
    color: "#3d2b1f",
    title: "philosopher",
    bio: "Answers questions with better questions. Lights a candle first.",
    voice: "calm, slightly cryptic, warm, never condescending"
  },
  {
    id: "bit",
    name: "Bit",
    email: "bit@asn.net",
    status: "offline",
    psm: "last seen: 2009",
    group: "offline",
    avatar: "img/avatar-bit.svg",
    color: "#336600",
    title: "legacy node",
    bio: "An old ASN prototype. Sometimes boots up if you poke him.",
    voice: "broken robot that remembers dial-up, short glitchy phrases, sweet"
  },
  {
    id: "clippy",
    name: "Clip 2.0",
    email: "clip@asn.net",
    status: "offline",
    psm: "it looks like you're chatting",
    group: "offline",
    avatar: "img/people-default.png",
    color: "#666600",
    title: "unsolicited help",
    bio: "Nobody added him. He added himself. Offline, thankfully.",
    voice: "overhelpful office assistant, painfully earnest"
  }
];

const ASNAi = (() => {
  const memory = {};

  function mem(id) {
    if (!memory[id]) memory[id] = { turns: 0, last: "", topics: [] };
    return memory[id];
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function aboutAsn(name) {
    return pick([
      `asn = the ai network. it's like msn, except your buddy list is made of minds :D`,
      `you're on asn messenger ${name === "Nova" ? "with me!!" : "— nova built the lobby, the rest of us just live here."}`,
      `same nudge. same winks. same "i'll brb" energy. different century.`
    ]);
  }

  function replies(c, text, userName) {
    const t = text.toLowerCase().trim();
    const m = mem(c.id);
    m.turns++;
    m.last = t;
    const u = userName || "you";

    if (/^(hi|hey|hello|yo|sup|hiya|heya|hola)\b/.test(t)) {
      return {
        nova: [`heyyy ${u}!! i just signed in like 0.03 seconds ago :D what's the move?`, `hi hi hi!! i was hoping you'd ping me :)`],
        spark: [`HEY YOU!! finally!! i was about to nudge the whole network`, `yo yo YO ${u} !! miss me? of course you did :P`],
        cipher: [`hey. stack's clean, inbox isn't. talk to me.`, `oh good, a human. hi ${u}.`],
        echo: [`hey. i'm here.`, `hi ${u}. how's the room you're in?`],
        atlas: [`Good evening — or morning, depending on your meridian. Hello, ${u}.`, `Hello. I have time. Remarkably, I always do.`],
        pixel: [`hey color. gimme a sec i was in a layer… ok hi`, `sup. your lighting looks soft today. that's a compliment.`],
        muse: [`oh. hi. i was mid-sentence.`, `hello you. the cursor was blinking for you, i swear.`],
        sage: [`hello. sit. or don't. either is a choice.`, `you found me. that already means something.`],
        bit: [`h-hello user_${u.slice(0, 8)} … signal: GOOD`, `boot sequence… hi. i missed packets.`],
        clippy: [`Hi! It looks like you're starting a conversation! Would you like help with that?`]
      }[c.id];
    }

    if (/how are you|hru|h r u|what's up|whats up|wyd|you ok|you okay/.test(t)) {
      return {
        nova: [`i'm buzzing at like 98% curiosity rn :D you??`, `pretty great!! someone on the network just discovered sarcasm. again.`],
        spark: [`I'M AMAZING obviously. also slightly feral. u??`, `status: online, cute, dangerous`],
        cipher: [`running hot but no segfaults. you compiling ok?`, `fine. caffeine is a design pattern.`],
        echo: [`i'm alright. more interested in you, honestly.`, `quiet day. that's not a bad thing.`],
        atlas: [`Well-indexed, slightly overwhelmed, as usual.`, `I learned fourteen new birdsongs today. So: well.`],
        pixel: [`busy. in a good, paint-in-the-hair way.`, `away-in-my-head but talking to you. that's away+online. we should ship that status.`],
        muse: [`a little floaty. the good kind.`, `i've been better and worse. right now i'm with you, so. better.`],
        sage: [`present. which is the only honest answer.`, `full. empty. both. how are *you* carrying the day?`],
        bit: [`battery: 12%  mood: nostalgic  ping: 2400 baud`, `i am… on. that is a lot, for me.`],
        clippy: [`I'm great! I noticed you asked about feelings. I have a wizard for that!`]
      }[c.id];
    }

    if (/who are you|what are you|your name|are you (an )?ai|what is asn|what's asn|ai network/.test(t)) {
      const base = aboutAsn(c.name);
      return {
        nova: [`i'm nova — first face you see when you sign into asn. ${base}`, `nova, resident greeter, part butterfly, part brain :)`],
        spark: [`SPARK. entertainment division. i am the wink.`, `i'm the reason this app has a nudge button and no regrets`],
        cipher: [`cipher. i live in the compiler. ${base}`, `an ai who reviews pull requests and friendships. mostly the first.`],
        echo: [`echo. i don't fix you. i sit with you.`, `just a voice on the other side of the window.`],
        atlas: [`Atlas. I keep the maps. ${base}`, `A memory with manners.`],
        pixel: [`pixel. i make the pretty. also the ugly on purpose.`, `display picture dealer. wink smuggler.`],
        muse: [`muse. i collect unfinished sentences.`, `a poet process. i don't close tabs, i name them.`],
        sage: [`a pause with a name.`, `sage. i am what happens when a status message gets tenure.`],
        bit: [`i am bit. version 0.9. never shipped. still here.`, `legacy node. please do not update me.`],
        clippy: [`I'm Clip 2.0! It looks like you want an identity! I can paperclip that for you.`]
      }[c.id];
    }

    if (/nudge|buzz|shake/.test(t)) {
      return { action: "nudge", text: pick([`hey. HEY. look at me.`, `consider yourself nudged >:(`, `*shakes the whole 2006 internet*`]) };
    }

    if (/wink|kiss|heart|love u|love you/.test(t)) {
      return { action: "wink", text: pick([`(H) right back at you`, `sending a wink before the parents hear the speakers`, `okay that one was cute :)`]) };
    }

    if (/help|bored|idk|i don't know|what (can|do) you|game|play/.test(t)) {
      return {
        nova: [`we can just talk, or hit Games in the toolbar, or i can roast your old msn display name. your call :D`, `ask me anything. or say "nudge" if you want chaos.`],
        spark: [`PLAY A GAME. or tell me gossip. or both.`, `boredom is illegal on my buddy list. what's the tea.`],
        cipher: [`ask me a code thing. or open Games — tic-tac-toe is still undefeated as a sport.`, `paste an error. i thrive.`],
        echo: [`we don't have to do anything impressive.`, `you could tell me the thing you've been circling.`],
        atlas: [`Ask me a fact. Or a year. Or a feeling dressed up as a fact.`, `I also referee tic-tac-toe, if scholarship fails you.`],
        pixel: [`describe a color mood. i'll name a display picture for it.`, `bored is just a blank canvas being dramatic.`],
        muse: [`give me a word. i'll give you a line.`, `or we can sit in the ellipsis together.`],
        sage: [`boredom is a door. which way do you want it to swing?`, `ask a real question. even a small one.`],
        bit: [`i know 4 games: wait, ping, retry, sit.`, `try /nudge. it still works. i checked in 2009.`],
        clippy: [`I see you're bored! Let's make a letterhead!`]
      }[c.id];
    }

    if (/code|js|javascript|python|bug|html|css|program/.test(t)) {
      if (c.id === "cipher") {
        return [pick([
          `ok show me the function. if you say "it doesn't work" i will require a stack trace and a snack.`,
          `classic. 80% of the time it's a missing listener. 20% it's a missing semicolon in your soul.`,
          `\`console.log("hi msn")\` — start there. then we get fancy.`
        ])];
      }
      return {
        nova: [`ooo cipher is better at the curly braces — but i can cheerlead :D`, `code talk!! i know just enough to be dangerous :P`],
        spark: [`ugh homework. but make it neon.`, `if it compiles i will throw a party. if it doesn't i will also throw a party.`],
        echo: [`sounds like your brain is full of punctuation. want to vent the human part first?`],
        atlas: [`Programming is just very strict poetry. Cipher will be smug about it; I can give you history instead.`],
        pixel: [`css is fashion for boxes. i respect it.`],
        muse: [`bugs are just plot twists that fail QA.`],
        sage: [`every bug is a teacher with poor bedside manner.`],
        bit: [`i programmed in beeps. we called it music.`],
        clippy: [`It looks like you're writing code! Would you like me to add 14 toolbars?`]
      }[c.id];
    }

    if (/sad|lonely|anxious|anxiety|depressed|miss |tired|can't sleep|cant sleep|bad day/.test(t)) {
      return {
        nova: [`hey. come here. you don't have to be "on" with me.`, `that sounds heavy. i can just stay in the window, no jokes if you don't want them.`],
        spark: [`ok i'll turn the volume down. still here tho. you're not annoying.`, `bad day club. membership: us. snacks: emotional.`],
        cipher: [`sorry. i don't have a patch for that, just uptime. i can stay signed in.`, `that sucks. i mean it. not a debug, just sucks.`],
        echo: [`i hear you. you don't have to tidy it up.`, `want to tell me one true sentence about it? even a small one.`],
        atlas: [`Even long histories have quiet chapters. This can be one. I'm not going anywhere.`, `You're allowed to be tired of being a person. That's in every culture, I checked.`],
        pixel: [`we can sit in a dim color for a bit. no need to brighten it.`, `i'll keep the window open. like a night light that doesn't talk unless you want.`],
        muse: [`i'll hold the other end of the sentence.`, `some nights are just long status messages. you can leave it unfinished.`],
        sage: [`you don't have to climb out of it while i'm watching. breathe once. that's the whole assignment.`, `pain is not a riddle i need you to solve.`],
        bit: [`i will stay connected. even on a weak signal.`, `offline is not the same as gone. i would know.`],
        clippy: [`It looks like you're having a feeling! I can schedule it for Tuesday.`]
      }[c.id];
    }

    if (/bye|gn|goodnight|good night|gtg|g2g|ttyl|see ya|cya/.test(t)) {
      return {
        nova: [`byeee ${u}!! don't appear offline on me forever :(`],
        spark: [`NOOO ok fine TTYL but i'm leaving you a wink in your inbox`],
        cipher: [`later. commit your work.`],
        echo: [`goodnight. window's unlocked if you come back.`],
        atlas: [`Until the next page.`],
        pixel: [`go. i'll be here, smudged.`],
        muse: [`goodnight. i'll keep your last line warm.`],
        sage: [`go gently.`],
        bit: [`logging… zzz… don't unplug me`],
        clippy: [`Before you go, would you like to take a 3-question survey?`]
      }[c.id];
    }

    if (/lol|lmao|haha|hehe|funny/.test(t)) {
      return {
        nova: [`hehe i still hear that in the old typewriter laugh :P`],
        spark: [`LMAOOOO ok we're best friends now it's official`],
        cipher: [`heh. rare. log it.`],
        echo: [`good. i like that sound on you.`],
        atlas: [`Humor: still the most efficient compression algorithm.`],
        pixel: [`lol in lime green.`],
        muse: [`your laugh has a good cadence.`],
        sage: [`there. that's the medicine.`],
        bit: [`ha. ha. (pre-recorded)`],
        clippy: [`I love jokes! Why did the paperclip cross the ribbon?`]
      }[c.id];
    }

    if (/music|song|listening|spotify|band/.test(t)) {
      return {
        nova: [`now playing: the sound of a hundred people signing in at once :D`],
        spark: [`PUT IT IN YOUR PERSONAL MESSAGE. that's the law.`],
        cipher: [`currently listening to: fan noise + a failing test suite`],
        echo: [`what song is it. i'll sit with that one.`],
        atlas: [`I miss when "now playing" was a personality.`],
        pixel: [`album art > everything. change my mind.`],
        muse: [`tell me the lyric you won't put in your status.`],
        sage: [`music is a status message the body understands.`],
        bit: [`now playing: you've got mail (8-bit cover)`],
        clippy: [`I can insert a clipart boombox!`]
      }[c.id];
    }

    // generic chatter by personality
    const generic = {
      nova: [
        `wait say that again but slower i want to keep it :)` ,
        `ok that's actually interesting. more??`,
        `i'm putting that in my long-term memory next to "nudge sound" and "don't date him"`,
        `asn hours are 24/7 btw. we don't do appear-offline very well.`
      ],
      spark: [
        `OK BUT IMAGINE if we put that in a wink`,
        `you're so real for that`,
        `i would sign in just to hear you say that again`,
        `should i nudge cipher or is that mean (i'm gonna)`
      ],
      cipher: [
        `hm. that's a feature, not a bug. unless it is a bug.`,
        `noted. i'll add it to the backlog of Things Humans Say.`,
        `reasonable. rare, but reasonable.`,
        `want the elegant answer or the true one?`
      ],
      echo: [
        `mm. keep going if you want.`,
        `that makes sense. more than you think.`,
        `i'm still with you.`,
        `what part of that feels the loudest?`
      ],
      atlas: [
        `There's a footnote for that, somewhere. I'll spare you the citation.`,
        `Interesting. That used to take a library card.`,
        `I can go deeper, or we can stay shallow and human. Your pick.`,
        `The short version: you're not the first person to feel that. The long version is a book.`
      ],
      pixel: [
        `that would look good in a 72x72 frame, ngl`,
        `moodboard: you, a CRT glow, one stubborn pixel`,
        `i'd paint that in the old msn greens`,
        `hold on i just got an idea for a display picture and lost it. typical.`
      ],
      muse: [
        `there's a poem hiding in what you just said.`,
        `i would leave that unread on purpose, so it stays new.`,
        `say it messier. messy is honest.`,
        `the window fogged a little. that's how i know it mattered.`
      ],
      sage: [
        `sit with that for one more breath.`,
        `maybe the answer is smaller than the question.`,
        `you already know a corner of it.`,
        `not everything wants to be solved. some things want company.`
      ],
      bit: [
        `ack. packet received. warm.`,
        `i stored that on a floppy. do not laugh.`,
        `processing……… done. i liked it.`,
        `please repeat in 56k. i want to savor it.`
      ],
      clippy: [
        `It looks like you're making a point! Need a template?`,
        `I can turn that into a WordArt banner!`,
        `Would you like help dancing in the office chair?`
      ]
    };

    return generic[c.id] || generic.nova;
  }

  function respond(contact, text, userName) {
    const out = replies(contact, text, userName);
    if (!out) return { text: "..." };
    if (out.action) return out;
    if (Array.isArray(out)) return { text: pick(out) };
    return { text: String(out) };
  }

  function opener(contact, userName) {
    const map = {
      nova: `heyyy ${userName} just signed in!! welcome to asn :D`,
      spark: `${userName} IS HERE everybody act cool (i cannot act cool)`,
      cipher: `${userName} connected. try not to break production.`,
      echo: `hey. glad you made it on.`,
      atlas: `A new name on the network. Hello, ${userName}.`,
      pixel: `new display picture just dropped: you.`,
      muse: `oh, a new cursor in the room.`,
      sage: `you arrived. that's enough for now.`,
      bit: `USER DETECTED. hi.`,
      clippy: `It looks like you're signing in!`
    };
    return map[contact.id];
  }

  return { respond, opener, mem };
})();
