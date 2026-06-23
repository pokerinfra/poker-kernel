// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { GameState, IActionProcessor, Player, PlayerAction } from "../../types";

abstract class BaseActionHandler implements IActionProcessor {
    abstract process(player: Player, action: PlayerAction, gameState: GameState): void;
}

class FoldHandler extends BaseActionHandler {
    process(player: Player, action: PlayerAction, gameState: GameState): void {
        player.isActive = false;
    }
}

class CallHandler extends BaseActionHandler {
    process(player: Player, action: PlayerAction, gameState: GameState): void {
        if (action.type === "call") {
            const amount = action.amount || 0;
            player.chips -= amount;
            player.currentRoundContribution += amount;
        }
    }
}

class BetHandler extends BaseActionHandler {
    process(player: Player, action: PlayerAction, gameState: GameState): void {
        if (action.type === "bet") {
            const amount = action.amount || 0;
            player.chips -= amount;
            player.currentRoundContribution += amount;
            gameState.round.lastRaiseAmount = amount;
        }
    }
}

class RaiseHandler extends BaseActionHandler {
    process(player: Player, action: PlayerAction, gameState: GameState): void {
        if (action.type === "raise") {
            const amount = action.amount || 0;
            const previousHighestBet = Math.max(
                ...gameState.players
                    .filter((p) => p.isActive)
                    .map((p) => p.currentRoundContribution),
                0
            );
            player.chips -= amount;
            player.currentRoundContribution += amount;
            gameState.round.hasRaised = true;
            gameState.round.lastRaiseAmount = player.currentRoundContribution - previousHighestBet;
        }
    }
}

class AllInHandler extends BaseActionHandler {
    process(player: Player, action: PlayerAction, gameState: GameState): void {
        if (action.type === "all-in") {
            const amount = "amount" in action ? action.amount || player.chips : player.chips;
            player.currentRoundContribution += amount;
            player.chips = 0;
            gameState.round.hasRaised = true;
        }
    }
}

class CheckHandler extends BaseActionHandler {
    process(player: Player, action: PlayerAction, gameState: GameState): void {}
}

export class ActionHandlerFactory {
    private static processors: Map<string, IActionProcessor> = new Map([
        ["fold", new FoldHandler()],
        ["call", new CallHandler()],
        ["bet", new BetHandler()],
        ["raise", new RaiseHandler()],
        ["all-in", new AllInHandler()],
        ["check", new CheckHandler()],
    ]);

    static getProcessor(actionType: string): IActionProcessor | null {
        return this.processors.get(actionType) || null;
    }

    static addProcessor(actionType: string, processor: IActionProcessor): void {
        this.processors.set(actionType, processor);
    }
}
