// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { Card, HandStrength } from "./card";
import { Position } from "./primitives";
import { PreChecks } from "./preChecks";

export interface Player {
    id: string;

    profile?: IPlayerProfile;

    chips: number;

    hand: Card[];

    isActive: boolean;

    contributedToPot: number;

    currentRoundContribution: number;

    isAutoPostBB: boolean;

    seat: number;

    leaveNextHand: boolean;

    hasActed: boolean;

    preChecks: PreChecks;

    straddle: boolean;

    sitOut: boolean;

    handStrength: HandStrength | null;

    timeBank: number;

    position: Position;

    leaveBB: boolean;

    openingBalance: number;

    autoTopUp: boolean;

    rit: boolean;

    leaveHand: boolean;
}

export interface IPlayerProfile {
    clientId: string;
    buyIn: number;
    isConnected: boolean;
    isDisconnectedTimerConsumed: boolean;
    turnTimerExtension: number;
    timeBankConsumed: number;
    turnTimerAutoActionCounter: number;
    disconnectionTimer: number;
    standUp: boolean;
    standUpNextBB: boolean;
    [key: string]: any;
}

export type PlayerPublicView = Omit<Player, "hand" | "handStrength"> & {
    hand?: Card[];
    handStrength?: HandStrength;
};
