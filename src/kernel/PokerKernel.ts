// Copyright (c) 2026 Poker Infra. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only
// https://github.com/pokerinfra/poker-kernel

import type {
    GameState,
    RoundState,
    RoundStatePublicView,
    RoundStage,
    Player,
    PlayerPublicView,
    PlayerHandInfo,
    PlayerAction,
    ValidAction,
    Card,
    Rank,
    Suit,
    HandStrength,
    GameVariation,
    Position,
    PreCheck,
    Mutation,
    IPreCheckHandler,
    IActionValidator,
    IValidActionProvider,
} from "../types";

import {
    PlayerJoined,
    PlayerJoinedWaitingList,
    PlayerLeft,
    PlayerExit,
    PlayerLeaveInNextHand,
    PlayerLeaveNextBB,
    PlayerSitOut,
    PlayerSitIn,
    PlayerRebuy,
    PlayersOutOfChips,
    TopUpChips,
    HandStarted,
    HandEnded,
    DealerAssigned,
    SmallBlindAssigned,
    BigBlindAssigned,
    PostStraddle,
    ToggleStraddle,
    HoleCardsDealt,
    PreflopBegin,
    FlopBegin,
    TurnBegin,
    RiverBegin,
    Showdown,
    ShowdownByFold,
    WinnerDeclared,
    RabbitDealtCards,
    CallAction,
    RaiseAction,
    BetAction,
    CheckAction,
    FoldAction,
    AllInAction,
    AutoPostBB,
    TogglePreCheck,
    PreCheckAction,
    PreChecksUpdates,
    PlayerValidAction,
    PlayerTurnTimer,
    PlayerExtraTimer,
    PlayerHandStrength,
    CurrentPlayer,
    LastActionChange,
    CurrentRoundContribution,
    PotUpdates,
    PlayersStatesUpdates,
    WaitingPlayers,
    SitoutPlayers,
} from "../types";
import { Deck } from "./helpers/Deck";
import { Hand } from "pokersolver";
import { PotManager } from "./helpers/PotManager";
import { PreCheckHandler } from "./helpers/PreCheckHandler";
import { ValidActionProvider } from "./helpers/PKActionManager";
import { CompositeActionValidator } from "./helpers/PKActionValidations";
import { ActionHandlerFactory } from "./helpers/PKActionHandler";
import { randomUUID } from "node:crypto";
import { ShowdownHandlerManager } from "./helpers/ShowdownHandler";

export class PokerKernel {
    protected state: GameState;
    private deckService: Deck = new Deck();
    private actionValidator: IActionValidator;
    protected preCheckManager: IPreCheckHandler;
    private validActionProvider: IValidActionProvider;
    private showdownManager: ShowdownHandlerManager;
    protected mutations: Mutation[];

    constructor(initialState: GameState) {
        this.state = initialState;
        this.actionValidator = new CompositeActionValidator();
        this.preCheckManager = new PreCheckHandler();
        this.validActionProvider = new ValidActionProvider();
        this.showdownManager = new ShowdownHandlerManager();
        this.mutations = [];
    }

    public getState(): GameState {
        const copy: GameState = structuredClone(this.state);
        return copy;
    }

    public canStartHand(): boolean {
        const { players, waitingPlayers, sitOutPlayers, config, round } = this.state;

        if (round.stage !== "ended" && round.stage !== "waiting") {
            return false;
        }

        let activePlayersCount = 0;

        activePlayersCount += players.filter((p) => !p.leaveNextHand && !p.sitOut).length;

        activePlayersCount += sitOutPlayers.filter((p) => !p.sitOut).length;

        if (waitingPlayers.length > 0) {
            const totalSeatsAfterLeavers =
                config.maxPlayers -
                players.filter((p) => p.leaveNextHand || p.leaveBB).length -
                sitOutPlayers.filter((p) => p.sitOut).length -
                this.state.outOfChipsPlayers.length;

            const availableSeats = Math.max(0, totalSeatsAfterLeavers - activePlayersCount);

            activePlayersCount += Math.min(waitingPlayers.length, availableSeats);
        }

        return activePlayersCount >= config.minPlayers;
    }

    public beginHand(): Mutation[] {
        this.resetHandState();

        this.rotateDealer();

        this.processWaitingPlayers();

        if (this.state.players.length < this.state.config.minPlayers) {
            this.state.round.stage = "waiting";
            throw new Error(`Not enough players to start the hand.`);
        }

        this.onBeforeDealHoleCards();

        this.dealHoleCards();
        this.updateOpeningBalance();
        const holeCards = this.state.players.map((player) => ({
            playerId: player.id,
            hand: player.hand,
        }));
        this.mutations.push(new HoleCardsDealt({ hands: holeCards }));

        this.postBlinds();

        this.postStraddle();

        {
            const blindActivePlayers = this.getActivePlayers();
            const maxContrib = Math.max(
                ...blindActivePlayers.map((p) => p.currentRoundContribution),
                0
            );
            const anyoneNeedsToAct = blindActivePlayers.some(
                (p) => p.chips > 0 && p.currentRoundContribution < maxContrib
            );
            if (!anyoneNeedsToAct) {
                this.state.round.currentPlayer = "";
                this.mutations.push(new CurrentPlayer({ playerId: "" }));
                this.advanceStage();
                this.mutations.sort((a, b) => a.weight - b.weight);
                return this.mutations;
            }
        }

        this.addPotUpdateStateChage();

        this.preCheckManager.updatePreChecks(this.state);

        this.updatePositions();
        this.addPrecheckMutations();
        this.updatePlayersHandStrength();

        if (
            this.state.round.currentPlayer &&
            this.state.round.currentPlayer !== "" &&
            this.state.players.length >= this.state.config.minPlayers
        ) {
            const actions = this.getLegalActions(this.state.round.currentPlayer);
            this.mutations.push(
                new PlayerValidAction({
                    playerId: this.state.round.currentPlayer,
                    action: actions,
                })
            );
        }

        this.mutations.push(
            new SitoutPlayers({
                players: this.state.sitOutPlayers.map((p) => this.toPublicView(p)),
            })
        );
        this.mutations.push(
            new WaitingPlayers({
                players: this.state.waitingPlayers.map((p) => {
                    return this.toPublicView(p);
                }),
            })
        );
        this.addContributionMutation();
        const timerKey = randomUUID();
        const timerstamp = Date.now();
        const player = this.state.players.find((p) => p.id === this.state.round.currentPlayer);
        if (player) {
            this.mutations.push(
                new PlayerTurnTimer({
                    playerId: this.state.round.currentPlayer,
                    timerKey: timerKey,
                    timerValue: this.state.turnTimer || 30,
                    timestamp: timerstamp,
                })
            );
        }
        this.mutations.sort((a, b) => a.weight - b.weight);
        return this.mutations;
    }

    public applyAction(playerId: string, action: PlayerAction): Mutation[] {
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player) throw new Error(`Player with playerId ${playerId} not found.`);

        if (!this.actionValidator.validate(player, action, this.state))
            throw new Error(`Invalid action.`);

        this.processPlayerAction(player, action);

        const stageBefore = this.state.round.stage;

        this.updateLastAction(player, action);

        if (this.state.round.stage === "ended") {
            this.mutations.sort((a, b) => a.weight - b.weight);
            return this.mutations;
        }

        this.processPreCheckedActions();

        const stageAfter = this.state.round.stage;
        const stageTransitioned = stageBefore !== stageAfter;

        if (!stageTransitioned) {
            this.preCheckManager.updatePreChecks(this.state);
            this.addPrecheckMutations();
        }

        if (
            this.state.round.currentPlayer &&
            this.state.round.currentPlayer !== "" &&
            this.state.players.length >= this.state.config.minPlayers
        ) {
            const actions = this.getLegalActions(this.state.round.currentPlayer);
            this.mutations.push(
                new PlayerValidAction({
                    playerId: this.state.round.currentPlayer,
                    action: actions,
                })
            );
        }
        const timerKey = randomUUID();
        const timestamp = Date.now();

        const playerToMove = this.state.players.find(
            (p) => p.id === this.state.round.currentPlayer
        );

        if (playerToMove) {
            this.mutations.push(
                new PlayerTurnTimer({
                    playerId: this.state.round.currentPlayer,
                    timerKey: timerKey,
                    timerValue: this.state.turnTimer || 30,
                    timestamp: timestamp,
                })
            );
            this.mutations.push(
                new PlayerExtraTimer({
                    playerId: this.state.round.currentPlayer,
                    timerKey: timerKey,
                    timerValue: (this.state.extraTimer || 0) + (playerToMove.timeBank || 0) || 30,
                    timestamp: timestamp,
                })
            );
        }

        if (!stageTransitioned) {
            this.addContributionMutation();
            this.addPotUpdateStateChage();
        }
        this.mutations.sort((a, b) => a.weight - b.weight);
        return this.mutations;
    }

    public revealRemainingBoard(): Mutation[] {
        if (this.state.round.stage === "ended" && this.state.round.communityCards.length < 5) {
            this.dealCommunityCards(5 - this.state.round.communityCards.length);
        }

        const isRabbitWindow =
            this.state.round.stage === "ended" ||
            (this.state.round.stage === "waiting" && this.state.round.communityCards.length === 5);

        if (isRabbitWindow && this.state.round.communityCards.length > 0) {
            this.mutations.push(
                new RabbitDealtCards({
                    communityCards: this.state.round.communityCards,
                })
            );
        }
        return this.mutations;
    }

    public addPlayer(
        player: Pick<Player, "id" | "isAutoPostBB" | "chips" | "profile"> & {
            desiredSeat: number;
        }
    ): Mutation[] {
        const { players, waitingPlayers, config, round, sitOutPlayers, outOfChipsPlayers } =
            this.state;
        if ([...players, ...waitingPlayers].some((p) => p.id === player.id)) {
            throw new Error(`Player with id '${player.id}' already exists.`);
        }

        const { desiredSeat } = player;
        if (
            desiredSeat == null ||
            isNaN(desiredSeat) ||
            desiredSeat < 1 ||
            desiredSeat > config.maxPlayers
        ) {
            throw new Error(`Seat number must be between 1 and ${config.maxPlayers}.`);
        }

        const occupiedSeats = new Set(
            [...players, ...waitingPlayers, ...sitOutPlayers, ...outOfChipsPlayers].map(
                (p) => p.seat
            )
        );

        if (occupiedSeats.has(desiredSeat)) {
            throw new Error(`Seat ${desiredSeat} is already taken.`);
        }

        if (player.chips < config.buyIn.min || player.chips > config.buyIn.max) {
            throw new Error(
                `Buy-in (${player.chips}) must be between ${config.buyIn.min} and ${config.buyIn.max}.`
            );
        }

        let { desiredSeat: seat, ...playerData } = player;
        const newPlayer: Player = {
            ...playerData,
            hand: [],
            isActive: false,
            contributedToPot: 0,
            currentRoundContribution: 0,
            isAutoPostBB: player.isAutoPostBB ?? this.state.config.autoPostBB,
            seat: desiredSeat,
            leaveNextHand: false,
            leaveHand: false,
            hasActed: false,
            preChecks: [],
            straddle: false,
            sitOut: false,
            profile: player.profile,
            handStrength: null,
            timeBank: 0,
            position: "N/A",
            openingBalance: player.chips,
            autoTopUp: false,
            leaveBB: false,
            rit: false,
        };

        if (round.stage === "waiting" && players.length < config.maxPlayers) {
            players.push(newPlayer);
            this.state.players = this.sortBySeat(players);

            const publicReturnPlayer = this.toPublicView(newPlayer);
            this.mutations.push(
                new PlayerJoined({
                    player: publicReturnPlayer,
                })
            );
        } else {
            waitingPlayers.push(newPlayer);
            this.state.waitingPlayers = this.sortBySeat(waitingPlayers);
            const publicReturnPlayer = this.toPublicView(newPlayer);

            this.mutations.push(
                new PlayerJoinedWaitingList({
                    waitingPlayers: publicReturnPlayer,
                })
            );
        }

        this.mutations.sort((a, b) => a.weight - b.weight);
        return this.mutations;
    }

    public removePlayer(playerId: string): Mutation[] {
        let player;

        player = this.state.sitOutPlayers.find((p) => p.id === playerId);

        if (player) {
            this.state.sitOutPlayers = this.state.sitOutPlayers.filter((p) => p.id !== playerId);

            const playerReturnValue = this.toPublicView(player);
            this.mutations.push(new PlayerLeft({ player: playerReturnValue }));
            return this.mutations;
        }

        player = this.state.outOfChipsPlayers.find((p) => p.id === playerId);

        if (player) {
            this.state.outOfChipsPlayers = this.state.outOfChipsPlayers.filter(
                (p) => p.id !== playerId
            );

            const playerReturnValue = this.toPublicView(player);
            this.mutations.push(new PlayerLeft({ player: playerReturnValue }));
            return this.mutations;
        }

        player = this.state.waitingPlayers.find((p) => p.id === playerId);

        if (player) {
            this.state.waitingPlayers = this.state.waitingPlayers.filter((p) => p.id !== playerId);

            const playerReturnValue = this.toPublicView(player);
            this.mutations.push(new PlayerLeft({ player: playerReturnValue }));
            return this.mutations;
        }

        if (this.state.round.stage !== "ended" && this.state.round.stage !== "waiting") {
            throw new Error(`Player cannot leave during a hand.`);
        }

        player = this.state.players.find((p) => p.id === playerId);
        if (!player) throw new Error(`Player with playerId ${playerId} not found.`);

        this.state.players = this.state.players.filter((p) => p.id !== playerId);

        const playerReturnValue = this.toPublicView(player);
        this.mutations.push(new PlayerLeft({ player: playerReturnValue }));

        return this.mutations;
    }

    public requestExit(playerId: string) {
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player) throw new Error(`Player with playerId = ${playerId} not found`);

        if (["ended", "showdown", "waiting"].includes(this.state.round.stage)) {
            this.state.players = this.state.players.filter((player) => player.id !== playerId);

            const playerReturnValue = this.toPublicView(player);
            this.mutations.push(new PlayerLeft({ player: playerReturnValue }));
            this.mutations.sort((a, b) => a.weight - b.weight);
            return this.mutations;
        }

        player.leaveHand = !player.leaveHand;

        if (
            !player.leaveNextHand &&
            !["ended", "showdown", "waiting"].includes(this.state.round.stage)
        ) {
            player.leaveNextHand = !player.leaveNextHand;
        }

        if (!player.leaveHand && player.leaveNextHand) {
            player.leaveNextHand = false;
            const playerPublicView = this.toPublicView(player);
            this.mutations.push(new PlayersStatesUpdates({ players: [playerPublicView] }));
        }

        if (this.state.round.currentPlayer === playerId && player.chips !== 0) {
            const validActions = this.getLegalActions(playerId);
            const canCheck = validActions.some((a) => a.type === "check");
            this.applyAction(playerId, { type: canCheck ? "check" : "fold" });
        }

        const stillSeated = this.state.players.some((p) => p.id === playerId);
        if (stillSeated) {
            const playerReturnValue = this.toPublicView(player);
            this.mutations.push(new PlayerExit({ player: playerReturnValue }));
        }
        this.mutations.sort((a, b) => a.weight - b.weight);
        return this.mutations;
    }

    public addChips(playerId: string, chips: number, autoTopUp: boolean): Mutation[] {
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player) throw new Error(`Player with playerId = ${playerId} not found`);
        if (!this.canPlayerAddChips(player, chips)) return this.mutations;

        if (player.chips >= this.state.config.buyIn.max) {
            throw new Error(`Top-up Not Possible`);
        }

        const range =
            player.chips > this.state.config.buyIn.min && player.chips < this.state.config.buyIn.max
                ? { min: 1, max: this.state.config.buyIn.max - player.chips }
                : {
                      min: Math.max(this.state.config.buyIn.min - player.chips, 1),
                      max: this.state.config.buyIn.max - player.chips,
                  };

        if (chips < range.min || chips > range.max) throw new Error(`Invalid Top-up Amount`);

        player.autoTopUp = autoTopUp;
        player.chips = player.chips + chips;

        this.mutations.push(
            new TopUpChips({
                playerId: playerId,
                topUpAmount: chips,
                totalChips: player.chips,
                autoTopUp: autoTopUp || false,
            })
        );

        return this.mutations;
    }

    public rebuy(playerId: string, chips: number): Mutation[] {
        const player = this.state.outOfChipsPlayers.find((p) => p.id === playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found in out-of-chips list.`);
        }
        if (!this.canPlayerRebuy(player, chips)) return this.mutations;

        const { buyIn } = this.state.config;
        if (chips < buyIn.min || chips > buyIn.max) {
            throw new Error(
                `Rebuy amount (${chips}) must be between ${buyIn.min} and ${buyIn.max}.`
            );
        }

        player.chips = chips;
        this.state.outOfChipsPlayers = this.state.outOfChipsPlayers.filter(
            (p) => p.id !== playerId
        );

        const rest = this.toPublicView(player);

        if (this.state.config.rebuyMode === "auto") {
            this.state.players.push(player);
            this.state.players = this.sortBySeat(this.state.players);
        } else {
            this.state.waitingPlayers.push(player);
            this.state.waitingPlayers = this.sortBySeat(this.state.waitingPlayers);
            this.mutations.push(new PlayerJoinedWaitingList({ waitingPlayers: rest }));
        }

        this.mutations.push(new PlayerRebuy({ player: rest }));
        return this.mutations;
    }

    public toggleStraddle(playerId: string): Mutation[] {
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player || this.state.config.straddle !== "Optional")
            throw new Error(
                `Player with playerId ${playerId} not found or straddle is not optional.`
            );

        player.straddle = !player.straddle;
        const rest = this.toPublicView(player);
        this.mutations.push(new ToggleStraddle({ player: rest }));
        return this.mutations;
    }

    public toggleSitOut(playerId: string): Mutation[] {
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player) throw new Error(`Player ${playerId} not found.`);
        if (!this.canPlayerSitOut(player)) return this.mutations;
        player.sitOut = !player.sitOut;
        const rest = this.toPublicView(player);
        this.mutations.push(new PlayerSitOut({ player: rest }));
        return this.mutations;
    }

    public toggleSitIn(playerId: string): Mutation[] {
        const player = this.state.sitOutPlayers.find((p) => p.id === playerId);
        if (!player) throw new Error(`Player ${playerId} not found in sit-out list.`);
        player.sitOut = !player.sitOut;
        const rest = this.toPublicView(player);
        this.mutations.push(new PlayerSitIn({ player: rest }));
        return this.mutations;
    }

    public toggleAutoPostBB(playerId: string): Mutation[] {
        const players = [...this.state.waitingPlayers, ...this.state.sitOutPlayers];
        const player = players.find((p) => p.id === playerId);

        if (!player) {
            throw new Error("Player not found");
        }
        if (this.isNaturalBB(player)) {
            throw new Error("Cannot toggle auto-post for natural big blind");
        }

        player.isAutoPostBB = !player.isAutoPostBB;
        const rest = this.toPublicView(player);
        this.mutations.push(new AutoPostBB({ player: rest }));
        return this.mutations;
    }

    public toggleLeaveAfterHand(playerId: string): Mutation[] {
        const { players } = this.state;
        let player = players.find((player) => player.id === playerId);
        if (!player) throw new Error(`Player ${playerId} not found.`);
        if (!this.canPlayerLeave(player)) return this.mutations;

        player.leaveNextHand = !player.leaveNextHand;
        const playerReturnValue = this.toPublicView(player);
        this.mutations.push(new PlayerLeaveInNextHand({ player: playerReturnValue }));
        return this.mutations;
    }

    public toggleLeaveAfterBB(playerId: string): Mutation[] {
        let player = this.state.players.find((player) => player.id === playerId);
        if (!player) throw new Error(`Player with ${playerId} not found.`);
        if (!this.canPlayerLeave(player)) return this.mutations;
        player.leaveBB = !player.leaveBB;
        const playerReturnValue = this.toPublicView(player);
        this.mutations.push(new PlayerLeaveNextBB({ player: playerReturnValue }));
        return this.mutations;
    }

    public toggleRunItTwice(playerId: string) {
        const player = this.state.players.find((p) => p.id === playerId);
        if (!player) return false;
        player.rit = !player.rit;
    }

    public setPreCheck(playerId: string, selectedPreCheck: PreCheck): Mutation[] {
        this.preCheckManager.togglePreCheck(playerId, selectedPreCheck, this.state);
        const player = this.state.players.find((p) => p.id === playerId);
        const rest = this.toPublicView(player!);
        this.mutations.push(
            new TogglePreCheck({
                player: rest,
                precheck: selectedPreCheck,
            })
        );

        return this.mutations;
    }

    public getLegalActions(playerId: string): ValidAction[] {
        return this.validActionProvider.getValidActions(playerId, this.state);
    }

    public getHandStrengths(revealAll: boolean = false): PlayerHandInfo[] {
        const result: PlayerHandInfo[] = [];

        const communityCards = this.state.round.communityCards;
        const isShowdown = this.state.round.stage === "showdown";

        this.state.players.forEach((player) => {
            if (!player.isActive && !isShowdown) {
                result.push({
                    playerId: player.id,
                    handStrength: null,
                    currentHand: [],
                });
                return;
            }

            const shouldShow =
                isShowdown || revealAll || player.id === this.state.round.currentPlayer;

            const handStrength = shouldShow
                ? this.calculateHandStrength(player.hand, communityCards, this.state.gameVariant)
                : null;

            result.push({
                playerId: player.id,
                handStrength,
                currentHand: shouldShow ? player.hand : [],
            });
        });

        return result;
    }

    protected resetHandState(): void {
        this.state.round = {
            stage: "preflop",
            communityCards: [],
            currentPlayer: "",
            lastAction: undefined,
            deck: [],
            hasRaised: false,
            lastRaiseAmount: undefined,
        };

        const roundState: RoundStatePublicView = {
            stage: this.state.round.stage,
            communityCards: this.state.round.communityCards,
            currentPlayer: this.state.round.currentPlayer,
        };

        this.mutations.push(new HandStarted({ round: roundState }));
        this.addRoundMutation(this.state.round);

        this.state.pots = [];

        this.state.players = this.state.players.map((player) => ({
            ...player,
            hand: [],
            contributedToPot: 0,
            currentRoundContribution: 0,
            isActive: true,
            hasActed: false,
            handStrength: null,
        }));

        this.mutations.push(
            new PlayersStatesUpdates({
                players: this.state.players.map((p) => this.toPublicView(p)),
            })
        );
    }

    private rotateDealer(): void {
        const { players, dealerPosition } = this.state;

        const sortedPlayers = this.sortBySeat(players);

        const rotated = this.rotateBySeat(sortedPlayers, dealerPosition + 1);

        const nextDealer = rotated.find((p) => p.isActive);

        if (nextDealer) {
            const rest = this.toPublicView(nextDealer);

            this.mutations.push(new DealerAssigned({ dealer: rest }));

            this.state.dealerPosition = nextDealer.seat;
        }
    }

    private updateOpeningBalance(): void {
        this.state.players = this.state.players.map((player) => {
            return {
                ...player,
                openingBalance: player.chips,
            };
        });
    }

    private updatePositions(): void {
        const { dealerPosition, players } = this.state;

        if (players.length === 2) {
            players.forEach((player) => {
                if (player.seat === dealerPosition) {
                    player.position = "Dealer";
                } else {
                    player.position = "BB";
                }
            });
        } else {
            const sorted = [...players].sort((a, b) => a.seat - b.seat);

            const dealerIndex = sorted.findIndex((p) => p.seat === dealerPosition);

            const rotated = [...sorted.slice(dealerIndex), ...sorted.slice(0, dealerIndex)];

            const positions: Position[] = [
                "Dealer",
                "SB",
                "BB",
                "UTG",
                "UTG +1",
                "MP",
                "LJ",
                "HJ",
                "CO",
            ];

            rotated.forEach((player, idx) => {
                player.position = positions[idx] || "N/A";
            });
        }
    }

    private dealHoleCards(): void {
        const { players, dealerPosition } = this.state;
        const deckService =
            this.state.round.deck.length > 0
                ? new Deck(this.state.round.deck)
                : new Deck();

        if (this.state.round.deck.length === 0) {
            deckService.shuffle();
        }

        const sorted = this.sortBySeat(players);
        const dealingOrder = this.rotateBySeat(sorted, dealerPosition + 1);

        const recipients = dealingOrder.filter((p) => p.isActive);

        for (const player of recipients) {
            player.hand = deckService.drawCards(this.getHoleCardCount(this.state.gameVariant));
        }

        this.state.round.deck = deckService.remainingCards;

        this.state.round.currentPlayer = this.determineFirstPlayer();
    }

    private getHoleCardCount(variant: GameVariation): number {
        switch (variant) {
            case "PLO6":
                return 6;
            case "PLO5":
                return 5;
            case "PLO":
                return 4;
            case "NLH":
                return 2;
            default:
                return 2;
        }
    }

    private determineFirstPlayer(): string {
        const { players, dealerPosition } = this.state;
        const activePlayers = this.sortBySeat(players).filter((p) => p.isActive);

        if (activePlayers.length < 2) throw new Error("Not enough players");

        const dealerIndex = activePlayers.findIndex((p) => p.seat === dealerPosition);

        if (activePlayers.length <= 3) {
            return dealerIndex >= 0 ? activePlayers[dealerIndex].id : activePlayers[0].id;
        }

        const firstToActIndex = (dealerIndex + 3) % activePlayers.length;

        return activePlayers[firstToActIndex].id;
    }

    protected postBlinds(): void {
        const { players, config } = this.state;

        const activePlayers = players.filter((p) => p.isActive);

        if (activePlayers.length < 2) return;

        const sortedPlayers = this.sortBySeat(players);
        const rotated = this.rotateBySeat(
            sortedPlayers,
            sortedPlayers.length > 2 ? this.state.dealerPosition + 1 : this.state.dealerPosition
        );
        this.postBlind(rotated[0], config.blinds.small);
        const smallBlind = this.toPublicView(rotated[0]);
        this.mutations.push(new SmallBlindAssigned({ smallBlind: smallBlind }));
        this.postBlind(rotated[1], config.blinds.big);
        const bigBlind = this.toPublicView(rotated[1]);
        this.mutations.push(new BigBlindAssigned({ bigBlind: bigBlind }));

        this.state.round.lastAction = {
            playerId: rotated[1].id,
            action: {
                type: "bet",
                amount: rotated[1].currentRoundContribution,
            },
        };

        this.mutations.push(new LastActionChange({ action: this.state.round.lastAction }));

        this.state.round.currentPlayer = rotated.length > 2 ? rotated[2].id : rotated[0].id;
        this.mutations.push(new CurrentPlayer({ playerId: this.state.round.currentPlayer }));
    }

    private postBlind(player: Player, amount: number): void {
        const actualAmount = Math.min(amount, player.chips);

        player.chips -= actualAmount;
        player.currentRoundContribution += actualAmount;

        this.state.round.lastAction = {
            playerId: player.id,
            action: { type: "bet", amount: actualAmount },
        };
    }

    private postStraddle(): void {
        const { config } = this.state;
        if (this.getActivePlayers().length < 4) return;

        const bbPlayer = this.getBigBlindPlayer();
        if (!bbPlayer) throw new Error(`Big bling player not found`);

        const straddlePosition = (bbPlayer.seat % this.state.config.maxPlayers) + 1;
        const straddlePlayer = this.state.players.find(
            (p) => p.seat === straddlePosition && p.isActive && p.chips > 0
        );
        if (!straddlePlayer) return;

        const straddleAmount = config.blinds.big * 2;
        const shouldStraddle =
            config.straddle === "Mandatory" ||
            (config.straddle === "Optional" && straddlePlayer.straddle);

        if (!shouldStraddle) return;

        if (straddlePlayer.chips >= straddleAmount) {
            this.postBlind(straddlePlayer, straddleAmount);
            this.moveToNextPlayer();
            const straddler = this.toPublicView(straddlePlayer);
            this.mutations.push(new PostStraddle({ player: straddler }));
        } else if (straddlePlayer.chips > 0) {
            const processsor = ActionHandlerFactory.getProcessor("all-in");
            processsor?.process(
                straddlePlayer,
                {
                    type: "all-in",
                    amount: straddlePlayer.chips,
                },
                this.state
            );
            const straddler = this.toPublicView(straddlePlayer);
            this.mutations.push(new PostStraddle({ player: straddler }));
        }

        straddlePlayer.straddle = false;
    }

    private processWaitingPlayers(): void {
        const { sitOutPlayers, waitingPlayers, dealerPosition } = this.state;
        const activePlayers = this.sortBySeat(this.getActivePlayers());
        const sortedSitOutPlayers = this.sortBySeat(sitOutPlayers).filter((p) => !p.sitOut);
        const sortedWaitingPlayers = this.sortBySeat([...waitingPlayers, ...sortedSitOutPlayers]);

        const combinedPlayers = [...activePlayers, ...sortedWaitingPlayers];
        const { sb, bb } = this.calculateBlindPositions(combinedPlayers, dealerPosition);

        const processedPlayers: Player[] = [];

        for (const player of sortedWaitingPlayers) {
            const isNaturalBB = player.seat === bb.seat;
            const isSB = player.seat === sb.seat;

            if (!player.isAutoPostBB) {
                if (isNaturalBB) {
                    this.addPlayerToGame(player);
                    const rest = this.toPublicView(player);
                    this.mutations.push(new PlayerJoined({ player: rest }));
                }
                continue;
            }

            if (!isSB) {
                this.addPlayerToGame(player);
                const rest = this.toPublicView(player);
                this.mutations.push(new PlayerJoined({ player: rest }));
            }
        }
    }

    protected processSitOutPlayers(): void {
        const [activePlayers, sittingOutPlayers] = this.state.players.reduce<[Player[], Player[]]>(
            ([active, sitOut], player) => {
                if (player.sitOut) {
                    sitOut.push(player);
                    return [active, sitOut];
                }
                active.push(player);
                return [active, sitOut];
            },
            [[], []]
        );

        if (sittingOutPlayers.length > 0) {
            this.state.players = activePlayers;
            this.state.sitOutPlayers = [...this.state.sitOutPlayers, ...sittingOutPlayers];
            this.mutations.push(
                new SitoutPlayers({
                    players: sittingOutPlayers.map((p) => this.toPublicView(p)),
                })
            );
        }
    }

    protected processEmptyStackPlayers(): void {
        const emptyStackPlayers = this.state.players.filter((p) => p.chips === 0);
        if (emptyStackPlayers.length === 0) return;

        this.state.players = this.state.players.filter((p) => p.chips > 0);
        this.state.outOfChipsPlayers = [...this.state.outOfChipsPlayers, ...emptyStackPlayers];

        this.mutations.push(
            new PlayersOutOfChips({
                players: emptyStackPlayers.map((p) => this.toPublicView(p)),
            })
        );
    }

    private playersReadyToLeave(): void {
        const leavingPlayers: PlayerPublicView[] = [];

        this.state.players = this.state.players.filter((player) => {
            if (player.leaveNextHand) {
                const playerPublic = this.toPublicView(player);
                leavingPlayers.push(playerPublic);
                return false;
            }
            return true;
        });

        if (leavingPlayers.length > 0) {
            leavingPlayers.forEach((player) => {
                this.mutations.push(new PlayerLeft({ player }));
            });
        }
    }

    private processLeaveBBAtHandEnd(skipLeaveBBAsDealer: boolean = false): void {
        let cloneState = structuredClone(this.state);

        if (cloneState.players.length < cloneState.config.minPlayers) return;

        let check = true;

        while (check) {
            if (cloneState.players.length < cloneState.config.minPlayers) break;

            const sorted = this.sortBySeat(cloneState.players);
            const rotated = this.rotateBySeat(sorted, cloneState.dealerPosition + 1);
            const nextDealer = skipLeaveBBAsDealer
                ? rotated.find((p) => !p.leaveNextHand && !p.sitOut && !p.leaveBB)
                : rotated.find((p) => !p.leaveNextHand && !p.sitOut);

            if (!nextDealer) break;

            const nextDealerPosition = nextDealer.seat;

            const { bb } = this.calculateBlindPositions(cloneState.players, nextDealerPosition);

            if (!bb) break;

            if (bb.leaveBB) {
                this.state.players = this.state.players.filter((p) => p.id !== bb.id);

                const rest = this.toPublicView(bb);
                this.mutations.push(new PlayerLeft({ player: rest }));

                this.processSitOutPlayers();
                this.processWaitingPlayers();

                cloneState = structuredClone(this.state);
            } else {
                check = false;
            }
        }
    }

    private addPlayerToGame(player: Player): void {
        this.state.players.push({
            ...player,
            isActive: true,
        });
        this.state.waitingPlayers = this.state.waitingPlayers.filter((wp) => wp.id !== player.id);
        this.state.sitOutPlayers = this.state.sitOutPlayers.filter((sp) => sp.id !== player.id);
    }

    private calculateBlindPositions(
        players: Player[],
        dealerPosition: number
    ): { sb: Player; bb: Player } {
        const rotated =
            players.length > 2
                ? this.rotateBySeat(players, dealerPosition + 1)
                : this.rotateBySeat(players, dealerPosition);

        return {
            sb: rotated[0],
            bb: rotated[1],
        };
    }

    private getBigBlindPlayer(): Player | undefined {
        const activePlayers = this.sortBySeat(this.getActivePlayers());
        if (activePlayers.length < 2) return undefined;

        const dealerIndex = activePlayers.findIndex((p) => p.seat === this.state.dealerPosition);
        const bbIndex = (dealerIndex + 2) % activePlayers.length;
        return activePlayers[bbIndex];
    }

    private isNaturalBB(player: Player): boolean {
        const { dealerPosition } = this.state;
        const activePlayers = this.sortBySeat(this.getActivePlayers());
        const combined = [
            ...activePlayers,
            ...this.sortBySeat([...this.state.waitingPlayers, ...this.state.sitOutPlayers]),
        ];
        const { bb } = this.calculateBlindPositions(combined, dealerPosition);

        return player.seat === bb.seat;
    }

    private sortBySeat(players: Player[]): Player[] {
        if (players.length < 0) return [];
        return [...players].sort((a, b) => a.seat - b.seat);
    }

    private rotateBySeat(players: Player[], startSeat: number): Player[] {
        const sortedPlayers = this.sortBySeat(players);
        const index = sortedPlayers.findIndex((p) => p.seat >= startSeat);
        if (index === -1) return sortedPlayers;
        return [...sortedPlayers.slice(index), ...sortedPlayers.slice(0, index)];
    }

    private getActivePlayers(): Player[] {
        return this.state.players.filter((p) => p.isActive);
    }

    private processPlayerAction(player: Player, action: PlayerAction): void {
        player.hasActed = true;

        const processor = ActionHandlerFactory.getProcessor(action.type);
        if (processor) {
            processor.process(player, action, this.state);
            this.addActionMutation(player, action);
        }
    }

    private processPreCheckedActions(): void {
        if (this.state.round.stage === "ended") return;
        if (this.isBettingRoundComplete()) return;

        const currentPlayer = this.state.players.find(
            (p) => p.id === this.state.round.currentPlayer
        );

        if (!currentPlayer) throw new Error(`Current player not found.`);

        const preCheckAction = this.preCheckManager.getValidPreCheckAction(
            currentPlayer,
            this.state
        );

        const rest = this.toPublicView(currentPlayer);

        if (preCheckAction) {
            this.mutations.push(
                new PreCheckAction({
                    player: rest,
                    action: preCheckAction,
                })
            );
            this.applyPreCheckAction(currentPlayer, preCheckAction);
        }
    }

    private applyPreCheckAction(player: Player, action: PlayerAction): void {
        player.preChecks = player.preChecks.map((p) =>
            p.type === action.type ? { ...p, enable: false } : p
        );

        if (!this.actionValidator.validate(player, action, this.state)) {
            throw new Error(`Invalid pre-check action.`);
        }

        this.processPlayerAction(player, action);
        this.updateLastAction(player, action);

        this.processPreCheckedActions();
    }

    private updateLastAction(player: Player, action: PlayerAction): void {
        this.state.round.lastAction = {
            playerId: player.id,
            action:
                action.type === "call" ||
                action.type === "bet" ||
                action.type === "raise" ||
                action.type === "all-in"
                    ? { type: action.type, amount: action.amount! }
                    : { type: action.type },
        };

        this.mutations.push(new LastActionChange({ action: this.state.round.lastAction }));

        const activePlayers = this.getActivePlayers();
        const allInPlayers = activePlayers.filter((p) => p.chips === 0);
        if (
            (allInPlayers.length === activePlayers.length - 1 ||
                allInPlayers.length === activePlayers.length) &&
            action.type === "call"
        ) {
            const remainingCards = 5 - this.state.round.communityCards.length;
            if (remainingCards > 0) {
                this.dealCommunityCards(remainingCards);
                this.updatePlayersHandStrength();
            }
            this.state.round.stage = "showdown";
            this.addRoundMutation(this.state.round);
            this.state.pots = PotManager.createPots(this.state);
            this.addPotUpdateStateChage();
            this.addContributionMutation();
            this.determineWinner();
            return;
        }

        this.isBettingRoundComplete() ? this.advanceStage() : this.moveToNextPlayer();
    }

    private moveToNextPlayer(): void {
        const currentStage = this.state.round.stage;
        const sorted = this.sortBySeat(this.state.players);

        if (currentStage !== "preflop") {
            const currentIndex = sorted.findIndex((p) => p.id === this.state.round.currentPlayer);

            let start = currentIndex === -1 ? 0 : currentIndex + 1;

            for (let i = 0; i < sorted.length; i++) {
                const idx = (start + i) % sorted.length;
                const candidate = sorted[idx];

                if (candidate.isActive && candidate.chips > 0) {
                    this.state.round.currentPlayer = candidate.id;
                    this.mutations.push(new CurrentPlayer({ playerId: candidate.id }));
                    return;
                }
            }

            this.state.round.currentPlayer = "";
            this.mutations.push(new CurrentPlayer({ playerId: "" }));
            return;
        }

        const dealer = sorted.find((p) => p.seat === this.state.dealerPosition);
        if (!dealer) return;

        const { sb, bb } = this.calculateBlindPositions(sorted, dealer.seat);
        let order: Player[] = [];

        if (sorted.length === 2) {
            const dealerIsSB = sb.id === dealer.id;
            order = dealerIsSB ? [dealer, bb] : [bb, dealer];
        } else if (sorted.length === 3) {
            order = [dealer, sb, bb];
        } else {
            const rotated = this.rotateBySeat(sorted, bb.seat + 1);
            order = [...rotated];
        }

        const alive = order.filter((p) => p.isActive && p.chips > 0);

        if (alive.length === 0) {
            this.state.round.currentPlayer = "";
            this.mutations.push(new CurrentPlayer({ playerId: "" }));
            return;
        }

        const currentIndex = order.findIndex((p) => p.id === this.state.round.currentPlayer);

        let startIndex = currentIndex === -1 ? 0 : currentIndex + 1;

        for (let i = 0; i < order.length; i++) {
            const idx = (startIndex + i) % order.length;
            const candidate = order[idx];

            if (candidate.isActive && candidate.chips > 0) {
                this.state.round.currentPlayer = candidate.id;
                this.mutations.push(new CurrentPlayer({ playerId: candidate.id }));
                return;
            }
        }

        this.state.round.currentPlayer = "";
        this.mutations.push(new CurrentPlayer({ playerId: "" }));
    }

    private isBettingRoundComplete(): boolean {
        const activePlayers = this.getActivePlayers();

        if (activePlayers.length <= 1) {
            this.mutations.push(new ShowdownByFold({}));
            return true;
        }

        const allPlayersActed = activePlayers.every(
            (player) => player.hasActed || player.chips === 0
        );

        if (!allPlayersActed) return false;

        const maxContribution = Math.max(...activePlayers.map((p) => p.currentRoundContribution));

        return activePlayers.every(
            (player) => player.currentRoundContribution === maxContribution || player.chips === 0
        );
    }

    private getNextStage(current: RoundStage): RoundStage {
        const progression: Record<RoundStage, RoundStage> = {
            waiting: "preflop",
            preflop: "flop",
            flop: "turn",
            turn: "river",
            river: "showdown",
            showdown: "ended",
            ended: "ended",
        };
        return progression[current];
    }

    private dealCommunityCards(count: number): void {
        const deckService = new Deck(this.state.round.deck);

        const cards = deckService.drawCards(count);

        this.state.round.communityCards = [...this.state.round.communityCards, ...cards];

        this.state.round.deck = deckService.remainingCards;
    }

    private advanceStage(): void {
        const activePlayers = this.getActivePlayers();

        const currentStage = this.state.round.stage;
        const nextStage = this.getNextStage(currentStage);

        const allPlayersAllIn = currentStage !== "ended" && this.areAllActivePlayersAllIn();

        if (currentStage !== "ended") {
            this.state.pots = PotManager.createPots(this.state);
            this.addPotUpdateStateChage();
        }

        this.state.players.forEach((player) => {
            if (player.isActive && player.chips > 0) {
                player.hasActed = false;
                player.currentRoundContribution = 0;
            } else {
                player.currentRoundContribution = 0;
            }
        });
        this.state.round.hasRaised = false;
        this.state.round.lastRaiseAmount = undefined;
        if (currentStage !== "ended") {
            this.addContributionMutation();
        }

        if (currentStage === "ended") {
            this.playersReadyToLeave();
            this.processSitOutPlayers();
            this.processEmptyStackPlayers();
            this.processLeaveBBAtHandEnd();
            this.mutations.push(
                new HandEnded({
                    round: {
                        stage: this.state.round.stage,
                        currentPlayer: this.state.round.currentPlayer,
                        lastAction: this.state.round.lastAction,
                        communityCards: this.state.round.communityCards,
                    },
                })
            );
            return;
        }

        if (allPlayersAllIn && this.state.round.stage !== "showdown") {
            const remainingCardsToDeal = 5 - this.state.round.communityCards.length;
            const ritCards = this.state.round.communityCards.length;
            const ritTruePlayers = new Set(
                this.state.players.filter((p) => p.rit === true && p.isActive === true)
            );

            if (remainingCardsToDeal > 0) {
                this.dealCommunityCards(remainingCardsToDeal);
                this.updatePlayersHandStrength();
            }

            if (
                ritTruePlayers.size ===
                    this.state.players.filter((p) => p.isActive === true).length &&
                remainingCardsToDeal !== 0
            ) {
                this.dealCommunityCards(remainingCardsToDeal);
                this.dealCommunityCards(ritCards);
                this.updatePlayersHandStrength();
            }

            this.state.round.stage = "showdown";
            this.addRoundMutation(this.state.round);
            this.determineWinner();
            return;
        }

        if (activePlayers.length <= 1) {
            this.state.round.stage = "showdown";
            this.addRoundMutation(this.state.round);
            this.determineWinner();
            return;
        }

        if (this.shouldGoToShowdown()) {
            const remainingCards = 5 - this.state.round.communityCards.length;
            if (remainingCards > 0) {
                this.dealCommunityCards(remainingCards);
                this.updatePlayersHandStrength();
            }
            this.state.round.stage = "showdown";
            this.addRoundMutation(this.state.round);
            this.determineWinner();
            return;
        }

        this.state.round.stage = nextStage;
        this.state.round.lastAction = undefined;

        switch (nextStage) {
            case "flop":
                this.dealCommunityCards(3);
                this.addRoundMutation(this.state.round);
                this.updatePlayersHandStrength();
                break;
            case "turn":
                this.dealCommunityCards(1);
                this.addRoundMutation(this.state.round);
                this.updatePlayersHandStrength();
                break;
            case "river":
                this.dealCommunityCards(1);
                this.addRoundMutation(this.state.round);
                this.updatePlayersHandStrength();

                break;
            case "showdown":
                this.determineWinner();
                this.addRoundMutation(this.state.round);
                this.updatePlayersHandStrength();
                return;
        }

        this.state.round.currentPlayer = this.getFirstActivePlayerAfterDealer();
        if (!this.state.round.currentPlayer) {
            this.determineWinner();
        }
        this.preCheckManager.updatePreChecks(this.state);
        this.addPrecheckMutations();
    }

    private areAllActivePlayersAllIn(): boolean {
        const activePlayers = this.getActivePlayers();

        if (activePlayers.length <= 1) return false;

        return activePlayers.every((player) => player.chips === 0);
    }

    private shouldGoToShowdown(): boolean {
        const activePlayers = this.getActivePlayers();

        if (activePlayers.length <= 1) {
            this.mutations.push(new ShowdownByFold({}));
            return true;
        }

        if (activePlayers.every((p) => p.chips === 0)) return true;

        if (this.state.round.communityCards.length === 5) return true;

        this.state.players.every((player) => {
            return (player.isActive && player.chips === 0) || !player.isActive;
        });

        if (activePlayers.length === 2 && activePlayers.some((p) => p.chips === 0)) {
            return true;
        }

        return false;
    }

    private getFirstActivePlayerAfterDealer(): string {
        const { players, dealerPosition } = this.state;

        const sorted = this.sortBySeat(players);

        if (!sorted || sorted.length === 0) return "";

        const dealerIndex = sorted.findIndex((p) => p.seat === dealerPosition);

        if (dealerIndex === -1) {
            const fallback = sorted.find((p) => p.isActive && p.chips > 0);
            const fallbackId = fallback ? fallback.id : "";
            this.mutations.push(new CurrentPlayer({ playerId: fallbackId }));
            return fallbackId;
        }

        for (let i = 1; i <= sorted.length; i++) {
            const idx = (dealerIndex + i) % sorted.length;
            const cand = sorted[idx];
            if (cand.isActive && cand.chips > 0) {
                this.mutations.push(new CurrentPlayer({ playerId: cand.id }));
                return cand.id;
            }
        }

        this.mutations.push(new CurrentPlayer({ playerId: "" }));
        return "";
    }

    private determineWinner(): void {
        const activePlayers = this.getActivePlayers();

        this.showdownManager.executeShowdown(
            activePlayers,
            this.state,
            this.evaluatePlayerHand.bind(this),
            this.distributePots.bind(this)
        );

        this.state.round.stage = "ended";
        this.advanceStage();
    }

    private distributePots(
        playerEvaluations: { player: Player; hand: Hand }[],
        pots = this.state.pots
    ): void {
        const potsAfterRake = PotManager.applyRake(
            pots,
            this.state.players.length,
            this.state.config.rake
        );
        for (const pot of potsAfterRake) {
            if (!pot || !pot.eligiblePlayers) continue;
            const eligiblePlayers = playerEvaluations.filter(
                (evaluation) => pot.eligiblePlayers.indexOf(evaluation.player.id) !== -1
            );

            if (eligiblePlayers.length === 0) continue;
            const hands = eligiblePlayers.map((evaluation) => evaluation.hand);
            const winningHands = Hand.winners(hands);

            const winners = eligiblePlayers.filter((evaluation) =>
                winningHands.some((winningHand) => winningHand === evaluation.hand)
            );

            if (winners.length > 0) {
                const share = Math.round((pot.amount / winners.length) * 100) / 100;
                const remainder = Math.round((pot.amount - share * winners.length) * 100) / 100;

                winners.forEach((winner, index) => {
                    const amount = share + (index === 0 ? remainder : 0);
                    const player = this.state.players.find((p) => p.id === winner.player.id);

                    if (player) {
                        player.chips += amount;

                        const rest = this.toPublicView(player);

                        const winningCards = this.convertToCards(winner.hand.cards || []);

                        this.mutations.push(
                            new WinnerDeclared({
                                player: rest,
                                hand: winner.hand.descr.replace(/[hdcs]( High)$/, "$1"),
                                amount,
                                name: winner.hand.name,
                                cards: winningCards,
                            })
                        );
                    }
                });
            }
        }
    }

    private evaluatePlayerHand(
        holeCards: Card[],
        communityCards: Card[],
        variant: GameVariation
    ): any {
        const allCards = [...holeCards, ...communityCards];
        const cardStrings = allCards.map((card) => this.cardToString(card));

        switch (variant) {
            case "NLH":
                return Hand.solve(cardStrings, "standard");
            case "PLO":
            case "PLO5":
            case "PLO6":
                return this.solveOmahaHand(holeCards, communityCards);

            default:
                throw new Error(`Unsupported variant: ${variant}`);
        }
    }

    private solveOmahaHand(holeCards: Card[], communityCards: Card[]): any {
        if (communityCards.length === 0) {
            const cardStrings = holeCards.map((card) => this.cardToString(card));
            return Hand.solve(cardStrings, "standard");
        }
        const holeCombinations = this.getCombinations(holeCards, 2);
        const commCombinations = this.getCombinations(communityCards, 3);

        let bestHand: any = null;

        for (const holeCombo of holeCombinations) {
            for (const commCombo of commCombinations) {
                const cards = [...holeCombo, ...commCombo];
                const cardStrings = cards.map((card) => this.cardToString(card));
                const hand = Hand.solve(cardStrings, "standard");

                if (!bestHand || hand.rank > bestHand.rank) {
                    bestHand = hand;
                }
            }
        }

        return bestHand;
    }

    private calculateHandStrength(
        holeCards: Card[],
        communityCards: Card[],
        variant: GameVariation
    ): HandStrength {
        const allCards = [...holeCards, ...communityCards];
        const cardStrings = allCards.map((card) => this.cardToString(card));

        let bestHand: any;

        if (variant === "NLH") {
            bestHand = Hand.solve(cardStrings, "standard");
        } else {
            bestHand = this.calculateOmahaHandStrength(holeCards, communityCards);
        }

        return {
            name: bestHand.name,
            description: bestHand.descr.replace(/[hdcs]( High)$/, "$1"),
            cards: this.convertToCards(bestHand.cards),
            confidence: this.state.round.stage === "showdown" ? "exact" : "possible",
        };
    }

    private calculateOmahaHandStrength(holeCards: Card[], communityCards: Card[]): any {
        if (communityCards.length === 0) {
            const holeCombinations = this.getCombinations(holeCards, 2);
            const allHands = holeCombinations.map((holeCombo) => {
                const cardStrings = holeCombo.map(this.cardToString);
                return Hand.solve(cardStrings, "standard");
            });
            return Hand.winners(allHands)[0];
        }

        const holeCombinations = this.getCombinations(holeCards, 2);
        const commCombinations = this.getCombinations(
            communityCards,
            Math.min(3, communityCards.length)
        );

        const allHands: any[] = [];
        for (const holeCombo of holeCombinations) {
            for (const commCombo of commCombinations) {
                const cards = [...holeCombo, ...commCombo];
                const cardStrings = cards.map(this.cardToString);
                allHands.push(Hand.solve(cardStrings, "standard"));
            }
        }

        return allHands.length > 0 ? Hand.winners(allHands)[0] : null;
    }

    private getCombinations<T>(array: T[], k: number): T[][] {
        if (k > array.length || k <= 0) return [];
        if (k === array.length) return [array];
        if (k === 1) return array.map((item) => [item]);

        const combs: T[][] = [];
        for (let i = 0; i <= array.length - k; i++) {
            const head = array.slice(i, i + 1);
            const tailCombs = this.getCombinations(array.slice(i + 1), k - 1);
            for (const tail of tailCombs) {
                combs.push([...head, ...tail]);
            }
        }
        return combs;
    }

    private cardToString(card: Card): string {
        const rankMap: Record<Rank, string> = {
            "2": "2",
            "3": "3",
            "4": "4",
            "5": "5",
            "6": "6",
            "7": "7",
            "8": "8",
            "9": "9",
            "10": "T",
            J: "J",
            Q: "Q",
            K: "K",
            A: "A",
        };

        const suitLetter = card.suit.charAt(0).toLowerCase();

        return rankMap[card.rank] + suitLetter;
    }

    private convertToCards(cards: any[]): Card[] {
        const rankMap: Record<string, Rank> = {
            "2": "2",
            "3": "3",
            "4": "4",
            "5": "5",
            "6": "6",
            "7": "7",
            "8": "8",
            "9": "9",
            T: "10",
            J: "J",
            Q: "Q",
            K: "K",
            A: "A",
        };

        const suitMap: Record<string, Suit> = {
            h: "hearts",
            d: "diamonds",
            c: "clubs",
            s: "spades",
        };

        return cards.map((card) => {
            const rankStr = card.value.toString();
            const suitChar = card.suit.toLowerCase();

            return {
                rank: rankMap[rankStr],
                suit: suitMap[suitChar],
            };
        });
    }

    private updatePlayersHandStrength(): void {
        const communityCards = this.state.round.communityCards;
        this.state.players.forEach((player) => {
            if (player.isActive) {
                const handStrength = this.calculateHandStrength(
                    player.hand,
                    communityCards,
                    this.state.gameVariant
                );
                player.handStrength = handStrength;
            } else {
                player.handStrength = null;
            }
        });
        this.mutations.push(
            new PlayerHandStrength({
                players: this.state.players.map((p) => ({
                    playerId: p.id,
                    handStrength: p.handStrength!,
                })),
            })
        );
    }

    protected toPublicView(player: Player): PlayerPublicView {
        const { hand, handStrength, ...publicView } = player;
        return publicView;
    }

    private addRoundMutation(round: RoundState): void {
        const stage = round.stage;
        const roundState = {
            stage: round.stage,
            currentPlayer: round.currentPlayer,
            lastAction: round.lastAction,
            communityCards: round.communityCards,
        };
        switch (stage) {
            case "preflop":
                this.mutations.push(
                    new PreflopBegin({
                        round: roundState,
                    })
                );
                break;
            case "flop":
                this.mutations.push(
                    new FlopBegin({
                        round: roundState,
                    })
                );
                break;
            case "turn":
                this.mutations.push(
                    new TurnBegin({
                        round: roundState,
                    })
                );
                break;
            case "river":
                this.mutations.push(
                    new RiverBegin({
                        round: roundState,
                    })
                );
                break;
            case "showdown": {
                const activePlayers = this.state.players.filter((p) => p.isActive);
                const showdownPlayers =
                    activePlayers.length >= 2
                        ? activePlayers.map((p) => ({ id: p.id, hand: p.hand }))
                        : [];
                this.mutations.push(
                    new Showdown({
                        round: roundState,
                        players: showdownPlayers,
                    })
                );
                break;
            }

            default:
                break;
        }
    }

    private addActionMutation(player: Player, preCheck: PlayerAction): void {
        const rest = this.toPublicView(player);
        switch (preCheck.type) {
            case "call":
                this.mutations.push(new CallAction({ player: rest, action: preCheck }));
                break;
            case "all-in":
                this.mutations.push(new AllInAction({ player: rest, action: preCheck }));
                break;
            case "raise":
                this.mutations.push(new RaiseAction({ player: rest, action: preCheck }));
                break;
            case "check":
                this.mutations.push(new CheckAction({ player: rest, action: preCheck }));
                break;
            case "fold":
                this.mutations.push(new FoldAction({ player: rest, action: preCheck }));
                break;
            case "bet":
                this.mutations.push(new BetAction({ player: rest, action: preCheck }));
                break;

            default:
                break;
        }
    }

    private addContributionMutation(): void {
        const contributions = this.state.players.map((player) => ({
            playerId: player.id,
            chips: player.chips,
            currentRoundContribution: player.currentRoundContribution,
        }));

        this.mutations.push(new CurrentRoundContribution({ contributions }));
    }

    private addPrecheckMutations(): void {
        const preChecks = this.state.players.map((player) => ({
            playerId: player.id,
            precheck: player.preChecks,
        }));
        this.mutations.push(new PreChecksUpdates({ preChecks }));
    }

    private addPotUpdateStateChage(): void {
        const potsTotal = this.state.pots.reduce((total, pot) => total + pot.amount, 0);
        const currentRoundContributionsTotal = this.state.players.reduce(
            (sum, p) => sum + p.currentRoundContribution,
            0
        );

        this.mutations.push(
            new PotUpdates({
                pots: this.state.pots,
                totalPot: potsTotal + currentRoundContributionsTotal,
            })
        );
    }

    protected onBeforeDealHoleCards(): void {}

    protected canPlayerSitOut(_player: Player): boolean {
        return true;
    }

    protected canPlayerLeave(_player: Player): boolean {
        return true;
    }

    protected canPlayerAddChips(_player: Player, _chips: number): boolean {
        return true;
    }

    protected canPlayerRebuy(_player: Player, _chips: number): boolean {
        return true;
    }
}
