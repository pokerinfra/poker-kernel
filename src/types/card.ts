// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
    suit: Suit;
    rank: Rank;
}

export interface HandStrength {
    name: string;
    description: string;
    cards: Card[];
    confidence: "exact" | "possible";
}

export interface PlayerHandInfo {
    playerId: string;
    handStrength: HandStrength | null;
    currentHand: Card[];
}

export interface HandPotential {
    madeHand: HandStrength | null;
    draws: DrawInfo[];
    totalOuts: number;
    immediateOdds: number;
    showdownOdds: number;
    equity: number;
}

export interface DrawInfo {
    type: "flush" | "straight" | "full-house" | "quads" | "set" | "pair" | "straight-flush";

    description: string;
    outs: number;
    outsList: Card[];
    probability: number;
}
