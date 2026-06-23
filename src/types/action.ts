// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { Player } from "./player";
import { GameState } from "./state";

export type PlayerAction =
    | { type: "fold" }
    | { type: "check" }
    | { type: "call"; amount: number }
    | { type: "bet"; amount: number }
    | { type: "raise"; amount: number }
    | { type: "all-in"; amount: number };

export interface ValidAction {
    type: "fold" | "check" | "call" | "bet" | "raise" | "all-in";
    amount?: number;
    min?: number;
    max?: number;
}

export interface IActionProcessor {
    process(player: Player, action: PlayerAction, gameState: GameState): void;
}

export interface IValidActionProvider {
    getValidActions(playerId: string, gameState: GameState): ValidAction[];
}

export interface IActionValidator {
    validate(player: Player, action: PlayerAction, gameState: GameState): boolean;
}

export interface LastAction {
    playerId: string;
    action: PlayerAction;
}

export type BetSizingLabel =
    | "2x"
    | "2.5x"
    | "3x"
    | "4x"
    | "1/5 Pot"
    | "1/2 Pot"
    | "2/3 Pot"
    | "Pot";
export interface BetSizingOption {
    type: "raise" | "bet";
    label: BetSizingLabel;
    amount: number;
}
