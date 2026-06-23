// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { GameState, IActionValidator, Player, PlayerAction } from "../../types";
import { PokerVariantFactory } from "./PokerVariantFactory";

abstract class BaseActionValidator implements IActionValidator {
    abstract validate(player: Player, action: PlayerAction, gameState: GameState): boolean;
}

class PlayerExistsValidator extends BaseActionValidator {
    validate(player: Player, _action: PlayerAction, gameState: GameState): boolean {
        return gameState.players.some((p) => p.id === player.id);
    }
}

class PlayerActiveValidator extends BaseActionValidator {
    validate(player: Player, _action: PlayerAction, _gameState: GameState): boolean {
        return player.isActive;
    }
}

class CurrentPlayerValidator extends BaseActionValidator {
    validate(player: Player, _action: PlayerAction, gameState: GameState): boolean {
        return gameState.round.currentPlayer === player.id;
    }
}

class SufficientChipsValidator extends BaseActionValidator {
    validate(player: Player, action: PlayerAction, _gameState: GameState): boolean {
        if (action.type === "call" || action.type === "bet" || action.type === "raise") {
            return player.chips >= (action.amount || 0);
        }
        return true;
    }
}

class CallAmountValidator extends BaseActionValidator {
    validate(player: Player, action: PlayerAction, gameState: GameState): boolean {
        if (action.type === "call") {
            const currentHighestBet = Math.max(
                ...gameState.players
                    .filter((p) => p.isActive)
                    .map((p) => p.currentRoundContribution),
                0
            );

            const callAmount = currentHighestBet - player.currentRoundContribution;

            return action.amount === Math.min(callAmount, player.chips);
        }
        return true;
    }
}

class BetAmountValidator extends BaseActionValidator {
    validate(player: Player, action: PlayerAction, gameState: GameState): boolean {
        if (action.type === "bet") {
            if (action.amount === undefined) return false;

            const strategy = PokerVariantFactory.create(gameState.bettingStructure);
            const minBet = strategy.getMinBet(gameState, player);
            const maxBet = strategy.getMaxBet(gameState, player);

            return (
                action.amount >= minBet && action.amount <= maxBet && action.amount <= player.chips
            );
        }
        return true;
    }
}

class RaiseAmountValidator extends BaseActionValidator {
    validate(player: Player, action: PlayerAction, gameState: GameState): boolean {
        if (action.type === "raise") {
            if (action.amount === undefined) return false;

            const strategy = PokerVariantFactory.create(gameState.bettingStructure);
            const minRaise = strategy.getMinRaise(gameState, player);
            const maxRaise = strategy.getMaxRaise(gameState, player);

            return (
                action.amount >= minRaise &&
                action.amount <= maxRaise &&
                action.amount <= player.chips
            );
        }
        return true;
    }
}

class AllInAmountValidator extends BaseActionValidator {
    validate(player: Player, action: PlayerAction, _gameState: GameState): boolean {
        if (action.type === "all-in") {
            return action.amount === player.chips && player.chips > 0;
        }
        return true;
    }
}

class ValidActionValidator implements IActionValidator {
    private validTypes: Set<string> = new Set(["fold", "check", "call", "bet", "raise", "all-in"]);

    validate(_player: Player, action: PlayerAction, _gameState: GameState): boolean {
        return this.validTypes.has(action.type);
    }
}

class CheckActionValidator extends BaseActionValidator {
    validate(player: Player, action: PlayerAction, gameState: GameState): boolean {
        if (action.type !== "check") return true;

        const currentHighestBet = Math.max(
            ...gameState.players.filter((p) => p.isActive).map((p) => p.currentRoundContribution),
            0
        );

        const callAmount = currentHighestBet - player.currentRoundContribution;

        return callAmount === 0;
    }
}

export class CompositeActionValidator implements IActionValidator {
    private validators: IActionValidator[] = [
        new ValidActionValidator(),
        new PlayerExistsValidator(),
        new PlayerActiveValidator(),
        new CurrentPlayerValidator(),
        new SufficientChipsValidator(),
        new CallAmountValidator(),
        new BetAmountValidator(),
        new RaiseAmountValidator(),
        new AllInAmountValidator(),
        new CheckActionValidator(),
    ];

    validate(player: Player, action: PlayerAction, gameState: GameState): boolean {
        return this.validators.every((validator) => validator.validate(player, action, gameState));
    }

    addValidator(validator: IActionValidator): void {
        this.validators.push(validator);
    }
}
