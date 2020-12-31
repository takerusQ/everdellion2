import {
  Season,
  GameInputType,
  GameInput,
  GameInputPlayCard,
  GameInputClaimEvent,
  GameInputPlaceWorker,
  GameInputVisitDestinationCard,
  GameInputMultiStep,
  CardName,
  EventName,
  LocationName,
  LocationNameToPlayerIds,
  EventNameToPlayerId,
  PlayerIdsToAvailableDestinationCards,
  ResourceType,
} from "./types";
import { GameStateJSON } from "./jsonTypes";
import { Player } from "./player";
import { Card } from "./card";
import { CardStack, emptyCardStack } from "./cardStack";
import { Location, initialLocationsMap } from "./location";
import { Event, initialEventMap } from "./event";
import { initialDeck } from "./deck";

import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash/isEqual";
import omit from "lodash/omit";

const MEADOW_SIZE = 8;
const STARTING_PLAYER_HAND_SIZE = 5;

export class GameState {
  private _activePlayerId: Player["playerId"];
  readonly pendingGameInputs: GameInputMultiStep[];
  readonly players: Player[];
  readonly meadowCards: CardName[];
  readonly discardPile: CardStack;
  readonly deck: CardStack;
  readonly locationsMap: LocationNameToPlayerIds;
  readonly eventsMap: EventNameToPlayerId;

  constructor({
    activePlayerId,
    players,
    meadowCards,
    discardPile,
    deck,
    locationsMap,
    eventsMap,
    pendingGameInputs = [],
  }: {
    activePlayerId?: Player["playerId"];
    players: Player[];
    meadowCards: CardName[];
    discardPile: CardStack;
    deck: CardStack;
    locationsMap: LocationNameToPlayerIds;
    eventsMap: EventNameToPlayerId;
    pendingGameInputs: GameInputMultiStep[];
  }) {
    this.players = players;
    this.locationsMap = locationsMap;
    this.meadowCards = meadowCards;
    this.discardPile = discardPile;
    this.deck = deck;
    this.eventsMap = eventsMap;
    this._activePlayerId = activePlayerId || players[0].playerId;
    this.pendingGameInputs = pendingGameInputs;
  }

  get activePlayerId(): string {
    return this._activePlayerId;
  }

  toJSON(includePrivate: boolean): GameStateJSON {
    return cloneDeep({
      activePlayerId: this.activePlayerId,
      players: this.players.map((p) => p.toJSON(includePrivate)),
      meadowCards: this.meadowCards,
      locationsMap: this.locationsMap,
      eventsMap: this.eventsMap,
      pendingGameInputs: this.pendingGameInputs,
      deck: this.deck.toJSON(includePrivate),
      discardPile: this.discardPile.toJSON(includePrivate),
    });
  }

  nextPlayer(): void {
    const player = this.getActivePlayer();
    const playerIdx = this.players.indexOf(player);
    const nextPlayer = this.players[(playerIdx + 1) % this.players.length];
    this._activePlayerId = nextPlayer.playerId;
  }

  replenishMeadow(): void {
    while (this.meadowCards.length !== MEADOW_SIZE) {
      this.meadowCards.push(this.drawCard());
    }
  }

  removeCardFromMeadow(cardName: CardName): void {
    const idx = this.meadowCards.indexOf(cardName);
    if (idx === -1) {
      throw new Error(`Unable to remove meadow card ${cardName}`);
    } else {
      this.meadowCards.splice(idx, 1);
    }
  }

  clone(): GameState {
    return GameState.fromJSON(this.toJSON(true /* includePrivate */));
  }

  private handlePlayCardGameInput(gameInput: GameInputPlayCard): void {
    const card = Card.fromName(gameInput.card);
    const player = this.getActivePlayer();
    if (!card.canPlay(this, gameInput)) {
      throw new Error("Cannot take action");
    }
    if (!player.isPaymentOptionsValid(gameInput)) {
      throw new Error("Invalid payment options");
    }
    player.payForCard(this, gameInput);
    if (gameInput.fromMeadow) {
      this.removeCardFromMeadow(gameInput.card);
      this.replenishMeadow();
    } else {
      this.getActivePlayer().removeCardFromHand(gameInput.card);
    }
    card.play(this, gameInput);
  }

  private handlePlaceWorkerGameInput(gameInput: GameInputPlaceWorker): void {
    const location = Location.fromName(gameInput.location);
    if (!location.canPlay(this, gameInput)) {
      throw new Error("Cannot take action");
    }

    const player = this.getActivePlayer();
    player.placeWorkerOnLocation(gameInput.location);

    location.play(this, gameInput);

    this.locationsMap[gameInput.location]!.push(player.playerId);
  }

  private removeMultiStepGameInput(gameInput: GameInputMultiStep): void {
    const found = this.pendingGameInputs.find((pendingGameInput) => {
      return isEqual(
        omit(pendingGameInput, ["clientOptions"]),
        omit(gameInput, ["clientOptions"])
      );
    });
    if (!found) {
      throw new Error(`Invalid multi-step input`);
    }
    const idx = this.pendingGameInputs.indexOf(found);
    if (idx === -1) {
      throw new Error(`Invalid multi-step input`);
    } else {
      this.pendingGameInputs.splice(idx, 1);
    }
  }

  private handleMultiStepGameInput(gameInput: GameInputMultiStep): void {
    this.removeMultiStepGameInput(gameInput);

    if (gameInput.cardContext) {
      const card = Card.fromName(gameInput.cardContext);
      if (!card.canPlay(this, gameInput)) {
        throw new Error("Cannot take action");
      }
      card.play(this, gameInput);
      return;
    }

    if (gameInput.locationContext) {
      const location = Location.fromName(gameInput.locationContext);
      if (!location.canPlay(this, gameInput)) {
        throw new Error("Cannot take action");
      }
      location.play(this, gameInput);
      return;
    }

    if (gameInput.eventContext) {
      const event = Event.fromName(gameInput.eventContext as EventName);
      if (!event.canPlay(this, gameInput)) {
        throw new Error("event cannot be played");
      }
      event.play(this, gameInput);
      return;
    }

    throw new Error(`Unhandled game input: ${JSON.stringify(gameInput)}`);
  }

  public handleClaimEventGameInput(gameInput: GameInputClaimEvent): void {
    const event = Event.fromName(gameInput.event);
    if (!event.canPlay(this, gameInput)) {
      throw new Error("Cannot play this event");
    }
    event.play(this, gameInput);
    this.eventsMap[gameInput.event] = this._activePlayerId;
  }

  public handleVisitDestinationCardGameInput(
    gameInput: GameInputVisitDestinationCard
  ): void {
    const card = Card.fromName(gameInput.card);
    const cardOwner = this.getPlayer(gameInput.playerId);
    const activePlayer = this.getActivePlayer();
    const activePlayerOwnsCard = cardOwner.playerId === activePlayer.playerId;

    activePlayer.placeWorkerOnCard(card.name, cardOwner);

    // If card isn't owned by active player, pay the other player a VP
    if (!activePlayerOwnsCard) {
      cardOwner.gainResources({ [ResourceType.VP]: 1 });
    }

    // Take card's effect
    card.play(this, gameInput);
  }

  next(gameInput: GameInput): GameState {
    const nextGameState = this.clone();
    switch (gameInput.inputType) {
      case GameInputType.PLAY_CARD:
        nextGameState.handlePlayCardGameInput(gameInput);
        break;
      case GameInputType.PLACE_WORKER:
        nextGameState.handlePlaceWorkerGameInput(gameInput);
        break;
      case GameInputType.VISIT_DESTINATION_CARD:
        nextGameState.handleVisitDestinationCardGameInput(gameInput);
        break;
      case GameInputType.SELECT_CARD:
      case GameInputType.SELECT_MULTIPLE_CARDS:
      case GameInputType.SELECT_PLAYER:
      case GameInputType.SELECT_RESOURCES:
      case GameInputType.DISCARD_CARDS:
        nextGameState.handleMultiStepGameInput(gameInput);
        break;
      case GameInputType.CLAIM_EVENT:
        nextGameState.handleClaimEventGameInput(gameInput);
        break;
      default:
        throw new Error(`Unhandled game input: ${JSON.stringify(gameInput)}`);
    }

    // If there's pending game inputs, don't go to the next player.
    if (nextGameState.pendingGameInputs.length === 0) {
      nextGameState.nextPlayer();
    }

    return nextGameState;
  }

  static fromJSON(gameStateJSON: GameStateJSON): GameState {
    return new GameState({
      ...gameStateJSON,
      deck: CardStack.fromJSON(gameStateJSON.deck),
      discardPile: CardStack.fromJSON(gameStateJSON.discardPile),
      players: gameStateJSON.players.map((pJSON: any) =>
        Player.fromJSON(pJSON)
      ),
    });
  }

  static initialGameState({
    players,
    shuffleDeck = true,
  }: {
    players: Player[];
    shuffleDeck?: boolean;
  }): GameState {
    if (players.length < 2) {
      throw new Error(`Unable to create a game with ${players.length} players`);
    }

    const gameState = new GameState({
      players,
      meadowCards: [],
      deck: initialDeck(),
      discardPile: emptyCardStack(),
      locationsMap: initialLocationsMap(players.length),
      eventsMap: initialEventMap(),
      pendingGameInputs: [],
    });

    if (shuffleDeck) {
      gameState.deck.shuffle();
    }

    // Players draw cards
    players.forEach((p, idx) => {
      p.drawCards(gameState, STARTING_PLAYER_HAND_SIZE + idx);
    });

    // Draw cards onto the meadow
    gameState.replenishMeadow();

    return gameState;
  }

  getActivePlayer(): Player {
    return this.getPlayer(this.activePlayerId);
  }

  getPlayer(playerId: string): Player {
    const ret = this.players.find((player) => player.playerId === playerId);

    if (!ret) {
      throw new Error(`Unable to find player: ${playerId}`);
    }
    return ret;
  }

  drawCard(): CardName {
    if (!this.deck.isEmpty) {
      return this.deck.drawInner();
    }

    while (!this.discardPile.isEmpty) {
      this.deck.addToStack(this.discardPile.drawInner());
    }

    this.deck.shuffle();
    if (!this.deck.isEmpty) {
      return this.drawCard();
    }

    throw new Error("No more cards to draw");
  }

  private getEligibleEventGameInputs = (): GameInput[] => {
    const keys = (Object.keys(this.eventsMap) as unknown) as EventName[];
    return keys
      .map((eventName) => {
        return {
          inputType: GameInputType.CLAIM_EVENT as const,
          playerId: this.activePlayerId,
          event: eventName,
        };
      })
      .filter((gameInput) => {
        const event = Event.fromName(gameInput.event);
        return event.canPlay(this, gameInput);
      });
  };

  private getAvailableLocationGameInputs = (): GameInput[] => {
    const keys = (Object.keys(this.locationsMap) as unknown) as LocationName[];
    return keys
      .map((locationName) => {
        return {
          inputType: GameInputType.PLACE_WORKER as const,
          playerId: this.activePlayerId,
          location: locationName,
        };
      })
      .filter((gameInput) => {
        const location = Location.fromName(gameInput.location);
        return location.canPlay(this, gameInput);
      });
  };

  private getAvailableDestinationCardGameInputs = (): GameInput[] => {
    const destinationCardsToPlayers: PlayerIdsToAvailableDestinationCards = {};

    // get open destination cards of other players
    this.players.forEach((player) => {
      const availableDestinationCards: CardName[] = player.getAvailableOpenDestinationCards();

      const playerId = player.playerId;

      destinationCardsToPlayers[playerId] = availableDestinationCards;
    });

    const activePlayer = this.getActivePlayer();
    const activePlayerId: string = this.activePlayerId;
    const availableClosedDestinationCards = activePlayer.getAvailableClosedDestinationCards();
    destinationCardsToPlayers[activePlayerId].push(
      ...availableClosedDestinationCards
    );

    // create the game inputs for these cards
    const gameInputs: GameInput[] = [];
    const playerIds = Object.keys(destinationCardsToPlayers);

    playerIds.forEach((player) => {
      const cards = destinationCardsToPlayers[player];
      cards.forEach((cardName) => {
        gameInputs.push({
          inputType: GameInputType.VISIT_DESTINATION_CARD as const,
          playerId: this.activePlayerId,
          card: cardName as CardName,
        });
      });
    });

    return gameInputs;
  };

  getPossibleGameInputs(): GameInput[] {
    if (this.pendingGameInputs.length !== 0) {
      return this.pendingGameInputs;
    }

    const player = this.getActivePlayer();
    const playerId = player.playerId;
    const possibleGameInputs: GameInput[] = [];
    if (player.currentSeason === Season.AUTUMN) {
      possibleGameInputs.push({
        inputType: GameInputType.GAME_END,
      });
    } else {
      possibleGameInputs.push({
        inputType: GameInputType.PREPARE_FOR_SEASON,
      });
    }

    if (player.numAvailableWorkers > 0) {
      possibleGameInputs.push(...this.getAvailableLocationGameInputs());

      possibleGameInputs.push(...this.getEligibleEventGameInputs());

      possibleGameInputs.push(...this.getAvailableDestinationCardGameInputs());
    }

    possibleGameInputs.push(
      ...this.meadowCards
        .map((cardName) => {
          return {
            inputType: GameInputType.PLAY_CARD as const,
            playerId,
            card: cardName,
            fromMeadow: true,
            paymentOptions: {
              resources: {},
            },
          };
        })
        .filter((gameInput) =>
          Card.fromName(gameInput.card).canPlay(this, gameInput)
        ),
      ...this.getActivePlayer()
        .cardsInHand.map((cardName) => {
          return {
            inputType: GameInputType.PLAY_CARD as const,
            playerId,
            card: cardName,
            fromMeadow: false,
            paymentOptions: {
              resources: {},
            },
          };
        })
        .filter((gameInput) =>
          Card.fromName(gameInput.card).canPlay(this, gameInput)
        )
    );

    return possibleGameInputs;
  }
}

export type GameStatePlayFn = (
  gameState: GameState,
  gameInput: GameInput
) => void;

export type GameStateCanPlayFn = (
  gameState: GameState,
  gameInput: GameInput
) => boolean;

export interface GameStatePlayable {
  canPlay: GameStateCanPlayFn;
  play: GameStatePlayFn;
}

export type GameStateCountPointsFn = (
  gameState: GameState,
  playerId: string
) => number;
