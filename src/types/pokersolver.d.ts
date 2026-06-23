// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

declare module "pokersolver" {
    export class Hand {
        static solve(cards: string[], type?: string): Hand;
        static winners(hands: Hand[]): Hand[];
        rank: number;
        name: string;
        descr: string;
        cards: Card[];
        toString(): string;
    }
}
