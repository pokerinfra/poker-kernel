// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { GameState } from "./state";
import { Player } from "./player";

export interface IVariantBetHandler {
    getMinBet(state: GameState, player: Player): number;

    getMaxBet(state: GameState, player: Player): number;

    getMinRaise(state: GameState, player: Player): number;

    getMaxRaise(state: GameState, player: Player): number;
}
