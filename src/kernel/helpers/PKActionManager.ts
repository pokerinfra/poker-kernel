// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import {
    GameState,
    IVariantBetHandler,
    IValidActionProvider,
    Player,
    ValidAction,
} from "../../types";

import { PokerVariantFactory } from "./PokerVariantFactory";

export class ValidActionProvider implements IValidActionProvider {
    getValidActions(playerId: string, gameState: GameState): ValidAction[] {
        const player = gameState.players.find((p) => p.id === playerId);

        if (!player || !player.isActive) return [];

        const strategy = PokerVariantFactory.create(gameState.bettingStructure);

        const currentHighestBet = this.getCurrentHighestBet(gameState);
        const callAmount = this.getCallAmount(player, currentHighestBet);

        const actions: ValidAction[] = [{ type: "fold" }];

        const activePlayers = gameState.players.filter((p) => p.isActive);
        const isHeadsUp = activePlayers.length === 2;
        const opponent = activePlayers.find((p) => p.id !== player.id);
        const isOpponentAllIn = opponent && opponent.chips === 0;

        this.addCheckAction(actions, callAmount);

        this.addCallAction(actions, player, callAmount, strategy, gameState);

        if (!(isHeadsUp && isOpponentAllIn)) {
            this.addBetOrRaiseActions(actions, player, strategy, currentHighestBet, gameState);
        }

        return actions;
    }

    private getCurrentHighestBet(gameState: GameState): number {
        return Math.max(
            ...gameState.players.filter((p) => p.isActive).map((p) => p.currentRoundContribution),
            0
        );
    }

    private getCallAmount(player: Player, currentHighestBet: number): number {
        return currentHighestBet - player.currentRoundContribution;
    }

    private addCheckAction(actions: ValidAction[], callAmount: number): void {
        if (callAmount === 0) {
            actions.push({ type: "check" });
        }
    }

    private addCallAction(
        actions: ValidAction[],
        player: Player,
        callAmount: number,
        _strategy: IVariantBetHandler,
        _gameState: GameState
    ): void {
        if (
            callAmount > 0 &&
            player.chips > 0 &&
            player.chips !== callAmount &&
            player.chips > callAmount
        ) {
            actions.push({
                type: "call",
                amount: Math.min(callAmount, player.chips),
            });
        } else if (player.chips === callAmount || player.chips < callAmount) {
            actions.push({
                type: "all-in",
                amount: player.chips,
            });
        }
    }

    private addBetOrRaiseActions(
        actions: ValidAction[],
        player: Player,
        strategy: IVariantBetHandler,
        currentHighestBet: number,
        gameState: GameState
    ): void {
        const isBetPlaced = currentHighestBet > 0;

        if (isBetPlaced) {
            this.addRaiseActions(actions, player, strategy, gameState);
        } else {
            this.addBetActions(actions, player, strategy, gameState);
        }
    }

    private addRaiseActions(
        actions: ValidAction[],
        player: Player,
        strategy: IVariantBetHandler,
        gameState: GameState
    ): void {
        const minRaise = strategy.getMinRaise(gameState, player);
        const maxRaise = strategy.getMaxRaise(gameState, player);

        const currentHighestBet = Math.max(
            ...gameState.players.filter((p) => p.isActive).map((p) => p.currentRoundContribution),
            0
        );
        const callAmount = currentHighestBet - player.currentRoundContribution;

        if (minRaise < player.chips) {
            actions.push({
                type: "raise",
                min: minRaise,
                max: maxRaise,
            });
        } else if (player.chips > 0 && player.chips > callAmount) {
            actions.push({
                type: "all-in",
                amount: player.chips,
            });
        }
    }

    private addBetActions(
        actions: ValidAction[],
        player: Player,
        strategy: IVariantBetHandler,
        gameState: GameState
    ): void {
        const minBet = strategy.getMinBet(gameState, player);
        const maxBet = strategy.getMaxBet(gameState, player);

        if (minBet < player.chips) {
            actions.push({ type: "bet", min: minBet, max: maxBet });
        } else if (player.chips > 0) {
            actions.push({ type: "all-in", amount: player.chips });
        }
    }
}
