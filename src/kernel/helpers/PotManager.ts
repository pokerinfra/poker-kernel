// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { Pot, Player, GameState } from "../../types";

interface RakeConfig {
    rake3or4PlayersPercent: number;
    rakeCap3or4PlayersPercent: number;
    rake5orMorePlayersPercent: number;
    rakeCap5orMorePlayersPercent: number;
}

export class PotManager {
    static createPots(state: GameState): Pot[] {
        const updatedPots = [...state.pots];

        if (!this.hasContributions(state)) {
            return updatedPots;
        }

        if (this.shouldMergeToLastPot(state, updatedPots)) {
            return this.mergeToLastPot(state, updatedPots);
        }

        return this.processContributions(state, updatedPots);
    }

    static applyRake(pots: Pot[], playerCount: number, rakeConfig: RakeConfig): Pot[] {
        if (playerCount <= 2) {
            return pots;
        }

        let rakePercent: number;
        let rakeCap: number;

        if (playerCount === 3 || playerCount === 4) {
            rakePercent = rakeConfig.rake3or4PlayersPercent;
            rakeCap = rakeConfig.rakeCap3or4PlayersPercent;
        } else if (playerCount >= 5) {
            rakePercent = rakeConfig.rake5orMorePlayersPercent;
            rakeCap = rakeConfig.rakeCap5orMorePlayersPercent;
        } else {
            return pots;
        }

        const updatedPots: Pot[] = pots.map((pot) => ({ ...pot }));
        let totalRakeCollected = 0;

        for (let i = 0; i < updatedPots.length; i++) {
            const pot = updatedPots[i];

            if (pot.eligiblePlayers.length === 1) {
                continue;
            }

            const potRake = Math.round(((pot.amount * rakePercent) / 100) * 100) / 100;

            const remainingRakeCapacity = rakeCap - totalRakeCollected;

            if (remainingRakeCapacity <= 0) {
                break;
            }

            const rakeToDeduct = Math.min(potRake, remainingRakeCapacity);

            pot.amount -= rakeToDeduct;
            totalRakeCollected += rakeToDeduct;

            if (totalRakeCollected >= rakeCap) {
                break;
            }
        }

        return updatedPots;
    }

    private static hasContributions(state: GameState): boolean {
        return state.players.some((p) => p.currentRoundContribution > 0);
    }

    private static shouldMergeToLastPot(state: GameState, pots: Pot[]): boolean {
        if (pots.length === 0) return false;

        const activeContributions = state.players
            .filter((p) => p.isActive && p.currentRoundContribution > 0)
            .map((p) => p.currentRoundContribution);

        const uniqueAmounts = [...new Set(activeContributions)];
        return uniqueAmounts.length === 1;
    }

    private static mergeToLastPot(state: GameState, pots: Pot[]): Pot[] {
        const allContributors = state.players.filter((p) => p.currentRoundContribution > 0);

        const amountToMerge = allContributors.reduce(
            (sum, p) => sum + p.currentRoundContribution,
            0
        );

        const eligiblePlayers = allContributors.filter((p) => p.isActive).map((p) => p.id);

        state.players.forEach((p) => (p.currentRoundContribution = 0));

        const lastPot = pots[pots.length - 1];
        lastPot.amount += amountToMerge;

        lastPot.eligiblePlayers = Array.from(
            new Set([...lastPot.eligiblePlayers, ...eligiblePlayers])
        );

        return pots;
    }

    private static processContributions(state: GameState, pots: Pot[]): Pot[] {
        const updatedPots = [...pots];
        const contributions = this.getSortedContributions(state);
        const checkedPlayers = new Set<string>();

        while (contributions.length > 0) {
            const currentMin = contributions.shift()!;
            const minPlayer = this.findMinContributor(state, currentMin, checkedPlayers);

            if (!minPlayer?.isActive) {
                checkedPlayers.add(minPlayer?.id || "");
                continue;
            }

            const { potAmount, eligiblePlayers } = this.createPotFromContributions(
                state,
                currentMin
            );

            if (potAmount > 0) {
                const otherActivePlayers = state.players.filter(
                    (p) => p.isActive && p.id !== eligiblePlayers[0]
                );
                const isAllInRefund =
                    eligiblePlayers.length === 1 &&
                    otherActivePlayers.length > 0 &&
                    otherActivePlayers.every((p) => p.chips === 0);

                if (isAllInRefund) {
                    const refundPlayer = state.players.find((p) => p.id === eligiblePlayers[0]);
                    if (refundPlayer) {
                        refundPlayer.chips += potAmount;
                    }
                } else {
                    updatedPots.push({
                        amount: potAmount,
                        eligiblePlayers,
                    });
                }
            }

            this.adjustRemainingContributions(contributions, currentMin);
        }

        return updatedPots;
    }

    private static getSortedContributions(state: GameState): number[] {
        return state.players
            .filter((p) => p.currentRoundContribution > 0)
            .map((p) => p.currentRoundContribution)
            .sort((a, b) => a - b);
    }

    private static findMinContributor(
        state: GameState,
        amount: number,
        checkedPlayers: Set<string>
    ): Player | undefined {
        return state.players.find(
            (p) => p.currentRoundContribution === amount && !checkedPlayers.has(p.id)
        );
    }

    private static createPotFromContributions(
        state: GameState,
        minAmount: number
    ): { potAmount: number; eligiblePlayers: string[] } {
        let potAmount = 0;
        const eligiblePlayers: string[] = [];

        state.players.forEach((player) => {
            if (player.currentRoundContribution >= minAmount) {
                const amountToDeduct = Math.min(minAmount, player.currentRoundContribution);

                player.currentRoundContribution -= amountToDeduct;
                potAmount += amountToDeduct;

                if (player.isActive && !eligiblePlayers.includes(player.id)) {
                    eligiblePlayers.push(player.id);
                }
            } else if (!player.isActive) {
                potAmount += player.currentRoundContribution;
            }
        });

        return { potAmount, eligiblePlayers };
    }

    private static adjustRemainingContributions(contributions: number[], amount: number): void {
        for (let i = 0; i < contributions.length; i++) {
            contributions[i] -= amount;
        }
    }
}
