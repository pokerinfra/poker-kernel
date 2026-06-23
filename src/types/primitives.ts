// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

export type GameType = "cash" | "tour";

export type GameVariation = "NLH" | "PLO" | "PLO5" | "PLO6";

export type ChipsType = "real" | "play";

export type Stakes = "No Limit" | "Pot Limit" | "Fixed Limit";

export type BlindType = "Low" | "Medium" | "High";

export type Straddle = "Mandatory" | "Optional";

export type TableStatus = "active" | "orphaned" | "destroyed" | "ended" | "refund" | "refunded";

export type Position =
    | "Dealer"
    | "SB"
    | "BB"
    | "UTG"
    | "UTG +1"
    | "MP"
    | "LJ"
    | "HJ"
    | "CO"
    | "N/A";
