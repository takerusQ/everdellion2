import * as React from "react";
import styles from "../styles/gameBoard.module.css";
import {
  CardName,
  EventNameToPlayerId,
  EventName,
  LocationNameToPlayerIds,
  LocationName,
  LocationType,
  EventType,
} from "../model/types";
import { Player } from "../model/player";
import { GameState } from "../model/gameState";
import { Event as EventModel } from "../model/event";
import { Location as LocationModel } from "../model/location";

import GameLog from "./GameLog";
import Card, { PlayedCard } from "./Card";
import Location from "./Location";
import Event from "./Event";
import { GameBlock, ItemWrapper } from "./common";

export const Meadow: React.FC<{ meadowCards: CardName[] }> = ({
  meadowCards,
}) => {
  return (
    <GameBlock title={"Meadow"}>
      <div className={styles.items_no_wrap}>
        {meadowCards.slice(0, 4).map((cardName, idx) => (
          <ItemWrapper key={idx}>
            <Card name={cardName} />
          </ItemWrapper>
        ))}
      </div>
      <div className={styles.items_no_wrap}>
        {meadowCards.slice(4).map((cardName, idx) => (
          <ItemWrapper key={idx}>
            <Card name={cardName} />
          </ItemWrapper>
        ))}
      </div>
    </GameBlock>
  );
};

export const Locations: React.FC<{
  gameState: GameState;
  viewingPlayer: Player;
}> = ({ gameState, viewingPlayer }) => {
  const locationsMap = gameState.locationsMap;
  const allLocations = Object.keys(locationsMap) as LocationName[];
  const allLocationObjs = allLocations.map((x) => LocationModel.fromName(x));

  const allForestLocationObjs = allLocationObjs.filter(
    (x) => x.type === LocationType.FOREST
  );
  const allBasicLocationObjs = allLocationObjs.filter(
    (x) => x.type === LocationType.BASIC
  );
  const allJourneyLocationObjs = allLocationObjs.filter(
    (x) => x.type === LocationType.JOURNEY
  );
  const allHavenLocationObjs = allLocationObjs.filter(
    (x) => x.type === LocationType.HAVEN
  );

  const renderLocationWithPlayerNames = (name: LocationName) => {
    return (
      <Location
        key={name}
        name={name}
        gameState={gameState}
        viewingPlayer={viewingPlayer}
        playerWorkers={(locationsMap[name] || []).map(
          (pId) => gameState.getPlayer(pId).name
        )}
      />
    );
  };

  return (
    <GameBlock title={"Locations"}>
      <div className={styles.location_items}>
        {allForestLocationObjs.map((location, idx) => {
          return renderLocationWithPlayerNames(location.name);
        })}
      </div>
      <div className={styles.location_items}>
        {allBasicLocationObjs.map((location, idx) => {
          return renderLocationWithPlayerNames(location.name);
        })}
      </div>
      <div className={styles.location_items}>
        {allJourneyLocationObjs.map((location, idx) => {
          return renderLocationWithPlayerNames(location.name);
        })}
      </div>
      <div className={styles.location_items}>
        {allHavenLocationObjs.map((location, idx) => {
          return renderLocationWithPlayerNames(location.name);
        })}
      </div>
    </GameBlock>
  );
};

export const ForestLocations: React.FC<{
  gameState: GameState;
  viewingPlayer: Player;
}> = ({ gameState, viewingPlayer }) => {
  const locationsMap = gameState.locationsMap;
  const allLocations = Object.keys(locationsMap) as LocationName[];
  const allLocationObjs = allLocations.map((x) => LocationModel.fromName(x));
  const allForestLocationObjs = allLocationObjs.filter(
    (x) => x.type === LocationType.FOREST
  );
  const renderLocationWithPlayerNames = (name: LocationName) => {
    return (
      <Location
        key={name}
        name={name}
        gameState={gameState}
        viewingPlayer={viewingPlayer}
        playerWorkers={(locationsMap[name] || []).map(
          (pId) => gameState.getPlayer(pId).name
        )}
      />
    );
  };

  return (
    <GameBlock title={"Forest Locations"}>
      <div className={styles.forest_locations}>
        {allForestLocationObjs.map((location, idx) => {
          return renderLocationWithPlayerNames(location.name);
        })}
      </div>
    </GameBlock>
  );
};

export const Events: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const renderClaimedEvent = (name: EventName) => {
    const playerId = gameState.eventsMap[name];
    const claimedBy = playerId ? gameState.getPlayer(playerId).name : null;
    return <Event key={name} name={name} claimedBy={claimedBy} />;
  };
  const allEvents = Object.keys(gameState.eventsMap) as EventName[];
  const allEventObj = allEvents.map((eventName) =>
    EventModel.fromName(eventName)
  );

  return (
    <GameBlock title={"Events"}>
      <div className={styles.items}>
        {allEventObj
          .filter((event) => {
            return event.type === EventType.BASIC;
          })
          .map((event) => renderClaimedEvent(event.name))}
      </div>
      <div className={styles.items}>
        {allEventObj
          .filter((event) => {
            return event.type !== EventType.BASIC;
          })
          .map((event) => renderClaimedEvent(event.name))}
      </div>
    </GameBlock>
  );
};

export const PlayerCity: React.FC<{ player: Player; viewerId: string }> = ({
  player,
  viewerId,
}) => {
  const playedCards = player.getAllPlayedCards();
  return playedCards.length !== 0 ? (
    <div className={styles.items}>
      {playedCards.map((playedCard, idx) => (
        <ItemWrapper key={idx}>
          <PlayedCard
            playedCard={playedCard}
            viewerId={viewerId}
            cardOwner={player}
          />
        </ItemWrapper>
      ))}
    </div>
  ) : (
    <div className={styles.empty_city}>City is empty.</div>
  );
};

export const GameBoard: React.FC<{
  gameState: GameState;
  viewingPlayer: Player;
}> = ({ gameState, viewingPlayer }) => {
  return (
    <div className={styles.game_board}>
      <div>
        <div className={styles.game_board_meadow}>
          <Meadow meadowCards={gameState.meadowCards} />
        </div>
        <GameLog logs={gameState.gameLog} />
      </div>
      <div>
        <ForestLocations gameState={gameState} viewingPlayer={viewingPlayer} />
      </div>
      <div className={styles.game_board_events}>
        <Events gameState={gameState} />
      </div>
    </div>
  );
};
