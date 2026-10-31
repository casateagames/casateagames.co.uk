/* ==========================================================
   INSHEEPNIA RULES ENGINE
   Pure game logic. The host's browser runs this; other players
   only ever receive their own view of the game.
   Works in the browser (window.InsheepniaEngine) and in Node.
   ========================================================== */
(function (root) {
  "use strict";

  var CARDS = {
    s1: { name: "1 Sheep", type: "sheep", val: 1, img: "one-sheep", text: "Counts as 1 sheep." },
    s2: { name: "2 Sheep", type: "sheep", val: 2, img: "two-sheep", text: "Counts as 2 sheep." },
    s3: { name: "3 Sheep", type: "sheep", val: 3, img: "three-sheep", text: "Counts as 3 sheep." },
    black: { name: "Black Sheep", type: "sheep", val: -1, img: "black-sheep", target: "other",
      text: "Counts as -1 sheep. Play it into another player's hand. It's stuck there until it's sheared or stolen." },
    wolf: { name: "Wolf", type: "power", img: "wolf", target: "other", text: "Take one random card from another player's hand." },
    milk: { name: "Warm Milk", type: "power", img: "warm-milk", react: true,
      text: "Play any time to block a card that affects you. You'll be asked automatically." },
    shear: { name: "Shear", type: "power", img: "shear", choose: "ownCard", text: "Discard one card from your own hand." },
    lullaby: { name: "Lullaby", type: "power", img: "lullaby", text: "Draw 2 cards." },
    snore: { name: "Snore", type: "power", img: "snore", text: "The next player skips their turn." },
    owl: { name: "Night Owl", type: "power", img: "night-owl", target: "other", text: "Secretly look at another player's bed card." },
    sleepwalker: { name: "Sleepwalker", type: "power", img: "sleepwalker", target: "other", text: "Swap your whole hand with another player's." },
    nightmare: { name: "Nightmare", type: "power", img: "nightmare", all: true,
      text: "Every player passes one random card to the player on their left." },
    firealarm: { name: "Fire Alarm", type: "power", img: "fire-alarm", all: true, text: "Every other player discards down to 3 cards." },
    duvethog: { name: "Duvet Hog", type: "power", img: "duvet-hog", target: "other", text: "Take two random cards from another player's hand." },
    snack: { name: "Midnight Snack", type: "power", img: "midnight-snack", choose: "discard", text: "Take any one card from the discard pile." },
    espresso: { name: "Double Espresso", type: "mod", img: "double-espresso", target: "other", delta: 1,
      text: "Another player needs +1 sheep. Goes in their bed." },
    insomnia: { name: "Insomnia", type: "mod", img: "insomnia", target: "other", delta: 2,
      text: "Another player needs +2 sheep. Goes in their bed." },
    dog: { name: "Neighbour's Dog", type: "mod", img: "neighbours-dog", all: true,
      text: "Every other player needs +1 sheep. Goes in your bed." },
    bottle: { name: "Hot Water Bottle", type: "mod", img: "hot-water-bottle", target: "any", delta: -1,
      text: "Needs -1 sheep. Put it in your bed or another player's." },
    earplugs: { name: "Earplugs", type: "mod", img: "earplugs", choose: "earplugs",
      text: "Only works for you. Discard a card from your bed, or keep these in your bed to block out the Neighbour's Dog." },
  };

  var COUNTS = {
    s1: 22, s2: 20, s3: 16, black: 4,
    wolf: 5, milk: 4, shear: 4, lullaby: 3, snore: 3, owl: 3,
    sleepwalker: 2, nightmare: 2, firealarm: 2, duvethog: 2, snack: 2,
    espresso: 3, insomnia: 2, dog: 1, bottle: 2, earplugs: 2,
  };

  var BEDS = [8, 8, 9, 9, 10, 10, 11, 11];
  var HAND_LIMIT = 7;
  var MILK_WAIT_MS = 20000;
  var FIRE_WAIT_MS = 30000;
  var DISCARD_WAIT_MS = 60000;

  function makeRng(seed) {
    if (seed === undefined) return Math.random;
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /** Build the main deck for a player count, removing moon cards. */
  function buildDeck(nPlayers) {
    var cards = [];
    var id = 1;
    Object.keys(COUNTS).forEach(function (k) {
      for (var i = 0; i < COUNTS[k]; i++) cards.push({ id: id++, k: k, moon: 0 });
    });
    // Mark 12 sheep cards per moon tier: four each of 1, 2 and 3 Sheep.
    [3, 5, 7].forEach(function (tier) {
      ["s1", "s2", "s3"].forEach(function (k) {
        var marked = 0;
        for (var i = 0; i < cards.length && marked < 4; i++) {
          if (cards[i].k === k && !cards[i].moon) { cards[i].moon = tier; marked++; }
        }
      });
    });
    return cards.filter(function (c) { return !c.moon || nPlayers >= c.moon; });
  }

  function createGame(players, opts) {
    opts = opts || {};
    if (players.length < 2 || players.length > 8) throw new Error("Insheepnia needs 2 to 8 players.");
    var rng = makeRng(opts.seed);
    var beds = shuffle(BEDS.slice(), rng);
    var order = shuffle(players.map(function (p) { return p.id; }), rng);
    var state = {
      players: {},
      order: order,
      turn: 0,
      deck: shuffle(buildDeck(players.length), rng),
      discard: [],
      log: [],
      pending: null,
      winner: null,
      falseAlarm: opts.falseAlarm !== false,
      round: 1,
      seed: opts.seed,
      rngState: Math.floor(rng() * 4294967296),
      startedAt: opts.now || 0,
    };
    players.forEach(function (p, i) {
      state.players[p.id] = { id: p.id, name: p.name, hand: [], bed: beds[i], mods: [], skip: false };
    });
    addLog(state, nameOf(state, order[0]) + " went to bed last, so they go first.");
    return state;
  }

  function rngFor(state) {
    // Keep randomness inside the state so a game can be resumed.
    var r = makeRng(state.rngState);
    return function () {
      var v = r();
      state.rngState = Math.floor(v * 4294967296) ^ (state.rngState + 0x9e3779b9);
      state.rngState >>>= 0;
      return v;
    };
  }

  function nameOf(state, pid) {
    var p = state.players[pid];
    return p ? p.name : "Someone";
  }

  function addLog(state, text) {
    state.log.push(text);
    if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
  }

  function current(state) { return state.order[state.turn]; }

  function sheepCount(hand) {
    return hand.reduce(function (sum, c) {
      var d = CARDS[c.k];
      return d.type === "sheep" ? sum + d.val : sum;
    }, 0);
  }

  function needOf(state, pid) {
    var p = state.players[pid];
    var n = p.bed;
    var plugged = p.mods.some(function (m) { return m.k === "earplugs"; });
    p.mods.forEach(function (m) { if (CARDS[m.k].delta) n += CARDS[m.k].delta; });
    if (!plugged) {
      state.order.forEach(function (qid) {
        if (qid === pid) return;
        state.players[qid].mods.forEach(function (m) {
          if (m.k === "dog" && (m.immune || []).indexOf(pid) === -1) n += 1;
        });
      });
    }
    return Math.max(1, n);
  }

  function drawCard(state, pid, rng) {
    if (!state.deck.length) {
      if (!state.discard.length) return null;
      state.deck = shuffle(state.discard.splice(0), rng);
      state.round += 1;
      addLog(state, "The deck ran out, so the discard pile was shuffled into a new deck.");
    }
    var c = state.deck.pop();
    c.stuck = false;
    state.players[pid].hand.push(c);
    return c;
  }

  function takeRandom(state, fromId, rng) {
    var hand = state.players[fromId].hand;
    if (!hand.length) return null;
    var i = Math.floor(rng() * hand.length);
    return hand.splice(i, 1)[0];
  }

  function toDiscard(state, card) {
    card.stuck = false;
    delete card.immune;
    delete card.from;
    state.discard.push(card);
  }

  function findIndex(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return i;
    return -1;
  }

  function others(state, pid) {
    return state.order.filter(function (q) { return q !== pid; });
  }

  function nextPlayer(state, pid) {
    var i = state.order.indexOf(pid);
    return state.order[(i + 1) % state.order.length];
  }

  function holdsMilk(state, pid) {
    return state.players[pid].hand.some(function (c) { return c.k === "milk"; });
  }

  /** Who a played card affects (and so who may block it with Warm Milk). */
  function affectedBy(state, actor, card, target) {
    var d = CARDS[card.k];
    if (card.k === "snore") return [nextPlayer(state, actor)];
    if (d.all) return others(state, actor);
    if (d.target === "other") return [target];
    if (d.target === "any") return target === actor ? [] : [target];
    return [];
  }

  // ---------------------------------------------------------- actions

  function act(state, pid, action, now) {
    now = now || 0;
    var out = { ok: false, error: null, privates: [] };
    if (state.winner) { out.error = "The game is over."; return out; }
    var rng = rngFor(state);
    var p = state.players[pid];
    if (!p) { out.error = "You're not in this game."; return out; }

    var pend = state.pending;

    // Responses to something waiting on several players.
    if (action.type === "respond") {
      if (!pend || pend.kind !== "milk" || pend.waitingOn.indexOf(pid) === -1) { out.error = "Nothing to answer."; return out; }
      pend.waitingOn.splice(pend.waitingOn.indexOf(pid), 1);
      if (action.block && holdsMilk(state, pid)) {
        var mi = -1;
        p.hand.forEach(function (c, i) { if (c.k === "milk" && mi === -1) mi = i; });
        toDiscard(state, p.hand.splice(mi, 1)[0]);
        pend.blockers.push(pid);
        addLog(state, p.name + " blocked it with Warm Milk.");
      }
      if (!pend.waitingOn.length) finishMilk(state, rng, out, now);
      out.ok = true;
      return out;
    }

    if (action.type === "fireDiscard") {
      if (!pend || pend.kind !== "fire" || pend.waitingOn.indexOf(pid) === -1) { out.error = "Nothing to discard."; return out; }
      var need = p.hand.length - 3;
      var ids = action.cards || [];
      if (ids.length !== need) { out.error = "Choose " + need + " card" + (need === 1 ? "" : "s") + " to discard."; return out; }
      if (!discardIds(state, pid, ids)) { out.error = "Those cards aren't in your hand."; return out; }
      pend.waitingOn.splice(pend.waitingOn.indexOf(pid), 1);
      addLog(state, p.name + " discarded down to 3 cards.");
      if (!pend.waitingOn.length) { state.pending = null; endTurn(state, pend.actor, now); }
      out.ok = true;
      return out;
    }

    if (action.type === "discardDown") {
      if (!pend || pend.kind !== "discardDown" || pend.who !== pid) { out.error = "Nothing to discard."; return out; }
      var n = p.hand.length - HAND_LIMIT;
      var dids = action.cards || [];
      if (dids.length !== n) { out.error = "Choose " + n + " card" + (n === 1 ? "" : "s") + " to discard."; return out; }
      if (!discardIds(state, pid, dids)) { out.error = "Those cards aren't in your hand."; return out; }
      addLog(state, p.name + " discarded down to " + HAND_LIMIT + " cards.");
      state.pending = null;
      advance(state, now);
      out.ok = true;
      return out;
    }

    // Everything below is a normal turn action.
    if (pend) { out.error = "Waiting for other players first."; return out; }
    if (current(state) !== pid) { out.error = "It's not your turn."; return out; }

    if (action.type === "draw") {
      var c = drawCard(state, pid, rng);
      addLog(state, p.name + (c ? " drew a card." : " tried to draw, but there are no cards left."));
      endTurn(state, pid, now);
      out.ok = true;
      return out;
    }

    if (action.type === "announce") {
      var have = sheepCount(p.hand);
      var needN = needOf(state, pid);
      if (have === needN) {
        state.winner = pid;
        addLog(state, p.name + " counted exactly " + needN + " sheep and fell asleep. Sweet dreams!");
      } else {
        addLog(state, p.name + " announced, but had " + have + " sheep and needed " + needN + ". False alarm!");
        if (state.falseAlarm) {
          var q = nextPlayer(state, pid);
          while (q !== pid && p.hand.length) {
            var t = takeRandom(state, pid, rng);
            t.stuck = false;
            state.players[q].hand.push(t);
            q = nextPlayer(state, q);
          }
          addLog(state, "Everyone else took a random card from " + p.name + ".");
        }
        endTurn(state, pid, now);
      }
      out.ok = true;
      return out;
    }

    if (action.type === "play") {
      var idx = findIndex(p.hand, action.card);
      if (idx === -1) { out.error = "That card isn't in your hand."; return out; }
      var card = p.hand[idx];
      var d = CARDS[card.k];
      if (d.type === "sheep" && card.k !== "black") { out.error = "Sheep cards stay in your hand. Draw, play a power card, or announce."; return out; }
      if (card.k === "black" && card.stuck) { out.error = "This Black Sheep is stuck with you. Shear it to get rid of it."; return out; }
      if (d.react) { out.error = "Warm Milk is played automatically when a card is played on you."; return out; }

      var target = action.target;
      if (d.target === "other") {
        if (!state.players[target] || target === pid) { out.error = "Choose another player."; return out; }
      } else if (d.target === "any") {
        if (!state.players[target]) target = pid;
      }
      // Validate choices before anything moves.
      if (d.choose === "ownCard") {
        if (action.choice === card.id || findIndex(p.hand, action.choice) === -1) { out.error = "Choose a card from your hand to shear."; return out; }
      }
      if (d.choose === "discard") {
        if (findIndex(state.discard, action.choice) === -1) { out.error = "Choose a card from the discard pile."; return out; }
      }
      if (d.choose === "earplugs") {
        if (action.choice !== "block" && findIndex(p.mods, action.choice) === -1) { out.error = "Choose a card in your bed, or block the dog."; return out; }
      }

      p.hand.splice(idx, 1);
      var affected = affectedBy(state, pid, card, target);
      var desc = describePlay(state, pid, card, target);
      addLog(state, desc);

      var waiting = affected.filter(function (q) { return holdsMilk(state, q); });
      state.pending = { kind: "milk", actor: pid, card: card, target: target, choice: action.choice,
        affected: affected, waitingOn: waiting, blockers: [], deadline: now + MILK_WAIT_MS, text: desc };
      if (!waiting.length) finishMilk(state, rng, out, now);
      out.ok = true;
      return out;
    }

    if (action.type === "skipTurn") {
      // Host only (checked by the caller): skip a player who has dropped out.
      return out;
    }

    out.error = "Unknown action.";
    return out;
  }

  function describePlay(state, pid, card, target) {
    var n = nameOf(state, pid);
    var d = CARDS[card.k];
    if (card.k === "black") return n + " slipped a Black Sheep into " + nameOf(state, target) + "'s hand.";
    if (d.target === "other") return n + " played " + d.name + " on " + nameOf(state, target) + ".";
    if (d.target === "any") return n + " played " + d.name + (target === pid ? " in their own bed." : " in " + nameOf(state, target) + "'s bed.");
    if (card.k === "snore") return n + " played Snore. " + nameOf(state, nextPlayer(state, pid)) + " is next.";
    return n + " played " + d.name + ".";
  }

  function discardIds(state, pid, ids) {
    var hand = state.players[pid].hand;
    var uniq = ids.filter(function (v, i) { return ids.indexOf(v) === i; });
    if (uniq.length !== ids.length) return false;
    for (var i = 0; i < ids.length; i++) if (findIndex(hand, ids[i]) === -1) return false;
    ids.forEach(function (id) { toDiscard(state, hand.splice(findIndex(hand, id), 1)[0]); });
    return true;
  }

  /** Apply a played card once Warm Milk answers are in. */
  function finishMilk(state, rng, out, now) {
    var pend = state.pending;
    state.pending = null;
    var actor = pend.actor, card = pend.card, target = pend.target, blockers = pend.blockers;
    var a = state.players[actor];
    var blocked = function (q) { return blockers.indexOf(q) !== -1; };
    var d = CARDS[card.k];

    switch (card.k) {
      case "black":
        if (blocked(target)) toDiscard(state, card);
        else { card.stuck = true; state.players[target].hand.push(card); }
        break;
      case "wolf":
        toDiscard(state, card);
        if (!blocked(target)) {
          var w = takeRandom(state, target, rng);
          if (w) { w.stuck = false; a.hand.push(w); addLog(state, a.name + " stole a card."); }
        }
        break;
      case "duvethog":
        toDiscard(state, card);
        if (!blocked(target)) {
          var got = 0;
          for (var i = 0; i < 2; i++) {
            var h = takeRandom(state, target, rng);
            if (h) { h.stuck = false; a.hand.push(h); got++; }
          }
          if (got) addLog(state, a.name + " hogged " + got + " card" + (got === 1 ? "" : "s") + ".");
        }
        break;
      case "owl":
        toDiscard(state, card);
        if (!blocked(target)) {
          out.privates.push({ to: actor, text: nameOf(state, target) + "'s bed card is " + state.players[target].bed + "." });
        }
        break;
      case "sleepwalker":
        toDiscard(state, card);
        if (!blocked(target)) {
          var tmp = a.hand; a.hand = state.players[target].hand; state.players[target].hand = tmp;
          addLog(state, a.name + " and " + nameOf(state, target) + " swapped hands.");
        }
        break;
      case "snore":
        toDiscard(state, card);
        if (!blocked(pend.affected[0])) state.players[pend.affected[0]].skip = true;
        break;
      case "lullaby":
        toDiscard(state, card);
        drawCard(state, actor, rng); drawCard(state, actor, rng);
        break;
      case "shear":
        toDiscard(state, card);
        var si = findIndex(a.hand, pend.choice);
        if (si !== -1) {
          var sheared = a.hand.splice(si, 1)[0];
          toDiscard(state, sheared);
          addLog(state, a.name + " sheared off " + (CARDS[sheared.k].type === "sheep" ? "a " + CARDS[sheared.k].name : "a card") + ".");
        }
        break;
      case "snack":
        toDiscard(state, card);
        var di = findIndex(state.discard, pend.choice);
        if (di !== -1) {
          var snackCard = state.discard.splice(di, 1)[0];
          a.hand.push(snackCard);
          addLog(state, a.name + " took " + CARDS[snackCard.k].name + " from the discard pile.");
        }
        break;
      case "nightmare":
        toDiscard(state, card);
        var ring = state.order.filter(function (q) { return !blocked(q); });
        if (ring.length >= 2) {
          var passed = ring.map(function (q) { return takeRandom(state, q, rng); });
          ring.forEach(function (q, i) {
            var c = passed[i];
            if (c) state.players[ring[(i + 1) % ring.length]].hand.push(c);
          });
          addLog(state, "Everyone passed a random card to the left.");
        }
        break;
      case "firealarm":
        toDiscard(state, card);
        var hit = others(state, actor).filter(function (q) { return !blocked(q) && state.players[q].hand.length > 3; });
        if (hit.length) {
          state.pending = { kind: "fire", actor: actor, waitingOn: hit, deadline: now + FIRE_WAIT_MS, text: a.name + " set off the Fire Alarm!" };
          return;
        }
        break;
      case "espresso":
      case "insomnia":
        if (blocked(target)) toDiscard(state, card);
        else { card.from = actor; state.players[target].mods.push(card); }
        break;
      case "bottle":
        if (blocked(target)) toDiscard(state, card);
        else { card.from = actor; state.players[target].mods.push(card); }
        break;
      case "dog":
        card.immune = blockers.slice();
        card.from = actor;
        a.mods.push(card);
        break;
      case "earplugs":
        if (pend.choice === "block") {
          card.from = actor;
          a.mods.push(card);
          addLog(state, a.name + " popped in Earplugs. The dog can't keep them awake.");
        } else {
          var mi2 = findIndex(a.mods, pend.choice);
          toDiscard(state, card);
          if (mi2 !== -1) {
            var gone = a.mods.splice(mi2, 1)[0];
            addLog(state, a.name + " cleared " + CARDS[gone.k].name + " from their bed.");
            toDiscard(state, gone);
          }
        }
        break;
      default:
        toDiscard(state, card);
    }
    void d;
    endTurn(state, actor, now);
  }

  function endTurn(state, pid, now) {
    var p = state.players[pid];
    if (p.hand.length > HAND_LIMIT) {
      state.pending = { kind: "discardDown", who: pid, deadline: now + DISCARD_WAIT_MS };
      return;
    }
    advance(state, now);
  }

  function advance(state, now) {
    void now;
    var guard = 0;
    do {
      state.turn = (state.turn + 1) % state.order.length;
      var p = state.players[current(state)];
      if (p.skip) {
        p.skip = false;
        addLog(state, p.name + " is snoring, so they miss this turn.");
        continue;
      }
      break;
    } while (++guard < 20);
  }

  /** Host-only: skip whoever's turn it is (for someone who dropped out). */
  function skipCurrent(state, now) {
    if (state.winner) return false;
    var pend = state.pending;
    if (pend && pend.kind !== "discardDown") return false;
    var rng = rngFor(state);
    if (pend && pend.kind === "discardDown") {
      autoDiscard(state, pend.who, state.players[pend.who].hand.length - HAND_LIMIT, rng);
      state.pending = null;
    }
    addLog(state, nameOf(state, current(state)) + "'s turn was skipped.");
    advance(state, now);
    return true;
  }

  function autoDiscard(state, pid, n, rng) {
    for (var i = 0; i < n; i++) {
      var c = takeRandom(state, pid, rng);
      if (c) toDiscard(state, c);
    }
  }

  /** Call regularly on the host: answers for anyone who runs out of time. */
  function tick(state, now) {
    var pend = state.pending;
    if (!pend || state.winner || now < pend.deadline) return false;
    var rng = rngFor(state);
    if (pend.kind === "milk") {
      pend.waitingOn = [];
      finishMilk(state, rng, { privates: [] }, now);
      return true;
    }
    if (pend.kind === "fire") {
      pend.waitingOn.forEach(function (q) {
        autoDiscard(state, q, state.players[q].hand.length - 3, rng);
        addLog(state, nameOf(state, q) + " ran out of time and lost random cards.");
      });
      state.pending = null;
      endTurn(state, pend.actor, now);
      return true;
    }
    if (pend.kind === "discardDown") {
      autoDiscard(state, pend.who, state.players[pend.who].hand.length - HAND_LIMIT, rng);
      addLog(state, nameOf(state, pend.who) + " ran out of time and discarded at random.");
      state.pending = null;
      advance(state, now);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------- views

  function publicCard(c) {
    return { id: c.id, k: c.k, stuck: !!c.stuck };
  }

  function modView(m) {
    return { id: m.id, k: m.k, immune: (m.immune || []).slice() };
  }

  /** What one player is allowed to see. */
  function view(state, pid) {
    var over = !!state.winner;
    var me = state.players[pid];
    var pend = state.pending;
    var v = {
      you: pid,
      order: state.order.slice(),
      current: current(state),
      deck: state.deck.length,
      discard: state.discard.map(publicCard),
      log: state.log.slice(-40),
      winner: state.winner,
      falseAlarm: state.falseAlarm,
      handLimit: HAND_LIMIT,
      players: state.order.map(function (q) {
        var p = state.players[q];
        var showAll = over || q === pid;
        return {
          id: q,
          name: p.name,
          handCount: p.hand.length,
          hand: showAll ? p.hand.map(publicCard) : null,
          bed: showAll ? p.bed : null,
          need: showAll ? needOf(state, q) : null,
          have: showAll ? sheepCount(p.hand) : null,
          mods: p.mods.map(modView),
          skip: p.skip,
        };
      }),
      pending: null,
    };
    if (pend) {
      var pv = { kind: pend.kind, deadline: pend.deadline, text: pend.text || "" };
      if (pend.kind === "milk") {
        pv.card = publicCard(pend.card);
        pv.actor = pend.actor;
        pv.youDecide = pend.waitingOn.indexOf(pid) !== -1;
        pv.waiting = pend.waitingOn.length > 0;
      } else if (pend.kind === "fire") {
        pv.youDecide = pend.waitingOn.indexOf(pid) !== -1;
        pv.mustDiscard = pv.youDecide ? me.hand.length - 3 : 0;
        pv.waiting = true;
      } else if (pend.kind === "discardDown") {
        pv.who = pend.who;
        pv.youDecide = pend.who === pid;
        pv.mustDiscard = pv.youDecide ? me.hand.length - HAND_LIMIT : 0;
      }
      v.pending = pv;
    }
    return v;
  }

  var api = {
    CARDS: CARDS, COUNTS: COUNTS, HAND_LIMIT: HAND_LIMIT,
    buildDeck: buildDeck, createGame: createGame, act: act, tick: tick, view: view,
    needOf: needOf, sheepCount: sheepCount, skipCurrent: skipCurrent, current: current,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.InsheepniaEngine = api;
})(typeof window !== "undefined" ? window : this);