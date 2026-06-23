// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { PlayerAction } from "./action";
import { Player } from "./player";
import { GameState } from "./state";

export type PreCheck =
    | { type: "call"; amount: number; enable: boolean }
    | { type: "fold"; enable: boolean }
    | { type: "call any"; enable: boolean }
    | { type: "check/fold"; enable: boolean }
    | { type: "check"; enable: boolean }
    | { type: "all-in"; enable: boolean; amount: number };

export type PreChecks = PreCheck[];

export interface IPreCheckHandler {
    getValidPreCheckAction(player: Player, gameState: GameState): PlayerAction | null;

    updatePreChecks(gameState: GameState): void;

    togglePreCheck(playerId: string, selectedPreCheck: PreCheck, gameState: GameState): void;
}
