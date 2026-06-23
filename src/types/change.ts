// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import { BetSizingOption, LastAction, PlayerAction, ValidAction } from "./action";
import { Card, HandStrength } from "./card";
import { PlayerPublicView } from "./player";
import { Pot } from "./pot";
import { PreCheck, PreChecks } from "./preChecks";
import { RoundStatePublicView } from "./round";

export interface MutationType {
    PlayerJoined: { player: PlayerPublicView };
    PlayerLeft: { player: PlayerPublicView };
    PlayerExit: { player: PlayerPublicView };
    PlayerSitOut: { player: PlayerPublicView };
    PlayerSitIn: { player: PlayerPublicView };

    PlayerJoinedWaitingList: { waitingPlayers: PlayerPublicView };
    PlayerLeaveInNextHand: { player: PlayerPublicView };
    PlayerLeaveNextBB: { player: PlayerPublicView };

    CurrentRoundContributions: {
        contributions: {
            playerId: string;
            chips: number;
            currentRoundContribution: number;
        }[];
    };

    HandStarted: { round: RoundStatePublicView };
    PreflopBegin: { round: RoundStatePublicView };
    FlopBegin: { round: RoundStatePublicView };
    TurnBegin: { round: RoundStatePublicView };
    RiverBegin: { round: RoundStatePublicView };
    Showdown: {
        round: RoundStatePublicView;
        players: { id: string; hand: Card[] }[];
    };
    ShowdownByFold: {};
    HandEnded: { round: RoundStatePublicView };

    PotUpdates: { pots: Pot[]; totalPot: number };
    PlayersStatesUpdates: { players: PlayerPublicView[] };
    WaitingPlayers: { players: PlayerPublicView[] };
    SitoutPlayers: { players: PlayerPublicView[] };

    DealerAssigned: { dealer: PlayerPublicView };
    SmallBlindAssigned: { smallBlind: PlayerPublicView };
    BigBlindAssigned: { bigBlind: PlayerPublicView };

    HoleCardsDealt: {
        hands: {
            playerId: string;
            hand: Card[];
        }[];
    };

    LastAction: { action: LastAction };
    DeckShuffled: {};
    CurrentPlayer: { playerId: string };

    PostStraddle: { player: PlayerPublicView };
    ToggleStraddle: { player: PlayerPublicView };

    PreChecksUpdates: {
        preChecks: {
            playerId: string;
            precheck: PreChecks;
        }[];
    };

    CallAction: { player: PlayerPublicView; action: PlayerAction };
    RaiseAction: { player: PlayerPublicView; action: PlayerAction };
    BetAction: { player: PlayerPublicView; action: PlayerAction };
    CheckAction: { player: PlayerPublicView; action: PlayerAction };
    FoldAction: { player: PlayerPublicView; action: PlayerAction };
    AllInAction: { player: PlayerPublicView; action: PlayerAction };

    TogglePreCheck: { player: PlayerPublicView; precheck: PreCheck };
    PreCheckAction: { player: PlayerPublicView; action: PlayerAction };

    AutoPostBB: { player: PlayerPublicView };

    PlayerValidAction: { playerId: string; action: ValidAction[] };

    WinnerDeclared: {
        player: PlayerPublicView;
        hand: string;
        name: string;
        amount: number;
        cards: Card[];
    };

    PlayerTurnTimer: {
        playerId: string;
        timerValue: number;
        timerKey: string;
        timestamp: number;
    };

    PlayerExtraTimer: {
        playerId: string;
        timerValue: number;
        timerKey: string;
        timestamp: number;
    };

    PlayerHandStrength: {
        players: {
            playerId: string;
            handStrength: HandStrength;
        }[];
    };

    BetSizingOptions: {
        playerId: string;
        options: BetSizingOption[];
    };

    RabbitDealtCards: {
        communityCards: Card[];
    };

    TopUpChips: {
        playerId: string;
        topUpAmount: number;
        totalChips: number;
        autoTopUp: boolean;
    };

    PlayersOutOfChips: { players: PlayerPublicView[] };

    PlayerRebuy: { player: PlayerPublicView };
}

export enum WEIGHT {
    PlayerJoined = 50,
    PlayerExit = 50,
    PlayerSitOut = 50,
    PlayerSitIn = 50,
    PlayerJoinedWaitingList = 50,
    PlayerLeaveInNextHand = 50,
    PlayerLeaveNextBB = 50,
    PlayerRebuy = 50,
    TopUpChips = 50,

    HandStarted = 100,
    PotUpdates = 100,
    PlayersStatesUpdates = 100,
    WaitingPlayers = 100,
    SitoutPlayers = 100,
    PreChecksUpdates = 100,

    DealerAssigned = 110,

    CurrentRoundContribution = 120,
    PlayerHandStrength = 120,

    SmallBlindAssigned = 200,
    AutoPostBB = 200,
    TogglePreCheck = 200,

    BigBlindAssigned = 210,

    PostStraddle = 220,
    ToggleStraddle = 220,

    HoleCardsDealt = 300,
    PlayerValidAction = 300,
    CallAction = 300,
    RaiseAction = 300,
    BetAction = 300,
    CheckAction = 300,
    FoldAction = 300,
    AllInAction = 300,
    PreCheckAction = 300,
    RabbitDealtCards = 300,

    BetSizingOptions = 305,

    PlayerTurnTimer = 330,

    PlayerExtraTimer = 340,

    PreflopBegin = 400,
    FlopBegin = 400,
    TurnBegin = 400,
    RiverBegin = 400,
    Showdown = 400,
    ShowdownByFold = 400,
    PlayerLeft = 402,

    CurrentPlayer = 405,

    LastAction = 410,

    WinnerDeclared = 450,

    PlayersOutOfChips = 490,
    HandEnded = 500,
    DeckShuffled = 500,
}

export interface Mutation<T extends keyof MutationType = keyof MutationType> {
    weight: number;
    type: T;
    payload: MutationType[T];
}

export class PlayerJoined implements Mutation<"PlayerJoined"> {
    readonly type: "PlayerJoined" = "PlayerJoined";
    readonly weight = WEIGHT.PlayerJoined;
    constructor(public payload: { player: PlayerPublicView }) {}
}

export class PlayerLeft implements Mutation<"PlayerLeft"> {
    readonly type: "PlayerLeft" = "PlayerLeft";
    readonly weight = WEIGHT.PlayerLeft;
    constructor(public payload: { player: PlayerPublicView }) {}
}

export class PlayerExit implements Mutation<"PlayerExit"> {
    readonly type: "PlayerExit" = "PlayerExit";
    readonly weight = WEIGHT.PlayerExit;
    constructor(public payload: { player: PlayerPublicView }) {}
}

export class HandStarted implements Mutation<"HandStarted"> {
    readonly type: "HandStarted" = "HandStarted";
    readonly weight = WEIGHT.HandStarted;
    constructor(public payload: { round: RoundStatePublicView }) {}
}

export class DealerAssigned implements Mutation<"DealerAssigned"> {
    readonly type: "DealerAssigned" = "DealerAssigned";
    readonly weight = WEIGHT.DealerAssigned;
    constructor(public payload: { dealer: PlayerPublicView }) {}
}

export class SmallBlindAssigned implements Mutation<"SmallBlindAssigned"> {
    readonly type: "SmallBlindAssigned" = "SmallBlindAssigned";
    readonly weight = WEIGHT.SmallBlindAssigned;
    constructor(public payload: { smallBlind: PlayerPublicView }) {}
}

export class BigBlindAssigned implements Mutation<"BigBlindAssigned"> {
    readonly type: "BigBlindAssigned" = "BigBlindAssigned";
    readonly weight = WEIGHT.BigBlindAssigned;
    constructor(public payload: { bigBlind: PlayerPublicView }) {}
}

export class PostStraddle implements Mutation<"PostStraddle"> {
    readonly type: "PostStraddle" = "PostStraddle";
    readonly weight = WEIGHT.PostStraddle;
    constructor(public payload: { player: PlayerPublicView }) {}
}

export class ToggleStraddle implements Mutation<"ToggleStraddle"> {
    readonly type: "ToggleStraddle" = "ToggleStraddle";
    readonly weight = WEIGHT.ToggleStraddle;
    constructor(public payload: { player: PlayerPublicView }) {}
}

export class HoleCardsDealt implements Mutation<"HoleCardsDealt"> {
    readonly type: "HoleCardsDealt" = "HoleCardsDealt";
    readonly weight = WEIGHT.HoleCardsDealt;
    constructor(
        public payload: {
            hands: {
                playerId: string;
                hand: Card[];
            }[];
        }
    ) {}
}

export class PreflopBegin implements Mutation<"PreflopBegin"> {
    readonly type: "PreflopBegin" = "PreflopBegin";
    readonly weight = WEIGHT.PreflopBegin;
    constructor(public payload: { round: RoundStatePublicView }) {}
}

export class FlopBegin implements Mutation<"FlopBegin"> {
    readonly type: "FlopBegin" = "FlopBegin";
    readonly weight = WEIGHT.FlopBegin;
    constructor(public payload: { round: RoundStatePublicView }) {}
}

export class TurnBegin implements Mutation<"TurnBegin"> {
    readonly type: "TurnBegin" = "TurnBegin";
    readonly weight = WEIGHT.TurnBegin;
    constructor(public payload: { round: RoundStatePublicView }) {}
}

export class RiverBegin implements Mutation<"RiverBegin"> {
    readonly type: "RiverBegin" = "RiverBegin";
    readonly weight = WEIGHT.RiverBegin;
    constructor(public payload: { round: RoundStatePublicView }) {}
}

export class Showdown implements Mutation<"Showdown"> {
    readonly type: "Showdown" = "Showdown";
    readonly weight = WEIGHT.Showdown;
    constructor(
        public payload: {
            round: RoundStatePublicView;
            players: {
                id: string;
                hand: Card[];
            }[];
        }
    ) {}
}

export class ShowdownByFold implements Mutation<"ShowdownByFold"> {
    readonly type: "ShowdownByFold" = "ShowdownByFold";
    readonly weight = WEIGHT.ShowdownByFold;
    constructor(public payload: {}) {}
}

export class HandEnded implements Mutation<"HandEnded"> {
    readonly type: "HandEnded" = "HandEnded";
    readonly weight = WEIGHT.HandEnded;
    constructor(public payload: { round: RoundStatePublicView }) {}
}

export class LastActionChange implements Mutation<"LastAction"> {
    readonly type: "LastAction" = "LastAction";
    readonly weight = WEIGHT.LastAction;
    constructor(public payload: { action: LastAction }) {}
}

export class CurrentPlayer implements Mutation<"CurrentPlayer"> {
    readonly type: "CurrentPlayer" = "CurrentPlayer";
    readonly weight = WEIGHT.CurrentPlayer;
    constructor(public payload: { playerId: string }) {}
}

export class PreChecksUpdates implements Mutation<"PreChecksUpdates"> {
    readonly type: "PreChecksUpdates" = "PreChecksUpdates";
    readonly weight = WEIGHT.PreChecksUpdates;
    constructor(
        public payload: {
            preChecks: { playerId: string; precheck: PreChecks }[];
        }
    ) {}
}

export class PotUpdates implements Mutation<"PotUpdates"> {
    readonly type: "PotUpdates" = "PotUpdates";
    readonly weight = WEIGHT.PotUpdates;
    constructor(public payload: { pots: Pot[]; totalPot: number }) {}
}

export class PlayersStatesUpdates implements Mutation<"PlayersStatesUpdates"> {
    readonly type: "PlayersStatesUpdates" = "PlayersStatesUpdates";
    readonly weight = WEIGHT.PlayersStatesUpdates;
    constructor(public payload: { players: PlayerPublicView[] }) {}
}

export class DeckShuffled implements Mutation<"DeckShuffled"> {
    readonly type: "DeckShuffled" = "DeckShuffled";
    readonly weight = WEIGHT.DeckShuffled;
    constructor(public payload: {}) {}
}

export class WaitingPlayers implements Mutation<"WaitingPlayers"> {
    readonly type: "WaitingPlayers" = "WaitingPlayers";
    readonly weight = WEIGHT.WaitingPlayers;
    constructor(public payload: { players: PlayerPublicView[] }) {}
}

export class PlayerSitOut implements Mutation<"PlayerSitOut"> {
    readonly type: "PlayerSitOut" = "PlayerSitOut";
    readonly weight = WEIGHT.PlayerSitOut;
    constructor(public payload: { player: PlayerPublicView }) {}
}

export class PlayerSitIn implements Mutation<"PlayerSitIn"> {
    readonly type: "PlayerSitIn" = "PlayerSitIn";
    readonly weight = WEIGHT.PlayerSitIn;
    constructor(public payload: { player: PlayerPublicView }) {}
}

export class PlayerJoinedWaitingList implements Mutation<"PlayerJoinedWaitingList"> {
    readonly type: "PlayerJoinedWaitingList" = "PlayerJoinedWaitingList";
    readonly weight = WEIGHT.PlayerJoinedWaitingList;
    constructor(public payload: { waitingPlayers: PlayerPublicView }) {}
}

export class PlayerLeaveInNextHand implements Mutation<"PlayerLeaveInNextHand"> {
    readonly type: "PlayerLeaveInNextHand" = "PlayerLeaveInNextHand";
    readonly weight = WEIGHT.PlayerLeaveInNextHand;
    constructor(public payload: { player: PlayerPublicView }) {}
}

export class PlayerLeaveNextBB implements Mutation<"PlayerLeaveNextBB"> {
    readonly type: "PlayerLeaveNextBB" = "PlayerLeaveNextBB";
    readonly weight = WEIGHT.PlayerLeaveInNextHand;
    constructor(public payload: { player: PlayerPublicView }) {}
}

export class SitoutPlayers implements Mutation<"SitoutPlayers"> {
    readonly type: "SitoutPlayers" = "SitoutPlayers";
    readonly weight = WEIGHT.SitoutPlayers;
    constructor(public payload: { players: PlayerPublicView[] }) {}
}

export class CallAction implements Mutation<"CallAction"> {
    readonly type: "CallAction" = "CallAction";
    readonly weight = WEIGHT.CallAction;
    constructor(public payload: { player: PlayerPublicView; action: PlayerAction }) {}
}

export class RaiseAction implements Mutation<"RaiseAction"> {
    readonly type: "RaiseAction" = "RaiseAction";
    readonly weight = WEIGHT.RaiseAction;
    constructor(public payload: { player: PlayerPublicView; action: PlayerAction }) {}
}

export class BetAction implements Mutation<"BetAction"> {
    readonly type: "BetAction" = "BetAction";
    readonly weight = WEIGHT.BetAction;
    constructor(public payload: { player: PlayerPublicView; action: PlayerAction }) {}
}

export class CheckAction implements Mutation<"CheckAction"> {
    readonly type: "CheckAction" = "CheckAction";
    readonly weight = WEIGHT.CheckAction;
    constructor(public payload: { player: PlayerPublicView; action: PlayerAction }) {}
}

export class FoldAction implements Mutation<"FoldAction"> {
    readonly type: "FoldAction" = "FoldAction";
    readonly weight = WEIGHT.FoldAction;
    constructor(public payload: { player: PlayerPublicView; action: PlayerAction }) {}
}

export class AllInAction implements Mutation<"AllInAction"> {
    readonly type: "AllInAction" = "AllInAction";
    readonly weight = WEIGHT.AllInAction;
    constructor(public payload: { player: PlayerPublicView; action: PlayerAction }) {}
}

export class PreCheckAction implements Mutation<"PreCheckAction"> {
    readonly type: "PreCheckAction" = "PreCheckAction";
    readonly weight = WEIGHT.PreCheckAction;
    constructor(public payload: { player: PlayerPublicView; action: PlayerAction }) {}
}

export class AutoPostBB implements Mutation<"AutoPostBB"> {
    readonly type: "AutoPostBB" = "AutoPostBB";
    readonly weight = WEIGHT.AutoPostBB;
    constructor(public payload: { player: PlayerPublicView }) {}
}

export class TogglePreCheck implements Mutation<"TogglePreCheck"> {
    readonly type: "TogglePreCheck" = "TogglePreCheck";
    readonly weight = WEIGHT.TogglePreCheck;
    constructor(public payload: { player: PlayerPublicView; precheck: PreCheck }) {}
}

export class WinnerDeclared implements Mutation<"WinnerDeclared"> {
    readonly type: "WinnerDeclared" = "WinnerDeclared";
    readonly weight = WEIGHT.WinnerDeclared;
    constructor(
        public payload: {
            player: PlayerPublicView;
            hand: string;
            amount: number;
            name: string;
            cards: Card[];
        }
    ) {}
}

export class PlayerValidAction implements Mutation<"PlayerValidAction"> {
    readonly type: "PlayerValidAction" = "PlayerValidAction";
    readonly weight = WEIGHT.PlayerValidAction;
    constructor(public payload: { playerId: string; action: ValidAction[] }) {}
}

export class CurrentRoundContribution implements Mutation<"CurrentRoundContributions"> {
    readonly type: "CurrentRoundContributions" = "CurrentRoundContributions";
    readonly weight = WEIGHT.CurrentRoundContribution;
    constructor(
        public payload: {
            contributions: {
                playerId: string;
                chips: number;
                currentRoundContribution: number;
            }[];
        }
    ) {}
}

export class PlayerTurnTimer implements Mutation<"PlayerTurnTimer"> {
    readonly type: "PlayerTurnTimer" = "PlayerTurnTimer";
    readonly weight = WEIGHT.PlayerTurnTimer;
    constructor(
        public payload: {
            playerId: string;
            timerValue: number;
            timerKey: string;
            timestamp: number;
        }
    ) {}
}

export class PlayerExtraTimer implements Mutation<"PlayerExtraTimer"> {
    readonly type: "PlayerExtraTimer" = "PlayerExtraTimer";
    readonly weight = WEIGHT.PlayerExtraTimer;
    constructor(
        public payload: {
            playerId: string;
            timerValue: number;
            timerKey: string;
            timestamp: number;
        }
    ) {}
}

export class PlayerHandStrength implements Mutation<"PlayerHandStrength"> {
    readonly type: "PlayerHandStrength" = "PlayerHandStrength";
    readonly weight = WEIGHT.PlayerHandStrength;
    constructor(
        public payload: {
            players: {
                playerId: string;
                handStrength: HandStrength;
            }[];
        }
    ) {}
}
export class BetSizingOptions implements Mutation<"BetSizingOptions"> {
    readonly type = "BetSizingOptions";
    readonly weight = WEIGHT.BetSizingOptions;

    constructor(
        public payload: {
            playerId: string;
            options: BetSizingOption[];
        }
    ) {}
}

export class RabbitDealtCards implements Mutation<"RabbitDealtCards"> {
    readonly type = "RabbitDealtCards";
    readonly weight = WEIGHT.RabbitDealtCards;

    constructor(
        public payload: {
            communityCards: Card[];
        }
    ) {}
}

export class TopUpChips implements Mutation<"TopUpChips"> {
    readonly type = "TopUpChips";
    readonly weight = WEIGHT.TopUpChips;

    constructor(
        public payload: {
            playerId: string;
            topUpAmount: number;
            totalChips: number;
            autoTopUp: boolean;
        }
    ) {}
}

export class PlayersOutOfChips implements Mutation<"PlayersOutOfChips"> {
    readonly type: "PlayersOutOfChips" = "PlayersOutOfChips";
    readonly weight = WEIGHT.PlayersOutOfChips;
    constructor(public payload: { players: PlayerPublicView[] }) {}
}

export class PlayerRebuy implements Mutation<"PlayerRebuy"> {
    readonly type: "PlayerRebuy" = "PlayerRebuy";
    readonly weight = WEIGHT.PlayerRebuy;
    constructor(public payload: { player: PlayerPublicView }) {}
}
