// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { GameState, IPreCheckHandler, Player, PlayerAction, PreCheck } from "../../types";

export class PreCheckHandler implements IPreCheckHandler {
    getValidPreCheckAction(player: Player, gameState: GameState): PlayerAction | null {
        const activePreCheck = player.preChecks.find((p) => p.enable);
        if (!activePreCheck) return null;

        const currentHighestBet = Math.max(
            ...gameState.players.filter((p) => p.isActive).map((p) => p.currentRoundContribution),
            0
        );

        const callAmount = currentHighestBet - player.currentRoundContribution;

        switch (activePreCheck.type) {
            case "call":
                if (callAmount !== activePreCheck.amount) return null;
                return callAmount > 0 && callAmount <= player.chips
                    ? { type: "call", amount: callAmount }
                    : null;

            case "check":
                return callAmount === 0 ? { type: "check" } : null;

            case "check/fold":
                return callAmount === 0 ? { type: "check" } : { type: "fold" };

            case "call any":
                if (callAmount === 0) {
                    return { type: "check" };
                } else if (callAmount >= player.chips) {
                    return { type: "all-in", amount: player.chips };
                } else {
                    return { type: "call", amount: callAmount };
                }

            case "fold":
                return { type: "fold" };

            default:
                return null;
        }
    }

    updatePreChecks(gameState: GameState): void {
        const currentPlayerId = gameState.round.currentPlayer;

        const isBetPlaced = gameState.players.some((p) => p.currentRoundContribution > 0);

        const currentHighestBet = Math.max(
            ...gameState.players.filter((p) => p.isActive).map((p) => p.currentRoundContribution),
            0
        );

        gameState.players.forEach((player) => {
            if (player.chips > 0 && player.isActive && player.id !== currentPlayerId) {
                const callAmount = currentHighestBet - player.currentRoundContribution;

                if (isBetPlaced) {
                    if (callAmount > 0) {
                        if (player.chips > callAmount) {
                            player.preChecks = [
                                {
                                    type: "call",
                                    amount: callAmount,
                                    enable: false,
                                },
                                { type: "call any", enable: false },
                                { type: "fold", enable: false },
                            ];
                        } else {
                            player.preChecks = [
                                {
                                    type: "all-in",
                                    amount: player.chips,
                                    enable: false,
                                },
                                { type: "fold", enable: false },
                            ];
                        }
                    } else {
                        player.preChecks = [
                            { type: "check", enable: false },
                            { type: "check/fold", enable: false },
                            { type: "call any", enable: false },
                        ];
                    }
                } else {
                    player.preChecks = [
                        { type: "check", enable: false },
                        { type: "check/fold", enable: false },
                        { type: "call any", enable: false },
                    ];
                }
            } else {
                player.preChecks = [];
            }
        });
    }

    togglePreCheck(playerId: string, selectedPreCheck: PreCheck, gameState: GameState): void {
        const player = gameState.players.find((p) => p.id === playerId);
        if (!player) return;

        player.preChecks = player.preChecks.map((preCheck) => ({
            ...preCheck,
            enable: preCheck.type === selectedPreCheck.type ? !preCheck.enable : false,
        }));
    }
}
