// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { Card, Suit, Rank } from "../../types";
import { randomInt } from "crypto";

export class Deck {
    private deck: Card[];

    constructor(
        initialDeck?: Card[],
        excludeCards: Card[] = [],
        private rng: (min: number, max: number) => number = randomInt
    ) {
        this.deck = initialDeck
            ? this.remainingDeck([...initialDeck], excludeCards)
            : this.freshDeck();

        if (!initialDeck) this.shuffle();
    }

    private freshDeck(): Card[] {
        const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
        const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

        return suits.flatMap((suit) => ranks.map((rank) => ({ suit, rank })));
    }

    shuffle(): void {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = this.rng(0, i + 1);

            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    drawCards(count: number): Card[] {
        if (count > this.deck.length) {
            throw new Error(`Cannot draw ${count} cards. Only ${this.deck.length} remaining.`);
        }

        return this.deck.splice(0, count);
    }

    get remainingCards(): Card[] {
        return [...this.deck];
    }

    private remainingDeck(deck: Card[], excludeCards: Card[]): Card[] {
        return deck.filter(
            (card) =>
                !excludeCards.some(
                    (excluded) => card.rank === excluded.rank && card.suit === excluded.suit
                )
        );
    }
}
