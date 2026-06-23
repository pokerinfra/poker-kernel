// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { IVariantBetHandler, Stakes } from "../../types";
import { NoLimitBetHandler } from "./NoLimitBetHandler";
import { PotLimitBetHandler } from "./PotLimitBetHandler";

export class PokerVariantFactory {
    static create(bettingStructure: Stakes): IVariantBetHandler {
        switch (bettingStructure) {
            case "No Limit":
                return new NoLimitBetHandler();

            case "Pot Limit":
                return new PotLimitBetHandler();

            default:
                throw new Error(`Unsupported betting structure: ${bettingStructure}`);
        }
    }
}
