<p align="center">
  <img src="https://www.pokerinfra.com/wp-content/uploads/2026/06/pokerinfra_logo.png" alt="Poker Infra" width="280" />
</p>

# Poker Kernel

A production-grade, stateful **Poker Rules Engine** and **Poker Game Engine** written in TypeScript — built for operators who cannot afford to get the rules wrong. Designed for **Real Money Poker Software**, **Online Poker Platforms**, and **White Label Poker Platform** operators.

| Package | Version | Description |
|---|---|---|
| [`@pokerinfra/poker-kernel`](https://www.npmjs.com/package/@pokerinfra/poker-kernel) | 1.0.0 | Rules engine for Texas Hold'em (NLH), Pot Limit Omaha (PLO), PLO5, PLO6, side pots, run-it-twice, and tournament poker. Ships its own TypeScript type definitions and event contracts. |

---

## For Poker Operators

Running a poker platform means your **Poker Engine** and **Poker Rules Engine** are on the critical path of every hand, every payout, and every dispute. Most teams underestimate how long it takes to build one correctly. The edge cases in side-pot math, blind rotation, disconnection handling, and all-in resolution are not obvious — and each one is a potential support ticket, chargeback, or regulatory flag.

The Poker Kernel solves that layer completely so your engineering time goes into product, UX, and compliance — not debugging a 4-way all-in scenario at 2 AM. It is designed as an **Open Source Poker Engine** for operators building **Real Money Poker Software**, **Online Poker Platforms**, **Poker Clubs**, and **White Label Poker Platforms**.

### What operators tell us they were tired of dealing with

**Incorrect payouts from side-pot bugs**
Multi-way all-ins with unequal stacks are the hardest case to get right. The kernel's pot algorithm handles every combination — partial blinds, straddle all-ins, 6-way all-ins with 6 different stack sizes — and has been verified across hundreds of targeted test scenarios. Wrong pot distributions are existential risk: player trust, regulatory penalties, and six-figure refunds. The architecture serves as the foundation for reliable **Poker Software Development**, **Poker Source Code**, and enterprise-grade **Poker Backend** implementations.

**Disconnection chaos mid-hand**
Players dropping at the wrong moment and getting stuck in the action queue — or worse, being force-folded incorrectly — generate more support tickets than anything else. The kernel has a pre-check system that handles disconnection gracefully: auto check/fold, call-any, and configurable timers that integrate cleanly with your reconnection flow. The architecture is suitable for **Multiplayer Poker Engines**, **Poker Game Servers**, and high-concurrency **Online Poker Platforms** where player connectivity is critical.

**Blind rotation breaking on edge cases**
Heads-up blind order, 3-handed dealer/SB/BB rotation, straddle in short-handed games, leave-after-BB flows — these are the cases that break naive implementations within weeks of launch. Every rotation scenario is tested including concurrent leave/join events across Texas Hold'em and Pot Limit Omaha game formats used by modern **Online Poker Software** and **White Label Poker Platforms**.

**No audit trail for regulators**
Every jurisdiction that licenses real-money poker requires a complete, ordered record of every action in every hand. The kernel emits a typed, ordered `Mutation[]` event stream for every operation — ready to pipe into your audit log, replay system, or analytics pipeline without extra instrumentation. The event stream is ideal for **Poker Analytics**, **Poker APIs**, compliance systems, and enterprise-grade **Poker Infrastructure**.

**Switching variants or adding new ones**
Adding PLO to an NLH-only engine is painful when hand evaluation and betting rules are tangled together. The kernel separates variant logic cleanly — Texas Hold'em (NLH), Pot Limit Omaha (PLO), PLO5, and PLO6 ship out of the box, and the betting structure (No Limit, Pot Limit) is independently configurable. This makes it an ideal **Open Source Poker Engine** for teams building scalable **Online Poker Software**, **Poker Backend Systems**, and **Real Money Poker Platforms**.

**Time to market**
A correct poker engine built from scratch is 12–18 months of engineering. Most of that time is not writing rules — it is debugging the edge cases that only appear under real load. Whether you are building a **White Label Poker Platform**, **Poker Club Software**, or a custom **Real Money Poker Platform**, the Poker Kernel dramatically reduces engineering time. The kernel is that work, already done, open source, and inspectable.

---

## Performance

**Action processing under 1 ms** — the kernel is a pure in-memory **Poker Engine** with no I/O in the hot path. `applyAction()` runs the full validation pipeline, updates state, calculates side pots, resolves pre-checks, and emits events in under 1 ms on standard server hardware.

**End-to-end action response under 25 ms** — measured from client send to broadcast receipt at the game server layer, including network round-trip and event fan-out. Achievable on commodity cloud infrastructure and suitable for production-grade **Real Money Poker Software** and **Online Poker Platforms**.

**Concurrent tables with full isolation** — each table runs as an independent `PokerKernel` instance with no shared mutable state. There is no coordination overhead between tables. Scale horizontally by adding instances; the kernel does not require any synchronisation layer between them. Ideal for **Multiplayer Poker Platforms**, **Poker Backend Systems**, and enterprise-grade **Poker Game Servers**.

**Battle-tested rules engine** — validated across 516 targeted scenarios spanning hand lifecycle, all-in resolution, multi-way side pots, straddle, run-it-twice, pre-checks, rake calculation, seat allocation, and disconnection flows. The depth of validation makes Poker Kernel one of the most battle-tested **Poker Rules Engines** and **Open Source Poker Engines** available today.

---

## Open-Core Model

The kernel and its type definitions are free and open source under **AGPL-3.0**. This makes Poker Kernel one of the few production-ready **Open Source Poker Engines**, **Poker Rules Engines**, and **Poker Game Engines** available for commercial poker operators.

The full poker platform — game server, lobby server, player management, tournament director, back-office, and payment integration — is commercial IP available under a white-label licensing arrangement.

**What is open:**
- Full poker rules engine (`@pokerinfra/poker-kernel`)
- All TypeScript type definitions and event contracts (bundled in the same package)
- Betting strategy implementations
- Hand evaluation and side-pot logic

**What is commercial:**
- Game server (real-time **Poker Game Server**, WebSocket/MQTT transport, session management)
- Lobby server (table discovery, matchmaking, tournament scheduling for **Online Poker Platforms**)
- Tournament director (**Poker Tournament Software**, blind level management, payout structures, rebuy flows)
- Back-office and reporting for **Real Money Poker Software**
- Compliance and RNG certification support for regulated **Poker Operators**

The AGPL-3.0 license means any operator running a modified version of the kernel as a network service must open source those modifications — or obtain a commercial license. This keeps the open source ecosystem healthy while funding continued development.

---

## Getting Started

```bash
npm install @pokerinfra/poker-kernel
```

Types and event contracts are bundled — import the engine and its types from the same package:

```ts
import { PokerKernel, GameState, Mutation } from "@pokerinfra/poker-kernel";
```

---

## Repository Structure

```
poker-kernel/
  src/
    kernel/
      PokerKernel.ts             core rules engine
      helpers/
        Deck.ts                  52-card deck (crypto Fisher–Yates shuffle)
        PotManager.ts            side-pot construction + rake
        PKActionHandler.ts       action handlers (fold/call/bet/raise/all-in/check)
        PKActionManager.ts       legal-action provider
        PKActionValidations.ts   action validation pipeline
        PreCheckHandler.ts       pre-check engine (auto check/fold, call-any)
        PokerVariantFactory.ts   betting-structure factory
        NoLimitBetHandler.ts     No Limit bet sizing
        PotLimitBetHandler.ts    Pot Limit bet sizing
        ShowdownHandler.ts       standard + run-it-twice resolution
    types/                       domain types and event contracts
    index.ts                     public entry point
  package.json                   @pokerinfra/poker-kernel
  README.md                      this file
```

---

## Commercial Enquiries

If you are building a **Real Money Poker Platform**, **White Label Poker Platform**, **Poker Club Software**, or a B2B gaming product and need a proven **Poker Rules Engine**, **Poker Game Engine**, and professional support behind it — let's talk.

**[pokerinfra.com](https://pokerinfra.com)** — commercial licensing, full white-label platform, managed hosting, SLA support, bespoke feature development, **Poker Software Development**, and enterprise **Poker Infrastructure**.

**[Book a demo →](https://pokerinfra.com/book-a-demo/)**

---

## Contributing

Issues and PRs are welcome at [github.com/pokerinfra/poker-kernel](https://github.com/pokerinfra/poker-kernel).

---

## License

AGPL-3.0 © [Poker Infra](https://pokerinfra.com)
