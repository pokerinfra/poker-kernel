// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { LastAction } from "./action";
import { Card } from "./card";

export type RoundStage = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown" | "ended";

export interface RoundState {
    stage: RoundStage;

    communityCards: Card[];

    currentPlayer: string;

    lastAction?: LastAction;

    deck: Card[];

    hasRaised: boolean;

    lastRaiseAmount?: number;
}

export type RoundStatePublicView = Omit<RoundState, "deck" | "hasRaised">;
