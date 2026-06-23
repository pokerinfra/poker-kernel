// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { Straddle } from "./primitives";

export interface GameConfig {
    minPlayers: number;

    maxPlayers: number;

    blinds: { small: number; big: number };

    buyIn: {
        min: number;
        max: number;
    };

    autoPostBB: boolean;

    straddle: Straddle;

    runItTwice: boolean;

    private: {
        isPrivateTable: boolean;
        password: string;
    };

    rake: {
        rake2PlayersPercent: number;
        rakeCap2PlayersPercent: number;

        rake3or4PlayersPercent: number;
        rakeCap3or4PlayersPercent: number;

        rake5orMorePlayersPercent: number;
        rakeCap5orMorePlayersPercent: number;
    };

    antiBankingTimer: number;

    timeBankTimer: number;

    timeBankUsageCap: number;

    disconnectionTimerBehaviour: "consumable" | "constant";

    waitingTimerPeriod: number;

    observeTimerPeriod: number;

    sitoutTimerPeriod: number;

    consecutiveMissedHand: number;

    rebuyMode: "auto" | "offer";

    rebuyTimerSeconds: number;
}
