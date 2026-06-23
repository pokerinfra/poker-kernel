// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { IVariantBetHandler, Player, GameState } from "../../types";

export class PotLimitBetHandler implements IVariantBetHandler {
    getMinBet(state: GameState, player: Player): number {
        return state.config.blinds.big;
    }

    getMaxBet(state: GameState, player: Player): number {
        const totalPotAmount = state.pots.reduce((acc, pot) => acc + pot.amount, 0);

        const playerWithLowerStack = state.players.find((p) => p.chips <= totalPotAmount);

        if (playerWithLowerStack) {
            return playerWithLowerStack.chips;
        }

        return totalPotAmount;
    }

    getMinRaise(state: GameState, player: Player): number {
        const currentHighestBet = Math.max(
            ...state.players.filter((p) => p.isActive).map((p) => p.currentRoundContribution),
            0
        );

        const callAmount = currentHighestBet - player.currentRoundContribution;

        if (player.chips <= callAmount) {
            return player.chips;
        }

        const raiseIncrement = state.round.lastRaiseAmount ?? state.config.blinds.big;
        return callAmount + raiseIncrement;
    }

    getMaxRaise(state: GameState, player: Player): number {
        const activePlayers = state.players.filter((p) => p.isActive);

        const currentHighestBet = Math.max(
            ...activePlayers.map((p) => p.currentRoundContribution),
            0
        );

        const callAmount = currentHighestBet - player.currentRoundContribution;

        const totalBetsOnTable = state.players.reduce(
            (acc, p) => acc + p.currentRoundContribution,
            0
        );

        const totalPotAmount = state.pots.reduce((acc, pot) => acc + pot.amount, 0);

        let rawMax: number;

        if (activePlayers.length === 2) {
            rawMax = totalPotAmount + totalBetsOnTable + callAmount + callAmount;
        } else {
            rawMax = totalPotAmount + totalBetsOnTable + callAmount + currentHighestBet;
        }

        return Math.min(rawMax, player.chips);
    }
}
